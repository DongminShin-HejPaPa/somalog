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

interface LogContainerProps {
  userId: string | null;
}

export function LogContainer({ userId }: LogContainerProps) {
  // familyTime ChatRoom 패턴: useState 초기화에서 캐시 동기 읽기.
  // 순서: 메모리(같은 세션 내 다른 탭에서 채워둔 경우) → localStorage → 빈 상태.
  // recentLogs 는 홈 캐시(somalog_home_v1:userId)에도 들어 있어 그쪽도 확인.
  const [bootLogs] = useState<DailyLog[]>(() => {
    if (typeof window === "undefined") return [];
    const fromMem = logStore.getRecentLogs();
    if (fromMem) return fromMem;
    if (!userId) return [];
    try {
      return logStore.loadHomeCache(userId)?.recentLogs ?? [];
    } catch {
      return [];
    }
  });
  const [bootLogCache] = useState<{ weeklyLogs: WeeklyLog[]; totalCount: number } | null>(() => {
    if (typeof window === "undefined" || !userId) return null;
    const memWeekly = logStore.getWeeklyLogs();
    const memCount = logStore.getTotalCount();
    if (memWeekly && memCount !== null) {
      return { weeklyLogs: memWeekly, totalCount: memCount };
    }
    try {
      return logStore.loadLogCache(userId);
    } catch {
      return null;
    }
  });
  const [logs, setLogs] = useState<DailyLog[]>(bootLogs);
  const [weeklyLogs, setWeeklyLogs] = useState<WeeklyLog[]>(bootLogCache?.weeklyLogs ?? []);
  const [totalCount, setTotalCount] = useState(bootLogCache?.totalCount ?? 0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  useEffect(() => {
    // bootLogs/bootLogCache 를 logStore 메모리 싱글톤에도 즉시 주입
    // (다른 탭이 또 이 데이터를 읽을 때 fetch 안 거치도록)
    if (bootLogs.length > 0) logStore.setRecentLogs(bootLogs);
    if (bootLogCache) {
      logStore.setWeeklyLogs(bootLogCache.weeklyLogs);
      logStore.setTotalCount(bootLogCache.totalCount);
    }

    // 백그라운드 최신화. memory 가 fresh 면 생략, stale 또는 처음이면 fetch.
    const hasFreshMemory =
      logStore.getRecentLogs() &&
      logStore.getWeeklyLogs() !== null &&
      logStore.getTotalCount() !== null &&
      !logStore.isStale();
    if (hasFreshMemory) return;

    Promise.all([
      actionGetRecentDailyLogs(PAGE_SIZE),
      actionGetWeeklyLogs(4),
      actionGetDailyLogsTotalCount(),
    ])
      .then(([freshLogs, freshWeekly, count]) => {
        logStore.setRecentLogs(freshLogs);
        logStore.setWeeklyLogs(freshWeekly);
        logStore.setTotalCount(count);
        setLogs(freshLogs);
        setWeeklyLogs(freshWeekly);
        setTotalCount(count);
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLoadMore = async () => {
    if (logs.length === 0 || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const older = await actionGetMoreDailyLogs(PAGE_SIZE, logs.length);
      setLogs((prev) => [...prev, ...older]);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleRefresh = useCallback(async () => {
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
  }, [logs.length]);

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
