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

  // 추가 진단 라인: SW 캐시 상태 + 스토리지 영속 grant + 환경 정보.
  // 단일 PING 으로 HTML_CACHE 내부 키/응답 상태/본문 크기까지 가져와 표시 → 한 번에 판별.
  const [diag2, setDiag2] = useState<string>("");
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    let cancelled = false;

    // 1) storage.persisted() 확인
    const persistedPromise = navigator.storage?.persisted
      ? navigator.storage.persisted().catch(() => null)
      : Promise.resolve(null);

    // 2) storage.estimate()
    const estimatePromise = navigator.storage?.estimate
      ? navigator.storage.estimate().catch(() => null)
      : Promise.resolve(null);

    // 3) SW PING
    const swInfoPromise: Promise<Record<string, unknown> | null> = (async () => {
      if (!navigator.serviceWorker) return null;
      try {
        const reg = await navigator.serviceWorker.ready;
        const controller = reg.active || navigator.serviceWorker.controller;
        if (!controller) return { _err: "noctrl" };
        return await new Promise<Record<string, unknown>>((resolve) => {
          const channel = new MessageChannel();
          const t0 = performance.now();
          channel.port1.onmessage = (event) => {
            const data = (event.data ?? {}) as Record<string, unknown>;
            data._rttMs = Math.round(performance.now() - t0);
            resolve(data);
          };
          try {
            controller.postMessage({ type: "PING" }, [channel.port2]);
          } catch {
            resolve({ _err: "pingFail" });
          }
          setTimeout(() => resolve({ _err: "timeout(oldSW?)" }), 1500);
        });
      } catch (e) {
        return { _err: `noReg:${String(e)}` };
      }
    })();

    Promise.all([persistedPromise, estimatePromise, swInfoPromise]).then(([persisted, estimate, sw]) => {
      if (cancelled) return;
      const parts: string[] = [];

      // SW info
      if (!sw) {
        parts.push("sw=N/A");
      } else if (sw._err) {
        parts.push(`sw=${sw._err}`);
      } else {
        parts.push(`sw=${sw.version ?? "?"}(rtt${sw._rttMs}ms)`);
        // HTML cache entries
        const html = sw.htmlCache as Array<{ url: string; status: number | string; bodyLen?: number; ct?: string; vary?: string; cc?: string; hasSetCookie?: boolean; date?: string }> | undefined;
        if (Array.isArray(html)) {
          if (html.length === 0) {
            parts.push("HTML[empty]");
          } else {
            const summary = html.map((e) => {
              const path = (() => {
                try { return new URL(e.url).pathname; } catch { return e.url; }
              })();
              const ct = e.ct?.includes("html") ? "html" : (e.ct ?? "?");
              const len = e.bodyLen !== undefined && e.bodyLen >= 0 ? `${Math.round(e.bodyLen / 1024)}KB` : "?";
              return `${path}:${e.status}:${ct}:${len}`;
            }).join(",");
            parts.push(`HTML[${summary}]`);
            // /home entry 의 헤더 detail (vary 등) — 가설 검증용
            const home = html.find((e) => {
              try { return new URL(e.url).pathname === "/home"; } catch { return false; }
            });
            if (home) {
              const v = home.vary ? `vary="${home.vary}"` : "vary=∅";
              const c = home.cc ? `cc="${home.cc}"` : "cc=∅";
              const sc = home.hasSetCookie ? "set-cookie=Y" : "set-cookie=N";
              parts.push(`/home-hdr[${v} ${c} ${sc}]`);
            }
          }
        } else if (sw.htmlCacheErr) {
          parts.push(`HTMLerr=${sw.htmlCacheErr}`);
        }
        parts.push(`static=${sw.staticCount ?? "?"} shell=${sw.shellCount ?? "?"}`);
        if (Array.isArray(sw.allCaches)) {
          parts.push(`allCaches=[${(sw.allCaches as string[]).join(",")}]`);
        }
        if (sw.scope) parts.push(`scope=${sw.scope}`);
        // SERVE_LOG: SW 가 HTML 요청을 어떻게 처리했는지 시간순.
        // "served-from-cache" 가 보이면 SW 가 캐시 서빙한 것.
        // 마지막 항목이 "served-from-network" 인데 그 시점에 캐시가 있었다면 vary/keys 매칭 실패.
        // 아무것도 없으면 SW 가 이 라운드의 HTML 요청을 처리 안 한 것 = iOS 우회.
        const log = sw.serveLog as Array<{ type: string; url: string; detail: string; agoMs: number }> | undefined;
        if (Array.isArray(log)) {
          if (log.length === 0) {
            parts.push("serveLog[empty=iOS-bypassed-SW?]");
          } else {
            const summary = log.map((e) => `${e.url}:${e.type}(${e.agoMs}ms전)`).join(" → ");
            parts.push(`serveLog[${summary}]`);
          }
        }
      }

      // Storage
      if (persisted === null) parts.push("persisted=?");
      else parts.push(`persisted=${persisted}`);
      if (estimate) {
        const usage = (estimate as { usage?: number }).usage;
        const quota = (estimate as { quota?: number }).quota;
        if (usage !== undefined && quota !== undefined) {
          parts.push(`storage=${Math.round(usage / 1024)}KB/${Math.round(quota / 1024 / 1024)}MB`);
        }
      }

      // Environment
      const conn = (navigator as Navigator & { connection?: { effectiveType?: string } }).connection;
      if (conn?.effectiveType) parts.push(`net=${conn.effectiveType}`);
      const ua = navigator.userAgent;
      const m = ua.match(/iPhone OS ([0-9_]+)/);
      if (m) parts.push(`iOS=${m[1].replace(/_/g, ".")}`);
      parts.push(`ctrl=${navigator.serviceWorker?.controller ? "yes" : "no"}`);

      setDiag2(parts.join(" | "));
    });

    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
          if (res.all) logStore.setAllLogs(res.all);
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
        {/* 진단 라인 1: 첫 페인트 시점 캐시 상태 + fetch 소요시간 (5초 wait 디버깅용) */}
        <p className="text-[10px] text-rose-500/70 font-mono mt-1 break-all">{diag}</p>
        {/* 진단 라인 2: SW 캐시 내부 상태 + 스토리지 영속 grant + 환경 (한 방에 다 확인) */}
        {diag2 && (
          <p className="text-[10px] text-amber-700/70 font-mono mt-0.5 break-all">{diag2}</p>
        )}
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
