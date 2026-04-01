"use server";

import { revalidatePath } from "next/cache";
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

export async function actionGetRecentDailyLogs(
  count: number
): Promise<DailyLog[]> {
  return getRecentDailyLogs(count);
}
