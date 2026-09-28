/**
 * 마감 경로 회귀 가드 — (1) 순차 왕복 깊이, (2) 마감 이벤트 판정 규칙.
 *
 * Supabase 호출(쿼리·auth.getUser) 하나하나에 고정 지연(LATENCY_MS)을 주는 가짜 클라이언트로
 * 실제 actionCloseDailyLog 를 돌린다. 걸린 시간 ÷ LATENCY_MS = "앞 호출이 끝나야 시작되는
 * 왕복" 단계 수. AI 는 키 미설정 → 즉시 폴백이라 측정에서 빠진다.
 *
 * 배경: 마감 뒤 판정기 8개가 순차로 돌며 각자 auth.getUser + getSettings + 쿼리를 해서
 * 평범한 평일 마감이 20단계(인증 10회)였다. React.cache 는 Server Action 안에서 동작하지
 * 않아(요청 스코프 없음 — 실측 확인) 중복 제거도 안 됐다. 그래서 여기서도 cache 를 흉내내지 않는다.
 */
import { vi, describe, it, expect, beforeEach } from "vitest";
import type { DailyLog } from "@/lib/types";
import { mockDailyLogRow, mockSettingsRow, mockUser } from "@/tests/fixtures/mock-data";

const LATENCY_MS = 25;

interface Fixture {
  settings: Record<string, unknown>;
  achievements: string[];
  prevWeight: number | null; // 이 날짜 이전 가장 최근 체중
  prevMin: number | null; // 이 날짜 이전 역대 최저
  dates: string[]; // 기록 존재 날짜 (연속 기록 판정)
  weeklyAvgs: number[]; // 최신순 주평균
}

let fx: Fixture;
const calls = { auth: 0, query: 0 };
const inserts: Record<string, unknown>[] = [];

function delay<T>(v: T): Promise<T> {
  return new Promise((r) => setTimeout(() => r(v), LATENCY_MS));
}

/** 체이닝 가능한 쿼리 빌더 — await 시점에 1왕복 */
function builder(table: string, op: string, payload?: unknown) {
  let mode: "list" | "single" | "maybe" = "list";
  let orderCol = "";
  let cols = "";
  const resolveData = () => {
    if (op === "insert") {
      inserts.push(payload as Record<string, unknown>);
      return null;
    }
    if (table === "settings") return fx.settings;
    if (table === "achievements") return fx.achievements.map((type) => ({ type }));
    if (table === "weekly_logs") return fx.weeklyAvgs.map((avg_weight) => ({ avg_weight }));
    if (table === "daily_logs") {
      if (op === "upsert") return { ...mockDailyLogRow, ...(payload as object), closed: true };
      if (mode === "maybe") {
        const w = orderCol === "weight" ? fx.prevMin : fx.prevWeight;
        return w === null ? null : { weight: w };
      }
      if (mode === "single") return mockDailyLogRow;
      if (cols === "date") return fx.dates.map((date) => ({ date }));
      return [mockDailyLogRow];
    }
    return null;
  };
  const b: Record<string, unknown> = {};
  const chain = () => b;
  for (const m of ["eq", "lt", "lte", "gte", "not", "like", "limit", "in"]) b[m] = chain;
  b.select = (c: string) => { cols = c; return b; };
  b.order = (c: string) => { orderCol = c; return b; };
  b.single = () => { mode = "single"; return b; };
  b.maybeSingle = () => { mode = "maybe"; return b; };
  b.then = (res: (v: unknown) => void, rej: (e: unknown) => void) => {
    calls.query++;
    return delay({ data: resolveData(), error: null, count: fx.dates.length }).then(res, rej);
  };
  return b;
}

function fakeClient() {
  return {
    auth: { getUser: () => { calls.auth++; return delay({ data: { user: mockUser } }); } },
    from: (table: string) => ({
      select: (c: string) => (builder(table, "select").select as (c: string) => unknown)(c),
      upsert: (row: unknown) => builder(table, "upsert", row),
      insert: (row: unknown) => builder(table, "insert", row),
      update: () => builder(table, "update"),
      delete: () => builder(table, "delete"),
    }),
  };
}

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => fakeClient(),
  getAuthUser: async () => (await fakeClient().auth.getUser()).data.user,
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => fakeClient() }));

import { actionCloseDailyLog } from "@/app/actions/log-actions";

function log(date: string, weight: number | null, day = 16): DailyLog {
  return {
    date, day, weight, avgWeight3d: null, weightChange: null, water: 2, exercise: "Y",
    breakfast: "a", lunch: "b", dinner: "c", lateSnack: "N", note: null, closed: false,
    intensiveDay: false, feedback: null, dailySummary: null, oneLiner: null,
  };
}

beforeEach(() => {
  calls.auth = 0;
  calls.query = 0;
  inserts.length = 0;
  delete process.env.OPENROUTER_API_KEY;
  vi.spyOn(console, "info").mockImplementation(() => {});
  fx = {
    settings: { ...mockSettingsRow }, // 시작 85 / 목표 70 / 시작일 2024-01-01
    achievements: [],
    prevWeight: 81,
    prevMin: 80,
    dates: ["2024-01-16", "2024-01-15"],
    weeklyAvgs: [],
  };
});

