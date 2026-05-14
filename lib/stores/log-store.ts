"use client";

import type { DailyLog, WeeklyLog } from "@/lib/types";
import { perfLog } from "@/lib/utils/perf-log";

const STALE_MS = 2 * 60 * 1000; // 2 minutes
const HOME_CACHE_KEY_PREFIX = "somalog_home_v1:";
const LEGACY_HOME_CACHE_KEY = "somalog_home_v1"; // pre-userId-split 키 (마이그레이션 대상)
const HOME_CACHE_SCHEMA_VERSION = 1;
const HOME_CACHE_LRU_LIMIT = 3;

interface HomeCacheRecord {
  userId: string;
  recentLogs: DailyLog[];
  activeLog: DailyLog | null;
  cachedAt: number;
  schemaVersion: number;
}

function homeCacheKey(userId: string): string {
  return HOME_CACHE_KEY_PREFIX + userId;
}

class LogStore {
  private currentUserId: string | null = null;
  private cache = new Map<string, DailyLog>();
  private recentLogs: DailyLog[] | null = null;
  private weeklyLogs: WeeklyLog[] | null = null;
  private totalCount: number | null = null;
  private allLogs: DailyLog[] | null = null;
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
      const idx = this.allLogs.findIndex((l) => l.date === log.date);
      if (idx !== -1) {
        this.allLogs[idx] = log;
      } else {
        this.allLogs.push(log);
        this.allLogs.sort((a, b) => b.date.localeCompare(a.date));
      }
    }

    // Smart lowestWeight update: only invalidate when we truly can't determine the new minimum.
    if (this.lowestWeightFetched && log.weight !== null && log.weight !== undefined) {
      if (this.lowestWeight === null || log.weight <= this.lowestWeight.weight) {
        this.lowestWeight = { weight: log.weight, date: log.date };
      }
    }
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
        const idx = this.allLogs.findIndex((l) => l.date === log.date);
        if (idx !== -1) {
          this.allLogs[idx] = log;
        } else {
          this.allLogs.push(log);
        }
      }
      this.allLogs.sort((a, b) => b.date.localeCompare(a.date));
    }
  }

  getRecentLogs(): DailyLog[] | null {
    return this.recentLogs;
  }

  setWeeklyLogs(logs: WeeklyLog[]) {
    this.weeklyLogs = logs;
  }

  getWeeklyLogs() {
    return this.weeklyLogs;
  }

  setTotalCount(c: number) {
    this.totalCount = c;
  }

  getTotalCount() {
    return this.totalCount;
  }

  setAllLogs(logs: DailyLog[]) {
    this.allLogs = logs;
  }

  getAllLogs() {
    return this.allLogs;
  }

  setLowestWeight(lowest: { weight: number; date: string } | null) {
    this.lowestWeight = lowest;
    this.lowestWeightFetched = true;
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
        if (k && k.startsWith(HOME_CACHE_KEY_PREFIX)) keys.push(k);
      }
      keys.forEach((k) => localStorage.removeItem(k));
      localStorage.removeItem(LEGACY_HOME_CACHE_KEY);
    } catch {
      // 무시
    }
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
