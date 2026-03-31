"use client";

import { SettingsProvider } from "@/lib/contexts/settings-context";

export function TabsProviders({ children }: { children: React.ReactNode }) {
  return <SettingsProvider>{children}</SettingsProvider>;
}
