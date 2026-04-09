"use client";

import { SettingsProvider } from "@/lib/contexts/settings-context";
import type { Settings } from "@/lib/types";

interface TabsProvidersProps {
  children: React.ReactNode;
  initialSettings: Settings | null;
  userId: string | null;
}

export function TabsProviders({ children, initialSettings, userId }: TabsProvidersProps) {
  return (
    <SettingsProvider initialSettings={initialSettings} userId={userId}>
      {children}
    </SettingsProvider>
  );
}
