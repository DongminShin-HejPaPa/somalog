"use client";

import { SettingsProvider } from "@/lib/contexts/settings-context";
import type { Settings } from "@/lib/types";

interface TabsProvidersProps {
  children: React.ReactNode;
  initialSettings: Settings | null;
}

export function TabsProviders({ children, initialSettings }: TabsProvidersProps) {
  return (
    <SettingsProvider initialSettings={initialSettings}>
      {children}
    </SettingsProvider>
  );
}
