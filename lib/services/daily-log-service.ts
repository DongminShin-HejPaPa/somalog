import { createClient } from "@/lib/supabase/server";
import type { DailyLog, DailyLogUpdate } from "@/lib/types";
import { formatDate, getWeekRange } from "@/lib/utils/date-utils";
import {
  computeDay,
  computeWeightChange,
  computeAvgWeight3d,
  computeIntensiveDay,
  getLowestWeightFromLogs,
  enrichIntensiveDay,
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
    customFieldValue: (row.custom_field_value as string | null) ?? null,
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
  if (log.customFieldValue !== undefined) row.custom_field_value = log.customFieldValue;
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

  const log = rowToDailyLog(data as Record<string, unknown>);

  // 체중이 없는 날은 직전 체중 기준으로 intensiveDay 재계산
  if (log.weight === null) {
    const [settings, prevRow, lowestRow] = await Promise.all([
      getSettings(),
      supabase
        .from("daily_logs")
        .select("weight")
        .eq("user_id", user.id)
        .lt("date", date)
        .not("weight", "is", null)
        .order("date", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("daily_logs")
        .select("weight")
        .eq("user_id", user.id)
        .not("weight", "is", null)
        .order("weight", { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);

    if (settings.intensiveDayOn) {
      const prevWeight = (prevRow.data?.weight as number | null) ?? null;
      const lowestWeight = (lowestRow.data?.weight as number | null) ?? Infinity;
      if (prevWeight !== null) {
        log.intensiveDay = computeIntensiveDay(prevWeight, settings.intensiveDayCriteria, lowestWeight);
      } else {
        log.intensiveDay = false;
      }
    }
  }

  return log;
}

export async function getRecentDailyLogs(count: number): Promise<DailyLog[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const [{ data, error }, settings, lowestRow] = await Promise.all([
    supabase
      .from("daily_logs")
      .select("*")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .limit(count),
    getSettings(),
    supabase
      .from("daily_logs")
      .select("weight")
      .eq("user_id", user.id)
      .not("weight", "is", null)
      .order("weight", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  if (error || !data) return [];

  const logs = data.map((row) => rowToDailyLog(row as Record<string, unknown>));
  if (!settings.intensiveDayOn) return logs;

  const lowestWeight = (lowestRow.data?.weight as number | null) ?? Infinity;
  return enrichIntensiveDay(logs, settings.intensiveDayCriteria, lowestWeight);
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


  // 4. DB에서 전체 로그 가져와 파생 필드 계산 (항상 실행)
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

  // 오늘을 제외한 가장 최근 체중 기록 (피드백에 prevWeight로 전달)
  const prevLog = logsWithMerged.find(
    (l) => l.date < date && l.weight !== null
  );
  const prevWeight = prevLog?.weight ?? null;

  // 5. 파생 필드 계산
  const lowestW = getLowestWeightFromLogs(logsWithMerged);

  if (merged.weight !== null) {
    merged.weightChange = computeWeightChange(merged.weight, settings.startWeight);
    merged.avgWeight3d = computeAvgWeight3d(date, logsWithMerged);
    if (settings.intensiveDayOn) {
      merged.intensiveDay = computeIntensiveDay(
        merged.weight,
        settings.intensiveDayCriteria,
        lowestW
      );
    }
  } else if (settings.intensiveDayOn && prevWeight !== null) {
    // 오늘 체중 미입력 → 직전 체중 기준으로 intensiveDay 판정
    merged.intensiveDay = computeIntensiveDay(
      prevWeight,
      settings.intensiveDayCriteria,
      lowestW
    );
  }

  // 6. 피드백 생성 — 실제로 입력된 항목이 있을 때만 생성
  const changedKeys = (Object.keys(data) as (keyof typeof data)[]).filter(
    (k) => data[k] !== null && data[k] !== undefined
  );
  if (changedKeys.length > 0) {
    const fieldPriority: (keyof typeof data)[] = [
      "weight", "dinner", "lateSnack", "lunch", "breakfast", "exercise", "water", "note",
    ];
    const primaryKey = fieldPriority.find((k) => changedKeys.includes(k)) ?? changedKeys[0] ?? null;
    const fieldLabels: Partial<Record<keyof typeof data, string>> = {
      weight: "체중", water: "수분", exercise: "운동",
      breakfast: "아침 식단", lunch: "점심 식단", dinner: "저녁 식단",
      lateSnack: "야식", note: "메모",
    };
    const changedField = primaryKey ? (fieldLabels[primaryKey] ?? null) : null;
    merged.feedback = await generateAiFeedback(merged, prevWeight, settings, changedField);
  }
  // changedKeys가 비어 있으면(빈 로그 생성 등) 기존 feedback 그대로 유지 (신규 로그는 null)


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
  field: "weight" | "water" | "exercise" | "breakfast" | "lunch" | "dinner" | "lateSnack" | "customFieldValue"
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
    customFieldValue: "custom_field_value",
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

  const [existing, settings, { data: prevRow }] = await Promise.all([
    getDailyLog(date),
    getSettings(),
    supabase
      .from("daily_logs")
      .select("weight")
      .eq("user_id", user.id)
      .lt("date", date)
      .not("weight", "is", null)
      .order("date", { ascending: false })
      .limit(1)
      .single(),
  ]);
  if (!existing || !existing.closed) return null;

  const prevWeight = (prevRow?.weight as number | null) ?? null;

  // AI로 총평과 한줄 요약을 모두 재생성 (코치 스타일 반영)
  let dailySummary: string;
  let oneLiner: string;
  try {
    [dailySummary, oneLiner] = await Promise.all([
      generateAiDailySummary(existing, settings, prevWeight),
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
    .update({ closed: false, daily_summary: null, one_liner: null })
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
 * 누락된 날짜 생성 + 오래된 미마감 로그 일괄 마감.
 *
 * 동작:
 * 1. 최근 1년 이내 기존 로그 전체 조회
 * 2. 첫 로그 ~ 어제 사이 빠진 날짜를 closed=true 빈 로그로 채움
 * 3. 마지막 로그 날짜로부터 7일 이상 경과 + 미마감 날짜 존재 시
 *    (가장 오래된 미마감일 ~ 어제) 범위를 반환 → 클라이언트가 확인 후 처리
 * 4. 그 외에는 기존 30일 초과 마감 규칙 유지
 */
export async function fillMissingAndAutoClose(): Promise<{
  filledCount: number;
  closedCount: number;
  hadOldUnclosed: boolean;
  oldUnclosedRange: { from: string; to: string } | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { filledCount: 0, closedCount: 0, hadOldUnclosed: false, oldUnclosedRange: null };

  const today = formatDate(new Date());
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = formatDate(yesterdayDate);

  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const oneYearAgoStr = formatDate(oneYearAgo);

  // 최근 1년 이내 로그 날짜 + 마감 여부 조회
  const { data: existingRows } = await supabase
    .from("daily_logs")
    .select("date, closed")
    .eq("user_id", user.id)
    .gte("date", oneYearAgoStr)
    .lte("date", yesterday)
    .order("date", { ascending: true });

  if (!existingRows || existingRows.length === 0) {
    return { filledCount: 0, closedCount: 0, hadOldUnclosed: false, oldUnclosedRange: null };
  }

  // 기존 날짜 맵 (date → closed)
  const existingMap = new Map<string, boolean>();
  for (const row of existingRows) {
    existingMap.set(row.date as string, row.closed as boolean);
  }

  // 마지막 로그 날짜 (채우기 전 기준 — 실제 마지막 접속일)
  const maxExistingDate = existingRows[existingRows.length - 1].date as string;
  const msPerDay = 86400000;
  const daysSinceLastLog = Math.floor(
    (new Date(today + "T00:00:00").getTime() - new Date(maxExistingDate + "T00:00:00").getTime()) / msPerDay
  );

  // 첫 로그 날짜 ~ 어제 사이 누락된 날짜 탐색
  const rangeStart = existingRows[0].date as string;
  const missingDates: string[] = [];
  const cur = new Date(rangeStart + "T00:00:00");
  const endDate = new Date(yesterday + "T00:00:00");
  while (cur <= endDate) {
    const d = formatDate(cur);
    if (!existingMap.has(d)) missingDates.push(d);
    cur.setDate(cur.getDate() + 1);
  }

  // 누락 날짜 → closed=true 빈 로그로 일괄 생성
  let filledCount = 0;
  if (missingDates.length > 0) {
    const settings = await getSettings();
    const rows = missingDates.map((date) => ({
      user_id: user.id,
      date,
      day: computeDay(date, settings.dietStartDate),
      closed: false,
    }));
    const { error } = await supabase
      .from("daily_logs")
      .upsert(rows, { onConflict: "user_id,date" });
    if (!error) {
      filledCount = missingDates.length;
      for (const date of missingDates) existingMap.set(date, false);
    }
  }

  // 트리거: 마지막 로그 날짜로부터 7일 이상 경과 + 미마감 날짜 존재
  // 범위: 가장 오래된 미마감일 ~ 어제 (자동 마감 안 함 — 클라이언트 확인 후 처리)
  const unclosedDates = [...existingMap.entries()]
    .filter(([date, closed]) => !closed && date !== today)
    .map(([date]) => date)
    .sort();

  const hadOldUnclosed = daysSinceLastLog >= 7 && unclosedDates.length > 0;
  const oldUnclosedRange = hadOldUnclosed
    ? { from: unclosedDates[0], to: yesterday }
    : null;

  // 기본: 30일 초과 미마감만 조용히 마감 (7일 초과분은 클라이언트 확인 후 별도 처리)
  let closedCount = 0;
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const cutoff30d = formatDate(thirtyDaysAgo);
  const { data: closedData, error: closeErr } = await supabase
    .from("daily_logs")
    .update({ closed: true })
    .eq("user_id", user.id)
    .eq("closed", false)
    .lt("date", cutoff30d)
    .select("date");
  if (!closeErr && closedData) closedCount = closedData.length;

  return { filledCount, closedCount, hadOldUnclosed, oldUnclosedRange };
}

/**
 * 사용자가 확인한 후 오늘 제외 미마감 로그를 전체 마감.
 */
export async function closeAllUnclosedExceptToday(): Promise<number> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  const today = formatDate(new Date());
  const { data, error } = await supabase
    .from("daily_logs")
    .update({ closed: true })
    .eq("user_id", user.id)
    .eq("closed", false)
    .neq("date", today)
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

  const log = rowToDailyLog(data as Record<string, unknown>);

  // 체중이 없는 날은 직전 체중 기준으로 intensiveDay 재계산 (getDailyLog와 동일 로직)
  if (log.weight === null) {
    const [settings, prevRow, lowestRow] = await Promise.all([
      getSettings(),
      supabase
        .from("daily_logs")
        .select("weight")
        .eq("user_id", user.id)
        .lt("date", log.date)
        .not("weight", "is", null)
        .order("date", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("daily_logs")
        .select("weight")
        .eq("user_id", user.id)
        .not("weight", "is", null)
        .order("weight", { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);

    if (settings.intensiveDayOn) {
      const prevWeight = (prevRow.data?.weight as number | null) ?? null;
      const lowestWeight = (lowestRow.data?.weight as number | null) ?? Infinity;
      log.intensiveDay = prevWeight !== null
        ? computeIntensiveDay(prevWeight, settings.intensiveDayCriteria, lowestWeight)
        : false;
    }
  }

  return log;
}

export async function getDailyLogsWithOffset(count: number, offset: number): Promise<DailyLog[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const [{ data, error }, settings, lowestRow] = await Promise.all([
    supabase
      .from("daily_logs")
      .select("*")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .range(offset, offset + count - 1),
    getSettings(),
    supabase
      .from("daily_logs")
      .select("weight")
      .eq("user_id", user.id)
      .not("weight", "is", null)
      .order("weight", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  if (error || !data) return [];

  const logs = data.map((row) => rowToDailyLog(row as Record<string, unknown>));
  if (!settings.intensiveDayOn) return logs;

  // 페이지 범위 밖의 직전 체중을 모르므로 enrichIntensiveDay에 앞 페이지 컨텍스트 없이 호출.
  // offset > 0인 경우 첫 번째 날짜 이전 체중이 없을 수 있어 정확도가 낮을 수 있지만,
  // 해당 범위 내에서 가능한 최선의 값을 반환한다.
  const lowestWeight = (lowestRow.data?.weight as number | null) ?? Infinity;
  return enrichIntensiveDay(logs, settings.intensiveDayCriteria, lowestWeight);
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

  const [{ data, error }, settings] = await Promise.all([
    supabase
      .from("daily_logs")
      .select("*")
      .eq("user_id", user.id)
      .order("date", { ascending: false }),
    getSettings(),
  ]);

  if (error || !data) return [];

  const logs = data.map((row) => rowToDailyLog(row as Record<string, unknown>));
  if (!settings.intensiveDayOn) return logs;

  // getAllDailyLogs는 전체 로그를 갖고 있으므로 자체적으로 lowestWeight 계산 가능
  const lowestWeight = getLowestWeightFromLogs(logs);
  return enrichIntensiveDay(logs, settings.intensiveDayCriteria, lowestWeight);
}

/**
 * 모든 daily_logs의 custom_field_value를 null로 초기화.
 * 맞춤 입력 필드 삭제 시 호출.
 */
export async function clearAllCustomFieldValues(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  await supabase
    .from("daily_logs")
    .update({ custom_field_value: null })
    .eq("user_id", user.id);
}
