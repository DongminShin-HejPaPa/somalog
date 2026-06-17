import { createClient } from "@/lib/supabase/server";
import type {
  DailyLog,
  Settings,
  GoalEvent,
  GoalSnapshot,
  Achievement,
  JourneyReport,
  MilestoneEvent,
} from "@/lib/types";
import { getSettings } from "./settings-service";
import { getAllDailyLogs } from "./daily-log-service";

const GOAL_TYPE = "goal_reached";
const MILESTONE_PREFIX = "milestone_";
const MILESTONE_STEP = 5; // kg

/**
 * 마일스톤 판정의 순수 로직 (DB 비의존 — 단위 테스트 대상).
 * 시작 체중 대비 누적 감량이 5kg 단위를 '처음' 넘었을 때 그 마일스톤(kg)을 반환.
 * 이미 달성한 것보다 더 큰 단위만 새 마일스톤으로 인정(중간 단위는 건너뛰어도 한 번만).
 * @returns 새로 도달한 마일스톤 kg (5/10/15…) 또는 null
 */
export function decideMilestoneReached(params: {
  weight: number | null;
  startWeight: number;
  reachedMilestones: number[]; // 이미 축하한 마일스톤 kg 목록
  step?: number;
}): number | null {
  const { weight, startWeight, reachedMilestones, step = MILESTONE_STEP } = params;
  if (weight === null || startWeight <= 0) return null;
  const loss = startWeight - weight;
  if (loss < step) return null;
  const highestCrossed = Math.floor(loss / step) * step; // 예: 12.3kg 감량 → 10
  if (highestCrossed <= 0) return null;
  const maxReached = reachedMilestones.length ? Math.max(...reachedMilestones) : 0;
  return highestCrossed > maxReached ? highestCrossed : null;
}

/**
 * 목표 달성 판정의 순수 로직 (DB 비의존 — 단위 테스트 대상).
 * @returns "first" 최초 달성(풀 세리머니) / "repeat" 재달성(미니 토스트) / null 이벤트 없음
 */
export function decideGoalEventKind(params: {
  weight: number | null;
  targetWeight: number;
  mode: "losing" | "maintaining";
  hasExistingAchievement: boolean;
  prevWeight: number | null; // 직전(이전 날) 체중
}): "first" | "repeat" | null {
  // mode는 더 이상 판정에 쓰지 않는다 (감량/유지 공통 규칙) — 시그니처 호환 위해 받기만 함
  const { weight, targetWeight, hasExistingAchievement, prevWeight } = params;

  if (weight === null) return null;
  if (!targetWeight || targetWeight <= 0) return null;
  if (weight > targetWeight) return null; // 아직 목표 미도달

  // 최초 달성
  if (!hasExistingAchievement) return "first";

  // 재달성(미니 토스트)은 '직전 체중이 목표 위'였다가 다시 목표 이하로 복귀한 경우에만.
  // 감량/유지 모드 공통 — 유지 중 요요 후 복귀도 격려하고, 목표 이하로 계속 머무는
  // 날에는 매일 토스트가 뜨지 않게 막는다.
  const isFreshCrossing = prevWeight === null || prevWeight > targetWeight;
  return isFreshCrossing ? "repeat" : null;
}

function rowToAchievement(row: Record<string, unknown>): Achievement {
  return {
    id: row.id as string,
    type: row.type as string,
    achievedAt: row.achieved_at as string,
    payload: (row.payload as GoalSnapshot | null) ?? null,
    seenAt: (row.seen_at as string | null) ?? null,
  };
}

/**
 * 마감된 로그가 목표 달성(또는 재달성)인지 판정한다.
 * - 최초 달성: achievements에 goal_reached 행이 없을 때 → INSERT + 풀 세리머니(kind:"first")
 * - 재달성: 행이 있고, 직전 체중이 목표 위였다가 다시 목표 이하로 '복귀'했을 때 → 미니 토스트(kind:"repeat")
 *   (감량/유지 모드 공통 — 유지 중 요요 후 복귀도 격려)
 * - 목표 이하로 계속 머무는 날 / 목표 미설정 / 체중 미입력 / 목표 초과: 이벤트 없음
 *
 * closeDailyLog 자체는 건드리지 않고, actionCloseDailyLog에서 마감 직후 호출한다.
 * (closeDailyLog는 같은 요청에서 getSettings를 이미 호출 → React.cache로 중복 조회 없음)
 */
