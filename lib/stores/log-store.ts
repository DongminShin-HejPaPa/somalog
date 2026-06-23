"use client";

import type { DailyLog, WeeklyLog, WeightPoint } from "@/lib/types";
import { perfLog } from "@/lib/utils/perf-log";
import { formatDate } from "@/lib/utils/date-utils";

const STALE_MS = 2 * 60 * 1000; // 2 minutes
const HOME_CACHE_KEY_PREFIX = "somalog_home_v1:";
const LEGACY_HOME_CACHE_KEY = "somalog_home_v1"; // pre-userId-split 키 (마이그레이션 대상)
const HOME_CACHE_SCHEMA_VERSION = 1;
const HOME_CACHE_LRU_LIMIT = 3;

// 로그 탭 / 그래프 탭 데이터 영속 캐시.
// 이전엔 메모리만 있어서 PWA 콜드 스타트마다 비어 있었고, 홈 진입 직후 다른 탭으로
// 가면 캐시 미스 → fetch → 2초 스켈레톤이 발생. familyTime ChatRoom 의
// localStorage 동기 읽기 패턴과 동일 구조로 추가.
const LOG_CACHE_KEY_PREFIX = "somalog_log_v1:";
const GRAPH_CACHE_KEY_PREFIX = "somalog_graph_v1:";
const LOG_CACHE_SCHEMA_VERSION = 1;
// v2: allLogs 를 전체 DailyLog → 경량 WeightPoint(date+weight) 로 축소.
// 버전 범프로 기존 비대 캐시는 1회 무효화된다.
const GRAPH_CACHE_SCHEMA_VERSION = 2;

interface HomeCacheRecord {
  userId: string;
  recentLogs: DailyLog[];
  activeLog: DailyLog | null;
  cachedAt: number;
  schemaVersion: number;
}

interface LogCacheRecord {
  userId: string;
  weeklyLogs: WeeklyLog[];
  totalCount: number;
  cachedAt: number;
  schemaVersion: number;
}

interface GraphCacheRecord {
  userId: string;
  allLogs: WeightPoint[];
  lowestWeight: { weight: number; date: string } | null;
  cachedAt: number;
  schemaVersion: number;
}

function homeCacheKey(userId: string): string {
  return HOME_CACHE_KEY_PREFIX + userId;
}

function logCacheKey(userId: string): string {
  return LOG_CACHE_KEY_PREFIX + userId;
}

function graphCacheKey(userId: string): string {
  return GRAPH_CACHE_KEY_PREFIX + userId;
}

class LogStore {
  private currentUserId: string | null = null;
  private cache = new Map<string, DailyLog>();
  private recentLogs: DailyLog[] | null = null;
  private weeklyLogs: WeeklyLog[] | null = null;
  private totalCount: number | null = null;
  private allLogs: WeightPoint[] | null = null;
  private lowestWeight: { weight: number; date: string } | null = null;
  private lowestWeightFetched = false;
  private lastFetchTime = 0;
  private autoCloseFired = false;

  getLog(date: string): DailyLog | undefined {
    return this.cache.get(date);
  }

  setLog(log: DailyLog) {
    this.cache.set(log.date, log);

    if (this.recentLogs) {
      const idx = this.recentLogs.findIndex((l) => l.date === log.date);
      if (idx !== -1) {
        this.recentLogs[idx] = log;
      } else {
        this.recentLogs.push(log);
        this.recentLogs.sort((a, b) => b.date.localeCompare(a.date));
      }
    }

    if (this.allLogs) {
      // allLogs 는 그래프 전용 경량 시리즈 — date+weight 만 보관.
      const point: WeightPoint = { date: log.date, weight: log.weight };
      const idx = this.allLogs.findIndex((l) => l.date === log.date);
      if (idx !== -1) {
        this.allLogs[idx] = point;
      } else {
        this.allLogs.push(point);
        this.allLogs.sort((a, b) => b.date.localeCompare(a.date));
      }
    }

    // Smart lowestWeight update: only invalidate when we truly can't determine the new minimum.
    if (this.lowestWeightFetched && log.weight !== null && log.weight !== undefined) {
      if (this.lowestWeight === null || log.weight <= this.lowestWeight.weight) {
        this.lowestWeight = { weight: log.weight, date: log.date };
      }
    }

    // 입력 탭에서 저장 / 홈 마감 등으로 setLog 가 불릴 때 그래프/홈 캐시 즉시 갱신.
    // (다음 cold reopen 시 stale 데이터 없이 바로 최신)
    this.persistGraphCacheIfReady();
    this.persistHomeCacheIfReady();
  }

  setLogs(logs: DailyLog[]) {
    logs.forEach((l) => this.cache.set(l.date, l));
  }

