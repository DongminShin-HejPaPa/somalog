"use client";

import { SettingsProvider } from "@/lib/contexts/settings-context";
import { NoticePopup } from "@/components/notices/notice-popup";
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
      {/* 중요 공지 팝업 — 로그인 사용자에게만 (settings가 null이면 미인증) */}
      {initialSettings && (
        <NoticePopup lastNoticeSeenAt={initialSettings.lastNoticeSeenAt} />
      )}
    </SettingsProvider>
  );
}