describe("마감 경로 순차 왕복 깊이", () => {
  it("평일 마감 · 이벤트 없음: 인증 1회, 순차 4단계 이하 (예전 20단계 · 인증 10회)", async () => {
    const t0 = performance.now();
    const res = await actionCloseDailyLog("2024-01-16", log("2024-01-16", 80.5));
    const depth = Math.round((performance.now() - t0) / LATENCY_MS);

    expect(res.log?.closed).toBe(true);
    expect(res.goalEvent).toBeNull();
    expect(res.milestoneEvent).toBeNull();
    expect(calls.auth).toBe(1);
    expect(depth).toBeLessThanOrEqual(4);
  });
});

describe("마감 이벤트 판정 규칙 (병렬 판정 후에도 유지)", () => {
  it("최초 목표 달성 → 풀 세리머니 + goal_reached 1행만 기록", async () => {
    const res = await actionCloseDailyLog("2024-01-16", log("2024-01-16", 69.8));
    expect(res.goalEvent?.kind).toBe("first");
    expect(res.goalEvent?.snapshot.finalWeight).toBe(69.8);
    expect(res.milestoneEvent).toBeNull();
    expect(inserts.map((r) => r.type)).toEqual(["goal_reached"]);
  });

  it("목표 이하 유지 중(직전도 목표 이하) → 목표 이벤트 없음, 마일스톤으로 넘어감", async () => {
    fx.achievements = ["goal_reached", "milestone_5", "milestone_10", "milestone_15"];
    fx.prevWeight = 69.9;
    fx.prevMin = 69.5;
    const res = await actionCloseDailyLog("2024-01-16", log("2024-01-16", 69.7));
    expect(res.goalEvent).toBeNull();
    expect(res.milestoneEvent).toBeNull(); // 최저 갱신 아님, 감량 15kg 미도달
    expect(inserts).toEqual([]);
  });

  it("재달성(직전 목표 위 → 목표 이하 복귀) → 미니 토스트, 기록 안 함", async () => {
    fx.achievements = ["goal_reached"];
    fx.prevWeight = 70.4;
    const res = await actionCloseDailyLog("2024-01-16", log("2024-01-16", 69.9));
    expect(res.goalEvent?.kind).toBe("repeat");
    expect(inserts).toEqual([]);
  });

  it("감량 마일스톤과 역대 최저가 동시에 걸리면 우선순위 높은 감량 하나만 — 기록도 1행", async () => {
    fx.achievements = ["eta_30", "eta_14", "eta_7"]; // 더 높은 우선순위(D-day)는 이미 소진
    fx.prevMin = 80.2; // 79.9 는 역대 최저이기도 함
    const res = await actionCloseDailyLog("2024-01-16", log("2024-01-16", 79.9));
    expect(res.milestoneEvent).toEqual({ kind: "loss", lostKg: 5 });
    expect(inserts.map((r) => r.type)).toEqual(["milestone_5"]);
  });

  it("역대 최저 갱신은 축하하되 기록하지 않는다 (반복 가능)", async () => {
    fx.prevMin = 80.6;
    const res = await actionCloseDailyLog("2024-01-16", log("2024-01-16", 80.5));
    expect(res.milestoneEvent).toEqual({ kind: "lowest", weight: 80.5 });
    expect(inserts).toEqual([]);
  });

  it("연속 기록 10일 — 체중 없이 마감해도 판정된다", async () => {
    fx.dates = Array.from({ length: 10 }, (_, i) => `2024-01-${String(16 - i).padStart(2, "0")}`);
    const res = await actionCloseDailyLog("2024-01-16", log("2024-01-16", null));
    expect(res.milestoneEvent).toEqual({ kind: "streak", streakDays: 10 });
    expect(inserts.map((r) => r.type)).toEqual(["streak_10"]);
  });

  it("이미 축하한 마일스톤은 다시 뜨지 않는다", async () => {
    fx.achievements = ["milestone_5", "eta_30", "eta_14", "eta_7"];
    fx.prevMin = 79.5;
    const res = await actionCloseDailyLog("2024-01-16", log("2024-01-16", 79.9));
    expect(res.milestoneEvent).toBeNull();
    expect(inserts).toEqual([]);
  });

  it("D-day 예측이 감량 마일스톤보다 먼저 (우선순위)", async () => {
    const res = await actionCloseDailyLog("2024-01-16", log("2024-01-16", 79.9));
    expect(res.milestoneEvent).toEqual({ kind: "eta", etaDays: 30 });
    expect(inserts.map((r) => r.type)).toEqual(["eta_30"]);
  });

  it("N주 연속 감량", async () => {
    fx.weeklyAvgs = [80, 81, 82];
    const res = await actionCloseDailyLog("2024-01-16", log("2024-01-16", 80.5));
    expect(res.milestoneEvent).toEqual({ kind: "weeklyLoss", weeks: 2 });
    expect(inserts.map((r) => r.type)).toEqual(["weeklyloss_2"]);
  });
});
