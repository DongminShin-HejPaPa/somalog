"use server";

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
  return updateSettings(data);
}

export async function actionInitializeSettings(
  data: SettingsInput
): Promise<Settings> {
  return initializeSettings(data);
}
