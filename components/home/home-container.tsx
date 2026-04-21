"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import { actionGetDailyLog, actionUpsertDailyLog, actionGetRecentDailyLogs, actionCloseDailyLog, actionGetFirstUnclosedLog, actionGetWeeklyLogs, actionGetDailyLogsTotalCount, actionGetAllDailyLogs, actionGetLowestWeight, actionAutoCloseOldLogs } from "@/app/actions/log-actions";
import { HomeContent } from "./home-content";
import { formatDate } from "@/lib/utils/date-utils";
import { getGreetingMessage } from "@/lib/utils/greeting-messages";
import { useSettings } from "@/lib/contexts/settings-context";
import type { DailyLog } from "@/lib/types";
import { logStore } from "@/lib/stores/log-store";

export function HomeContainer({ userId }: { userId: string | null }) {
  const [displayName, setDisplayName] = useState<string | null | undefined>(undefined);
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

    logStore.invalidateIfUserChanged(userId);
    const today = formatDate(new Date());

    const populate = (logs: DailyLog[], firstUnclosed: DailyLog | null, todayLog: DailyLog | null) => {
      setRecentLogs(logs);
      setActiveLog(firstUnclosed ?? todayLog);
    };

    const fetchFresh = async () => {
      const [fetchedFirst, fetchedLogs, fetchedToday] = await Promise.all([
        actionGetFirstUnclosedLog(),
        actionGetRecentDailyLogs(30),
        actionGetDailyLog(today),
      ]);
      let todayLog = fetchedToday;
      if (!todayLog) {
        todayLog = await actionUpsertDailyLog(today, {});
      }
      logStore.setRecentLogs(fetchedLogs);
      if (todayLog) logStore.setLog(todayLog);
      return { logs: fetchedLogs, firstUnclosed: fetchedFirst, todayLog };
    };

    const init = async () => {
      const cachedLogs = logStore.getRecentLogs();

      if (cachedLogs) {
        // Instant display from cache — no skeleton shown
        const firstUnclosed = logStore.getFirstUnclosedLog();
        const cachedToday = logStore.getLog(today) ?? cachedLogs.find((l) => l.date === today) ?? null;
        populate(cachedLogs, firstUnclosed, cachedToday);

        // Stale: background refresh without blocking UI
        if (logStore.isStale()) {
          fetchFresh()
            .then(({ logs, firstUnclosed, todayLog }) => populate(logs, firstUnclosed, todayLog))
            .catch(() => {});
        }
      } else {
        // No cache yet: must fetch (skeleton shows until complete)
        const { logs, firstUnclosed, todayLog } = await fetchFresh();
        populate(logs, firstUnclosed, todayLog);
      }

      // Background prefetch for Records & Graph tabs (1s delay, non-blocking)
      setTimeout(() => {
        const promises: Promise<any>[] = [];
        const fetchRecords = !logStore.getWeeklyLogs() || logStore.getTotalCount() === null;
        const fetchGraph = !logStore.getAllLogs() || !logStore.hasLowestWeight();

        if (fetchRecords) {
          promises.push(
            Promise.all([actionGetWeeklyLogs(4), actionGetDailyLogsTotalCount()]).then(([w, c]) => {
              logStore.setWeeklyLogs(w);
              logStore.setTotalCount(c);
            })
          );
        }
        if (fetchGraph) {
          promises.push(
            Promise.all([actionGetAllDailyLogs(), actionGetLowestWeight()]).then(([all, low]) => {
              logStore.setAllLogs(all);
              logStore.setLowestWeight(low);
            })
          );
        }
        Promise.all(promises).catch(() => {});
      }, 1000);

      // Auto-close: deduplicated via logStore so only one container fires per session
      logStore.runAutoCloseOnce(() => actionAutoCloseOldLogs())
        ?.then(async (result) => {
          if (result.filledCount + result.closedCount > 0) {
            const updatedLogs = await actionGetRecentDailyLogs(30);
            logStore.setRecentLogs(updatedLogs);
            setRecentLogs(updatedLogs);
            const newFirstUnclosed = logStore.getFirstUnclosedLog();
            setActiveLog(newFirstUnclosed ?? logStore.getLog(today));
          }
        })
        .catch(() => {});
    };

    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (displayName && activeLog !== undefined && recentLogs !== undefined && settings.onboardingComplete) {
      const msg = getGreetingMessage(displayName, activeLog ?? null, recentLogs ?? [], settings);
      setGreeting(msg);
    }
  }, [displayName, activeLog, recentLogs, settings]);

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
      logStore.setRecentLogs(updatedLogs);
      if (todayLog) logStore.setLog(todayLog);
      setRecentLogs(updatedLogs);

      const nextUnclosed = [...updatedLogs]
        .filter((l) => !l.closed && l.date <= today)
        .sort((a, b) => a.date.localeCompare(b.date))[0] ?? null;
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
          <div className="flex items-end gap-2">
            <h1 className="text-lg font-bold">Soma Log</h1>
            <span className="text-[10px] text-muted-foreground/40 font-mono mb-0.5">
              b.{process.env.NEXT_PUBLIC_BUILD_TIME}-{process.env.NEXT_PUBLIC_COMMIT_SHA}
            </span>
          </div>
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
