import { createClient } from "@/lib/supabase/server";
import type { DailyLog, DailyLogUpdate } from "@/lib/types";
import { formatDate, getWeekRange } from "@/lib/utils/date-utils";
import {
  computeDay,
  computeWeightChange,
  computeAvgWeight3d,
  computeIntensiveDay,
  getLowestWeightFromLogs,
} from "@/lib/utils/compute-daily";
import {
  generateDailySummary,
  generateWeeklySummary,
} from "@/lib/utils/templates";
import {
  generateAiFeedback,
  generateAiOneLiner,
} from "@/lib/ai/coach-service";
import { getSettings } from "./settings-service";
import { upsertWeeklyLog } from "./weekly-log-service";
import { mockDailyLogs } from "@/lib/mock-data";

function rowToDailyLog(row: Record<string, unknown>): DailyLog {
  return {
    date: row.date as string,
    day: (row.day as number) ?? 0,
    weight: (row.weight as number | null) ?? null,
    avgWeight3d: (row.avg_weight_3d as number | null) ?? null,
    weightChange: (row.weight_change as number | null) ?? null,
    water: (row.water as number | null) ?? null,
    exercise: (row.exercise as "Y" | "N" | null) ?? null,
    breakfast: (row.breakfast as string | null) ?? null,
    lunch: (row.lunch as string | null) ?? null,
    dinner: (row.dinner as string | null) ?? null,
    lateSnack: (row.late_snack as "Y" | "N" | null) ?? null,
    energy: (row.energy as "여유" | "보통" | "피곤" | null) ?? null,
    note: (row.note as string | null) ?? null,
    closed: (row.closed as boolean) ?? false,
    intensiveDay: (row.intensive_day as boolean | null) ?? null,
    feedback: (row.feedback as string | null) ?? null,
    dailySummary: (row.daily_summary as string | null) ?? null,
    oneLiner: (row.one_liner as string | null) ?? null,
  };
}

function dailyLogToRow(
  log: Partial<DailyLog>,
  userId: string
): Record<string, unknown> {
  const row: Record<string, unknown> = { user_id: userId };

  if (log.date !== undefined) row.date = log.date;
  if (log.day !== undefined) row.day = log.day;
  if (log.weight !== undefined) row.weight = log.weight;
  if (log.avgWeight3d !== undefined) row.avg_weight_3d = log.avgWeight3d;
  if (log.weightChange !== undefined) row.weight_change = log.weightChange;
  if (log.water !== undefined) row.water = log.water;
  if (log.exercise !== undefined) row.exercise = log.exercise;
  if (log.breakfast !== undefined) row.breakfast = log.breakfast;
  if (log.lunch !== undefined) row.lunch = log.lunch;
  if (log.dinner !== undefined) row.dinner = log.dinner;
  if (log.lateSnack !== undefined) row.late_snack = log.lateSnack;
  if (log.energy !== undefined) row.energy = log.energy;
  if (log.note !== undefined) row.note = log.note;
  if (log.closed !== undefined) row.closed = log.closed;
  if (log.intensiveDay !== undefined) row.intensive_day = log.intensiveDay;
  if (log.feedback !== undefined) row.feedback = log.feedback;
  if (log.dailySummary !== undefined) row.daily_summary = log.dailySummary;
  if (log.oneLiner !== undefined) row.one_liner = log.oneLiner;

  return row;
}

export async function getTodayLog(): Promise<DailyLog | null> {
  const today = formatDate(new Date());
  return getDailyLog(today);
}

export async function getDailyLog(date: string): Promise<DailyLog | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("daily_logs")
    .select("*")
    .eq("user_id", user.id)
    .eq("date", date)
    .single();

  if (error || !data) return null;

  return rowToDailyLog(data as Record<string, unknown>);
}

export async function getRecentDailyLogs(count: number): Promise<DailyLog[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from("daily_logs")
    .select("*")
    .eq("user_id", user.id)
    .order("date", { ascending: false })
    .limit(count);

  if (error || !data) return [];

  return data.map((row) => rowToDailyLog(row as Record<string, unknown>));
}

