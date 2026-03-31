"use server";

import {
  getDailyLog,
  upsertDailyLog,
  closeDailyLog,
  getRecentDailyLogs,
} from "@/lib/services/daily-log-service";
import type { DailyLog, DailyLogUpdate } from "@/lib/types";

export async function actionGetDailyLog(
  date: string
): Promise<DailyLog | null> {
  return getDailyLog(date);
}

export async function actionUpsertDailyLog(
  date: string,
  data: DailyLogUpdate
): Promise<DailyLog> {
  return upsertDailyLog(date, data);
}

export async function actionCloseDailyLog(
  date: string
): Promise<DailyLog | null> {
  return closeDailyLog(date);
}

export async function actionGetRecentDailyLogs(
  count: number
): Promise<DailyLog[]> {
  return getRecentDailyLogs(count);
}
