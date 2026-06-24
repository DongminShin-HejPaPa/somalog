vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));
vi.mock("@/lib/services/settings-service", () => ({
  getSettings: vi.fn(),
}));
vi.mock("@/lib/services/weekly-log-service", () => ({
  upsertWeeklyLog: vi.fn().mockResolvedValue(undefined),
}));

import { vi, beforeEach } from "vitest";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/services/settings-service";
import { upsertWeeklyLog } from "@/lib/services/weekly-log-service";
import {
  mockDailyLogRow,
  mockDailyLog,
  mockSettings,
  mockUser,
  MOCK_USER_ID,
} from "@/tests/fixtures/mock-data";
import {
  getDailyLog,
  getRecentDailyLogs,
  upsertDailyLog,
  closeDailyLog,
  getWeightSeries,
  getLowestWeightEntry,
  getDailyLogsBefore,
  getDailyLogsFiltered,
  getEventSeries,
} from "@/lib/services/daily-log-service";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSettings).mockResolvedValue(mockSettings);
  vi.mocked(upsertWeeklyLog).mockResolvedValue({
    weekStart: "2024-01-15",
    weekEnd: "2024-01-21",
    avgWeight: 80,
    exerciseDays: 3,
    lateSnackCount: 1,
    weeklySummary: "",
  });
});

// ---------------------------------------------------------------------------
// getDailyLog
// ---------------------------------------------------------------------------

describe("getDailyLog", () => {
  it("TC-1: 유저 없음 → null", async () => {
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
      from: vi.fn(),
    };
    vi.mocked(createClient).mockResolvedValue(client as any);

    const result = await getDailyLog("2024-01-15");

    expect(result).toBeNull();
  });

  it("TC-2: DB에 없음 → null", async () => {
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          single: vi
            .fn()
            .mockResolvedValue({ data: null, error: { message: "Not found" } }),
        }),
      }),
    };
    vi.mocked(createClient).mockResolvedValue(client as any);

    const result = await getDailyLog("2024-01-15");

    expect(result).toBeNull();
  });

  it("TC-3: DB에 있음 → snake_case → camelCase 매핑", async () => {
    // 메인 조회는 single()로 row 반환, enrichSingleIntensiveDay의 최저/직전 조회는
    // maybeSingle()로 null(이전 로그 없음) 반환하도록 체인 가능한 mock 구성
    const chain: any = {
      eq: vi.fn(() => chain),
      lt: vi.fn(() => chain),
      not: vi.fn(() => chain),
      order: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      single: vi.fn().mockResolvedValue({ data: mockDailyLogRow, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
      },
      from: vi.fn(() => ({ select: vi.fn(() => chain) })),
    };
    vi.mocked(createClient).mockResolvedValue(client as any);

    const result = await getDailyLog("2024-01-15");

    expect(result).not.toBeNull();
    expect(result!.avgWeight3d).toBe(mockDailyLogRow.avg_weight_3d);
    expect(result!.weightChange).toBe(mockDailyLogRow.weight_change);
    expect(result!.lateSnack).toBe(mockDailyLogRow.late_snack);
    // intensiveDay는 이제 매핑이 아니라 '이 날짜 이전 최저' 기준 파생값.
    // 이전 로그가 없으면(lowest=Infinity) false 로 재계산된다.
    expect(result!.intensiveDay).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getRecentDailyLogs
// ---------------------------------------------------------------------------

describe("getRecentDailyLogs", () => {
  it("TC-4: 유저 없음 → []", async () => {
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
      from: vi.fn(),
    };
    vi.mocked(createClient).mockResolvedValue(client as any);

    const result = await getRecentDailyLogs(5);

    expect(result).toEqual([]);
  });

  it("TC-5: 정상 → 배열 반환", async () => {
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockImplementation((cols: string) => {
          if (cols === "*") {
            return {
              eq: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [mockDailyLogRow], error: null }),
              }),
            };
          }
          // "weight" — 최저 체중 쿼리
          return {
            eq: vi.fn().mockReturnThis(),
            not: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          };
        }),
      }),
    };
    vi.mocked(createClient).mockResolvedValue(client as any);

    const result = await getRecentDailyLogs(5);

    expect(result).toHaveLength(1);
    expect(result[0].date).toBe("2024-01-15");
  });
});

