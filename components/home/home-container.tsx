"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { actionGetDailyLog, actionGetRecentDailyLogs, actionCloseDailyLog, actionAutoCloseOldLogs, actionGetPrefetchData, actionGetHomeInitialData } from "@/app/actions/log-actions";
import { HomeContent } from "./home-content";
import { formatDate, getDayNumber } from "@/lib/utils/date-utils";
import { getGreetingMessage } from "@/lib/utils/greeting-messages";
import { useSettings } from "@/lib/contexts/settings-context";
import type { DailyLog, GoalEvent, WeightPoint } from "@/lib/types";
import { logStore } from "@/lib/stores/log-store";

const GoalCeremony = dynamic(
  () => import("@/components/celebration/goal-ceremony"),
  { ssr: false }
);

/** 첫 기록일부터의 누적 일수 — 이전 챕터 존재 시 보조 표시용 (추가 쿼리 없이 캐시된 전체 로그 사용) */
function computeCumulativeDay(logs: WeightPoint[] | null, today: string): number | null {
  if (!logs || logs.length === 0) return null;
  let earliest = logs[0].date;
  for (const l of logs) if (l.date < earliest) earliest = l.date;
  return Math.max(getDayNumber(today, earliest), 1);
}

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
  const [goalEvent, setGoalEvent] = useState<GoalEvent | null>(null);
  const [goalToast, setGoalToast] = useState<string | null>(null);
  const [cumulativeDay, setCumulativeDay] = useState<number | null>(null);
  const { settings } = useSettings();

  useEffect(() => {
    const today = formatDate(new Date());

    // 회귀 수정: bootCache 적중 시 logStore (메모리 싱글톤) 도 즉시 채운다.
    // 이게 없으면 사용자가 홈 마운트 직후 다른 탭으로 가면 logStore 캐시 미스 →
    // 각 탭이 자체 fetch → 2초 스켈레톤. 5741de9 에서 3-tier init 제거 시
    // 빠뜨린 행동을 복구.
    if (bootCache) {
      logStore.setRecentLogs(bootCache.recentLogs);
      if (bootCache.activeLog) logStore.setLog(bootCache.activeLog);
    }

    // 누적 일수: 이미 캐시된 전체 로그가 있으면 즉시 계산 (신규 쿼리 없음)
    setCumulativeDay(computeCumulativeDay(logStore.getAllLogs(), today));

    // 마운트 시 무조건 최신 데이터 1회 fetch.
    // familyTime ChatRoom 과 동일: 캐시는 "즉시 표시", 네트워크는 "백그라운드 동기화".
    // 메모리/로컬/네트워크 3-tier 분기 없음 — 분기는 첫 페인트를 안 늦추기 위한 것이었지만
    // useState 초기화에서 동기로 캐시를 읽으면 이미 첫 페인트는 보장된다.
    const fetchFresh = async () => {
      try {
        const data = await actionGetHomeInitialData();
        const newActive = data.firstUnclosed ?? data.todayLog ?? null;
        setRecentLogs(data.recentLogs);
        setActiveLog(newActive);
        logStore.setRecentLogs(data.recentLogs);
        if (data.todayLog) logStore.setLog(data.todayLog);
        if (userId) {
          logStore.saveHomeCache(userId, data.recentLogs, newActive);
        }
      } catch {
        // 네트워크 실패 — 캐시 데이터 유지
      }
    };
    fetchFresh();

    // 프리페치: 이전엔 2초 지연이 있었으나 — 사용자가 홈 진입 직후 바로 다른 탭으로
    // 이동하면 (그 2초 안에) 캐시 미스로 떨어져서 결과적으로 탭 이동 시 스켈레톤이
    // 보였다. fetchFresh 와 별도 엔드포인트이므로 즉시 병렬 발사해도 무방.
    const fetchRecords = !logStore.getWeeklyLogs() || logStore.getTotalCount() === null;
    const fetchGraph = !logStore.getAllLogs() || !logStore.hasLowestWeight();
    if (fetchRecords || fetchGraph) {
      actionGetPrefetchData(fetchRecords, fetchGraph)
        .then((res) => {
          if (res.w) logStore.setWeeklyLogs(res.w);
          if (res.c !== undefined) logStore.setTotalCount(res.c);
          if (res.all) {
            logStore.setAllLogs(res.all);
            setCumulativeDay(computeCumulativeDay(res.all, today));
          }
          if (res.low) logStore.setLowestWeight(res.low);
        })
        .catch(() => {});
    }

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
      const closeResult = await actionCloseDailyLog(activeLog.date, activeLog);
      if (closeResult.goalEvent?.kind === "first") {
        setGoalEvent(closeResult.goalEvent);
      } else if (closeResult.goalEvent?.kind === "repeat") {
        setGoalToast("🎉 목표 체중 복귀! 다시 잘 버텼어요");
        setTimeout(() => setGoalToast(null), 4000);
      } else if (closeResult.milestoneEvent) {
        const m = closeResult.milestoneEvent;
        setGoalToast(
          m.kind === "streak"
            ? `🔥 ${m.streakDays}일 연속 기록! 꾸준함이 답이에요`
            : `🎉 −${m.lostKg}kg 달성! 이 흐름 그대로 가요`
        );
        setTimeout(() => setGoalToast(null), 4000);
      }

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
      {goalEvent && (
        <GoalCeremony snapshot={goalEvent.snapshot} onClose={() => setGoalEvent(null)} />
      )}
      {goalToast && (
        <div className="fixed top-16 inset-x-0 flex justify-center z-[55] pointer-events-none px-4">
          <div className="bg-navy text-white text-sm font-semibold px-5 py-2.5 rounded-full shadow-xl text-center">
            {goalToast}
          </div>
        </div>
      )}
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
        todayLog={activeLog}
        recentLogs={recentLogs.slice(0, 14)}
        cumulativeDay={cumulativeDay ?? undefined}
        onCloseToday={handleCloseDay}
        isClosingToday={isClosingDay}
      />
    </div>
  );
}
