import { after } from "next/server";
import { BottomNav } from "@/components/layout/bottom-nav";
import { TabsProviders } from "@/components/layout/tabs-providers";
import { getSettings } from "@/lib/services/settings-service";
import { getAuthUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Settings } from "@/lib/types";

export default async function TabsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let initialSettings: Settings | null = null;
  let userId: string | null = null;
  try {
    const [user, s] = await Promise.all([getAuthUser(), getSettings()]);
    userId = user?.id ?? null;
    // onboardingComplete=false 는 DB에 설정이 없거나 인증 일시 실패인 경우.
    // null로 처리해 클라이언트가 localStorage 캐시 → actionGetSettings() 순으로 재시도하도록 함.
    initialSettings = s.onboardingComplete ? s : null;

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
    // 온보딩 미완료 또는 오류 — context가 useEffect로 로드
  }

  return (
    <TabsProviders initialSettings={initialSettings} userId={userId}>
      <div className="pb-14">
        {children}
        <BottomNav />
      </div>
    </TabsProviders>
  );
}
