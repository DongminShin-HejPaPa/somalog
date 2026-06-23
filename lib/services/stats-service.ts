import * as dailyLogService from "./daily-log-service";

export async function getLowestWeight(): Promise<{
  weight: number;
  date: string;
}> {
  // 전 기간 최저를 인덱스 1행 조회로 가져온다(기존 최근 365일 한정 버그 + 365행 풀로드 제거).
  return dailyLogService.getLowestWeightEntry();
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
