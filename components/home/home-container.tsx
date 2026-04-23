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
      const initialData = await actionGetHomeInitialData();
      logStore.setRecentLogs(initialData.recentLogs);
      if (initialData.todayLog) logStore.setLog(initialData.todayLog);
      return initialData;
    };

    const init = async () => {
      const cachedLogs = logStore.getRecentLogs();

      if (cachedLogs) {
        // 1. 메모리 캐시 적중 (탭 이동 시): 즉각 표시
        const firstUnclosed = logStore.getFirstUnclosedLog();
        const cachedToday = logStore.getLog(today) ?? cachedLogs.find((l) => l.date === today) ?? null;
        populate(cachedLogs, firstUnclosed, cachedToday);

        // 메모리 캐시가 오래되었다면 백그라운드 갱신
        if (logStore.isStale()) {
          fetchFresh().then((data) => {
             populate(data.recentLogs, data.firstUnclosed, data.todayLog);
             if (userId) logStore.saveHomeCache(userId, data.recentLogs, data.firstUnclosed ?? data.todayLog);
          }).catch(() => {});
        }
      } else {
        // 2. 로컬 스토리지 확인 (PWA 재시작 시)
        const localCache = userId ? logStore.loadHomeCache(userId) : null;
        if (localCache) {
           // 즉각 표시
           setRecentLogs(localCache.recentLogs);
           setActiveLog(localCache.activeLog);
           logStore.setRecentLogs(localCache.recentLogs);
           if (localCache.activeLog) logStore.setLog(localCache.activeLog);

           // PWA 재시작 시점엔 무조건 백그라운드로 최신화 (조용한 단일 통신)
           fetchFresh().then((data) => {
             populate(data.recentLogs, data.firstUnclosed, data.todayLog);
             if (userId) logStore.saveHomeCache(userId, data.recentLogs, data.firstUnclosed ?? data.todayLog);
           }).catch(() => {});
        } else {
           // 3. 아무 캐시도 없음 (최초 로그인): 화면을 가리고(스켈레톤) Fetch 대기
           const data = await fetchFresh();
           populate(data.recentLogs, data.firstUnclosed, data.todayLog);
           if (userId) logStore.saveHomeCache(userId, data.recentLogs, data.firstUnclosed ?? data.todayLog);
        }
      }

      // 4. 프리페치: 2초 딜레이 후 1번의 요청으로 필요한 데이터 단일 다운로드
      setTimeout(() => {
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

      // 5. 백그라운드 밀린 로그 일괄 마감
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
