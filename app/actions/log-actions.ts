"use server";

import { revalidatePath } from "next/cache";
import {
  getDailyLog,
  upsertDailyLog,
  closeDailyLog,
  reopenDailyLog,
  getRecentDailyLogs,
  getDailyLogsBefore,
  getDailyLogsFiltered,
  getEventSeries,
  getDailyLogsTotalCount,
  getWeightSeries,
  regenerateDailySummary,
  fillMissingAndAutoClose,
  closeAllUnclosedExceptToday,
  getFirstUnclosedLog,
  clearDailyLogField,
} from "@/lib/services/daily-log-service";
import { getWeeklyLogs } from "@/lib/services/weekly-log-service";
import { getLowestWeight } from "@/lib/services/stats-service";
import {
  evaluateCloseEvents,
  commitCloseEvent,
  getAchievements,
  getJourneyReport,
  markAchievementSeen,
  type CloseEventDecision,
} from "@/lib/services/achievement-service";
import type { CloseContext } from "@/lib/services/daily-log-service";
import type {
  DailyLog,
  DailyLogUpdate,
  ClearableField,
  WeeklyLog,
  WeightPoint,
  CloseDailyLogResult,
  Achievement,
  JourneyReport,
} from "@/lib/types";

export async function actionGetDailyLog(
  date: string
): Promise<DailyLog | null> {
  return getDailyLog(date);
}

export async function actionUpsertDailyLog(
  date: string,
  data: DailyLogUpdate
): Promise<DailyLog> {
  const result = await upsertDailyLog(date, data);
  revalidatePath("/home");
  revalidatePath("/log");
  revalidatePath("/graph");
  return result;
}

export async function actionCloseDailyLog(
  date: string,
  log?: DailyLog
): Promise<CloseDailyLogResult> {
  const t0 = Date.now();
  let tCtx = 0;
  let ctx: CloseContext | null = null;
  let pending: Promise<CloseEventDecision | null> | null = null;

  const result = await closeDailyLog(date, log, {
    // 인증·설정·이전 체중이 준비되는 즉시 이벤트 판정 읽기를 시작 — AI 총평 생성과 동시에 돈다.
    // 판정 실패(예: 마이그레이션 미적용)가 마감 자체를 깨뜨리지 않도록 null 로 삼킨다.
    onContext: (c) => {
      tCtx = Date.now();
      ctx = c;
      pending = evaluateCloseEvents(c).catch(() => null);
    },
  });
  const tClosed = Date.now();

  let goalEvent: CloseDailyLogResult["goalEvent"] = null;
  let milestoneEvent: CloseDailyLogResult["milestoneEvent"] = null;
  if (result && ctx && pending) {
    const decision = await (pending as Promise<CloseEventDecision | null>);
    if (decision) {
      // 마감이 확정된 뒤에만 기록 — 이긴 이벤트 1건만 (achievement-service 주석 참고)
      await commitCloseEvent(ctx, decision).catch(() => {});
      goalEvent = decision.goalEvent;
      milestoneEvent = decision.milestoneEvent;
    }
  }

  // 단계별 소요 — Vercel 함수 로그에서 "[close-timing]" 으로 확인. ai 는 AI 총평+upsert 포함.
  console.info(
    `[close-timing] total=${Date.now() - t0}ms ctx=${tCtx ? tCtx - t0 : -1}ms ` +
      `ai+upsert=${tCtx ? tClosed - tCtx : -1}ms events=${Date.now() - tClosed}ms`
  );

  revalidatePath("/home");
  revalidatePath("/log");
  revalidatePath("/graph");
  return { log: result, goalEvent, milestoneEvent };
}

export async function actionGetAchievements(): Promise<Achievement[]> {
  return getAchievements();
}

export async function actionGetJourneyReport(): Promise<JourneyReport | null> {
  return getJourneyReport();
}

export async function actionMarkGoalSeen(type: string): Promise<void> {
  await markAchievementSeen(type);
}

