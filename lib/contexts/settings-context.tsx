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
import { mockSettings } from "@/lib/mock-data-new";
import {
  actionGetSettings,
  actionUpdateSettings,
  actionInitializeSettings,
} from "@/app/actions/settings-actions";

const SETTINGS_CACHE_KEY = "somalog-settings";

function readCachedSettings(): Settings | null {
  try {
    const raw = localStorage.getItem(SETTINGS_CACHE_KEY);
    if (!raw) return null;
    const parsed: Settings = JSON.parse(raw);
    // onboardingComplete=false 이면 초기/손상된 상태로 판단 → 무시
    if (!parsed.onboardingComplete) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCachedSettings(s: Settings): void {
  try {
    localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(s));
  } catch {
    // 저장 실패 무시 (용량 초과 등)
  }
}

function clearCachedSettings(): void {
  try {
    localStorage.removeItem(SETTINGS_CACHE_KEY);
  } catch {
    // 무시
  }
}

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
  routineExtra: [],
  intensiveDayOn: true,
  intensiveDayCriteria: "역대최저",
  coachStylePreset: "strong",
  coachStyleExtra: [],
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

export function SettingsProvider({
  children,
  initialSettings,
}: {
  children: ReactNode;
  initialSettings?: Settings | null;
}) {
  const [settings, setSettings] = useState<Settings>(() => {
    // SSR에서는 initialSettings 우선, 없으면 DEFAULT
    return initialSettings ?? DEFAULT_SETTINGS;
  });
  const [isLoaded, setIsLoaded] = useState(initialSettings != null);

  useEffect(() => {
    // 서버에서 이미 settings를 받았으면 localStorage에 쓰고 fetch 생략
    if (initialSettings != null) {
      if (initialSettings.onboardingComplete) {
        writeCachedSettings(initialSettings);
      }
      return;
    }

    // 서버 데이터 없는 경우: localStorage 캐시 즉시 적용 → 빈 화면 최소화
    const cached = readCachedSettings();
    if (cached) {
      setSettings(cached);
      setIsLoaded(true);
    }

    const loadSettings = async () => {
      try {
        const loaded = await actionGetSettings();
        if (loaded.onboardingComplete) {
          setSettings(loaded);
          writeCachedSettings(loaded);
        }
        // onboardingComplete=false → DB에 설정 없거나 인증 일시 실패 → 캐시 설정 유지
      } catch {
        if (!cached) setSettings(DEFAULT_SETTINGS);
      } finally {
        setIsLoaded(true);
      }
    };
    loadSettings();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const updateSettings = useCallback(async (data: SettingsUpdate) => {
    try {
      const updated = await actionUpdateSettings(data);
      setSettings(updated);
      if (updated.onboardingComplete) writeCachedSettings(updated);
    } catch {
      // 실패 시 로컬 state만 업데이트 (낙관적 업데이트)
      setSettings((prev) => {
        const next = { ...prev, ...data };
        if (next.onboardingComplete) writeCachedSettings(next);
        return next;
      });
    }
  }, []);

  const initializeSettings = useCallback(async (data: SettingsInput) => {
    try {
      const initialized = await actionInitializeSettings(data);
      setSettings(initialized);
      writeCachedSettings(initialized);
    } catch {
      const fallback: Settings = { ...data, onboardingComplete: true };
      setSettings(fallback);
      writeCachedSettings(fallback);
    }
  }, []);

  /** 모든 설정을 DEFAULT_SETTINGS로 리셋 (실제 데이터 삭제는 settings-form에서 serverResetAllData 호출) */
  const resetAllSettings = useCallback(() => {
    clearCachedSettings();
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
