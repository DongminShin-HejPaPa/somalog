"use server";

import { revalidatePath } from "next/cache";
import {
  getDailyLog,
  upsertDailyLog,
  closeDailyLog,
  reopenDailyLog,
  getRecentDailyLogs,
  getDailyLogsWithOffset,
  getDailyLogsTotalCount,
  getAllDailyLogs,
  regenerateDailySummary,
  fillMissingAndAutoClose,
  closeAllUnclosedExceptToday,
  getFirstUnclosedLog,
  clearDailyLogField,
} from "@/lib/services/daily-log-service";
import { getWeeklyLogs } from "@/lib/services/weekly-log-service";
import { getLowestWeight } from "@/lib/services/stats-service";
import {
  detectGoalAchievement,
  detectMilestone,
  detectStreakMilestone,
  getAchievements,
  getJourneyReport,
  markAchievementSeen,
} from "@/lib/services/achievement-service";
import type {
  DailyLog,
  DailyLogUpdate,
  ClearableField,
  WeeklyLog,
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
  const result = await closeDailyLog(date, log);
  revalidatePath("/home");
  revalidatePath("/log");
  revalidatePath("/graph");

  // 마감 직후 목표 달성 판정 (closeDailyLog는 미변경 — 별도 서비스에서 처리)
  // 판정 실패(예: 마이그레이션 미적용)가 마감 자체를 깨뜨리지 않도록 방어
  const goalEvent = result
    ? await detectGoalAchievement(result).catch(() => null)
    : null;
  // 목표 달성이 없을 때만 마일스톤 판정 — 목표 세리머니가 우선.
  // 우선순위: 감량 마일스톤(−5/−10kg…) > 연속 기록 마일스톤(7/30/100일…).
  // 감량 마일스톤이 떴으면 streak 쿼리는 건너뛴다(불필요한 INSERT/노출 방지).
  let milestoneEvent: import("@/lib/types").MilestoneEvent | null = null;
  if (result && !goalEvent) {
    milestoneEvent = await detectMilestone(result).catch(() => null);
    if (!milestoneEvent) {
      milestoneEvent = await detectStreakMilestone(result).catch(() => null);
    }
  }
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
  offset: number
): Promise<DailyLog[]> {
  return getDailyLogsWithOffset(count, offset);
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

export async function actionGetAllDailyLogs(): Promise<DailyLog[]> {
  return getAllDailyLogs();
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
  all?: DailyLog[];
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
      getAllDailyLogs().then((d) => (resAll = d)),
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
