"use server";

import { revalidatePath } from "next/cache";
import {
  getDailyLog,
  upsertDailyLog,
  closeDailyLog,
  reopenDailyLog,
  getRecentDailyLogs,
} from "@/lib/services/daily-log-service";
import { getWeeklyLogs } from "@/lib/services/weekly-log-service";
import { getLowestWeight } from "@/lib/services/stats-service";
import type { DailyLog, DailyLogUpdate, WeeklyLog } from "@/lib/types";

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
  date: string
): Promise<DailyLog | null> {
  const result = await closeDailyLog(date);
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