export async function detectGoalAchievement(
  closedLog: DailyLog
): Promise<GoalEvent | null> {
  if (closedLog.weight === null) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const settings = await getSettings();
  if (!settings.targetWeight || settings.targetWeight <= 0) return null;
  if (closedLog.weight > settings.targetWeight) return null;

  // 기존 최초 달성 기록 + 직전 체중 조회
  const [{ data: existing }, { data: prevRow }] = await Promise.all([
    supabase
      .from("achievements")
      .select("*")
      .eq("user_id", user.id)
      .eq("type", GOAL_TYPE)
      .maybeSingle(),
    supabase
      .from("daily_logs")
      .select("weight")
      .eq("user_id", user.id)
      .lt("date", closedLog.date)
      .not("weight", "is", null)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const kind = decideGoalEventKind({
    weight: closedLog.weight,
    targetWeight: settings.targetWeight,
    mode: settings.mode,
    hasExistingAchievement: !!existing,
    prevWeight: (prevRow?.weight as number | null) ?? null,
  });
  if (!kind) return null;

  const snapshot = await buildSnapshot(closedLog, settings, user.id, supabase);

  // 최초 달성만 영구 기록(UNIQUE) — 재달성은 토스트만
  if (kind === "first") {
    await supabase.from("achievements").insert({
      user_id: user.id,
      type: GOAL_TYPE,
      payload: snapshot,
    });
  }

  return { kind, snapshot };
}

/**
 * 마감된 로그가 새 감량 마일스톤(−5/−10kg…)에 도달했는지 판정.
 * 도달 시 achievements에 milestone_{kg} 1행(UNIQUE) INSERT + 이벤트 반환(작은 토스트용).
 * 목표 달성과 동시면 호출하지 않는다(goal 우선 — log-actions에서 분기).
 */
export async function detectMilestone(
  closedLog: DailyLog
): Promise<MilestoneEvent | null> {
  if (closedLog.weight === null) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const settings = await getSettings();
  if (!settings.startWeight || settings.startWeight <= 0) return null;

  const { data: rows } = await supabase
    .from("achievements")
    .select("type")
    .eq("user_id", user.id)
    .like("type", `${MILESTONE_PREFIX}%`);

  const reachedMilestones = (rows ?? [])
    .map((r) => parseInt((r.type as string).slice(MILESTONE_PREFIX.length), 10))
    .filter((n) => !Number.isNaN(n));

  const milestone = decideMilestoneReached({
    weight: closedLog.weight,
    startWeight: settings.startWeight,
    reachedMilestones,
  });
  if (milestone === null) return null;

  await supabase.from("achievements").insert({
    user_id: user.id,
    type: `${MILESTONE_PREFIX}${milestone}`,
  });

  return { lostKg: milestone };
}

async function buildSnapshot(
  log: DailyLog,
  settings: Settings,
  userId: string,
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<GoalSnapshot> {
  const { count } = await supabase
    .from("daily_logs")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  return {
    startWeight: settings.startWeight,
    targetWeight: settings.targetWeight,
    finalWeight: log.weight as number,
    daysElapsed: log.day,
    recordedDays: count ?? 0,
    coachName: settings.coachName,
  };
}

/** 명예의 전당 / 재진입 배너용 — 사용자의 모든 업적 조회 (최신순) */
export async function getAchievements(): Promise<Achievement[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("achievements")
    .select("*")
    .eq("user_id", user.id)
    .order("achieved_at", { ascending: false });

  if (error || !data) return [];
  return data.map((r) => rowToAchievement(r as Record<string, unknown>));
}

/**
 * 여정 회고 리포트 (2막) — 전체 일별 기록을 집계한다.
 * 세리머니 진입 시점에만 호출(지연 로드)되므로 탭 초기 진입 속도에 영향 없음.
 */
export async function getJourneyReport(): Promise<JourneyReport | null> {
  const [logs, settings] = await Promise.all([getAllDailyLogs(), getSettings()]);
  const withWeight = logs.filter(
    (l): l is DailyLog & { weight: number } => l.weight !== null
  );
  if (withWeight.length === 0) return null;

  // logs는 날짜 오름/내림 어느 쪽이든 올 수 있어 정렬 후 사용
  const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date));
  const sortedWeights = [...withWeight].sort((a, b) => a.date.localeCompare(b.date));

  const finalWeight = sortedWeights[sortedWeights.length - 1].weight;
  const recordedDays = sorted.length;

  // 비율 계산: 해당 항목을 실제로 입력한 날만 분모로 사용 (입력 자체가 없는 날은 제외)
  const exerciseEnteredDays = sorted.filter((l) => l.exercise !== null).length;
  const exerciseDays = sorted.filter(
    (l) => l.exercise !== null && l.exercise !== "N" && l.exercise !== "SKIP"
  ).length;

  const waterEnteredDays = sorted.filter((l) => l.water !== null).length;
  const waterGoalDays = sorted.filter(
    (l) => l.water !== null && settings.waterGoal > 0 && l.water >= settings.waterGoal
  ).length;

  const lateSnackEnteredDays = sorted.filter((l) => l.lateSnack !== null).length;
  const lateSnackDays = sorted.filter(
    (l) => l.lateSnack !== null && l.lateSnack !== "N" && l.lateSnack !== "SKIP"
  ).length;

  const mealsEnteredDays = sorted.filter(
    (l) => l.dinner !== null || l.lateSnack !== null
  ).length;
  const alcoholDays = sorted.filter(
    (l) => l.dinnerAlcohol === true || l.lateSnackAlcohol === true
  ).length;

  const anyMealEnteredDays = sorted.filter(
    (l) => l.breakfast !== null || l.lunch !== null || l.dinner !== null
  ).length;
  const allMealsDays = sorted.filter(
    (l) => l.breakfast !== null && l.lunch !== null && l.dinner !== null
  ).length;

  const daysElapsed =
    Math.round(
      (new Date(sortedWeights[sortedWeights.length - 1].date + "T00:00:00").getTime() -
        new Date(settings.dietStartDate + "T00:00:00").getTime()) /
        86_400_000
    ) + 1;
  const safeDaysElapsed = Math.max(daysElapsed, 1);

  const totalLoss = Math.round((settings.startWeight - finalWeight) * 10) / 10;
  const dailyAvgLoss = Math.round((totalLoss / safeDaysElapsed) * 100) / 100;
  const weeklyAvgLoss = Math.round(dailyAvgLoss * 7 * 100) / 100;

  return {
    startWeight: settings.startWeight,
    finalWeight,
    totalLoss,
    daysElapsed: safeDaysElapsed,
    recordedDays,
    exerciseDays,
    exerciseRate:
      exerciseEnteredDays > 0 ? Math.round((exerciseDays / exerciseEnteredDays) * 100) : 0,
    waterGoalDays,
    waterGoalRate:
      waterEnteredDays > 0 ? Math.round((waterGoalDays / waterEnteredDays) * 100) : 0,
    lateSnackDays,
    lateSnackRate:
      lateSnackEnteredDays > 0 ? Math.round((lateSnackDays / lateSnackEnteredDays) * 100) : 0,
    alcoholDays,
    alcoholRate:
      mealsEnteredDays > 0 ? Math.round((alcoholDays / mealsEnteredDays) * 100) : 0,
    allMealsDays,
    allMealsRate:
      anyMealEnteredDays > 0 ? Math.round((allMealsDays / anyMealEnteredDays) * 100) : 0,
    dailyAvgLoss,
    weeklyAvgLoss,
  };
}

/** 모든 업적(goal_reached + 마일스톤) 삭제 — 데이터 초기화/데모 로드 시 정합성 유지 */
export async function resetAchievements(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("achievements").delete().eq("user_id", user.id);
}

/** 목표 달성 기록 삭제 — targetWeight 재설정 시 새 목표를 첫 달성으로 처리하기 위해 호출 */
export async function deleteGoalAchievement(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("achievements").delete()
    .eq("user_id", user.id)
    .eq("type", GOAL_TYPE);
}

/** 세리머니를 본 시각 기록 (중복 노출 방지) */
export async function markAchievementSeen(type: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("achievements")
    .update({ seen_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("type", type);
}