// ---------------------------------------------------------------------------
// upsertDailyLog
// ---------------------------------------------------------------------------

describe("upsertDailyLog", () => {
  it("TC-6: 유저 없음 → Error('Unauthorized') throw", async () => {
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
      from: vi.fn(),
    };
    vi.mocked(createClient).mockResolvedValue(client as any);

    await expect(
      upsertDailyLog("2024-01-15", { breakfast: "오트밀" })
    ).rejects.toThrow("Unauthorized");
  });

  it("TC-7: 신규 로그 + weight 없음 → upsert 1회 호출", async () => {
    const upsertSingle = vi
      .fn()
      .mockResolvedValue({
        data: { ...mockDailyLogRow, breakfast: "오트밀" },
        error: null,
      });
    const getSingle = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: "Not found" } });

    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          single: getSingle,
          order: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          lt: vi.fn().mockReturnThis(),
          neq: vi.fn().mockReturnThis(),
          not: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnValue({
            data: [],
            error: null,
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({ single: upsertSingle }),
        }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
    };
    vi.mocked(createClient).mockResolvedValue(client as any);

    const result = await upsertDailyLog("2024-01-15", { breakfast: "오트밀" });

    expect(upsertSingle).toHaveBeenCalledTimes(1);
    expect(result.date).toBe("2024-01-15");
  });

  it("TC-8: 신규 로그 + weight 있음 → weightChange, day 계산값 포함", async () => {
    const upsertedRow = {
      ...mockDailyLogRow,
      weight: 80,
      weight_change: -5,
      avg_weight_3d: 80,
      intensive_day: false,
    };
    const getSingle = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: { message: "Not found" } })
      .mockResolvedValueOnce({ data: upsertedRow, error: null });

    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          single: getSingle,
          order: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          lt: vi.fn().mockReturnThis(),
          neq: vi.fn().mockReturnThis(),
          not: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnValue({
            data: [],
            error: null,
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({ single: getSingle }),
        }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
    };
    vi.mocked(createClient).mockResolvedValue(client as any);

    const result = await upsertDailyLog("2024-01-15", { weight: 80 });

    expect(result.weight).toBe(80);
    expect(result.weightChange).toBe(-5);
    expect(result.day).toBeDefined();
  });

  it("TC-9: intensiveDayOn=false → intensiveDay가 null", async () => {
    vi.mocked(getSettings).mockResolvedValue({
      ...mockSettings,
      intensiveDayOn: false,
    });

    const upsertedRow = {
      ...mockDailyLogRow,
      weight: 80,
      intensive_day: null,
    };
    const getSingle = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: { message: "Not found" } })
      .mockResolvedValueOnce({ data: upsertedRow, error: null });

    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          single: getSingle,
          order: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          lt: vi.fn().mockReturnThis(),
          neq: vi.fn().mockReturnThis(),
          not: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnValue({
            data: [],
            error: null,
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({ single: getSingle }),
        }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
    };
    vi.mocked(createClient).mockResolvedValue(client as any);

    const result = await upsertDailyLog("2024-01-15", { weight: 80 });

    expect(result.intensiveDay).toBeNull();
  });

  it("TC-10: 기존 로그 수정 → existing 데이터와 merge", async () => {
    const upsertSingle = vi
      .fn()
      .mockResolvedValue({
        data: { ...mockDailyLogRow, breakfast: "새로운 아침" },
        error: null,
      });
    const getSingle = vi
      .fn()
      .mockResolvedValue({ data: mockDailyLogRow, error: null });

    const upsertFn = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({ single: upsertSingle }),
    });

    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          single: getSingle,
          order: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          lt: vi.fn().mockReturnThis(),
          neq: vi.fn().mockReturnThis(),
          not: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnValue({
            data: [],
            error: null,
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
        upsert: upsertFn,
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
    };
    vi.mocked(createClient).mockResolvedValue(client as any);

    await upsertDailyLog("2024-01-15", { breakfast: "새로운 아침" });

    expect(upsertFn.mock.calls[0][0]).toMatchObject({
      exercise: "Y",
      breakfast: "새로운 아침",
    });
  });

  it("TC-11: upsert 실패 → Error throw", async () => {
    const getSingle = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: "Not found" } });

    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          single: getSingle,
          order: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          lt: vi.fn().mockReturnThis(),
          neq: vi.fn().mockReturnThis(),
          not: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnValue({
            data: [],
            error: null,
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi
              .fn()
              .mockResolvedValue({
                data: null,
                error: { message: "DB error" },
              }),
          }),
        }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
    };
    vi.mocked(createClient).mockResolvedValue(client as any);

    await expect(
      upsertDailyLog("2024-01-15", { breakfast: "오트밀" })
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// closeDailyLog
// ---------------------------------------------------------------------------

describe("closeDailyLog", () => {
  it("TC-12: 유저 없음 → null", async () => {
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
      from: vi.fn(),
    };
    vi.mocked(createClient).mockResolvedValue(client as any);

    const result = await closeDailyLog("2024-01-15");

    expect(result).toBeNull();
  });

  it("TC-13: 로그 없음 → null", async () => {
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          single: vi
            .fn()
            .mockResolvedValue({ data: null, error: { message: "Not found" } }),
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
        }),
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi
              .fn()
              .mockResolvedValue({ data: null, error: { message: "Not found" } }),
          }),
        }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
    };
    vi.mocked(createClient).mockResolvedValue(client as any);

    const result = await closeDailyLog("2024-01-15");

    expect(result).toBeNull();
  });

  it("TC-14: 평일(화요일 '2024-01-16') 마감 → upsertWeeklyLog 미호출", async () => {
    const closedRow = { ...mockDailyLogRow, date: "2024-01-16", closed: true };
    const getSingle = vi
      .fn()
      .mockResolvedValueOnce({
        data: { ...mockDailyLogRow, date: "2024-01-16" },
        error: null,
      })
      .mockResolvedValueOnce({ data: closedRow, error: null });

    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          single: getSingle,
          order: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          lt: vi.fn().mockReturnThis(),
          neq: vi.fn().mockReturnThis(),
          not: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnValue({
            data: [],
            error: null,
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({ single: getSingle }),
        }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
    };
    vi.mocked(createClient).mockResolvedValue(client as any);

    const result = await closeDailyLog("2024-01-16");

    expect(vi.mocked(upsertWeeklyLog)).not.toHaveBeenCalled();
    expect(result!.closed).toBe(true);
  });

  it("TC-15: 일요일('2024-01-21') 마감 → upsertWeeklyLog 1회 호출", async () => {
    const sundayRow = { ...mockDailyLogRow, date: "2024-01-21" };
    const closedSundayRow = { ...sundayRow, closed: true };

    const getSingle = vi
      .fn()
      .mockResolvedValueOnce({ data: sundayRow, error: null })
      .mockResolvedValueOnce({ data: closedSundayRow, error: null });

    const weeklyQueryMock = vi
      .fn()
      .mockResolvedValue({ data: [sundayRow], error: null });

    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          single: getSingle,
          order: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: weeklyQueryMock,
          lt: vi.fn().mockReturnThis(),
          neq: vi.fn().mockReturnThis(),
          not: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnValue({
            data: [],
            error: null,
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({ single: getSingle }),
        }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
    };
    vi.mocked(createClient).mockResolvedValue(client as any);

    await closeDailyLog("2024-01-21");

    expect(vi.mocked(upsertWeeklyLog)).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// getWeightSeries (그래프 전용 경량 시리즈 — Phase 2)
// ---------------------------------------------------------------------------

describe("getWeightSeries", () => {
  it("TC-16: 유저 없음 → []", async () => {
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      from: vi.fn(),
    };
    vi.mocked(createClient).mockResolvedValue(client as any);

    expect(await getWeightSeries()).toEqual([]);
  });

  it("TC-17: date+weight 만 매핑해 반환 (무거운 컬럼 미포함, null 보존)", async () => {
    const rows = [
      { date: "2024-03-01", weight: 79.5 },
      { date: "2024-02-01", weight: null },
    ];
    const orderMock = vi.fn().mockResolvedValue({ data: rows, error: null });
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }) },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          order: orderMock,
        }),
      }),
    };
    vi.mocked(createClient).mockResolvedValue(client as any);

    const result = await getWeightSeries();

    expect(result).toEqual([
      { date: "2024-03-01", weight: 79.5 },
      { date: "2024-02-01", weight: null },
    ]);
    // 경량 쿼리: feedback/daily_summary 등 무거운 컬럼은 결과에 존재하지 않아야 함
    expect(Object.keys(result[0])).toEqual(["date", "weight"]);
  });

  it("TC-18: 에러 → []", async () => {
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }) },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } }),
        }),
      }),
    };
    vi.mocked(createClient).mockResolvedValue(client as any);

    expect(await getWeightSeries()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getLowestWeightEntry (전 기간 최저 — Phase 1 정확성 수정)
// ---------------------------------------------------------------------------

describe("getLowestWeightEntry", () => {
  it("TC-19: 유저 없음 → {Infinity, ''}", async () => {
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      from: vi.fn(),
    };
    vi.mocked(createClient).mockResolvedValue(client as any);

    expect(await getLowestWeightEntry()).toEqual({ weight: Infinity, date: "" });
  });

  it("TC-20: 최저가 365일보다 과거여도 정확히 반환한다 (회귀 방지)", async () => {
    // 기존 버그: 최근 365일만 훑어 1년 밖의 진짜 최저를 놓침.
    const lowestRow = { date: "2023-01-10", weight: 71.2 };
    const chain: any = {
      eq: vi.fn(() => chain),
      not: vi.fn(() => chain),
      order: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      maybeSingle: vi.fn().mockResolvedValue({ data: lowestRow, error: null }),
    };
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }) },
      from: vi.fn(() => ({ select: vi.fn(() => chain) })),
    };
    vi.mocked(createClient).mockResolvedValue(client as any);

    expect(await getLowestWeightEntry()).toEqual({ weight: 71.2, date: "2023-01-10" });
  });

  it("TC-21: 체중 기록이 하나도 없으면 {Infinity, ''}", async () => {
    const chain: any = {
      eq: vi.fn(() => chain),
      not: vi.fn(() => chain),
      order: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }) },
      from: vi.fn(() => ({ select: vi.fn(() => chain) })),
    };
    vi.mocked(createClient).mockResolvedValue(client as any);

    expect(await getLowestWeightEntry()).toEqual({ weight: Infinity, date: "" });
  });
});

