"use client";

import type { DailyLog } from "@/lib/types";

class LogStore {
  private currentUserId: string | null = null;
  private cache = new Map<string, DailyLog>();
  private recentLogs: DailyLog[] | null = null;
  private weeklyLogs: any[] | null = null;
  private totalCount: number | null = null;
  private allLogs: DailyLog[] | null = null;
  private lowestWeight: { weight: number; date: string } | null = null;
  private lastFetchTime = 0;

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
  }

  setLogs(logs: DailyLog[]) {
    logs.forEach((l) => this.cache.set(l.date, l));
  }

  setRecentLogs(logs: DailyLog[]) {
    this.recentLogs = [...logs].sort((a, b) => b.date.localeCompare(a.date));
    this.setLogs(logs);
    this.lastFetchTime = Date.now();
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
  }

  getLowestWeight() {
    return this.lowestWeight;
  }

  getFirstUnclosedLog(): DailyLog | null {
    if (!this.recentLogs) return null;
    return [...this.recentLogs]
      .filter((l) => !l.closed)
      .sort((a, b) => a.date.localeCompare(b.date))[0] ?? null;
  }

  isStale(): boolean {
    return Date.now() - this.lastFetchTime > 5 * 60 * 1000; // 5 minutes
  }

  /** userId가 바뀐 경우 캐시 전체 초기화. 각 container 마운트 시 첫 번째로 호출해야 함. */
  invalidateIfUserChanged(userId: string | null): void {
    if (this.currentUserId !== userId) {
      this.clear();
      this.currentUserId = userId;
    }
  }

  clear() {
    this.cache.clear();
    this.recentLogs = null;
    this.weeklyLogs = null;
    this.totalCount = null;
    this.allLogs = null;
    this.lowestWeight = null;
    this.lastFetchTime = 0;
  }
}

export const logStore = new LogStore();
