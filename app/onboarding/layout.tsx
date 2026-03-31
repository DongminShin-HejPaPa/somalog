import { SettingsProvider } from "@/lib/contexts/settings-context";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SettingsProvider>{children}</SettingsProvider>;
}
