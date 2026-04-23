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
import type { DailyLog, DailyLogUpdate, ClearableField, WeeklyLog } from "@/lib/types";

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
): Promise<DailyLog | null> {
  const result = await closeDailyLog(date, log);
  revalidatePath("/home");
  revalidatePath("/log");
  revalidatePath("/graph");
  return result;
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
