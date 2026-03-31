import { mockSettings } from "@/lib/mock-data";
import type { Settings, SettingsInput, SettingsUpdate } from "@/lib/types";
import { formatDate } from "@/lib/utils/date-utils";

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
    routineEnergyTime: "21:00",
    routineExtra: [],
    intensiveDayOn: true,
    intensiveDayCriteria: "역대최저",
    coachStylePreset: "strong",
    coachStyleExtra: [],
    defaultTab: "input",
    onboardingComplete: false,
  };
}

let settings: Settings = createDefaultSettings();

export async function getSettings(): Promise<Settings> {
  return { ...settings };
}

export async function updateSettings(data: SettingsUpdate): Promise<Settings> {
  settings = { ...settings, ...data };
  return { ...settings };
}

export async function initializeSettings(data: SettingsInput): Promise<Settings> {
  settings = { ...data, onboardingComplete: true };
  return { ...settings };
}

export function resetSettings(): void {
  settings = createDefaultSettings();
}

export function loadMockSettings(): void {
  settings = { ...mockSettings };
}
