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

const PAGE_SIZE = 30;

export function LogContainer() {
  const [logs, setLogs] = useState<DailyLog[] | undefined>(undefined);
  const [weeklyLogs, setWeeklyLogs] = useState<WeeklyLog[] | undefined>(undefined);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const fetchInitial = useCallback(async () => {
    const [fetchedLogs, fetchedWeekly, count] = await Promise.all([
      actionGetRecentDailyLogs(PAGE_SIZE),
      actionGetWeeklyLogs(4),
      actionGetDailyLogsTotalCount(),
    ]);
    setLogs(fetchedLogs);
    setWeeklyLogs(fetchedWeekly);
    setTotalCount(count);
  }, []);

  useEffect(() => {
    fetchInitial();
  }, [fetchInitial]);

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
    // Re-fetch the same number of logs currently loaded (to get updated data)
    const count = Math.max(logs.length, PAGE_SIZE);
    const [refreshedLogs, refreshedWeekly] = await Promise.all([
      actionGetRecentDailyLogs(count),
      actionGetWeeklyLogs(4),
    ]);
    setLogs(refreshedLogs);
    setWeeklyLogs(refreshedWeekly);
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
