"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import { actionGetDailyLog, actionGetRecentDailyLogs, actionCloseDailyLog } from "@/app/actions/log-actions";
import { HomeContent } from "./home-content";
import { formatDate } from "@/lib/utils/date-utils";
import { getGreetingMessage } from "@/lib/utils/greeting-messages";
import { useSettings } from "@/lib/contexts/settings-context";
import type { DailyLog } from "@/lib/types";

export function HomeContainer() {
  const [displayName, setDisplayName] = useState<string | null | undefined>(undefined);
  // activeLog: 홈에서 보여줄 로그 (초기=오늘, 마감 후=다음 미마감)
  const [activeLog, setActiveLog] = useState<DailyLog | null | undefined>(undefined);
  const [recentLogs, setRecentLogs] = useState<DailyLog[] | undefined>(undefined);
  const [greeting, setGreeting] = useState<string | null>(null);
  const [isClosingDay, setIsClosingDay] = useState(false);
  const { settings } = useSettings();

  useEffect(() => {
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

    const today = formatDate(new Date());
    Promise.all([
      actionGetDailyLog(today),
      actionGetRecentDailyLogs(30),
    ]).then(([log, logs]) => {
      setActiveLog(log);
      setRecentLogs(logs);
    });
  }, []);

  useEffect(() => {
    if (displayName && activeLog !== undefined && recentLogs !== undefined && settings.onboardingComplete) {
      const msg = getGreetingMessage(displayName, activeLog ?? null, recentLogs ?? [], settings);
      setGreeting(msg);
    }
  }, [displayName, activeLog, recentLogs, settings]);

  /**
   * "이날은 이대로 마감하기" — 마감 후 다음 미마감 날짜로 이동
   * recentLogs(내림차순)에서 날짜 제한 없이 첫 번째 미마감 로그를 다음 활성 날짜로 설정
   */
  const handleCloseDay = async () => {
    if (!activeLog || activeLog.closed || isClosingDay) return;
    setIsClosingDay(true);
    try {
      const today = formatDate(new Date());
      await actionCloseDailyLog(activeLog.date, activeLog);

      const [updatedLogs, todayLog] = await Promise.all([
        actionGetRecentDailyLogs(30),
        actionGetDailyLog(today),
      ]);
      setRecentLogs(updatedLogs);

      // 날짜 제한 없이 가장 최근 미마감 (recentLogs는 내림차순 정렬)
      const nextUnclosed = updatedLogs.find((l) => !l.closed);
      setActiveLog(nextUnclosed ?? todayLog);
    } finally {
      setIsClosingDay(false);
    }
  };

  const isLoading = activeLog === undefined || recentLogs === undefined;

  return (
    <div className="pb-6">
      <header className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold">Soma Log</h1>
          {displayName !== undefined && !displayName && (
            <Link
              href="/login"
              className="px-3 py-1.5 rounded-lg border border-navy text-navy text-xs font-semibold hover:bg-navy hover:text-white active:scale-[0.97] transition-all"
            >
              로그인
            </Link>
          )}
        </div>
        {greeting && (
          <p className="text-xs text-rose-500 mt-1 leading-relaxed">{greeting}</p>
        )}
        {!greeting && displayName && (
          <p className="text-xs text-muted-foreground mt-1">{displayName} 님</p>
        )}
      </header>

      {isLoading ? (
        <HomeSkeleton />
      ) : (
        <HomeContent
          todayLog={activeLog ?? null}
          recentLogs={(recentLogs ?? []).slice(0, 14)}
          onCloseToday={handleCloseDay}
          isClosingToday={isClosingDay}
        />
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
