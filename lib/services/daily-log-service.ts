import { createClient } from "@/lib/supabase/server";
import type { DailyLog, DailyLogUpdate, WeightPoint } from "@/lib/types";
import { formatDate, getWeekRange } from "@/lib/utils/date-utils";
import {
  computeDay,
  computeWeightChange,
  computeAvgWeight3d,
  computeIntensiveDay,
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
    waterGoal: (row.water_goal as number | null) ?? null,
    exercise: (row.exercise as string | null) ?? null,
    breakfast: (row.breakfast as string | null) ?? null,
    lunch: (row.lunch as string | null) ?? null,
    dinner: (row.dinner as string | null) ?? null,
    dinnerAlcohol: (row.dinner_alcohol as boolean | null) ?? null,
    lateSnack: (row.late_snack as string | null) ?? null,
    lateSnackAlcohol: (row.late_snack_alcohol as boolean | null) ?? null,
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
  if (log.waterGoal !== undefined) row.water_goal = log.waterGoal;
  if (log.exercise !== undefined) row.exercise = log.exercise;
  if (log.breakfast !== undefined) row.breakfast = log.breakfast;
  if (log.lunch !== undefined) row.lunch = log.lunch;
  if (log.dinner !== undefined) row.dinner = log.dinner;
  if (log.dinnerAlcohol !== undefined) row.dinner_alcohol = log.dinnerAlcohol;
  if (log.lateSnack !== undefined) row.late_snack = log.lateSnack;
  if (log.lateSnackAlcohol !== undefined) row.late_snack_alcohol = log.lateSnackAlcohol;
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
  return enrichSingleIntensiveDay(supabase, user.id, log);
}

/**
 * 단일 로그의 intensiveDay를 '이 날짜 이전의 최저 체중' 기준으로 재계산한다.
 *
 * 저장된 intensive_day 는 쓰기 시점의 최저로 굳어 있어, 이후 다른 날 더 낮은 체중이
 * 입력되면 stale 해진다(예: 오늘 78.8 저장 후 과거 날에 76.8 입력 → 오늘 값은 그대로).
 * 표시용 단일 조회는 항상 이 함수로 재계산해 enrichIntensiveDay(prefix-min)와 동일한
 * 결과를 보장한다. 체중이 없는 날은 직전(이전 날) 체중으로 판정한다.
 */
async function enrichSingleIntensiveDay(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  log: DailyLog
): Promise<DailyLog> {
  const settings = await getSettings();
  if (!settings.intensiveDayOn) return log;

  const [{ data: lowestRow }, { data: prevRow }] = await Promise.all([
    supabase
      .from("daily_logs")
      .select("weight")
      .eq("user_id", userId)
      .lt("date", log.date)
      .not("weight", "is", null)
      .order("weight", { ascending: true })
      .limit(1)
      .maybeSingle(),
    log.weight === null
      ? supabase
          .from("daily_logs")
          .select("weight")
          .eq("user_id", userId)
          .lt("date", log.date)
          .not("weight", "is", null)
          .order("date", { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null as { weight: number | null } | null }),
  ]);

  const lowestWeight = (lowestRow?.weight as number | null) ?? Infinity;
  const effective = log.weight ?? ((prevRow?.weight as number | null) ?? null);
  return {
    ...log,
    intensiveDay:
      effective !== null
        ? computeIntensiveDay(effective, settings.intensiveDayCriteria, lowestWeight)
        : false,
  };
}

