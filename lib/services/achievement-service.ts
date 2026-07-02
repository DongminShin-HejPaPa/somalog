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
import { getLogsForJourney } from "./daily-log-service";
import { getWeeklyLogs } from "./weekly-log-service";
import { projectGoalEta } from "@/lib/utils/goal-projection";

const GOAL_TYPE = "goal_reached";
const MILESTONE_PREFIX = "milestone_";
const MILESTONE_STEP = 5; // kg
const STREAK_PREFIX = "streak_";
/** 연속 기록 마일스톤 간격 — 10일 단위(10/20/30 …) */
const STREAK_STEP = 10;
/** 연속일 계산용으로 마감일에서 거슬러 읽을 최대 날짜 수(장기 스트릭 커버) */
const STREAK_FETCH_CAP = 400;

const ETA_PREFIX = "eta_";
/** D-day 예측 임계(일) — 예상 잔여일이 이 값 이하로 처음 진입하면 이벤트 */
const ETA_THRESHOLDS = [30, 14, 7];

const WEEKLYLOSS_PREFIX = "weeklyloss_";
/** N주 연속 감량 마일스톤 */
const WEEKLYLOSS_MILESTONES = [2, 4, 8, 12];

const ANNIVERSARY_PREFIX = "anniversary_";
/** 다이어트 N주년 간격(일) */
const YEAR_DAYS = 365;

const BIRTHDAY_PREFIX = "birthday_";

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

