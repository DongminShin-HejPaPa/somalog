"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { actionGetDailyLog, actionUpsertDailyLog, actionGetRecentDailyLogs, actionCloseDailyLog, actionGetFirstUnclosedLog, actionGetWeeklyLogs, actionGetDailyLogsTotalCount, actionGetAllDailyLogs, actionGetLowestWeight, actionAutoCloseOldLogs } from "@/app/actions/log-actions";
import { HomeContent } from "./home-content";
import { formatDate } from "@/lib/utils/date-utils";
import { getGreetingMessage } from "@/lib/utils/greeting-messages";
import { useSettings } from "@/lib/contexts/settings-context";
import type { DailyLog } from "@/lib/types";
import { logStore } from "@/lib/stores/log-store";

interface HomeContainerProps {
  userId: string | null;
  /** 서버에서 계산된 표시 이름 — getSession() 브라우저 호출 없이 즉시 사용 */
  initialDisplayName: string | null;
}

export function HomeContainer({ userId, initialDisplayName }: HomeContainerProps) {
  const [activeLog, setActiveLog] = useState<DailyLog | null | undefined>(undefined);
  const [recentLogs, setRecentLogs] = useState<DailyLog[] | undefined>(undefined);
  const [greeting, setGreeting] = useState<string | null>(null);
  const [isClosingDay, setIsClosingDay] = useState(false);
  const { settings } = useSettings();

  useEffect(() => {
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
            .then(({ logs, firstUnclosed, todayLog }) => {
              populate(logs, firstUnclosed, todayLog);
              if (userId) logStore.saveHomeCache(userId, logs, firstUnclosed ?? todayLog ?? null);
            })
            .catch(() => {});
        }
      } else {
        // Check localStorage (PWA re-open: in-memory cleared but localStorage persists)
        const localCache = userId ? logStore.loadHomeCache(userId) : null;

        if (localCache) {
          // Instant display from localStorage — no skeleton shown
          setRecentLogs(localCache.recentLogs);
          setActiveLog(localCache.activeLog);
          // Populate logStore so other tabs (Input, etc.) benefit from the data
          logStore.setRecentLogs(localCache.recentLogs);
          if (localCache.activeLog) logStore.setLog(localCache.activeLog);

          // Always background-refresh: localStorage data may be hours old
          fetchFresh()
            .then(({ logs, firstUnclosed, todayLog }) => {
              populate(logs, firstUnclosed, todayLog);
              if (userId) logStore.saveHomeCache(userId, logs, firstUnclosed ?? todayLog ?? null);
            })
            .catch(() => {});
        } else {
          // No cache anywhere: must fetch (skeleton shows until complete)
          const { logs, firstUnclosed, todayLog } = await fetchFresh();
          populate(logs, firstUnclosed, todayLog);
          if (userId) logStore.saveHomeCache(userId, logs, firstUnclosed ?? todayLog ?? null);
        }
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
            const newActiveLog = newFirstUnclosed ?? logStore.getLog(today) ?? null;
            setActiveLog(newActiveLog);
            if (userId) logStore.saveHomeCache(userId, updatedLogs, newActiveLog);
          }
        })
        .catch(() => {});
    };

    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 인사말: 필요한 데이터가 준비될 때마다 갱신
  useEffect(() => {
    if (initialDisplayName && activeLog !== undefined && recentLogs !== undefined && settings.onboardingComplete) {
      setGreeting(getGreetingMessage(initialDisplayName, activeLog ?? null, recentLogs, settings));
    }
  }, [initialDisplayName, activeLog, recentLogs, settings]);

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
      const newActiveLog = nextUnclosed ?? todayLog ?? null;
      setActiveLog(newActiveLog);
      if (userId) logStore.saveHomeCache(userId, updatedLogs, newActiveLog);
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
          {/* 비로그인 상태일 때 즉시 표시 (getSession 대기 없음) */}
          {userId === null && (
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
        {!greeting && initialDisplayName && (
          <p className="text-xs text-muted-foreground mt-1">{initialDisplayName} 님</p>
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