  setRecentLogs(logs: DailyLog[]) {
    this.recentLogs = [...logs].sort((a, b) => b.date.localeCompare(a.date));
    this.setLogs(logs);
    this.lastFetchTime = Date.now();
    if (this.allLogs) {
      for (const log of logs) {
        const point: WeightPoint = { date: log.date, weight: log.weight };
        const idx = this.allLogs.findIndex((l) => l.date === log.date);
        if (idx !== -1) {
          this.allLogs[idx] = point;
        } else {
          this.allLogs.push(point);
        }
      }
      this.allLogs.sort((a, b) => b.date.localeCompare(a.date));
    }
    // home/graph 캐시도 자동 영속화 (recentLogs 갱신 시 home cache 의 recentLogs 도 같이)
    this.persistHomeCacheIfReady();
    this.persistGraphCacheIfReady();
  }

  getRecentLogs(): DailyLog[] | null {
    return this.recentLogs;
  }

  setWeeklyLogs(logs: WeeklyLog[]) {
    this.weeklyLogs = logs;
    this.persistLogCacheIfReady();
  }

  getWeeklyLogs() {
    return this.weeklyLogs;
  }

  setTotalCount(c: number) {
    this.totalCount = c;
    this.persistLogCacheIfReady();
  }

  getTotalCount() {
    return this.totalCount;
  }

  setAllLogs(logs: WeightPoint[]) {
    this.allLogs = logs;
    this.persistGraphCacheIfReady();
  }

  getAllLogs() {
    return this.allLogs;
  }

  setLowestWeight(lowest: { weight: number; date: string } | null) {
    this.lowestWeight = lowest;
    this.lowestWeightFetched = true;
    this.persistGraphCacheIfReady();
  }

  getLowestWeight() {
    return this.lowestWeight;
  }

  hasLowestWeight(): boolean {
    return this.lowestWeightFetched;
  }

  getFirstUnclosedLog(): DailyLog | null {
    if (!this.recentLogs) return null;
    return [...this.recentLogs]
      .filter((l) => !l.closed)
      .sort((a, b) => a.date.localeCompare(b.date))[0] ?? null;
  }

  isStale(): boolean {
    return Date.now() - this.lastFetchTime > STALE_MS;
  }

  runAutoCloseOnce<T>(fn: () => Promise<T>): Promise<T> | null {
    if (this.autoCloseFired) return null;
    this.autoCloseFired = true;
    return fn().catch((err) => {
      this.autoCloseFired = false;
      throw err;
    });
  }

  /**
   * 인메모리만 초기화. **localStorage 영구 캐시는 건드리지 않는다.**
   * cold start, 사용자 교체, 로그아웃 직후 등 어떤 transition에서도 영구 캐시 보존.
   */
  resetInMemory(): void {
    this.cache.clear();
    this.recentLogs = null;
    this.weeklyLogs = null;
    this.totalCount = null;
    this.allLogs = null;
    this.lowestWeight = null;
    this.lowestWeightFetched = false;
    this.lastFetchTime = 0;
    this.autoCloseFired = false;
  }

  /**
   * userId transition 감지 후 인메모리만 정리.
   *
   * 분기:
   * - prev === null (cold start, 모듈 첫 평가): baseline만 설정. 인메모리/localStorage 모두 보존.
   * - userId === null (로그아웃 직후 재마운트): 인메모리만 reset. localStorage 보존.
   * - prev !== userId (사용자 A → B 교체): 인메모리만 reset. localStorage는 키 분리로 자연 격리.
   * - prev === userId: no-op.
   *
   * **영구 캐시(localStorage)는 어떤 분기에서도 삭제하지 않는다.**
   * 명시적 삭제는 `clearHomeCacheForUser` / `clearAllHomeCaches`만 책임진다.
   */
  invalidateIfUserChanged(userId: string | null): void {
    const prev = this.currentUserId;
    this.currentUserId = userId;

    if (prev === null) {
      perfLog(`auth-resolved prev=null next=${userId ?? "null"} action=baseline`);
      return;
    }
    if (userId === null) {
      this.resetInMemory();
      perfLog(`auth-resolved prev=${prev} next=null action=resetInMemory`);
      return;
    }
    if (prev !== userId) {
      this.resetInMemory();
      perfLog(`auth-resolved prev=${prev} next=${userId} action=resetInMemory(userSwap)`);
      return;
    }
    perfLog(`auth-resolved prev=${prev} next=${userId} action=noop`);
  }

