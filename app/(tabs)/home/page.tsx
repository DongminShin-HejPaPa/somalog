import Link from "next/link";
import { HomeContent } from "@/components/home/home-content";
import { getTodayLog, getRecentDailyLogs } from "@/lib/services/daily-log-service";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  // 이름 표시 목적으로만 사용 (인증은 middleware가 담당)
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
  const displayName = user?.user_metadata?.full_name
    ?? user?.email?.split("@")[0]
    ?? null;

  const [todayLog, recentLogs] = await Promise.all([
    getTodayLog(),
    getRecentDailyLogs(14),
  ]);

  return (
    <div className="pb-6">
      <header className="px-4 pt-4 pb-2 flex items-center justify-between">
        <h1 className="text-lg font-bold">Soma Log</h1>
        {displayName ? (
          <span className="text-xs text-muted-foreground">{displayName} 님</span>
        ) : (
          <Link
            href="/login"
            className="px-3 py-1.5 rounded-lg border border-navy text-navy text-xs font-semibold hover:bg-navy hover:text-white active:scale-[0.97] transition-all"
          >
            로그인
          </Link>
        )}
      </header>

      <HomeContent todayLog={todayLog} recentLogs={recentLogs} />
    </div>
  );
}
