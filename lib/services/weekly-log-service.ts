import { mockWeeklyLog } from "@/lib/mock-data";
import type { WeeklyLog } from "@/lib/types";

const weeklyLogs: WeeklyLog[] = [{ ...mockWeeklyLog }];

export async function getWeeklyLog(
  weekStart: string
): Promise<WeeklyLog | null> {
  return weeklyLogs.find((log) => log.weekStart === weekStart) ?? null;
}

export async function getWeeklyLogs(count: number): Promise<WeeklyLog[]> {
  return weeklyLogs.slice(0, count);
}

export async function upsertWeeklyLog(log: WeeklyLog): Promise<WeeklyLog> {
  const index = weeklyLogs.findIndex((w) => w.weekStart === log.weekStart);
  if (index >= 0) {
    weeklyLogs[index] = log;
  } else {
    weeklyLogs.unshift(log);
  }
  return log;
}
