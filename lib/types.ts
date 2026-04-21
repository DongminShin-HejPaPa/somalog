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
  exercise: "Y" | "N" | null;
  breakfast: string | null;
  lunch: string | null;
  dinner: string | null;
  lateSnack: "Y" | "N" | null;
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
  onboardingComplete: boolean;
  lastNoticeSeenAt: string | null; // ISO string — 마지막 공지 팝업 확인 시각
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
  | "lateSnack"
  | "note"
> & { customFieldValue?: string | null };

export type DailyLogUpdate = Partial<DailyLogInput>;

/** 개별 삭제 가능한 필드 */
export type ClearableField = "weight" | "water" | "exercise" | "breakfast" | "lunch" | "dinner" | "lateSnack" | "customFieldValue";

export type SettingsInput = Omit<Settings, "onboardingComplete" | "lastNoticeSeenAt" | "customField">;

export type SettingsUpdate = Partial<Settings>;
