"use client";

import { useState, useEffect, useCallback } from "react";
import {
  actionGetRecentDailyLogs,
  actionGetMoreDailyLogs,
  actionGetDailyLogsTotalCount,
  actionGetWeeklyLogs,
} from "@/app/actions/log-actions";
import { LogList } from "./log-list";
import type { DailyLog, WeeklyLog } from "@/lib/types";
import { logStore } from "@/lib/stores/log-store";

const PAGE_SIZE = 30;

export function LogContainer({ userId }: { userId: string | null }) {
  const [logs, setLogs] = useState<DailyLog[] | undefined>(undefined);
  const [weeklyLogs, setWeeklyLogs] = useState<WeeklyLog[] | undefined>(undefined);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  useEffect(() => {
    logStore.invalidateIfUserChanged(userId);

    const cachedLogs = logStore.getRecentLogs();
    const cachedWeekly = logStore.getWeeklyLogs();
    const cachedCount = logStore.getTotalCount();

    const applyFresh = (freshLogs: DailyLog[], freshWeekly: WeeklyLog[], count: number) => {
      logStore.setRecentLogs(freshLogs);
      logStore.setWeeklyLogs(freshWeekly);
      logStore.setTotalCount(count);
      setLogs(freshLogs);
      setWeeklyLogs(freshWeekly);
      setTotalCount(count);
    };

    const fetchAll = () =>
      Promise.all([
        actionGetRecentDailyLogs(PAGE_SIZE),
        actionGetWeeklyLogs(4),
        actionGetDailyLogsTotalCount(),
      ]).then(([freshLogs, freshWeekly, count]) => applyFresh(freshLogs, freshWeekly, count));

    if (cachedLogs && cachedWeekly !== null && cachedCount !== null) {
      // Instant display from cache — no skeleton shown
      setLogs(cachedLogs);
      setWeeklyLogs(cachedWeekly);
      setTotalCount(cachedCount);

      // Stale: background refresh without blocking UI
      if (logStore.isStale()) {
        fetchAll().catch(() => {});
      }
    } else {
      // No cache yet: fetch (skeleton shows until complete)
      fetchAll().catch(() => {});
    }
  }, [userId]);

  const handleLoadMore = async () => {
    if (!logs || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const older = await actionGetMoreDailyLogs(PAGE_SIZE, logs.length);
      setLogs((prev) => [...(prev ?? []), ...older]);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleRefresh = useCallback(async () => {
    if (!logs) return;
    const count = Math.max(logs.length, PAGE_SIZE);
    const [refreshedLogs, refreshedWeekly, newTotalCount] = await Promise.all([
      actionGetRecentDailyLogs(count),
      actionGetWeeklyLogs(4),
      actionGetDailyLogsTotalCount(),
    ]);
    logStore.setRecentLogs(refreshedLogs);
    logStore.setWeeklyLogs(refreshedWeekly);
    logStore.setTotalCount(newTotalCount);

    setLogs(refreshedLogs);
    setWeeklyLogs(refreshedWeekly);
    setTotalCount(newTotalCount);
  }, [logs]);

  if (logs === undefined || weeklyLogs === undefined) {
    return (
      <div className="px-4 space-y-3 mt-2 animate-pulse">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-20 bg-secondary rounded-xl" />
        ))}
      </div>
    );
  }

  const hasMore = logs.length < totalCount;

  return (
    <LogList
      logs={logs}
      weeklyLogs={weeklyLogs}
      hasMore={hasMore}
      isLoadingMore={isLoadingMore}
      onLoadMore={handleLoadMore}
      onRefresh={handleRefresh}
    />
  );
}
