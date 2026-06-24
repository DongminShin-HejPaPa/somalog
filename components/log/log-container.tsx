"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  actionGetFilteredDailyLogs,
  actionGetEventSeries,
} from "@/app/actions/log-actions";
import { LogList } from "./log-list";
import { MetricTrendChart, type MetricKey } from "./metric-trend-chart";
import type { DailyLog, DailyEventPoint, ChapterScope } from "@/lib/types";
import { useChapterScope } from "@/lib/contexts/chapter-scope-context";
import { logStore } from "@/lib/stores/log-store";

const PAGE_SIZE = 30;
const METRIC_FILTERS: MetricKey[] = ["exercise", "lateSnack", "alcohol"];

interface LogContainerProps {
  userId: string | null;
}

function inScope(date: string, scope: ChapterScope): boolean {
  return (
    (scope.rangeStart == null || date >= scope.rangeStart) &&
    (scope.rangeEnd == null || date <= scope.rangeEnd)
  );
}

export function LogContainer({ userId }: LogContainerProps) {
  const { selectedScope } = useChapterScope();
  const scopeId = selectedScope.id;
  const { rangeStart, rangeEnd } = selectedScope;

  // 기본 뷰(진행 중 챕터 · 필터/검색 없음)는 홈/최근 캐시를 시드해 즉시 렌더.
  const [logs, setLogs] = useState<DailyLog[]>(() => {
    if (typeof window === "undefined" || selectedScope.id !== "current") return [];
    const recent =
      logStore.getRecentLogs() ??
      (userId ? safeHomeCache(userId) : null) ??
      [];
    return recent.filter((l) => inScope(l.date, selectedScope));
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [listLoading, setListLoading] = useState(false);

  // 누적평균 미니차트용 이벤트 시리즈 (운동/야식/술 필터 활성 시 lazy 로드).
  const [eventSeries, setEventSeries] = useState<DailyEventPoint[] | null>(null);
  const [eventLoading, setEventLoading] = useState(false);
  const eventCache = useRef<Map<string, DailyEventPoint[]>>(new Map());

  const listSeq = useRef(0);
  const eventSeq = useRef(0);

  const trimmedQuery = debouncedQuery.trim();
  const metricFilter = METRIC_FILTERS.includes(activeFilter as MetricKey)
    ? (activeFilter as MetricKey)
    : null;

  // 검색어 디바운스(300ms). 필터/스코프 전환은 즉시.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // 스코프/필터/검색이 바뀔 때 첫 페이지 조회. 이전 logs 는 새 데이터 도착까지 유지.
  useEffect(() => {
    const seq = ++listSeq.current;
    setListLoading(true);
    actionGetFilteredDailyLogs({
      query: trimmedQuery || undefined,
      filter: activeFilter,
      rangeStart,
      rangeEnd,
      cursorDate: null,
      limit: PAGE_SIZE,
    })
      .then((res) => {
        if (seq !== listSeq.current) return;
        setLogs(res);
        setHasMore(res.length === PAGE_SIZE);
        // 기본 뷰면 홈/최근 캐시를 따뜻하게 유지(다른 탭 즉시 렌더).
        if (scopeId === "current" && !activeFilter && !trimmedQuery) {
          logStore.setRecentLogs(res);
        }
      })
      .catch(() => {
        if (seq !== listSeq.current) return;
        setLogs([]);
        setHasMore(false);
      })
      .finally(() => {
        if (seq === listSeq.current) setListLoading(false);
      });
  }, [scopeId, rangeStart, rangeEnd, trimmedQuery, activeFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  // 미니차트 이벤트 시리즈: 운동/야식/술 필터 활성 시 스코프 단위로 1회 로드(캐시).
  useEffect(() => {
    if (!metricFilter) {
      setEventSeries(null);
      return;
    }
    const cached = eventCache.current.get(scopeId);
    if (cached) {
      setEventSeries(cached);
      return;
    }
    const seq = ++eventSeq.current;
    setEventSeries(null);
    setEventLoading(true);
    actionGetEventSeries(rangeStart, rangeEnd)
      .then((s) => {
        if (seq !== eventSeq.current) return;
        eventCache.current.set(scopeId, s);
        setEventSeries(s);
      })
      .catch(() => {
        if (seq === eventSeq.current) setEventSeries([]);
      })
      .finally(() => {
        if (seq === eventSeq.current) setEventLoading(false);
      });
  }, [metricFilter, scopeId, rangeStart, rangeEnd]);

  const handleLoadMore = async () => {
    if (isLoadingMore) return;
    const last = logs[logs.length - 1];
    if (!last) return;
    setIsLoadingMore(true);
    try {
      const older = await actionGetFilteredDailyLogs({
        query: trimmedQuery || undefined,
        filter: activeFilter,
        rangeStart,
        rangeEnd,
        cursorDate: last.date,
        limit: PAGE_SIZE,
      });
      setLogs((prev) => [...prev, ...older]);
      setHasMore(older.length === PAGE_SIZE);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleRefresh = useCallback(async () => {
    const fresh = await actionGetFilteredDailyLogs({
      query: trimmedQuery || undefined,
      filter: activeFilter,
      rangeStart,
      rangeEnd,
      cursorDate: null,
      limit: Math.max(logs.length, PAGE_SIZE),
    });
    setLogs(fresh);
    setHasMore(fresh.length >= PAGE_SIZE && fresh.length === Math.max(logs.length, PAGE_SIZE));
    if (scopeId === "current" && !activeFilter && !trimmedQuery) {
      logStore.setRecentLogs(fresh);
    }
  }, [trimmedQuery, activeFilter, rangeStart, rangeEnd, logs.length, scopeId]);

  const metricChart = useMemo(() => {
    if (!metricFilter || !eventSeries || eventSeries.length === 0) return null;
    return (
      <MetricTrendChart series={eventSeries} metric={metricFilter} startDate={rangeStart} />
    );
  }, [metricFilter, eventSeries, rangeStart]);

  return (
    <LogList
      logs={logs}
      hasMore={hasMore}
      isLoadingMore={isLoadingMore}
      onLoadMore={handleLoadMore}
      onRefresh={handleRefresh}
      searchQuery={searchQuery}
      onSearchQueryChange={setSearchQuery}
      activeFilter={activeFilter}
      onActiveFilterChange={setActiveFilter}
      isSearching={listLoading || eventLoading}
      metricChart={metricChart}
    />
  );
}

function safeHomeCache(userId: string): DailyLog[] | null {
  try {
    return logStore.loadHomeCache(userId)?.recentLogs ?? null;
  } catch {
    return null;
  }
}
