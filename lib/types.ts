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
  onboardingComplete: boolean;
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

/** 개별 삭제 가능한 필드 */
export type ClearableField = "weight" | "water" | "exercise" | "breakfast" | "lunch" | "dinner" | "lateSnack";

export type SettingsInput = Omit<Settings, "onboardingComplete">;

export type SettingsUpdate = Partial<Settings>;