// ---------------------------------------------------------------------------
// getDailyLogsBefore (keyset 페이지네이션 — Phase 5A)
// ---------------------------------------------------------------------------

describe("getDailyLogsBefore", () => {
  it("TC-22: 유저 없음 → []", async () => {
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      from: vi.fn(),
    };
    vi.mocked(createClient).mockResolvedValue(client as any);

    expect(await getDailyLogsBefore("2024-02-01", 30)).toEqual([]);
  });

  it("TC-23: cursorDate 이전 로그를 lt(date) 키셋으로 조회한다", async () => {
    const ltMock = vi.fn();
    const chain: any = {
      eq: vi.fn(() => chain),
      lt: vi.fn((...args: unknown[]) => {
        ltMock(...args);
        return chain;
      }),
      order: vi.fn(() => chain),
      limit: vi.fn().mockResolvedValue({ data: [mockDailyLogRow], error: null }),
    };
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }) },
      from: vi.fn(() => ({ select: vi.fn(() => chain) })),
    };
    vi.mocked(createClient).mockResolvedValue(client as any);

    const result = await getDailyLogsBefore("2024-02-01", 30);

    expect(ltMock).toHaveBeenCalledWith("date", "2024-02-01");
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe("2024-01-15");
  });
});

// ---------------------------------------------------------------------------
// getDailyLogsFiltered (서버 검색/필터 — Phase 4)
// ---------------------------------------------------------------------------

