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

export function LogContainer() {
  const [logs, setLogs] = useState<DailyLog[] | undefined>(undefined);
  const [weeklyLogs, setWeeklyLogs] = useState<WeeklyLog[] | undefined>(undefined);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const fetchInitial = useCallback(async () => {
    if (!logStore.isStale() && logStore.getRecentLogs() && logStore.getWeeklyLogs() && logStore.getTotalCount() !== null) {
      setLogs(logStore.getRecentLogs()!);
      setWeeklyLogs(logStore.getWeeklyLogs()!);
      setTotalCount(logStore.getTotalCount()!);
      return;
    }

    const [fetchedLogs, fetchedWeekly, count] = await Promise.all([
      actionGetRecentDailyLogs(PAGE_SIZE),
      actionGetWeeklyLogs(4),
      actionGetDailyLogsTotalCount(),
    ]);
    
    logStore.setRecentLogs(fetchedLogs);
    logStore.setWeeklyLogs(fetchedWeekly);
    logStore.setTotalCount(count);
    
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
