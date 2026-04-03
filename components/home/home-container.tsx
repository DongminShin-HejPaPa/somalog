"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import { actionGetDailyLog, actionGetRecentDailyLogs } from "@/app/actions/log-actions";
import { HomeContent } from "./home-content";
import { formatDate } from "@/lib/utils/date-utils";
import type { DailyLog } from "@/lib/types";

export function HomeContainer() {
  // undefined = 로딩 중
  const [displayName, setDisplayName] = useState<string | null | undefined>(undefined);
  const [todayLog, setTodayLog] = useState<DailyLog | null | undefined>(undefined);
  const [recentLogs, setRecentLogs] = useState<DailyLog[] | undefined>(undefined);

  useEffect(() => {
    // 로컬 세션에서 이름 읽기 (네트워크 호출 없음)
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!
    );
    supabase.auth.getSession().then(({ data: { session } }) => {
      const user = session?.user;
      setDisplayName(
        (user?.user_metadata?.full_name as string) ??
        user?.email?.split("@")[0] ??
        null
      );
    });

    // 로그 데이터 병렬 페치
    const today = formatDate(new Date());
    Promise.all([
      actionGetDailyLog(today),
      actionGetRecentDailyLogs(14),
    ]).then(([log, logs]) => {
      setTodayLog(log);
      setRecentLogs(logs);
    });
  }, []);

  const isLoading = todayLog === undefined || recentLogs === undefined;

  return (
    <div className="pb-6">
      <header className="px-4 pt-4 pb-2 flex items-center justify-between">
        <h1 className="text-lg font-bold">Soma Log</h1>
        {displayName !== undefined && (
          displayName ? (
            <span className="text-xs text-muted-foreground">{displayName} 님</span>
          ) : (
            <Link
              href="/login"
              className="px-3 py-1.5 rounded-lg border border-navy text-navy text-xs font-semibold hover:bg-navy hover:text-white active:scale-[0.97] transition-all"
            >
              로그인
            </Link>
          )
        )}
      </header>

      {isLoading ? (
        <HomeSkeleton />
      ) : (
        <HomeContent todayLog={todayLog ?? null} recentLogs={recentLogs ?? []} />
      )}
    </div>
  );
}

function HomeSkeleton() {
  return (
    <div className="px-4 space-y-3 mt-2 animate-pulse">
      <div className="h-20 bg-secondary rounded-xl" />
      <div className="grid grid-cols-4 gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-16 bg-secondary rounded-xl" />
        ))}
      </div>
      <div className="h-20 bg-secondary rounded-xl" />
      <div className="h-44 bg-secondary rounded-xl" />
    </div>
  );
}
