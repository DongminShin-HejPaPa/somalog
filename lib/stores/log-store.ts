"use client";

import type { DailyLog } from "@/lib/types";

const STALE_MS = 2 * 60 * 1000; // 2 minutes
const HOME_CACHE_KEY = 'somalog_home_v1';

class LogStore {
  private currentUserId: string | null = null;
  private cache = new Map<string, DailyLog>();
  private recentLogs: DailyLog[] | null = null;
  private weeklyLogs: any[] | null = null;
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
    // - If new weight is ≤ current lowest → update in-place (no fetch needed)
    // - If new weight is higher → current lowest still correct, no change needed
    // - If weight was cleared (null) → lowestWeight might be stale, but Graph tab
    //   background refresh will correct it; no need to block the cache hit
    if (this.lowestWeightFetched && log.weight !== null && log.weight !== undefined) {
      if (this.lowestWeight === null || log.weight <= this.lowestWeight.weight) {
        this.lowestWeight = { weight: log.weight, date: log.date };
      }
    }

    // weeklyLogs NOT cleared on close: AI summary is generated asynchronously anyway.
    // Log tab background-refreshes on next visit if stale.
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

  setWeeklyLogs(logs: any[]) {
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

  /** true if lowestWeight has been fetched at least once (value may be null = no data) */
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

  /**
   * Run the auto-close action exactly once per session (deduplicates across
   * HomeContainer and InputContainer which both call it on mount).
   * Returns the promise for the first caller; subsequent callers get null.
   */
  runAutoCloseOnce<T>(fn: () => Promise<T>): Promise<T> | null {
    if (this.autoCloseFired) return null;
    this.autoCloseFired = true;
    return fn().catch((err) => {
      this.autoCloseFired = false; // allow retry on error
      throw err;
    });
  }

  /** userId가 바뀐 경우 캐시 전체 초기화. 각 container 마운트 시 첫 번째로 호출해야 함. */
  invalidateIfUserChanged(userId: string | null): void {
    if (this.currentUserId !== userId) {
      this.clear();
      this.currentUserId = userId;
    }
  }

  clear() {
    this.clearHomeCache();
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

  saveHomeCache(userId: string, recentLogs: DailyLog[], activeLog: DailyLog | null): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(HOME_CACHE_KEY, JSON.stringify({ userId, recentLogs, activeLog }));
    } catch {}
  }

  loadHomeCache(userId: string): { recentLogs: DailyLog[]; activeLog: DailyLog | null } | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(HOME_CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { userId: string; recentLogs: DailyLog[]; activeLog: DailyLog | null };
      if (parsed.userId !== userId) return null;
      return { recentLogs: parsed.recentLogs, activeLog: parsed.activeLog };
    } catch { return null; }
  }

  private clearHomeCache(): void {
    if (typeof window === 'undefined') return;
    try { localStorage.removeItem(HOME_CACHE_KEY); } catch {}
  }
}

export const logStore = new LogStore();
