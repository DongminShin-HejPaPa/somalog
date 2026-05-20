"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { actionGetDailyLog, actionGetRecentDailyLogs, actionCloseDailyLog, actionAutoCloseOldLogs, actionGetPrefetchData, actionGetHomeInitialData } from "@/app/actions/log-actions";
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
  // familyTime ChatRoom 패턴: useState 초기화에서 localStorage 동기 읽기.
  // SSR/캐시 미스/비로그인 시 빈 상태(null / [])로 시작 — 스켈레톤 없음.
  // HomeContent 는 빈 상태를 "오늘의 기록을 시작하세요" 안내로 처리.
  const [bootCache] = useState<{ recentLogs: DailyLog[]; activeLog: DailyLog | null } | null>(() => {
    if (typeof window === "undefined" || !userId) return null;
    try {
      return logStore.loadHomeCache(userId);
    } catch {
      return null;
    }
  });
  const [activeLog, setActiveLog] = useState<DailyLog | null>(bootCache?.activeLog ?? null);
  const [recentLogs, setRecentLogs] = useState<DailyLog[]>(bootCache?.recentLogs ?? []);
  const [greeting, setGreeting] = useState<string | null>(null);
  const [isClosingDay, setIsClosingDay] = useState(false);
  // 진단: 페이지 시작(navigation/timeOrigin)부터 mount 까지 시간을 측정해
  // mount 이전 구간(흰화면 + JS 다운로드/파싱/하이드레이션)을 가시화한다.
  // SSR 데이터 적용 후엔 사용자가 mount 이전에 콘텐츠를 보므로 이 값과 체감이 분리된다.
  const [mountAt] = useState<number>(() => (typeof performance !== "undefined" ? performance.now() : 0));
  const [diag, setDiag] = useState<string>(() => {
    if (typeof window === "undefined") return "ssr";
    if (!userId) return "noUser";
    const preMount = Math.round(mountAt);
    const navEntry = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    const respEnd = navEntry ? Math.round(navEntry.responseEnd) : -1;
    const dcl = navEntry ? Math.round(navEntry.domContentLoadedEventEnd) : -1;
    const paintEntries = performance.getEntriesByType("paint") as PerformanceEntry[];
    const fcpEntry = paintEntries.find((e) => e.name === "first-contentful-paint");
    const fcp = fcpEntry ? Math.round(fcpEntry.startTime) : -1;
    // mountAt 이 10초를 넘으면 iOS WebView 가 살아있는 채로 백그라운드 → 재진입한 케이스.
    // performance.timeOrigin 이 옛 진입 시점이라 측정값을 못 믿음. diag 에 표식.
    const resumeFlag = mountAt > 10000 ? " [RESUMED-session: timings unreliable]" : "";
    const cacheState = bootCache ? `boot=hit:${bootCache.recentLogs.length}` : "boot=miss";
    return `${cacheState} | nav→mount=${preMount}ms FCP=${fcp}ms respEnd=${respEnd}ms dcl=${dcl}ms${resumeFlag}`;
  });
  const { settings } = useSettings();

  useEffect(() => {
    const today = formatDate(new Date());

    // 마운트 시 무조건 최신 데이터 1회 fetch.
    // familyTime ChatRoom 과 동일: 캐시는 "즉시 표시", 네트워크는 "백그라운드 동기화".
    // 메모리/로컬/네트워크 3-tier 분기 없음 — 분기는 첫 페인트를 안 늦추기 위한 것이었지만
    // useState 초기화에서 동기로 캐시를 읽으면 이미 첫 페인트는 보장된다.
    const fetchFresh = async () => {
      const t0 = performance.now();
      setDiag((d) => `${d} | fetchStart`);
      try {
        const data = await actionGetHomeInitialData();
        const elapsed = Math.round(performance.now() - t0);
        const sinceMount = Math.round(performance.now() - mountAt);
        const newActive = data.firstUnclosed ?? data.todayLog ?? null;
        setRecentLogs(data.recentLogs);
        setActiveLog(newActive);
        logStore.setRecentLogs(data.recentLogs);
        if (data.todayLog) logStore.setLog(data.todayLog);
        if (userId) {
          logStore.saveHomeCache(userId, data.recentLogs, newActive);
          // 저장 검증: 즉시 다시 읽어 확인
          const verify = logStore.loadHomeCache(userId);
          setDiag((d) => `${d} | fetched ${elapsed}ms (mount+${sinceMount}ms) save=${verify ? "ok" : "FAIL"}`);
        } else {
          setDiag((d) => `${d} | fetched ${elapsed}ms (mount+${sinceMount}ms) noUid`);
        }
      } catch (err) {
        setDiag((d) => `${d} | fetchError`);
      }
    };
    fetchFresh();

    // 프리페치: 2초 후 다른 탭(기록/그래프)용 데이터 미리 다운로드
    const prefetchTimer = setTimeout(() => {
      const fetchRecords = !logStore.getWeeklyLogs() || logStore.getTotalCount() === null;
      const fetchGraph = !logStore.getAllLogs() || !logStore.hasLowestWeight();
      if (fetchRecords || fetchGraph) {
        actionGetPrefetchData(fetchRecords, fetchGraph)
          .then((res) => {
            if (res.w) logStore.setWeeklyLogs(res.w);
            if (res.c !== undefined) logStore.setTotalCount(res.c);
            if (res.all) logStore.setAllLogs(res.all);
            if (res.low) logStore.setLowestWeight(res.low);
          })
          .catch(() => {});
      }
    }, 2000);

    // 백그라운드 밀린 로그 일괄 마감
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

    return () => clearTimeout(prefetchTimer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 인사말: 필요한 데이터가 준비될 때마다 갱신
  useEffect(() => {
    if (initialDisplayName && settings.onboardingComplete) {
      setGreeting(getGreetingMessage(initialDisplayName, activeLog, recentLogs, settings));
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
        {/* 진단 라인: 첫 페인트 시점 캐시 상태 + fetch 소요시간 (5초 wait 디버깅용) */}
        <p className="text-[10px] text-rose-500/70 font-mono mt-1 break-all">{diag}</p>
      </header>

      <HomeContent
        todayLog={activeLog}
        recentLogs={recentLogs.slice(0, 14)}
        onCloseToday={handleCloseDay}
        isClosingToday={isClosingDay}
      />
    </div>
  );
}
