import { after } from "next/server";
import { BottomNav } from "@/components/layout/bottom-nav";
import { TabsProviders } from "@/components/layout/tabs-providers";
import { getAuthUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function TabsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 이전엔 `await Promise.all([getAuthUser(), getSettings()])` 로 settings 까지
  // 서버에서 await 했으나, getSettings 가 Supabase 쿼리라 캐시 미스 시 HTML
  // 응답을 ~300-500ms 늦췄다. 캐시 미스 케이스의 respEnd 가 1.5초로 측정된 원인.
  // SettingsProvider 는 initialSettings=null 이어도 클라이언트에서 localStorage 캐시
  // → actionGetSettings() 순으로 자체 로드하는 fallback 경로를 이미 갖고 있어
  // (settings-context.tsx:120) 회귀 없이 제거 가능. NoticePopup 은 initialSettings
  // 의존을 없애고 context 에서 직접 읽도록 리팩토 (notice-popup.tsx).
  let userId: string | null = null;
  try {
    const user = await getAuthUser();
    userId = user?.id ?? null;

    // 응답 전송 후 last_seen_at 업데이트 (활성 사용자 추적용)
    if (userId) {
      after(async () => {
        // createClient()는 응답 후엔 쿠키 컨텍스트가 없어 인증 실패 → service_role 사용
        const adminClient = createAdminClient();
        await adminClient
          .from("user_profiles")
          .update({ last_seen_at: new Date().toISOString() })
          .eq("user_id", userId);
      });
    }
  } catch {
    // 인증 실패 — context 가 클라이언트에서 자체 처리
  }

  return (
    <TabsProviders initialSettings={null} userId={userId}>
      <div className="pb-20">
        {children}
        <BottomNav />
      </div>
    </TabsProviders>
  );
}
