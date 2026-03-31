"use server";

import {
  resetSettings,
  loadMockSettings,
} from "@/lib/services/settings-service";
import {
  resetDailyLogs,
  loadMockDailyLogs,
} from "@/lib/services/daily-log-service";
import {
  resetWeeklyLogs,
  loadMockWeeklyLogs,
} from "@/lib/services/weekly-log-service";

/** 모든 Supabase 데이터를 초기화합니다 */
export async function serverResetAllData(): Promise<void> {
  await Promise.all([resetSettings(), resetDailyLogs(), resetWeeklyLogs()]);
}

/** Supabase 데이터를 데모(mock) 데이터로 교체합니다 */
export async function serverLoadDemoData(): Promise<void> {
  await Promise.all([
    loadMockSettings(),
    loadMockDailyLogs(),
    loadMockWeeklyLogs(),
  ]);
}