/** 'YYYY-MM-DD'의 하루 전 날짜를 같은 포맷으로 반환 (UTC 기준 — DST 영향 없음) */
function prevDay(date: string): string {
  const t = new Date(date + "T00:00:00Z").getTime() - 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

/**
 * endDate에서 끝나는 '연속 기록일' 수를 센다 (DB 비의존 — 단위 테스트 대상).
 * recordedDates: 기록이 존재하는 날짜('YYYY-MM-DD') 목록(순서 무관, endDate 포함 가정).
 * endDate에 기록이 없으면 0(마감 직후 호출이라 정상 흐름에선 발생하지 않음).
 */
export function computeCurrentStreak(
  recordedDates: string[],
  endDate: string
): number {
  const set = new Set(recordedDates);
  if (!set.has(endDate)) return 0;
  let streak = 0;
  let cursor = endDate;
  while (set.has(cursor)) {
    streak++;
    cursor = prevDay(cursor);
  }
  return streak;
}

/**
 * 연속 기록 마일스톤 판정의 순수 로직 (DB 비의존 — 단위 테스트 대상).
 * 현재 연속일이 새 10일 단위(10/20/30…)를 '처음' 넘었을 때 그 일수를 반환.
 * 이미 축하한 것보다 큰 단위만 인정(백필 등으로 건너뛰어도 가장 높은 것 한 번만).
 * @returns 새로 도달한 마일스톤 일수 또는 null
 */
export function decideStreakMilestone(params: {
  currentStreak: number;
  reachedMilestones: number[];
  step?: number;
}): number | null {
  const { currentStreak, reachedMilestones, step = STREAK_STEP } = params;
  if (currentStreak < step) return null;
  const highest = Math.floor(currentStreak / step) * step; // 예: 23일 → 20
  const maxReached = reachedMilestones.length ? Math.max(...reachedMilestones) : 0;
  return highest > maxReached ? highest : null;
}

/**
 * 역대 최저 체중 '갱신 순간' 판정 (DB 비의존 — 단위 테스트 대상).
 * 오늘 체중이 오늘 이전까지의 역대 최저보다 낮으면(weight < prevMin) 갱신으로 본다.
 * 하강 구간엔 매일 축하가 뜬다(의도된 동작 — 최저 경신마다 격려).
 * 최초 기록(prevMin === null)은 비교 대상이 없어 갱신으로 치지 않는다.
 * @returns 갱신이면 true
 */
export function decideNewLow(params: {
  weight: number | null;
  prevMin: number | null; // 오늘 이전까지의 역대 최저
}): boolean {
  const { weight, prevMin } = params;
  if (weight === null || prevMin === null) return false;
  return weight < prevMin;
}

/**
 * D-day 예측 임계 진입 판정 (DB 비의존 — 단위 테스트 대상).
 * 예상 잔여일이 아직 축하 안 한 임계(30/14/7) 이하로 처음 진입하면 그중 가장 큰 값을 반환한다.
 * (큰 값부터 순서대로 30→14→7 이 자연스럽게 나오도록. 한 번에 여러 임계를 건너뛰면 큰 것부터 한 단계씩.)
 * @returns 새로 도달한 임계(일) 또는 null
 */
export function decideEtaMilestone(params: {
  daysToGoal: number | null;
  reachedThresholds: number[];
  thresholds?: number[];
}): number | null {
  const { daysToGoal, reachedThresholds, thresholds = ETA_THRESHOLDS } = params;
  if (daysToGoal === null) return null;
  const eligible = thresholds.filter(
    (t) => daysToGoal <= t && !reachedThresholds.includes(t)
  );
  return eligible.length ? Math.max(...eligible) : null;
}

/**
 * 주평균 체중 배열(최신순)에서 '연속 감량 주' 수를 센다 (DB 비의존 — 단위 테스트 대상).
 * 최신 주가 직전 주보다 낮으면 감량으로 보고, 감소가 깨질 때까지 센다.
 * 예) [70,71,72,73] (최신 70) → 3주 연속 감량.
 */
export function computeConsecutiveLossWeeks(avgWeightsNewestFirst: number[]): number {
  let weeks = 0;
  for (let i = 0; i < avgWeightsNewestFirst.length - 1; i++) {
    if (avgWeightsNewestFirst[i] < avgWeightsNewestFirst[i + 1]) weeks++;
    else break;
  }
  return weeks;
}

/**
 * N주 연속 감량 마일스톤 판정 (DB 비의존 — 단위 테스트 대상).
 * 현재 연속 감량 주 수가 새 마일스톤(2/4/8/12)을 처음 넘으면 그중 가장 큰 값을 반환.
 * @returns 새로 도달한 마일스톤(주) 또는 null
 */
export function decideWeeklyLossMilestone(params: {
  consecutiveLossWeeks: number;
  reachedMilestones: number[];
  milestones?: number[];
}): number | null {
  const { consecutiveLossWeeks, reachedMilestones, milestones = WEEKLYLOSS_MILESTONES } = params;
  const maxReached = reachedMilestones.length ? Math.max(...reachedMilestones) : 0;
  const candidate = milestones
    .filter((m) => m <= consecutiveLossWeeks && m > maxReached)
    .reduce((hi, m) => Math.max(hi, m), 0);
  return candidate > 0 ? candidate : null;
}

/**
 * 다이어트 N주년 판정 (DB 비의존 — 단위 테스트 대상).
 * 경과일이 365일 배수(1주년=365, 2주년=730…)에 처음 도달하면 그 연차를 반환.
 * @returns 새로 맞은 주년(1,2,3…) 또는 null
 */
export function decideAnniversary(params: {
  elapsedDays: number;
  reachedYears: number[];
}): number | null {
  const { elapsedDays, reachedYears } = params;
  const year = Math.floor(elapsedDays / YEAR_DAYS);
  if (year < 1) return null;
  const maxReached = reachedYears.length ? Math.max(...reachedYears) : 0;
  return year > maxReached ? year : null;
}

/**
 * 생일 판정 (DB 비의존 — 단위 테스트 대상).
 * 마감일(today)의 월-일이 생일과 같고, 그 해에 아직 축하 안 했으면 해당 연도를 반환.
 * @returns 축하할 연도(YYYY) 또는 null
 */
export function decideBirthday(params: {
  today: string; // YYYY-MM-DD (마감일)
  birthDate: string | null; // YYYY-MM-DD
  reachedYears: number[]; // 이미 축하한 연도 목록
}): number | null {
  const { today, birthDate, reachedYears } = params;
  if (!birthDate) return null;
  if (today.slice(5) !== birthDate.slice(5)) return null;
  const year = parseInt(today.slice(0, 4), 10);
  if (Number.isNaN(year) || reachedYears.includes(year)) return null;
  return year;
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

  return { kind: "loss", lostKg: milestone };
}

/**
 * 마감된 로그 기준으로 새 '연속 기록일' 마일스톤(7/30/100…)에 도달했는지 판정.
 * 도달 시 achievements에 streak_{N} 1행(UNIQUE) INSERT + 이벤트 반환(작은 토스트용).
 * 목표 달성·감량 마일스톤이 우선이므로 둘 다 없을 때만 log-actions에서 호출한다.
 *
 * 속도: 마감 액션에서만 실행(탭/홈 진입 경로 미접촉). 추가 쿼리는 date 컬럼만 읽는
 * 인덱스(`daily_logs_user_date_idx`) 커버 쿼리 1개 + 업적 1개로, AI 총평 await에 묻힌다.
 */
export async function detectStreakMilestone(
  closedLog: DailyLog
): Promise<MilestoneEvent | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: achRows }, { data: logRows }] = await Promise.all([
    supabase
      .from("achievements")
      .select("type")
      .eq("user_id", user.id)
      .like("type", `${STREAK_PREFIX}%`),
    supabase
      .from("daily_logs")
      .select("date")
      .eq("user_id", user.id)
      .lte("date", closedLog.date)
      .order("date", { ascending: false })
      .limit(STREAK_FETCH_CAP + 1),
  ]);

  const reachedMilestones = (achRows ?? [])
    .map((r) => parseInt((r.type as string).slice(STREAK_PREFIX.length), 10))
    .filter((n) => !Number.isNaN(n));

  const dates = (logRows ?? []).map((r) => r.date as string);
  const currentStreak = computeCurrentStreak(dates, closedLog.date);

  const milestone = decideStreakMilestone({ currentStreak, reachedMilestones });
  if (milestone === null) return null;

  await supabase.from("achievements").insert({
    user_id: user.id,
    type: `${STREAK_PREFIX}${milestone}`,
  });

  return { kind: "streak", streakDays: milestone };
}

