export interface CustomFieldDef {
  name: string;                // 맞춤 입력 이름 (예: "간식")
  type: "text" | "select";    // 입력 종류
  options?: string[];          // 선택형일 경우 선택지 (최대 3개)
}

export interface DailyLog {
  date: string;
  day: number;
  weight: number | null;
  avgWeight3d: number | null;
  weightChange: number | null;
  water: number | null;
  exercise: string | null;
  breakfast: string | null;
  lunch: string | null;
  dinner: string | null;
  dinnerAlcohol?: boolean | null;
  lateSnack: string | null;
  lateSnackAlcohol?: boolean | null;
  customFieldValue?: string | null;
  note: string | null;
  closed: boolean;
  intensiveDay: boolean | null;
  feedback: string | null;
  dailySummary: string | null;
  oneLiner: string | null;
}

export interface WeeklyLog {
  weekStart: string;
  weekEnd: string;
  avgWeight: number;
  exerciseDays: number;
  lateSnackCount: number;
  weeklySummary: string;
}

export interface Settings {
  coachName: string;
  height: number;
  currentWeight: number;
  gender: "남성" | "여성";
  birthDate: string | null; // YYYY-MM-DD, null = 미입력
  activityLevel: number;    // TDEE 활동 계수 (1.2/1.375/1.55/1.725)
  dietStartDate: string;
  startWeight: number;
  targetWeight: number;
  dietPreset: "easygoing" | "sustainable" | "medium" | "intensive" | "custom";
  targetMonths: number;
  waterGoal: number;
  routineWeightTime: string;
  routineExtra: string[];
  intensiveDayOn: boolean;
  // "역대최저" | "0.5kg" | "1.0kg" 는 프리셋, 그 외 숫자 문자열(e.g. "1.5")은 직접입력 커스텀 값
  intensiveDayCriteria: string;
  coachStylePreset: "strong" | "balanced" | "empathy" | "data";
  coachStyleExtra: string[];
  customField: CustomFieldDef | null; // 맞춤 입력 필드 정의
  mode: "losing" | "maintaining"; // 감량 모드 / (목표 달성 후) 유지 모드
  onboardingComplete: boolean;
  lastNoticeSeenAt: string | null; // ISO string — 마지막 공지 팝업 확인 시각
}

// ─── 목표 달성 경험 (Goal Achievement) ───

/** 목표 달성 순간의 스냅샷 — 세리머니/리포트/명예의 전당에서 사용 */
export interface GoalSnapshot {
  startWeight: number;
  targetWeight: number;
  finalWeight: number;   // 달성한 날의 체중
  daysElapsed: number;   // D+N
  recordedDays: number;  // 기록한 날 수
  coachName: string;
}

/** 마감 직후 클라이언트에 전달되는 목표 달성 이벤트 */
export interface GoalEvent {
  kind: "first" | "repeat"; // first = 최초 달성(풀 세리머니), repeat = 재달성(미니 토스트)
  snapshot: GoalSnapshot;
}

/** achievements 테이블 1행 */
export interface Achievement {
  id: string;
  type: string;
  achievedAt: string;  // ISO
  payload: GoalSnapshot | null;
  seenAt: string | null;
}

/** actionCloseDailyLog 반환 — 마감된 로그 + 목표 이벤트(있으면) */
export interface CloseDailyLogResult {
  log: DailyLog | null;
  goalEvent: GoalEvent | null;
}

/** 여정 회고 리포트 (2막) — 전체 기록 집계 */
export interface JourneyReport {
  startWeight: number;
  finalWeight: number;
  totalLoss: number;       // startWeight - finalWeight (양수 = 감량)
  daysElapsed: number;     // 시작일~달성일
  recordedDays: number;    // 기록한 날 수
  lowestWeight: number;
  exerciseDays: number;
  exerciseRate: number;    // 운동한 날 / 기록일 (%)
  waterGoalDays: number;   // 수분 목표 달성일 수
  longestStreak: number;   // 최장 연속 기록일
  hardResetSurvived: number; // Hard Reset Mode였던 날 수
}

export interface Notice {
  id: string;
  title: string;
  content: string;
  author: string;
  publishedAt: string; // ISO string
  isImportant: boolean;
}

export interface NoticeComment {
  id: string;
  noticeId: string;
  userId: string;
  name: string;
  content: string;
  createdAt: string; // ISO string
  updatedAt: string;
}

export type DailyLogInput = Pick<
  DailyLog,
  | "weight"
  | "water"
  | "exercise"
  | "breakfast"
  | "lunch"
  | "dinner"
  | "dinnerAlcohol"
  | "lateSnack"
  | "lateSnackAlcohol"
  | "note"
> & { customFieldValue?: string | null };

export type DailyLogUpdate = Partial<DailyLogInput>;

/** 개별 삭제 가능한 필드 */
export type ClearableField = "weight" | "water" | "exercise" | "breakfast" | "lunch" | "dinner" | "lateSnack" | "customFieldValue";

export type SettingsInput = Omit<Settings, "onboardingComplete" | "lastNoticeSeenAt" | "customField" | "mode">;

export type SettingsUpdate = Partial<Settings>;