describe("getDailyLogsFiltered", () => {
  function makeFilterClient(orSpy?: (s: string) => void) {
    const chain: any = {
      eq: vi.fn(() => chain),
      or: vi.fn((s: string) => {
        orSpy?.(s);
        return chain;
      }),
      not: vi.fn(() => chain),
      neq: vi.fn(() => chain),
      lt: vi.fn(() => chain),
      gte: vi.fn(() => chain),
      lte: vi.fn(() => chain),
      order: vi.fn(() => chain),
      limit: vi.fn().mockResolvedValue({ data: [mockDailyLogRow], error: null }),
    };
    return {
      client: {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }) },
        from: vi.fn(() => ({ select: vi.fn(() => chain) })),
      },
      chain,
    };
  }

  it("TC-24: 유저 없음 → []", async () => {
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      from: vi.fn(),
    };
    vi.mocked(createClient).mockResolvedValue(client as any);

    expect(await getDailyLogsFiltered({ limit: 30 })).toEqual([]);
  });

  it("TC-25: 검색어 → 3개 식단 컬럼 ilike or-필터", async () => {
    let orArg = "";
    const { client } = makeFilterClient((s) => (orArg = s));
    vi.mocked(createClient).mockResolvedValue(client as any);

    const result = await getDailyLogsFiltered({ query: "닭가슴살", limit: 30 });

    expect(orArg).toContain("breakfast.ilike.%닭가슴살%");
    expect(orArg).toContain("lunch.ilike.%닭가슴살%");
    expect(orArg).toContain("dinner.ilike.%닭가슴살%");
    expect(result).toHaveLength(1);
  });

  it("TC-26: 검색어의 or-구문 위험문자(,()*%)는 제거된다", async () => {
    let orArg = "";
    const { client } = makeFilterClient((s) => (orArg = s));
    vi.mocked(createClient).mockResolvedValue(client as any);

    await getDailyLogsFiltered({ query: "닭, 가슴(살)*", limit: 30 });

    expect(orArg).not.toContain(",가슴");
    expect(orArg).not.toContain("(");
    expect(orArg).not.toContain(")");
    expect(orArg).toContain("닭");
  });

  it("TC-27: exercise 필터 → not/neq 조건 적용", async () => {
    const { client, chain } = makeFilterClient();
    vi.mocked(createClient).mockResolvedValue(client as any);

    await getDailyLogsFiltered({ filter: "exercise", limit: 30 });

    expect(chain.not).toHaveBeenCalledWith("exercise", "is", null);
    expect(chain.neq).toHaveBeenCalledWith("exercise", "N");
    expect(chain.neq).toHaveBeenCalledWith("exercise", "SKIP");
  });

  it("TC-28: intensive 필터 → prefix-min으로 정확한 날짜만 .in 조회", async () => {
    // 15(81)→16(79)→17(80): 17일만 '그 전 최저(79)'보다 높아 intensive.
    const seriesRows = [
      { date: "2024-01-17", weight: 80 },
      { date: "2024-01-16", weight: 79 },
      { date: "2024-01-15", weight: 81 },
    ];
    const inSpy = vi.fn();
    const seriesChain: any = {
      eq: vi.fn(() => seriesChain),
      order: vi.fn().mockResolvedValue({ data: seriesRows, error: null }),
    };
    const pageChain: any = {
      eq: vi.fn(() => pageChain),
      in: vi.fn((...a: unknown[]) => {
        inSpy(...a);
        return pageChain;
      }),
      or: vi.fn(() => pageChain),
      order: vi.fn(() => pageChain),
      limit: vi.fn().mockResolvedValue({
        data: [{ ...mockDailyLogRow, date: "2024-01-17" }],
        error: null,
      }),
    };
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }) },
      from: vi.fn(() => ({
        select: vi.fn((cols: string) => (cols === "date, weight" ? seriesChain : pageChain)),
      })),
    };
    vi.mocked(createClient).mockResolvedValue(client as any);
    // 기본 mockSettings: intensiveDayOn=true, criteria="역대최저"

    const result = await getDailyLogsFiltered({ filter: "intensive", limit: 30 });

    expect(inSpy).toHaveBeenCalledWith("date", ["2024-01-17"]);
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe("2024-01-17");
  });

  it("TC-29: intensiveDayOn=false → intensive 필터는 빈 결과", async () => {
    vi.mocked(getSettings).mockResolvedValue({ ...mockSettings, intensiveDayOn: false });
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }) },
      from: vi.fn(),
    };
    vi.mocked(createClient).mockResolvedValue(client as any);

    expect(await getDailyLogsFiltered({ filter: "intensive", limit: 30 })).toEqual([]);
  });

  it("TC-30: rangeStart/rangeEnd → gte/lte 로 챕터 범위 제한", async () => {
    const { client, chain } = makeFilterClient();
    vi.mocked(createClient).mockResolvedValue(client as any);

    await getDailyLogsFiltered({
      rangeStart: "2024-01-01",
      rangeEnd: "2024-01-31",
      limit: 30,
    });

    expect(chain.gte).toHaveBeenCalledWith("date", "2024-01-01");
    expect(chain.lte).toHaveBeenCalledWith("date", "2024-01-31");
  });
});

