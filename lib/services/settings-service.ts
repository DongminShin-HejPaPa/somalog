import { mockSettings } from "@/lib/mock-data";
import type { Settings, SettingsInput, SettingsUpdate } from "@/lib/types";

let settings: Settings = { ...mockSettings };

export async function getSettings(): Promise<Settings> {
  return { ...settings };
}

export async function updateSettings(
  data: SettingsUpdate
): Promise<Settings> {
  settings = { ...settings, ...data };
  return { ...settings };
}

export async function initializeSettings(
  data: SettingsInput
): Promise<Settings> {
  settings = { ...data, onboardingComplete: true };
  return { ...settings };
}