export async function upsertDailyLog(
  date: string,
  data: DailyLogUpdate
): Promise<DailyLog> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Unauthorized");

  // 1. 기존 로그 가져오기 (없으면 빈 객체)
  const existing = await getDailyLog(date);

  const merged: DailyLog = existing
    ? { ...existing, ...data }
    : {
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

  // 2. 설정 로드
  const settings = await getSettings();

  // 3. day는 항상 계산
  merged.day = computeDay(date, settings.dietStartDate);

  // 4. weight가 있을 때 파생 필드 자동 계산
  if (merged.weight !== null) {
    // DB에서 모든 로그 가져와 최저 체중 계산
    const { data: allRows } = await supabase
      .from("daily_logs")
      .select("*")
      .eq("user_id", user.id)
      .order("date", { ascending: false });

    const allLogs: DailyLog[] = allRows
      ? allRows.map((r) => rowToDailyLog(r as Record<string, unknown>))
      : [];

    // 현재 upsert 대상 포함하여 계산 (기존 로그를 merged로 교체)
    const logsWithMerged = allLogs.some((l) => l.date === date)
      ? allLogs.map((l) => (l.date === date ? merged : l))
      : [merged, ...allLogs];

    const lowestW = getLowestWeightFromLogs(logsWithMerged);

    merged.weightChange = computeWeightChange(merged.weight, settings.startWeight);
    merged.avgWeight3d = computeAvgWeight3d(date, logsWithMerged);

    if (settings.intensiveDayOn) {
      merged.intensiveDay = computeIntensiveDay(
        merged.weight,
        settings.intensiveDayCriteria,
        lowestW
      );
    }

    // 5. 피드백 생성 (체중 입력 시)
    const prevLog = logsWithMerged.find(
      (l) => l.date < date && l.weight !== null
    );
    merged.feedback = await generateAiFeedback(
      merged,
      prevLog?.weight ?? null,
      settings
    );
  }

  // 6. DB upsert
  const row = dailyLogToRow(merged, user.id);

  const { data: upserted, error } = await supabase
    .from("daily_logs")
    .upsert(row, { onConflict: "user_id,date" })
    .select()
    .single();

  if (error || !upserted) throw new Error(error?.message ?? "upsert failed");

  return rowToDailyLog(upserted as Record<string, unknown>);
}

export async function closeDailyLog(date: string): Promise<DailyLog | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const existing = await getDailyLog(date);
  if (!existing) return null;

  const settings = await getSettings();

  // 1. 총평 + 한줄 요약 생성
  const updated: DailyLog = {
    ...existing,
    dailySummary: generateDailySummary(existing, settings.waterGoal),
    oneLiner: await generateAiOneLiner(existing, settings),
    closed: true,
  };

  const row = dailyLogToRow(updated, user.id);

  const { data: upserted, error } = await supabase
    .from("daily_logs")
    .upsert(row, { onConflict: "user_id,date" })
    .select()
    .single();

  if (error || !upserted) throw new Error(error?.message ?? "upsert failed");

  const closedLog = rowToDailyLog(upserted as Record<string, unknown>);

  // 2. 일요일(0)이면 WeeklyLog 자동 생성
  const dayOfWeek = new Date(date + "T00:00:00").getDay();
  if (dayOfWeek === 0) {
    const { weekStart, weekEnd } = getWeekRange(date);

    const { data: weekRows } = await supabase
      .from("daily_logs")
      .select("*")
      .eq("user_id", user.id)
      .gte("date", weekStart)
      .lte("date", weekEnd);

    const weekLogs: DailyLog[] = weekRows
      ? weekRows.map((r) => rowToDailyLog(r as Record<string, unknown>))
      : [];

    const weights = weekLogs
      .map((l) => l.weight)
      .filter((w): w is number => w !== null);
    const avgWeight =
      weights.length > 0
        ? Math.round(
            (weights.reduce((s, w) => s + w, 0) / weights.length) * 10
          ) / 10
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

  return closedLog;
}

export async function reopenDailyLog(date: string): Promise<DailyLog | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("daily_logs")
    .update({ closed: false })
    .eq("user_id", user.id)
    .eq("date", date)
    .select()
    .single();

  if (error || !data) return null;
  return rowToDailyLog(data as Record<string, unknown>);
}

export async function resetDailyLogs(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  await supabase.from("daily_logs").delete().eq("user_id", user.id);
}

export async function loadMockDailyLogs(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const rows = mockDailyLogs.map((log) => ({
    user_id: user.id,
    date: log.date,
    day: log.day,
    weight: log.weight,
    avg_weight_3d: log.avgWeight3d,
    weight_change: log.weightChange,
    water: log.water,
    exercise: log.exercise,
    breakfast: log.breakfast,
    lunch: log.lunch,
    dinner: log.dinner,
    late_snack: log.lateSnack,
    energy: log.energy,
    note: log.note,
    closed: log.closed,
    intensive_day: log.intensiveDay,
    feedback: log.feedback,
    daily_summary: log.dailySummary,
    one_liner: log.oneLiner,
  }));

  await supabase
    .from("daily_logs")
    .upsert(rows, { onConflict: "user_id,date" });
}
