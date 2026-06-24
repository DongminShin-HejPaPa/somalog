"use client";

import { SettingsProvider } from "@/lib/contexts/settings-context";
import { ChapterScopeProvider } from "@/lib/contexts/chapter-scope-context";
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
      <ChapterScopeProvider userId={userId}>
        {children}
        {/* NoticePopup 은 항상 마운트. 내부에서 useSettings 로 isLoaded +
            onboardingComplete + lastNoticeSeenAt 을 읽어 자체 gating.
            (tabs)/layout 의 getSettings await 를 제거해도 (initialSettings=null)
            공지 기능이 살아있도록 prop 의존 제거. */}
        <NoticePopup />
      </ChapterScopeProvider>
    </SettingsProvider>
  );
}
