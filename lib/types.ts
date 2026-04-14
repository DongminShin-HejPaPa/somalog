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
  defaultTab: "input" | "home";
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
>;

export type DailyLogUpdate = Partial<DailyLogInput>;

export type SettingsInput = Omit<Settings, "onboardingComplete" | "lastNoticeSeenAt">;

export type SettingsUpdate = Partial<Settings>;
