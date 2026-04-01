"use server";

import { revalidatePath } from "next/cache";
import {
  getSettings,
  updateSettings,
  initializeSettings,
} from "@/lib/services/settings-service";
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