export async function getRecentDailyLogs(count: number): Promise<DailyLog[]> {
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
      .order("date", { ascending: false })
      .limit(count),
    getSettings(),
  ]);

  if (error || !data) return [];

  const logs = data.map((row) => rowToDailyLog(row as Record<string, unknown>));
  if (!settings.intensiveDayOn) return logs;

  // prefix-min 방식: 최근 window 안에서 '그 전까지'의 최저 대비 판정한다.
  // 다이어트 중 최저 체중은 보통 최근 구간 안에 있으므로 별도 baseline 쿼리 불필요.
  return enrichIntensiveDay(logs, settings.intensiveDayCriteria);
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

  // 수분 목표 스냅샷: 물을 입력한 날은 '그날 적용된 목표'를 함께 저장(추가 쿼리 없음 — settings 재사용).
  // 이후 설정에서 목표를 바꿔도 과거 행은 흔들리지 않는다.
  if (merged.water !== null && merged.water !== undefined) {
    merged.waterGoal = settings.waterGoal;
  }


  // 4. DB에서 파생 필드 계산을 위한 최소 데이터만 조회 (100일 전체 스캔 방지)
  const [
    { data: recentRows },
    { data: lowestRow }
  ] = await Promise.all([
    supabase
      .from("daily_logs")
      .select("*")
      .eq("user_id", user.id)
      .lt("date", date)        // 현재 날짜보다 이전 기록만
      .order("date", { ascending: false })
      .limit(7),               // 최근 1주: avg3d 계산 + 피드백 최근 맥락용 공용
    supabase
      .from("daily_logs")
      .select("weight")
      .eq("user_id", user.id)
      .neq("date", date)       // 현재 날짜 기록 제외 (새로 입력된 값과 비교)
      .not("weight", "is", null)
      .order("weight", { ascending: true })
      .limit(1)
      .maybeSingle()
  ]);

  // 최근 1주 전체 로그 (날짜 내림차순) — 파생 계산 + 피드백 최근 맥락에 공용
  const recentLogs = (recentRows || []).map((r) =>
    rowToDailyLog(r as Record<string, unknown>)
  );

  // avgWeight3d 계산을 위해 현재 입력 로그(merged)와 최근 로그들을 합성
  const subsetLogs = [merged, ...recentLogs];

  // 직전 체중 기록 (피드백·weightChange를 위해 필요) — 최근 weight가 있는 날
  const prevWeight = recentLogs.find((l) => l.weight !== null)?.weight ?? null;

  // 5. 파생 필드 계산
  const dbLowestW = (lowestRow?.weight as number | null) ?? Infinity;
  const currentW = merged.weight ?? Infinity;
  let lowestW: number | null = Math.min(dbLowestW, currentW);
  if (lowestW === Infinity) lowestW = null;

  if (merged.weight !== null) {
    merged.weightChange = computeWeightChange(merged.weight, settings.startWeight);
    merged.avgWeight3d = computeAvgWeight3d(date, subsetLogs);
    if (settings.intensiveDayOn) {
      merged.intensiveDay = computeIntensiveDay(
        merged.weight,
        settings.intensiveDayCriteria,
        lowestW as number
      );
    }
  } else if (settings.intensiveDayOn && prevWeight !== null) {
    // 오늘 체중 미입력 → 직전 체중 기준으로 intensiveDay 판정
    merged.intensiveDay = computeIntensiveDay(
      prevWeight,
      settings.intensiveDayCriteria,
      lowestW as number
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
      dinnerAlcohol: "저녁 술", lateSnack: "야식", lateSnackAlcohol: "야식 술", note: "메모",
    };
    const changedField = primaryKey ? (fieldLabels[primaryKey] ?? null) : null;
    merged.feedback = await generateAiFeedback(merged, prevWeight, settings, changedField, recentLogs);
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
  // AI 총평에 필요한 이전 체중(prevWeight) 조회
  const { data: prevRow } = await supabase
    .from("daily_logs")
    .select("weight")
    .eq("user_id", user.id)
    .lt("date", date)
    .not("weight", "is", null)
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const prevWeight = prevRow?.weight ? Number(prevRow.weight) : null;

  let dailySummary: string;
  let oneLiner: string;
  try {
    const results = await Promise.all([
      generateAiDailySummary(existing, settings, prevWeight),
      generateAiOneLiner(existing, settings)
    ]);
    dailySummary = results[0];
    oneLiner = results[1];
  } catch {
    // AI 호출 실패 시에만 Rule-based 생성(Fallback)
    dailySummary = generateDailySummary(existing, settings.waterGoal);
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
    const exerciseDays = weekLogs.filter((l) => l.exercise !== null && l.exercise !== "N" && l.exercise !== "SKIP").length;
    const lateSnackCount = weekLogs.filter((l) => l.lateSnack !== null && l.lateSnack !== "N" && l.lateSnack !== "SKIP").length;

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

  const settings = await getSettings();

  const rows = mockDailyLogs.map((log) => ({
    user_id: user.id,
    date: log.date,
    day: log.day,
    weight: log.weight,
    avg_weight_3d: log.avgWeight3d,
    weight_change: log.weightChange,
    water: log.water,
    water_goal: log.water != null ? settings.waterGoal : null,
    exercise: log.exercise,
    breakfast: log.breakfast,
    lunch: log.lunch,
    dinner: log.dinner,
    dinner_alcohol: log.dinnerAlcohol ?? null,
    late_snack: log.lateSnack,
    late_snack_alcohol: log.lateSnackAlcohol ?? null,
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
  // 저장된 intensive_day stale 방지 — 항상 '이 날짜 이전 최저' 기준으로 재계산
  return enrichSingleIntensiveDay(supabase, user.id, log);
}

/**
 * 커서(날짜) 기반 페이지네이션 — cursorDate 보다 이전 날짜를 count개 반환한다.
 *
 * 기존 OFFSET(.range) 방식은 버리는 행까지 스캔해 깊은 페이지일수록 느려졌다.
 * keyset(date < cursor)은 (user_id, date DESC) 인덱스를 그대로 타 페이지 깊이와
 * 무관하게 일정 속도를 유지한다 — 수년치 "더 보기"에도 동일.
 */
export async function getDailyLogsBefore(cursorDate: string, count: number): Promise<DailyLog[]> {
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
      .lt("date", cursorDate)
      .order("date", { ascending: false })
      .limit(count),
    getSettings(),
  ]);

  if (error || !data) return [];

  const logs = data.map((row) => rowToDailyLog(row as Record<string, unknown>));
  if (!settings.intensiveDayOn) return logs;

  // prefix-min 방식: 페이지 범위 안에서 '그 전까지'의 최저 대비 판정한다.
  // 더 오래된 페이지는 범위 밖 이전 최저를 모르므로 경계 날짜에서 약간 보수적으로
  // 판정될 수 있으나, 미래 체중이 과거를 소급 변경하던 버그는 없다. 전체 정확값은 graph가 보장.
  return enrichIntensiveDay(logs, settings.intensiveDayCriteria);
}

/**
 * 'Hard Reset Mode(intensive)' 날짜 목록을 그래프와 동일한 prefix-min 기준으로
 * 정확히 계산한다 (date DESC). 무거운 컬럼 없이 date+weight 경량 시리즈만 읽어
 * enrichIntensiveDay 로 재계산하므로 빠르다. intensive 끄면 빈 배열.
 */
async function getIntensiveDateList(): Promise<string[]> {
  const settings = await getSettings();
  if (!settings.intensiveDayOn) return [];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("daily_logs")
    .select("date, weight")
    .eq("user_id", user.id)
    .order("date", { ascending: false });

  if (error || !data) return [];

  // enrichIntensiveDay 는 date/weight 만 읽으므로 경량 행을 그대로 넘겨도 정확하다.
  const logs = data.map((r) => ({
    date: r.date as string,
    weight: (r.weight as number | null) ?? null,
  })) as unknown as DailyLog[];

  return enrichIntensiveDay(logs, settings.intensiveDayCriteria)
    .filter((l) => l.intensiveDay)
    .map((l) => l.date);
}

/**
 * 로그 탭 서버 검색/필터 — 전체 기록을 대상으로 조회한다 (커서 페이지네이션).
 *
 * 기존엔 클라이언트가 이미 불러온 페이지(최근 30개씩)만 필터링해, 오래된 기록은
 * "검색 결과 없음"으로 보였다. 여기서는 DB에서 직접 ilike/조건 필터를 걸어
 * 수년 전 기록도 찾는다. cursorDate 로 "더 보기"를 이어간다.
 *
 * intensive 필터는 그래프와 동일한 prefix-min 으로 정확히 판정한다(경량 시리즈 재계산).
 */
export async function getDailyLogsFiltered(opts: {
  query?: string;
  filter?: string | null;
  cursorDate?: string | null;
  limit: number;
}): Promise<DailyLog[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  // 검색어: PostgREST or-필터 구문을 깨뜨리는 문자(`,()*%`)는 제거 후 사용.
  const term = (opts.query ?? "").trim().replace(/[,()*%]/g, " ").trim();
  const like = `%${term}%`;

  // intensive 필터: prefix-min 으로 정확한 날짜 집합을 구해 페이지 단위 .in 으로 조회.
  // 페이지당 날짜 수가 limit 이하라 .in 비용이 작고, 그래프 판정과 정확히 일치한다.
  if (opts.filter === "intensive") {
    let dates = await getIntensiveDateList();
    if (opts.cursorDate) dates = dates.filter((d) => d < opts.cursorDate!);
    const pageDates = dates.slice(0, opts.limit);
    if (pageDates.length === 0) return [];

    let iq = supabase
      .from("daily_logs")
      .select("*")
      .eq("user_id", user.id)
      .in("date", pageDates);
    if (term) {
      iq = iq.or(`breakfast.ilike.${like},lunch.ilike.${like},dinner.ilike.${like}`);
    }
    const { data, error } = await iq.order("date", { ascending: false }).limit(opts.limit);
    if (error || !data) return [];
    return data.map((row) => rowToDailyLog(row as Record<string, unknown>));
  }

  let q = supabase.from("daily_logs").select("*").eq("user_id", user.id);

  if (term) {
    q = q.or(`breakfast.ilike.${like},lunch.ilike.${like},dinner.ilike.${like}`);
  }

  switch (opts.filter) {
    case "unclosed":
      q = q.eq("closed", false);
      break;
    case "exercise":
      q = q.not("exercise", "is", null).neq("exercise", "N").neq("exercise", "SKIP");
      break;
    case "lateSnack":
      q = q.not("late_snack", "is", null).neq("late_snack", "N").neq("late_snack", "SKIP");
      break;
    case "alcohol":
      q = q.or("dinner_alcohol.eq.true,late_snack_alcohol.eq.true");
      break;
  }

  if (opts.cursorDate) q = q.lt("date", opts.cursorDate);

  const { data, error } = await q
    .order("date", { ascending: false })
    .limit(opts.limit);

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

/**
 * 그래프 전용 경량 시리즈 — date + weight 만 조회한다.
 *
 * 기존 getAllDailyLogs 는 select("*") 로 AI 총평·식단·메모 등 무거운 컬럼까지
 * 전부 내려받아, 수년치가 쌓이면 그래프 진입마다 수 MB 를 전송·파싱했다.
 * 그래프는 실제로 날짜·체중만 쓰므로(별표/급증은 클라이언트 계산, intensiveDay 미사용)
 * 두 컬럼만 가져와 페이로드를 20~50배 줄인다. 정렬은 기존과 동일하게 date DESC.
 */
export async function getWeightSeries(): Promise<WeightPoint[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from("daily_logs")
    .select("date, weight")
    .eq("user_id", user.id)
    .order("date", { ascending: false });

  if (error || !data) return [];

  return data.map((r) => ({
    date: r.date as string,
    weight: (r.weight as number | null) ?? null,
  }));
}

/**
 * 전 기간 통틀어 최저 체중 1건을 인덱스 1행 조회로 반환한다.
 *
 * 기존 stats-service.getLowestWeight 는 최근 365일만 훑어, 1년 넘게 쓰면
 * 진짜 역대 최저(365일보다 과거)를 놓치는 정확성 버그가 있었다. 여기서는
 * weight 오름차순 + date 오름차순(동률이면 더 이른 날) 으로 1행만 가져온다.
 */
export async function getLowestWeightEntry(): Promise<{
  weight: number;
  date: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { weight: Infinity, date: "" };

  const { data, error } = await supabase
    .from("daily_logs")
    .select("date, weight")
    .eq("user_id", user.id)
    .not("weight", "is", null)
    .order("weight", { ascending: true })
    .order("date", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data || data.weight === null) return { weight: Infinity, date: "" };
  return { weight: data.weight as number, date: data.date as string };
}

/**
 * 여정 회고(getJourneyReport) 전용 경량 조회.
 *
 * 리포트 집계에 필요한 컬럼만 가져온다 — AI 총평/한줄/메모(feedback·daily_summary·
 * one_liner·note) 같은 무거운 텍스트와 intensiveDay 재계산은 제외. 세리머니 진입 시
 * 지연 로드라 탭 속도엔 무관하지만, 페이로드를 줄여 그래프 외 경로도 일관되게 가볍게.
 */
export async function getLogsForJourney(): Promise<DailyLog[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from("daily_logs")
    .select(
      "date, weight, exercise, water, water_goal, late_snack, dinner_alcohol, late_snack_alcohol, breakfast, lunch, dinner"
    )
    .eq("user_id", user.id)
    .order("date", { ascending: false });

  if (error || !data) return [];

  return data.map((r) => rowToDailyLog(r as Record<string, unknown>));
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
