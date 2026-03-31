import { BottomNav } from "@/components/layout/bottom-nav";
import { TabsProviders } from "@/components/layout/tabs-providers";

export default function TabsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TabsProviders>
      <div className="pb-14">
        {children}
        <BottomNav />
      </div>
    </TabsProviders>
  );
}
