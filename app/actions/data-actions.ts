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

/** 모든 Supabase 데이터를 초기화합니다 (개발 환경 전용) */
export async function serverResetAllData(): Promise<void> {
  if (process.env.NODE_ENV !== "development") {
    throw new Error("데이터 초기화는 개발 환경에서만 사용할 수 있습니다.");
  }
  await Promise.all([resetSettings(), resetDailyLogs(), resetWeeklyLogs()]);
}

/** Supabase 데이터를 데모(mock) 데이터로 교체합니다 (개발 환경 전용) */
export async function serverLoadDemoData(): Promise<void> {
  if (process.env.NODE_ENV !== "development") {
    throw new Error("데모 데이터 로드는 개발 환경에서만 사용할 수 있습니다.");
  }
  await Promise.all([resetSettings(), resetDailyLogs(), resetWeeklyLogs()]);
  await Promise.all([
    loadMockSettings(),
    loadMockDailyLogs(),
    loadMockWeeklyLogs(),
  ]);
}