/**
 * 역대 최저 체중 '갱신 순간' 판정 — 오늘 체중이 이전까지의 역대 최저보다 낮으면 축하.
 * 하강 구간엔 매일 뜬다(의도). 반복 가능하므로 DB 미저장.
 * 오늘 이전까지의 역대 최저 1행(weight 인덱스 커버)만 읽는다.
 */
export async function detectNewLow(
  closedLog: DailyLog
): Promise<MilestoneEvent | null> {
  if (closedLog.weight === null) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: minRow } = await supabase
    .from("daily_logs")
    .select("weight")
    .eq("user_id", user.id)
    .lt("date", closedLog.date)
    .not("weight", "is", null)
    .order("weight", { ascending: true })
    .limit(1)
    .maybeSingle();

  const isNewLow = decideNewLow({
    weight: closedLog.weight,
    prevMin: (minRow?.weight as number | null) ?? null,
  });
  if (!isNewLow) return null;

  return { kind: "lowest", weight: closedLog.weight };
}

/**
 * D-day 예측 임계(30/14/7일) 진입 판정. 그래프 카드와 동일한 projectGoalEta 로직 사용.
 * 도달 시 achievements 에 eta_{n} 1행(UNIQUE) INSERT + 이벤트 반환.
 */
export async function detectEta(
  closedLog: DailyLog
): Promise<MilestoneEvent | null> {
  if (closedLog.weight === null) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const settings = await getSettings();
  if (!settings.targetWeight || settings.targetWeight <= 0) return null;
  if (!settings.startWeight || settings.startWeight <= 0) return null;
  if (!settings.dietStartDate) return null;
  if (closedLog.weight <= settings.targetWeight) return null; // 이미 목표 도달

  const { daysToGoal } = projectGoalEta({
    startWeight: settings.startWeight,
    currentWeight: closedLog.weight,
    targetWeight: settings.targetWeight,
    startDate: settings.dietStartDate,
    nowMs: new Date(closedLog.date + "T00:00:00").getTime(),
  });

  const { data: rows } = await supabase
    .from("achievements")
    .select("type")
    .eq("user_id", user.id)
    .like("type", `${ETA_PREFIX}%`);

  const reachedThresholds = (rows ?? [])
    .map((r) => parseInt((r.type as string).slice(ETA_PREFIX.length), 10))
    .filter((n) => !Number.isNaN(n));

  const threshold = decideEtaMilestone({ daysToGoal, reachedThresholds });
  if (threshold === null) return null;

  await supabase.from("achievements").insert({
    user_id: user.id,
    type: `${ETA_PREFIX}${threshold}`,
  });

  return { kind: "eta", etaDays: threshold };
}

/**
 * N주 연속 감량(2/4/8/12주) 판정. 주간 로그의 주평균 체중으로 연속 감량 주 수를 센다.
 * 도달 시 weeklyloss_{n} 1행(UNIQUE) INSERT + 이벤트 반환.
 */
