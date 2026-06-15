import { createClient } from "@/lib/supabase/server";
import type {
  DailyLog,
  Settings,
  GoalEvent,
  GoalSnapshot,
  Achievement,
  JourneyReport,
} from "@/lib/types";
import { getSettings } from "./settings-service";
import { getAllDailyLogs } from "./daily-log-service";

const GOAL_TYPE = "goal_reached";

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
  const { weight, targetWeight, mode, hasExistingAchievement, prevWeight } = params;

  if (weight === null) return null;
  if (!targetWeight || targetWeight <= 0) return null;
  if (weight > targetWeight) return null; // 아직 목표 미도달

  // 최초 달성
  if (!hasExistingAchievement) return "first";

  // 이미 달성 이력 있음 — 유지 모드면 목표 이하가 정상이므로 이벤트 없음
  if (mode === "maintaining") return null;

  // 재달성은 '직전 체중이 목표 위'였다가 복귀한 경우에만 (목표 이하 유지 중 매일 토스트 방지)
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
 * - 재달성: 행이 있고 mode가 'losing'이며, 직전 체중이 목표 위였다가 다시 목표 이하로 '복귀'했을 때 → 미니 토스트(kind:"repeat")
 * - 유지 모드('maintaining'): 목표 이하가 정상 상태이므로 이벤트 없음
 * - 목표 미설정 / 체중 미입력 / 목표 초과: 이벤트 없음
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
  const lowestWeight = withWeight.reduce(
    (min, l) => (l.weight < min ? l.weight : min),
    withWeight[0].weight
  );
  const recordedDays = sorted.length;
  const exerciseDays = sorted.filter(
    (l) => l.exercise !== null && l.exercise !== "N" && l.exercise !== "SKIP"
  ).length;
  const waterGoalDays = sorted.filter(
    (l) => l.water !== null && settings.waterGoal > 0 && l.water >= settings.waterGoal
  ).length;
  const alcoholDays = sorted.filter(
    (l) => l.dinnerAlcohol === true || l.lateSnackAlcohol === true
  ).length;
  const hardResetSurvived = sorted.filter((l) => l.intensiveDay === true).length;

  // 최장 연속 기록일 (날짜가 하루씩 이어지는 최대 길이)
  let longestStreak = 0;
  let cur = 0;
  let prevTime: number | null = null;
  for (const l of sorted) {
    const t = new Date(l.date + "T00:00:00").getTime();
    if (prevTime !== null && t - prevTime === 86_400_000) {
      cur += 1;
    } else {
      cur = 1;
    }
    if (cur > longestStreak) longestStreak = cur;
    prevTime = t;
  }

  const daysElapsed =
    Math.round(
      (new Date(sortedWeights[sortedWeights.length - 1].date + "T00:00:00").getTime() -
        new Date(settings.dietStartDate + "T00:00:00").getTime()) /
        86_400_000
    ) + 1;

  return {
    startWeight: settings.startWeight,
    finalWeight,
    totalLoss: Math.round((settings.startWeight - finalWeight) * 10) / 10,
    daysElapsed: Math.max(daysElapsed, 1),
    recordedDays,
    lowestWeight,
    exerciseDays,
    exerciseRate:
      recordedDays > 0 ? Math.round((exerciseDays / recordedDays) * 100) : 0,
    waterGoalDays,
    waterGoalRate:
      recordedDays > 0 ? Math.round((waterGoalDays / recordedDays) * 100) : 0,
    alcoholDays,
    alcoholRate:
      recordedDays > 0 ? Math.round((alcoholDays / recordedDays) * 100) : 0,
    longestStreak,
    hardResetSurvived,
  };
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
