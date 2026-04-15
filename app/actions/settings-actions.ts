"use server";

import { revalidatePath } from "next/cache";
import {
  getSettings,
  updateSettings,
  initializeSettings,
} from "@/lib/services/settings-service";
import { clearAllCustomFieldValues } from "@/lib/services/daily-log-service";
import type { Settings, SettingsInput, SettingsUpdate } from "@/lib/types";

export async function actionGetSettings(): Promise<Settings> {
  return getSettings();
}

export async function actionUpdateSettings(
  data: SettingsUpdate
): Promise<Settings> {
  const result = await updateSettings(data);
  revalidatePath("/graph");
  revalidatePath("/home");
  return result;
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
