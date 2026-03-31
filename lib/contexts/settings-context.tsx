"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import type { Settings, SettingsUpdate, SettingsInput } from "@/lib/types";
import { mockSettings } from "@/lib/mock-data";

const STORAGE_KEY = "somalog-settings";

const DEFAULT_SETTINGS: Settings = {
  coachName: "Soma",
  height: 0,
  currentWeight: 0,
  gender: "남성",
  dietStartDate: "",
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

interface SettingsContextValue {
  settings: Settings;
  updateSettings: (data: SettingsUpdate) => void;
  initializeSettings: (data: SettingsInput) => void;
  resetAllSettings: () => void;
  loadDemoSettings: () => void;
  isLoaded: boolean;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  // SSR-safe 초기값으로 mockSettings 사용 (hydration mismatch 방지)
  const [settings, setSettings] = useState<Settings>(mockSettings);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setSettings(JSON.parse(stored));
      } else {
        // localStorage 없음 = 신규 유저 → onboardingComplete: false 기본값 사용
        setSettings(DEFAULT_SETTINGS);
      }
    } catch {
      setSettings(DEFAULT_SETTINGS);
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    }
  }, [settings, isLoaded]);

  const updateSettings = useCallback((data: SettingsUpdate) => {
    setSettings((prev) => ({ ...prev, ...data }));
  }, []);

  const initializeSettings = useCallback((data: SettingsInput) => {
    setSettings({ ...data, onboardingComplete: true });
  }, []);

  /** 모든 설정 + localStorage 초기화 */
  const resetAllSettings = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setSettings(DEFAULT_SETTINGS);
  }, []);

  /** 데모 데이터로 설정 교체 */
  const loadDemoSettings = useCallback(() => {
    setSettings({ ...mockSettings });
  }, []);

  return (
    <SettingsContext.Provider
      value={{
        settings,
        updateSettings,
        initializeSettings,
        resetAllSettings,
        loadDemoSettings,
        isLoaded,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error("useSettings must be used within SettingsProvider");
  }
  return ctx;
}
