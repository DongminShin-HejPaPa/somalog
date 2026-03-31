import type { DailyLog } from "@/lib/types";
import * as dailyLogService from "./daily-log-service";

export async function getLowestWeight(): Promise<{
  weight: number;
  date: string;
}> {
  const logs = await dailyLogService.getRecentDailyLogs(365);
  const withWeight = logs.filter(
    (l): l is DailyLog & { weight: number } => l.weight !== null
  );
  if (withWeight.length === 0) return { weight: Infinity, date: "" };
  return withWeight.reduce((min, l) =>
    l.weight < min.weight ? l : min
  , withWeight[0]);
}

export async function getAvgWeight3d(date: string): Promise<number | null> {
  const logs = await dailyLogService.getRecentDailyLogs(30);
  const dateIndex = logs.findIndex((log) => log.date === date);
  if (dateIndex < 0) return null;

  const window = logs.slice(dateIndex, dateIndex + 3);
  const weights = window
    .map((log) => log.weight)
    .filter((w): w is number => w !== null);

  if (weights.length === 0) return null;
  const avg = weights.reduce((sum, w) => sum + w, 0) / weights.length;
  return Math.round(avg * 10) / 10;
}

export async function getWeightChange(date: string): Promise<number | null> {
  const log = await dailyLogService.getDailyLog(date);
  if (!log?.weight) return null;
  return log.weightChange;
}