  saveHomeCache(userId: string, recentLogs: DailyLog[], activeLog: DailyLog | null): void {
    if (typeof window === "undefined") return;
    try {
      const record: HomeCacheRecord = {
        userId,
        recentLogs,
        activeLog,
        cachedAt: Date.now(),
        schemaVersion: HOME_CACHE_SCHEMA_VERSION,
      };
      localStorage.setItem(homeCacheKey(userId), JSON.stringify(record));
      this.scheduleLruCleanup();
    } catch {
      // 용량 초과 등 무시
    }
  }

  loadHomeCache(userId: string): { recentLogs: DailyLog[]; activeLog: DailyLog | null } | null {
    if (typeof window === "undefined") return null;
    try {
      // 레거시 단일 키가 남아있으면 1회 삭제 (마이그레이션).
      // 다음 close/save에서 새 키로 자연 복구.
      const legacyRaw = localStorage.getItem(LEGACY_HOME_CACHE_KEY);
      if (legacyRaw !== null) {
        localStorage.removeItem(LEGACY_HOME_CACHE_KEY);
      }

      const raw = localStorage.getItem(homeCacheKey(userId));
      if (!raw) {
        perfLog(`cache hit=miss userId=${userId}`);
        return null;
      }
      const parsed = JSON.parse(raw) as Partial<HomeCacheRecord>;
      if (parsed.userId !== userId) {
        perfLog(`cache hit=miss reason=userId_mismatch`);
        return null;
      }
      if (parsed.schemaVersion !== HOME_CACHE_SCHEMA_VERSION) {
        // schema 불일치 → 해당 키 1회 삭제 후 미스 처리
        localStorage.removeItem(homeCacheKey(userId));
        perfLog(`cache hit=miss reason=schemaVersion_mismatch`);
        return null;
      }
      if (!Array.isArray(parsed.recentLogs)) {
        perfLog(`cache hit=miss reason=malformed`);
        return null;
      }
      perfLog(`cache hit=localStorage cachedAt=${parsed.cachedAt} age_ms=${parsed.cachedAt ? Date.now() - parsed.cachedAt : "?"}`);
      return {
        recentLogs: parsed.recentLogs,
        activeLog: parsed.activeLog ?? null,
      };
    } catch {
      return null;
    }
  }

