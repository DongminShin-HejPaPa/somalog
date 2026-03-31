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
import {
  actionGetSettings,
  actionUpdateSettings,
  actionInitializeSettings,
} from "@/app/actions/settings-actions";

export const DEFAULT_SETTINGS: Settings = {
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
  // SSR-safe 초기값으로 DEFAULT_SETTINGS 사용 (hydration mismatch 방지)
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const loaded = await actionGetSettings();
        setSettings(loaded);
      } catch {
        setSettings(DEFAULT_SETTINGS);
      } finally {
        setIsLoaded(true);
      }
    };
    loadSettings();
  }, []);

  const updateSettings = useCallback(async (data: SettingsUpdate) => {
    try {
      const updated = await actionUpdateSettings(data);
      setSettings(updated);
    } catch {
      // 실패 시 로컬 state만 업데이트 (낙관적 업데이트)
      setSettings((prev) => ({ ...prev, ...data }));
    }
  }, []);

  const initializeSettings = useCallback(async (data: SettingsInput) => {
    try {
      const initialized = await actionInitializeSettings(data);
      setSettings(initialized);
    } catch {
      setSettings({ ...data, onboardingComplete: true });
    }
  }, []);

  /** 모든 설정을 DEFAULT_SETTINGS로 리셋 (실제 데이터 삭제는 settings-form에서 serverResetAllData 호출) */
  const resetAllSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, []);

  /** 데모 데이터로 설정 state 교체 (실제 데이터 로드는 settings-form에서 serverLoadDemoData 호출 후 이 함수로 상태 동기화) */
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