export async function actionReopenDailyLog(
  date: string
): Promise<DailyLog | null> {
  const result = await reopenDailyLog(date);
  revalidatePath("/home");
  revalidatePath("/log");
  revalidatePath("/graph");
  return result;
}

export async function actionGetRecentDailyLogs(
  count: number
): Promise<DailyLog[]> {
  return getRecentDailyLogs(count);
}

export async function actionGetMoreDailyLogs(
  count: number,
  cursorDate: string
): Promise<DailyLog[]> {
  return getDailyLogsBefore(cursorDate, count);
}

export async function actionGetFilteredDailyLogs(opts: {
  query?: string;
  filter?: string | null;
  cursorDate?: string | null;
  rangeStart?: string | null;
  rangeEnd?: string | null;
  limit: number;
}): Promise<DailyLog[]> {
  return getDailyLogsFiltered(opts);
}

export async function actionGetEventSeries(
  rangeStart: string | null,
  rangeEnd: string | null
): Promise<import("@/lib/types").DailyEventPoint[]> {
  return getEventSeries(rangeStart, rangeEnd);
}

export async function actionGetDailyLogsTotalCount(): Promise<number> {
  return getDailyLogsTotalCount();
}

export async function actionGetWeeklyLogs(
  count: number
): Promise<WeeklyLog[]> {
  return getWeeklyLogs(count);
}

export async function actionGetLowestWeight(): Promise<{
  weight: number;
  date: string;
}> {
  return getLowestWeight();
}

export async function actionAutoCloseOldLogs(): Promise<{
  filledCount: number;
  closedCount: number;
  hadOldUnclosed: boolean;
  oldUnclosedRange: { from: string; to: string } | null;
}> {
  return fillMissingAndAutoClose();
}

export async function actionCloseAllUnclosedExceptToday(): Promise<number> {
  const result = await closeAllUnclosedExceptToday();
  revalidatePath("/home");
  revalidatePath("/log");
  revalidatePath("/graph");
  return result;
}

export async function actionGetFirstUnclosedLog(): Promise<DailyLog | null> {
  return getFirstUnclosedLog();
}

export async function actionGetWeightSeries(): Promise<WeightPoint[]> {
  return getWeightSeries();
}

export async function actionRegenerateDailySummary(date: string): Promise<import("@/lib/types").DailyLog | null> {
  const result = await regenerateDailySummary(date);
  revalidatePath("/log");
  revalidatePath("/home");
  return result;
}

export async function actionClearDailyLogField(
  date: string,
  field: ClearableField
): Promise<DailyLog | null> {
  const result = await clearDailyLogField(date, field);
  revalidatePath("/home");
  revalidatePath("/log");
  revalidatePath("/graph");
  return result;
}

export async function actionGetPrefetchData(
  fetchRecords: boolean,
  fetchGraph: boolean
): Promise<{
  w?: WeeklyLog[];
  c?: number;
  all?: WeightPoint[];
  low?: { weight: number; date: string } | null;
}> {
  const promises: Promise<any>[] = [];
  let resW, resC, resAll, resLow;

  if (fetchRecords) {
    promises.push(
      getWeeklyLogs(4).then((d) => (resW = d)),
      getDailyLogsTotalCount().then((d) => (resC = d))
    );
  }
  if (fetchGraph) {
    promises.push(
      getWeightSeries().then((d) => (resAll = d)),
      getLowestWeight().then((d) => (resLow = d))
    );
  }

  await Promise.all(promises);

  return {
    ...(fetchRecords && { w: resW, c: resC }),
    ...(fetchGraph && { all: resAll, low: resLow }),
  };
}

import { getHomeInitialData, type HomeInitialData } from "@/lib/services/home-service";
import { getAuthUser } from "@/lib/supabase/server";

export async function actionGetHomeInitialData(): Promise<HomeInitialData> {
  const user = await getAuthUser();
  return getHomeInitialData(user?.id ?? null);
}