  /** 특정 userId의 영구 캐시만 명시적으로 삭제. 계정 삭제 / 데이터 reset / 데모 로드에서 호출. */
  clearHomeCacheForUser(userId: string): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.removeItem(homeCacheKey(userId));
    } catch {
      // 무시
    }
  }

  /** somalog_home_v1: prefix를 가진 모든 사용자 캐시를 일괄 삭제. 계정 삭제 등에서 호출. */
  clearAllHomeCaches(): void {
    if (typeof window === "undefined") return;
    try {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (
          k &&
          (k.startsWith(HOME_CACHE_KEY_PREFIX) ||
            k.startsWith(LOG_CACHE_KEY_PREFIX) ||
            k.startsWith(GRAPH_CACHE_KEY_PREFIX))
        ) {
          keys.push(k);
        }
      }
      keys.forEach((k) => localStorage.removeItem(k));
      localStorage.removeItem(LEGACY_HOME_CACHE_KEY);
    } catch {
      // 무시
    }
  }

  // ── 로그 탭 영속 캐시 ──────────────────────────────────────────
  saveLogCache(userId: string, weeklyLogs: WeeklyLog[], totalCount: number): void {
    if (typeof window === "undefined") return;
    try {
      const record: LogCacheRecord = {
        userId,
        weeklyLogs,
        totalCount,
        cachedAt: Date.now(),
        schemaVersion: LOG_CACHE_SCHEMA_VERSION,
      };
      localStorage.setItem(logCacheKey(userId), JSON.stringify(record));
    } catch {
      // 용량 초과 등 무시
    }
  }

  loadLogCache(userId: string): { weeklyLogs: WeeklyLog[]; totalCount: number } | null {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(logCacheKey(userId));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<LogCacheRecord>;
      if (parsed.userId !== userId) return null;
      if (parsed.schemaVersion !== LOG_CACHE_SCHEMA_VERSION) {
        localStorage.removeItem(logCacheKey(userId));
        return null;
      }
      if (!Array.isArray(parsed.weeklyLogs) || typeof parsed.totalCount !== "number") {
        return null;
      }
      return { weeklyLogs: parsed.weeklyLogs, totalCount: parsed.totalCount };
    } catch {
      return null;
    }
  }

  clearLogCacheForUser(userId: string): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.removeItem(logCacheKey(userId));
    } catch {
      // 무시
    }
  }

  // ── 그래프 탭 영속 캐시 ────────────────────────────────────────
  saveGraphCache(
    userId: string,
    allLogs: WeightPoint[],
    lowestWeight: { weight: number; date: string } | null
  ): void {
    if (typeof window === "undefined") return;
    try {
      const record: GraphCacheRecord = {
        userId,
        allLogs,
        lowestWeight,
        cachedAt: Date.now(),
        schemaVersion: GRAPH_CACHE_SCHEMA_VERSION,
      };
      localStorage.setItem(graphCacheKey(userId), JSON.stringify(record));
    } catch (e) {
      // 용량 초과(QuotaExceededError) 등 — 캐시는 포기하되 '조용한 죽음'은 로그로 가시화.
      perfLog(`graph cache save failed (${(e as Error)?.name ?? "unknown"}) — len=${allLogs.length}`);
    }
  }

  loadGraphCache(
    userId: string
  ): { allLogs: WeightPoint[]; lowestWeight: { weight: number; date: string } | null } | null {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(graphCacheKey(userId));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<GraphCacheRecord>;
      if (parsed.userId !== userId) return null;
      if (parsed.schemaVersion !== GRAPH_CACHE_SCHEMA_VERSION) {
        localStorage.removeItem(graphCacheKey(userId));
        return null;
      }
      if (!Array.isArray(parsed.allLogs)) return null;
      return {
        allLogs: parsed.allLogs,
        lowestWeight: parsed.lowestWeight ?? null,
      };
    } catch {
      return null;
    }
  }

  clearGraphCacheForUser(userId: string): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.removeItem(graphCacheKey(userId));
    } catch {
      // 무시
    }
  }

  // ── 자동 영속화: setter 가 호출될 때 currentUserId 기준으로 자동 저장 ──────
  // 사용자가 입력 탭에서 저장 → 홈/그래프 캐시도 즉시 갱신 (다음 탭 진입 즉시 최신).
  private persistLogCacheIfReady(): void {
    if (!this.currentUserId) return;
    if (this.weeklyLogs === null || this.totalCount === null) return;
    this.saveLogCache(this.currentUserId, this.weeklyLogs, this.totalCount);
  }

  private persistGraphCacheIfReady(): void {
    if (!this.currentUserId) return;
    if (!this.allLogs || !this.lowestWeightFetched) return;
    this.saveGraphCache(this.currentUserId, this.allLogs, this.lowestWeight);
  }

  // 회귀 수정: 입력 탭에서 저장 후 cold reopen 시 홈이 옛 데이터를 보여주던 문제.
  // setLog 가 메모리 + graph 캐시는 갱신하지만 home localStorage 캐시
  // (somalog_home_v1:userId) 는 갱신하지 않아 다음 cold start 에서 bootCache 가
  // 옛 데이터를 읽었음. setLog/setRecentLogs 가 불릴 때 home 캐시도 자동 영속화.
  private persistHomeCacheIfReady(): void {
    if (!this.currentUserId) return;
    if (!this.recentLogs) return;
    const today = formatDate(new Date());
    const firstUnclosed = this.getFirstUnclosedLog();
    const todayLog = this.cache.get(today) ?? null;
    const activeLog = firstUnclosed ?? todayLog;
    this.saveHomeCache(this.currentUserId, this.recentLogs, activeLog);
  }

  /**
   * LRU 청소를 비동기로 schedule. requestIdleCallback 우선, 없으면 setTimeout(0).
   * **초기 렌더링/메인 스레드를 절대 차단하지 않는다.**
   */
  private scheduleLruCleanup(): void {
    if (typeof window === "undefined") return;
    const cb = () => this.cleanupLru();
    const ric = (window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => void }).requestIdleCallback;
    if (typeof ric === "function") {
      ric(cb, { timeout: 2000 });
    } else {
      setTimeout(cb, 0);
    }
  }

  private cleanupLru(): void {
    if (typeof window === "undefined") return;
    try {
      const entries: Array<{ key: string; cachedAt: number }> = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || !k.startsWith(HOME_CACHE_KEY_PREFIX)) continue;
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        try {
          const parsed = JSON.parse(raw) as Partial<HomeCacheRecord>;
          const cachedAt = typeof parsed.cachedAt === "number" ? parsed.cachedAt : 0;
          entries.push({ key: k, cachedAt });
        } catch {
          // 손상된 항목은 즉시 제거
          localStorage.removeItem(k);
        }
      }
      if (entries.length <= HOME_CACHE_LRU_LIMIT) return;
      entries.sort((a, b) => a.cachedAt - b.cachedAt); // 오래된 순
      const toRemove = entries.slice(0, entries.length - HOME_CACHE_LRU_LIMIT);
      toRemove.forEach((e) => localStorage.removeItem(e.key));
    } catch {
      // 무시
    }
  }

  /** @internal 테스트 전용: 모듈 싱글톤 상태 초기화 */
  __resetForTest(): void {
    this.currentUserId = null;
    this.resetInMemory();
  }
}

export const logStore = new LogStore();
