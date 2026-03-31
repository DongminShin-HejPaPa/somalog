import { mockDailyLogs } from "@/lib/mock-data";
import type { DailyLog, DailyLogUpdate } from "@/lib/types";
import { formatDate, getWeekRange } from "@/lib/utils/date-utils";
import {
  computeDay,
  computeWeightChange,
  computeAvgWeight3d,
  computeIntensiveDay,
  getLowestWeightFromLogs,
} from "@/lib/utils/compute-daily";
import { generateFeedback, generateDailySummary, generateOneLiner, generateWeeklySummary } from "@/lib/utils/templates";
import { getSettings } from "./settings-service";
import { upsertWeeklyLog } from "./weekly-log-service";

let dailyLogs: DailyLog[] = [...mockDailyLogs];

export async function getTodayLog(): Promise<DailyLog | null> {
  const today = formatDate(new Date());
  return dailyLogs.find((log) => log.date === today) ?? null;
}

export async function getDailyLog(date: string): Promise<DailyLog | null> {
  return dailyLogs.find((log) => log.date === date) ?? null;
}

export async function getRecentDailyLogs(count: number): Promise<DailyLog[]> {
  return dailyLogs.slice(0, count);
}

export async function upsertDailyLog(
  date: string,
  data: DailyLogUpdate
): Promise<DailyLog> {
  // 1. 기본 upsert
  const index = dailyLogs.findIndex((log) => log.date === date);
  if (index >= 0) {
    dailyLogs[index] = { ...dailyLogs[index], ...data };
  } else {
    const newLog: DailyLog = {
      date,
      day: 0,
      weight: null,
      avgWeight3d: null,
      weightChange: null,
      water: null,
      exercise: null,
      breakfast: null,
      lunch: null,
      dinner: null,
      lateSnack: null,
      energy: null,
      note: null,
      closed: false,
      intensiveDay: null,
      feedback: null,
      dailySummary: null,
      oneLiner: null,
      ...data,
    };
    dailyLogs.unshift(newLog);
  }

  const logIndex = dailyLogs.findIndex((log) => log.date === date);
  const log = dailyLogs[logIndex];

  // 2. 설정 로드
  const settings = await getSettings();

  // 3. day는 항상 계산
  log.day = computeDay(date, settings.dietStartDate);

  // 4. weight가 있을 때 파생 필드 자동 계산
  if (log.weight !== null) {
    const lowestW = getLowestWeightFromLogs(dailyLogs);

    log.weightChange = computeWeightChange(log.weight, settings.startWeight);
    log.avgWeight3d = computeAvgWeight3d(date, dailyLogs);

    if (settings.intensiveDayOn) {
      log.intensiveDay = computeIntensiveDay(
        log.weight,
        settings.intensiveDayCriteria,
        lowestW
      );
    }

    // 5. 피드백 생성 (체중 입력 시)
    const prevLog = dailyLogs.find((l) => l.date < date && l.weight !== null);
    log.feedback = generateFeedback(
      log,
      prevLog?.weight ?? null,
      lowestW,
      settings.waterGoal
    );
  }

  dailyLogs[logIndex] = log;
  return log;
}

export async function closeDailyLog(date: string): Promise<DailyLog | null> {
  const index = dailyLogs.findIndex((log) => log.date === date);
  if (index < 0) return null;

  const settings = await getSettings();
  const log = dailyLogs[index];

  // 1. 총평 + 한줄 요약 생성
  log.dailySummary = generateDailySummary(log, settings.waterGoal);
  log.oneLiner = generateOneLiner(log);
  log.closed = true;
  dailyLogs[index] = log;

  // 2. 일요일(0)이면 WeeklyLog 자동 생성
  const dayOfWeek = new Date(date + "T00:00:00").getDay();
  if (dayOfWeek === 0) {
    const { weekStart, weekEnd } = getWeekRange(date);
    const weekLogs = dailyLogs.filter(
      (l) => l.date >= weekStart && l.date <= weekEnd
    );

    const weights = weekLogs
      .map((l) => l.weight)
      .filter((w): w is number => w !== null);
    const avgWeight =
      weights.length > 0
        ? Math.round((weights.reduce((s, w) => s + w, 0) / weights.length) * 10) / 10
        : 0;
    const exerciseDays = weekLogs.filter((l) => l.exercise === "Y").length;
    const lateSnackCount = weekLogs.filter((l) => l.lateSnack === "Y").length;

    await upsertWeeklyLog({
      weekStart,
      weekEnd,
      avgWeight,
      exerciseDays,
      lateSnackCount,
      weeklySummary: generateWeeklySummary(
        weekLogs,
        avgWeight,
        exerciseDays,
        lateSnackCount
      ),
    });
  }

  return dailyLogs[index];
}
