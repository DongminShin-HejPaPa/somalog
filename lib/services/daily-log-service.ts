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
  generateAiDailySummary,
} from "@/lib/ai/coach-service";
import { getSettings } from "./settings-service";
import { upsertWeeklyLog } from "./weekly-log-service";
import { mockDailyLogs } from "@/lib/mock-data-new";

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

  // 1. 기존 로그 가져오기 — 동일 supabase 클라이언트 재사용 (별도 createClient/getUser 호출 방지)
  const { data: existingRow } = await supabase
    .from("daily_logs")
    .select("*")
    .eq("user_id", user.id)
    .eq("date", date)
    .single();
  const existing = existingRow ? rowToDailyLog(existingRow as Record<string, unknown>) : null;

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

/** 특정 필드를 null로 초기화 (항목 개별 삭제) */
export async function clearDailyLogField(
  date: string,
  field: "weight" | "water" | "exercise" | "breakfast" | "lunch" | "dinner" | "lateSnack"
): Promise<DailyLog | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const colMap: Record<string, string> = {
    weight: "weight",
    water: "water",
    exercise: "exercise",
    breakfast: "breakfast",
    lunch: "lunch",
    dinner: "dinner",
    lateSnack: "late_snack",
  };

  const { data: upserted, error } = await supabase
    .from("daily_logs")
    .update({ [colMap[field]]: null })
    .eq("user_id", user.id)
    .eq("date", date)
    .select()
    .single();

  if (error || !upserted) return null;
  return rowToDailyLog(upserted as Record<string, unknown>);
}

export async function closeDailyLog(date: string, existingLog?: DailyLog): Promise<DailyLog | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // 클라이언트에서 이미 로그를 갖고 있으면 재조회 불필요 (병목 제거)
  const [existing, settings] = await Promise.all([
    existingLog ? Promise.resolve(existingLog) : getDailyLog(date),
    getSettings(),
  ]);
  if (!existing) return null;

  // 1. 총평 + 한줄 요약 생성 (AI 실패 시에도 반드시 upsert 진행)
  const dailySummary = generateDailySummary(existing, settings.waterGoal);
  let oneLiner: string;
  try {
    oneLiner = await generateAiOneLiner(existing, settings);
  } catch {
    oneLiner = "";
  }

  const updated: DailyLog = { ...existing, dailySummary, oneLiner, closed: true };
  const row = dailyLogToRow(updated, user.id);

  const { data: upserted, error } = await supabase
    .from("daily_logs")
    .upsert(row, { onConflict: "user_id,date" })
    .select()
    .single();

  if (error || !upserted) return null; // throw 대신 null 반환 → 클라이언트가 에러 표시

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

export async function regenerateDailySummary(date: string): Promise<DailyLog | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [existing, settings] = await Promise.all([
    getDailyLog(date),
    getSettings(),
  ]);
  if (!existing || !existing.closed) return null;

  // AI로 총평과 한줄 요약을 모두 재생성 (코치 스타일 반영)
  let dailySummary: string;
  let oneLiner: string;
  try {
    [dailySummary, oneLiner] = await Promise.all([
      generateAiDailySummary(existing, settings),
      generateAiOneLiner(existing, settings),
    ]);
  } catch {
    dailySummary = generateDailySummary(existing, settings.waterGoal);
    oneLiner = existing.oneLiner ?? "";
  }

  const updated: DailyLog = { ...existing, dailySummary, oneLiner };
  const row = dailyLogToRow(updated, user.id);

  const { data: upserted, error } = await supabase
    .from("daily_logs")
    .upsert(row, { onConflict: "user_id,date" })
    .select()
    .single();

  if (error || !upserted) return null;
  return rowToDailyLog(upserted as Record<string, unknown>);
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

/**
 * 마감되지 않은 채 30일이 지난 로그를 일괄 마감 처리.
 * 세션 시작 시 호출해 오래된 미마감 날짜를 정리한다.
 * AI 피드백 생성 없이 closed=true 만 설정 (배치 처리).
 */
export async function autoCloseOldLogs(): Promise<number> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return 0;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffDate = formatDate(cutoff);

  const { data, error } = await supabase
    .from("daily_logs")
    .update({ closed: true })
    .eq("user_id", user.id)
    .eq("closed", false)
    .lt("date", cutoffDate)
    .select("date");

  if (error || !data) return 0;
  return data.length;
}

/**
 * 오늘 이하 날짜 중 마감되지 않은 가장 오래된 로그 1건 반환.
 * 입력탭·홈탭 진입 시 초기 날짜 결정에 사용.
 */
export async function getFirstUnclosedLog(): Promise<DailyLog | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const today = formatDate(new Date());

  const { data, error } = await supabase
    .from("daily_logs")
    .select("*")
    .eq("user_id", user.id)
    .eq("closed", false)
    .lte("date", today)
    .order("date", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return rowToDailyLog(data as Record<string, unknown>);
}

export async function getDailyLogsWithOffset(count: number, offset: number): Promise<DailyLog[]> {
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
    .range(offset, offset + count - 1);

  if (error || !data) return [];

  return data.map((row) => rowToDailyLog(row as Record<string, unknown>));
}

export async function getDailyLogsTotalCount(): Promise<number> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return 0;

  const { count, error } = await supabase
    .from("daily_logs")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  if (error) return 0;
  return count ?? 0;
}

export async function getAllDailyLogs(): Promise<DailyLog[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from("daily_logs")
    .select("*")
    .eq("user_id", user.id)
    .order("date", { ascending: false });

  if (error || !data) return [];

  return data.map((row) => rowToDailyLog(row as Record<string, unknown>));
}
