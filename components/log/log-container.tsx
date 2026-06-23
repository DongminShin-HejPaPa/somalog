"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  actionGetRecentDailyLogs,
  actionGetMoreDailyLogs,
  actionGetFilteredDailyLogs,
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

  // ── 검색/필터 (서버 위임) ──────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [searchResults, setSearchResults] = useState<DailyLog[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchHasMore, setSearchHasMore] = useState(false);
  // 응답 경합 방지: 마지막으로 발사한 요청만 반영.
  const searchSeq = useRef(0);

  const trimmedQuery = debouncedQuery.trim();
  const isSearchMode = trimmedQuery.length > 0 || activeFilter !== null;

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

  // 검색어 디바운스 (300ms). 필터 토글은 즉시.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // 검색/필터가 바뀔 때 서버에서 첫 페이지 조회.
  useEffect(() => {
    if (!isSearchMode) {
      setSearchResults([]);
      setSearchHasMore(false);
      setSearchLoading(false);
      return;
    }
    const seq = ++searchSeq.current;
    setSearchLoading(true);
    actionGetFilteredDailyLogs({
      query: trimmedQuery || undefined,
      filter: activeFilter,
      cursorDate: null,
      limit: PAGE_SIZE,
    })
      .then((res) => {
        if (seq !== searchSeq.current) return; // 오래된 응답 무시
        setSearchResults(res);
        setSearchHasMore(res.length === PAGE_SIZE);
      })
      .catch(() => {
        if (seq !== searchSeq.current) return;
        setSearchResults([]);
        setSearchHasMore(false);
      })
      .finally(() => {
        if (seq === searchSeq.current) setSearchLoading(false);
      });
  }, [isSearchMode, trimmedQuery, activeFilter]);

  const handleLoadMore = async () => {
    if (isLoadingMore) return;

    if (isSearchMode) {
      const last = searchResults[searchResults.length - 1];
      if (!last) return;
      setIsLoadingMore(true);
      try {
        const older = await actionGetFilteredDailyLogs({
          query: trimmedQuery || undefined,
          filter: activeFilter,
          cursorDate: last.date,
          limit: PAGE_SIZE,
        });
        setSearchResults((prev) => [...prev, ...older]);
        setSearchHasMore(older.length === PAGE_SIZE);
      } finally {
        setIsLoadingMore(false);
      }
      return;
    }

    const last = logs[logs.length - 1];
    if (!last) return;
    setIsLoadingMore(true);
    try {
      // keyset: 마지막 로그 날짜 이전을 이어서 조회 (offset 미사용)
      const older = await actionGetMoreDailyLogs(PAGE_SIZE, last.date);
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

  const displayLogs = isSearchMode ? searchResults : logs;
  const hasMore = isSearchMode ? searchHasMore : logs.length < totalCount;

  return (
    <LogList
      logs={displayLogs}
      weeklyLogs={weeklyLogs}
      hasMore={hasMore}
      isLoadingMore={isLoadingMore}
      onLoadMore={handleLoadMore}
      onRefresh={handleRefresh}
      searchQuery={searchQuery}
      onSearchQueryChange={setSearchQuery}
      activeFilter={activeFilter}
      onActiveFilterChange={setActiveFilter}
      isSearching={searchLoading}
    />
  );
}