// ---------------------------------------------------------------------------
// getEventSeries (미니차트용 경량 이벤트 시리즈)
// ---------------------------------------------------------------------------

describe("getEventSeries", () => {
  it("TC-31: 유저 없음 → []", async () => {
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      from: vi.fn(),
    };
    vi.mocked(createClient).mockResolvedValue(client as any);

    expect(await getEventSeries(null, null)).toEqual([]);
  });

  it("TC-32: 범위 gte/lte 적용 + snake→camel 매핑(오름차순)", async () => {
    const gteSpy = vi.fn();
    const lteSpy = vi.fn();
    const rows = [
      {
        date: "2024-01-01",
        exercise: "Y",
        late_snack: "N",
        dinner_alcohol: true,
        late_snack_alcohol: null,
      },
    ];
    const chain: any = {
      eq: vi.fn(() => chain),
      gte: vi.fn((...a: unknown[]) => {
        gteSpy(...a);
        return chain;
      }),
      lte: vi.fn((...a: unknown[]) => {
        lteSpy(...a);
        return chain;
      }),
      order: vi.fn().mockResolvedValue({ data: rows, error: null }),
    };
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }) },
      from: vi.fn(() => ({ select: vi.fn(() => chain) })),
    };
    vi.mocked(createClient).mockResolvedValue(client as any);

    const result = await getEventSeries("2024-01-01", "2024-01-31");

    expect(gteSpy).toHaveBeenCalledWith("date", "2024-01-01");
    expect(lteSpy).toHaveBeenCalledWith("date", "2024-01-31");
    expect(result).toEqual([
      {
        date: "2024-01-01",
        exercise: "Y",
        lateSnack: "N",
        dinnerAlcohol: true,
        lateSnackAlcohol: null,
      },
    ]);
  });
});
