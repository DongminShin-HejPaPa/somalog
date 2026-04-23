"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { actionGetDailyLog, actionGetRecentDailyLogs, actionCloseDailyLog, actionAutoCloseOldLogs, actionGetPrefetchData } from "@/app/actions/log-actions";
import { HomeContent } from "./home-content";
import { formatDate } from "@/lib/utils/date-utils";
import { getGreetingMessage } from "@/lib/utils/greeting-messages";
import { useSettings } from "@/lib/contexts/settings-context";
import type { DailyLog } from "@/lib/types";
import { logStore } from "@/lib/stores/log-store";
import type { HomeInitialData } from "@/lib/services/home-service";

interface HomeContainerProps {
  userId: string | null;
  /** 서버에서 계산된 표시 이름 — getSession() 브라우저 호출 없이 즉시 사용 */
  initialDisplayName: string | null;
  /** SSR로 미리 가져온 초기 데이터 셋 */
  initialData: HomeInitialData;
}

export function HomeContainer({ userId, initialDisplayName, initialData }: HomeContainerProps) {
  const [activeLog, setActiveLog] = useState<DailyLog | null>(
    initialData.firstUnclosed ?? initialData.todayLog ?? null
  );
  const [recentLogs, setRecentLogs] = useState<DailyLog[]>(initialData.recentLogs);
  const [greeting, setGreeting] = useState<string | null>(null);
  const [isClosingDay, setIsClosingDay] = useState(false);
  const { settings } = useSettings();

  useEffect(() => {
    logStore.invalidateIfUserChanged(userId);
    const today = formatDate(new Date());

    // 1. 초기 데이터를 스토어에 동기화 (다른 탭에서 즉시 꺼내 쓸 수 있도록)
    if (initialData.recentLogs.length > 0 || initialData.todayLog) {
      logStore.setRecentLogs(initialData.recentLogs);
      if (initialData.todayLog) logStore.setLog(initialData.todayLog);
      if (userId) {
        logStore.saveHomeCache(userId, initialData.recentLogs, initialData.firstUnclosed ?? initialData.todayLog);
      }
    }

    // 2. 백그라운드 프리페치: 2초 딜레이 후 1번의 요청으로 모든 필요 데이터 단일 다운로드
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

    // 3. 백그라운드 밀린 로그 일괄 마감 (UI 렌더링을 막지 않음)
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
  }, [initialData]); // mount 시 한 번 및 initialData 변경 시 실행

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

      <HomeContent
        todayLog={activeLog ?? null}
        recentLogs={(recentLogs ?? []).slice(0, 14)}
        onCloseToday={handleCloseDay}
        isClosingToday={isClosingDay}
      />
    </div>
  );
}
