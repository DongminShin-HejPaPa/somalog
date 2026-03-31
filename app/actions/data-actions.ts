"use server";

import { resetSettings, loadMockSettings } from "@/lib/services/settings-service";
import { resetDailyLogs, loadMockDailyLogs } from "@/lib/services/daily-log-service";
import { resetWeeklyLogs, loadMockWeeklyLogs } from "@/lib/services/weekly-log-service";

/** 모든 서버 인메모리 데이터를 초기화합니다 */
export async function serverResetAllData(): Promise<void> {
  resetSettings();
  resetDailyLogs();
  resetWeeklyLogs();
}

/** 서버 인메모리 상태를 데모(mock) 데이터로 교체합니다 */
export async function serverLoadDemoData(): Promise<void> {
  loadMockSettings();
  loadMockDailyLogs();
  loadMockWeeklyLogs();
}
