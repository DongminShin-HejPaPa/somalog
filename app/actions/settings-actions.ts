"use server";

import { revalidatePath } from "next/cache";
import {
  getSettings,
  updateSettings,
  updateInputPresets,
  initializeSettings,
} from "@/lib/services/settings-service";
import { clearAllCustomFieldValues } from "@/lib/services/daily-log-service";
import { deleteGoalAchievement } from "@/lib/services/achievement-service";
import type { Settings, SettingsInput, SettingsUpdate, InputPresets } from "@/lib/types";

export async function actionGetSettings(): Promise<Settings> {
  return getSettings();
}

export async function actionUpdateSettings(
  data: SettingsUpdate
): Promise<Settings> {
  // 목표 체중이 바뀌면 기존 goal_reached 를 초기화 → 새 목표 달성 시 풀 세레머니 재발동
  if (data.targetWeight !== undefined) {
    const current = await getSettings();
    if (current.targetWeight !== data.targetWeight) {
      await deleteGoalAchievement().catch(() => {});
    }
  }
  const result = await updateSettings(data);
  revalidatePath("/graph");
  revalidatePath("/home");
  return result;
}

/**
 * 자주 쓰는 메뉴 전용 경량 저장.
 * actionUpdateSettings 와 달리 revalidatePath 를 부르지 않는다 — 프리셋은 서버 컴포넌트가
 * 읽지 않으므로 무효화할 캐시가 없고, 무효화하면 탭 전환 prefetch 만 버려진다.
 */
export async function actionUpdateInputPresets(
  presets: InputPresets
): Promise<InputPresets | null> {
  try {
    return await updateInputPresets(presets);
  } catch {
    return null;
  }
}

export async function actionInitializeSettings(
  data: SettingsInput
): Promise<Settings> {
  const result = await initializeSettings(data);
  revalidatePath("/", "layout");
  return result;
}

/**
 * 맞춤 입력 필드 삭제:
 * 1. settings.custom_field → null
 * 2. 모든 daily_logs.custom_field_value → null
 */
export async function actionDeleteCustomField(): Promise<Settings> {
  await clearAllCustomFieldValues();
  const result = await updateSettings({ customField: null });
  revalidatePath("/home");
  revalidatePath("/log");
  revalidatePath("/graph");
  return result;
}