export async function detectWeeklyLoss(
  _closedLog: DailyLog
): Promise<MilestoneEvent | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const maxMilestone = WEEKLYLOSS_MILESTONES[WEEKLYLOSS_MILESTONES.length - 1];
  const [weeklyLogs, { data: rows }] = await Promise.all([
    getWeeklyLogs(maxMilestone + 2), // 연속 판정에 필요한 만큼만
    supabase
      .from("achievements")
      .select("type")
      .eq("user_id", user.id)
      .like("type", `${WEEKLYLOSS_PREFIX}%`),
  ]);

  const avgWeightsNewestFirst = weeklyLogs
    .map((w) => w.avgWeight)
    .filter((n): n is number => typeof n === "number" && n > 0);
  const consecutiveLossWeeks = computeConsecutiveLossWeeks(avgWeightsNewestFirst);

  const reachedMilestones = (rows ?? [])
    .map((r) => parseInt((r.type as string).slice(WEEKLYLOSS_PREFIX.length), 10))
    .filter((n) => !Number.isNaN(n));

  const milestone = decideWeeklyLossMilestone({
    consecutiveLossWeeks,
    reachedMilestones,
  });
  if (milestone === null) return null;

  await supabase.from("achievements").insert({
    user_id: user.id,
    type: `${WEEKLYLOSS_PREFIX}${milestone}`,
  });

  return { kind: "weeklyLoss", weeks: milestone };
}

/**
 * 다이어트 N주년(경과일 365 배수) 판정. 도달 시 anniversary_{days} 1행 INSERT + 이벤트.
 */
export async function detectAnniversary(
  closedLog: DailyLog
): Promise<MilestoneEvent | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const settings = await getSettings();
  if (!settings.dietStartDate) return null;

  const elapsedDays =
    Math.floor(
      (new Date(closedLog.date + "T00:00:00").getTime() -
        new Date(settings.dietStartDate + "T00:00:00").getTime()) /
        86_400_000
    ) + 1;

  const { data: rows } = await supabase
    .from("achievements")
    .select("type")
    .eq("user_id", user.id)
    .like("type", `${ANNIVERSARY_PREFIX}%`);

  const reachedYears = (rows ?? [])
    .map((r) => parseInt((r.type as string).slice(ANNIVERSARY_PREFIX.length), 10))
    .filter((n) => !Number.isNaN(n))
    .map((days) => Math.round(days / YEAR_DAYS));

  const year = decideAnniversary({ elapsedDays, reachedYears });
  if (year === null) return null;

  const days = year * YEAR_DAYS;
  await supabase.from("achievements").insert({
    user_id: user.id,
    type: `${ANNIVERSARY_PREFIX}${days}`,
  });

  return { kind: "anniversary", years: year, days };
}

/**
 * 생일 판정 — 마감일 월-일이 settings.birthDate 와 같으면(그 해 최초) 축하.
 * 도달 시 birthday_{YYYY} 1행 INSERT + 이벤트.
 */
export async function detectBirthday(
  closedLog: DailyLog
): Promise<MilestoneEvent | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const settings = await getSettings();
  if (!settings.birthDate) return null;

  const { data: rows } = await supabase
    .from("achievements")
    .select("type")
    .eq("user_id", user.id)
    .like("type", `${BIRTHDAY_PREFIX}%`);

  const reachedYears = (rows ?? [])
    .map((r) => parseInt((r.type as string).slice(BIRTHDAY_PREFIX.length), 10))
    .filter((n) => !Number.isNaN(n));

  const year = decideBirthday({
    today: closedLog.date,
    birthDate: settings.birthDate,
    reachedYears,
  });
  if (year === null) return null;

  await supabase.from("achievements").insert({
    user_id: user.id,
    type: `${BIRTHDAY_PREFIX}${year}`,
  });

  return { kind: "birthday" };
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
  const [logs, settings] = await Promise.all([getLogsForJourney(), getSettings()]);
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

  // 수분 목표 달성은 '그날 적용된 목표'(스냅샷)로 판정한다. 미스냅샷(레거시) 행은
  // 현재 설정값으로 폴백 — 단, 백필 마이그레이션으로 입력일은 모두 스냅샷이 채워져 있다.
  const waterEnteredDays = sorted.filter((l) => l.water !== null).length;
  const waterGoalDays = sorted.filter((l) => {
    if (l.water === null) return false;
    const goal = l.waterGoal ?? settings.waterGoal;
    return goal > 0 && l.water >= goal;
  }).length;

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

  // '세 끼 모두 먹은 날' = 아침·점심·저녁을 모두 실제로 먹은 날.
  // 미입력(null)·"N"·"SKIP"(안 먹음)은 먹은 끼니로 치지 않는다.
  const ateMeal = (v: string | null) => v !== null && v !== "N" && v !== "SKIP";
  const anyMealEnteredDays = sorted.filter(
    (l) => l.breakfast !== null || l.lunch !== null || l.dinner !== null
  ).length;
  const allMealsDays = sorted.filter(
    (l) => ateMeal(l.breakfast) && ateMeal(l.lunch) && ateMeal(l.dinner)
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
