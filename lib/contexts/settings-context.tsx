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

interface SettingsContextValue {
  settings: Settings;
  updateSettings: (data: SettingsUpdate) => void;
  initializeSettings: (data: SettingsInput) => void;
  isLoaded: boolean;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(mockSettings);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setSettings(JSON.parse(stored));
      }
    } catch {
      // ignore parse errors
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

  return (
    <SettingsContext.Provider
      value={{ settings, updateSettings, initializeSettings, isLoaded }}
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
