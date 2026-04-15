import { cache } from "react";
import { revalidateTag } from "next/cache";
import { getAuthUser } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server";
import type { Settings, SettingsInput, SettingsUpdate, CustomFieldDef } from "@/lib/types";
import { formatDate } from "@/lib/utils/date-utils";
import { mockSettings } from "@/lib/mock-data-new";

export function createDefaultSettings(): Settings {
  return {
    coachName: "Soma",
    height: 0,
    currentWeight: 0,
    gender: "남성",
    dietStartDate: formatDate(new Date()),
    startWeight: 0,
    targetWeight: 0,
    dietPreset: "sustainable",
    targetMonths: 12,
    waterGoal: 2.8,
    routineWeightTime: "아침 기상 직후",
    routineExtra: [],
    intensiveDayOn: true,
    intensiveDayCriteria: "역대최저",
    coachStylePreset: "strong",
    coachStyleExtra: [],
    customField: null,
    onboardingComplete: false,
    lastNoticeSeenAt: null,
  };
}

function rowToSettings(row: Record<string, unknown>): Settings {
  return {
    coachName: (row.coach_name as string) ?? "Soma",
    height: (row.height as number) ?? 0,
    currentWeight: (row.current_weight as number) ?? 0,
    gender: (row.gender as "남성" | "여성") ?? "남성",
    dietStartDate: (row.diet_start_date as string) ?? formatDate(new Date()),
    startWeight: (row.start_weight as number) ?? 0,
    targetWeight: (row.target_weight as number) ?? 0,
    dietPreset:
      (row.diet_preset as "easygoing" | "sustainable" | "medium" | "intensive" | "custom") ??
      "sustainable",
    targetMonths: (row.target_months as number) ?? 12,
    waterGoal: (row.water_goal as number) ?? 2.8,
    routineWeightTime:
      (row.routine_weight_time as string) ?? "아침 기상 직후",
    routineExtra: (row.routine_extra as string[]) ?? [],
    intensiveDayOn: (row.intensive_day_on as boolean) ?? true,
    intensiveDayCriteria:
      (row.intensive_day_criteria as
        | "역대최저"
        | "0.5kg"
        | "1.0kg"
        | "직접입력") ?? "역대최저",
    coachStylePreset:
      (row.coach_style_preset as "strong" | "balanced" | "empathy" | "data") ??
      "strong",
    coachStyleExtra: (row.coach_style_extra as string[]) ?? [],
    customField: (row.custom_field as CustomFieldDef | null) ?? null,
    onboardingComplete: ((row.onboarding_complete as boolean) ?? false) || !!(row.diet_start_date as string),
    lastNoticeSeenAt: (row.last_notice_seen_at as string | null) ?? null,
  };
}

function settingsToRow(
  s: Settings | SettingsInput,
  userId: string
): Record<string, unknown> {
  return {
    user_id: userId,
    coach_name: s.coachName,
    height: s.height,
    current_weight: s.currentWeight,
    gender: s.gender,
    diet_start_date: s.dietStartDate,
    start_weight: s.startWeight,
    target_weight: s.targetWeight,
    diet_preset: s.dietPreset,
    target_months: s.targetMonths,
    water_goal: s.waterGoal,
    routine_weight_time: s.routineWeightTime,
    routine_extra: s.routineExtra,
    intensive_day_on: s.intensiveDayOn,
    intensive_day_criteria: s.intensiveDayCriteria,
    coach_style_preset: s.coachStylePreset,
    coach_style_extra: s.coachStyleExtra,
    custom_field: "customField" in s ? s.customField : null,
    onboarding_complete:
      "onboardingComplete" in s ? s.onboardingComplete : false,
    last_notice_seen_at:
      "lastNoticeSeenAt" in s ? s.lastNoticeSeenAt : undefined,
  };
}

/**
 * 동일 요청 내 중복 DB 호출 방지용 React.cache() 메모이제이션.
 * unstable_cache는 내부에서 cookies()를 쓸 수 없어 Next.js 15에서 에러 발생 — React.cache()로 대체.
 */
const fetchSettingsOnce = cache(async (userId: string): Promise<Settings | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("settings")
    .select("*")
    .eq("user_id", userId)
    .single();
  if (error || !data) return null;
  return rowToSettings(data as Record<string, unknown>);
});

export async function getSettings(): Promise<Settings> {
  const user = await getAuthUser();
  if (!user) return createDefaultSettings();
  return (await fetchSettingsOnce(user.id)) ?? createDefaultSettings();
}

export async function updateSettings(data: SettingsUpdate): Promise<Settings> {
  const user = await getAuthUser();
  if (!user) throw new Error("Unauthorized");

  const current = await getSettings();
  const merged: Settings = { ...current, ...data };

  const supabase = await createClient();
  const row = settingsToRow(merged, user.id);

  const { data: upserted, error } = await supabase
    .from("settings")
    .upsert(row, { onConflict: "user_id" })
    .select()
    .single();

  if (error || !upserted) throw new Error(error?.message ?? "upsert failed");

  revalidateTag(`settings-${user.id}`);
  return rowToSettings(upserted as Record<string, unknown>);
}

export async function initializeSettings(
  data: SettingsInput
): Promise<Settings> {
  const user = await getAuthUser();
  if (!user) throw new Error("Unauthorized");

  const full: Settings = { ...data, customField: null, onboardingComplete: true, lastNoticeSeenAt: null };
  const supabase = await createClient();
  const row = settingsToRow(full, user.id);

  const { data: upserted, error } = await supabase
    .from("settings")
    .upsert(row, { onConflict: "user_id" })
    .select()
    .single();

  if (error || !upserted) throw new Error(error?.message ?? "upsert failed");

  revalidateTag(`settings-${user.id}`);
  return rowToSettings(upserted as Record<string, unknown>);
}

export async function resetSettings(): Promise<void> {
  const user = await getAuthUser();
  if (!user) return;

  const supabase = await createClient();
  await supabase.from("settings").delete().eq("user_id", user.id);
  revalidateTag(`settings-${user.id}`);
}

export async function loadMockSettings(): Promise<void> {
  const user = await getAuthUser();
  if (!user) return;

  const supabase = await createClient();
  const row = settingsToRow(mockSettings, user.id);

  await supabase
    .from("settings")
    .upsert(row, { onConflict: "user_id" });
  revalidateTag(`settings-${user.id}`);
}
