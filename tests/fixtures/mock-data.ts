import { vi } from "vitest";
import type { DailyLog, WeeklyLog, Settings } from "@/lib/types";

/** 테스트용 유저 ID */
export const MOCK_USER_ID = "test-user-uuid-1234";

/** 테스트용 Settings (camelCase) */
export const mockSettings: Settings = {
  coachName: "Soma",
  height: 170,
  currentWeight: 80,
  gender: "남성",
  dietStartDate: "2024-01-01",
  startWeight: 85,
  targetWeight: 70,
  dietPreset: "sustainable",
  targetMonths: 12,
  waterGoal: 2.5,
  routineWeightTime: "아침 기상 직후",
  routineExtra: [],
  intensiveDayOn: true,
  intensiveDayCriteria: "역대최저",
  coachStylePreset: "strong",
  coachStyleExtra: [],
  onboardingComplete: true,
};

/** 테스트용 Settings DB row (snake_case) */
export const mockSettingsRow: Record<string, unknown> = {
  user_id: MOCK_USER_ID,
  coach_name: "Soma",
  height: 170,
  current_weight: 80,
  gender: "남성",
  diet_start_date: "2024-01-01",
  start_weight: 85,
  target_weight: 70,
  diet_preset: "sustainable",
  target_months: 12,
  water_goal: 2.5,
  routine_weight_time: "아침 기상 직후",
  routine_extra: [],
  intensive_day_on: true,
  intensive_day_criteria: "역대최저",
  coach_style_preset: "strong",
  coach_style_extra: [],
  onboarding_complete: true,
};

/** 테스트용 DailyLog (camelCase) */
export const mockDailyLog: DailyLog = {
  date: "2024-01-15",
  day: 15,
  weight: 80.0,
  avgWeight3d: 80.2,
  weightChange: -5.0,
  water: 2.0,
  exercise: "Y",
  breakfast: "오트밀",
  lunch: "샐러드",
  dinner: "닭가슴살",
  lateSnack: "N",
  note: null,
  closed: false,
  intensiveDay: false,
  feedback: "잘하고 있어.",
  dailySummary: null,
  oneLiner: null,
};

/** 테스트용 DailyLog DB row (snake_case) */
export const mockDailyLogRow: Record<string, unknown> = {
  id: "row-uuid-1234",
  user_id: MOCK_USER_ID,
  date: "2024-01-15",
  day: 15,
  weight: 80.0,
  avg_weight_3d: 80.2,
  weight_change: -5.0,
  water: 2.0,
  exercise: "Y",
  breakfast: "오트밀",
  lunch: "샐러드",
  dinner: "닭가슴살",
  late_snack: "N",
  note: null,
  closed: false,
  intensive_day: false,
  feedback: "잘하고 있어.",
  daily_summary: null,
  one_liner: null,
};

/** 테스트용 WeeklyLog (camelCase) */
export const mockWeeklyLog: WeeklyLog = {
  weekStart: "2024-01-15",
  weekEnd: "2024-01-21",
  avgWeight: 80.1,
  exerciseDays: 4,
  lateSnackCount: 1,
  weeklySummary: "이번 주 평균 체중은 80.1kg.",
};

/** 테스트용 WeeklyLog DB row (snake_case) */
export const mockWeeklyLogRow: Record<string, unknown> = {
  id: "weekly-uuid-1234",
  user_id: MOCK_USER_ID,
  week_start: "2024-01-15",
  week_end: "2024-01-21",
  avg_weight: 80.1,
  exercise_days: 4,
  late_snack_count: 1,
  weekly_summary: "이번 주 평균 체중은 80.1kg.",
};

/** Supabase auth.getUser() 모킹용 */
export const mockUser = {
  id: MOCK_USER_ID,
  email: "test@example.com",
};

/** createClient() 모킹 헬퍼 — Supabase 체이닝 구현 */
export function createMockSupabaseClient(overrides: {
  selectData?: unknown;
  selectError?: unknown;
  upsertData?: unknown;
  upsertError?: unknown;
  deleteError?: unknown;
} = {}) {
  const mockSingle = vi.fn().mockResolvedValue({
    data: overrides.selectData ?? null,
    error: overrides.selectError ?? null,
  });

  const mockSelect = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnThis(),
    single: mockSingle,
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({
      data: overrides.selectData ?? [],
      error: overrides.selectError ?? null,
    }),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
  });

  const mockUpsert = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({
        data: overrides.upsertData ?? null,
        error: overrides.upsertError ?? null,
      }),
    }),
  });

  const mockDelete = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({
      error: overrides.deleteError ?? null,
    }),
  });

  const mockFrom = vi.fn().mockReturnValue({
    select: mockSelect,
    upsert: mockUpsert,
    delete: mockDelete,
  });

  return {
    from: mockFrom,
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: mockUser },
      }),
    },
  };
}
