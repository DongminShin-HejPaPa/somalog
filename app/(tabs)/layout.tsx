import { BottomNav } from "@/components/layout/bottom-nav";
import { TabsProviders } from "@/components/layout/tabs-providers";
import { getSettings } from "@/lib/services/settings-service";
import type { Settings } from "@/lib/types";

export default async function TabsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let initialSettings: Settings | null = null;
  try {
    initialSettings = await getSettings();
  } catch {
    // 온보딩 미완료 사용자는 settings 없음 — context가 useEffect로 로드
  }

  return (
    <TabsProviders initialSettings={initialSettings}>
      <div className="pb-14">
        {children}
        <BottomNav />
      </div>
    </TabsProviders>
  );
}
