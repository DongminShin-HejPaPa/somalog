import { describe, it, expect, beforeEach, vi } from "vitest";

// vitest 환경이 node이므로 localStorage / window 를 모듈 import 전에 polyfill.
class MemoryStorage {
  private store = new Map<string, string>();
  get length() { return this.store.size; }
  key(i: number) { return Array.from(this.store.keys())[i] ?? null; }
  getItem(k: string) { return this.store.has(k) ? this.store.get(k)! : null; }
  setItem(k: string, v: string) { this.store.set(k, String(v)); }
  removeItem(k: string) { this.store.delete(k); }
  clear() { this.store.clear(); }
}
const memStorage = new MemoryStorage();
vi.stubGlobal("localStorage", memStorage as unknown as Storage);
vi.stubGlobal("window", { localStorage: memStorage } as unknown as Window);

// LRU의 setTimeout(0)을 동기 실행으로 만든다.
const realSetTimeout = globalThis.setTimeout;
vi.stubGlobal("setTimeout", ((cb: () => void, ms?: number) => {
  if (ms === 0 || ms === undefined) {
    cb();
    return 0 as unknown as ReturnType<typeof globalThis.setTimeout>;
  }
  return realSetTimeout(cb, ms);
}) as typeof globalThis.setTimeout);

import { logStore } from "@/lib/stores/log-store";
import { mockDailyLog } from "@/tests/fixtures/mock-data";
import type { DailyLog } from "@/lib/types";

beforeEach(() => {
  memStorage.clear();
  (logStore as unknown as { __resetForTest: () => void }).__resetForTest();
});

function makeLog(date: string, overrides: Partial<DailyLog> = {}): DailyLog {
  return { ...mockDailyLog, date, ...overrides };
}

function readCacheKey(userId: string): { cachedAt: number; schemaVersion: number; recentLogs: DailyLog[] } | null {
  const raw = localStorage.getItem(`somalog_home_v1:${userId}`);
  return raw ? JSON.parse(raw) : null;
}

describe("LogStore - invalidateIfUserChanged 분기", () => {
  it("cold start (prev=null, next=userA): 인메모리/영구 캐시 모두 보존 — baseline만 설정", () => {
    logStore.saveHomeCache("userA", [makeLog("2024-01-15")], makeLog("2024-01-15"));
    (logStore as unknown as { __resetForTest: () => void }).__resetForTest(); // cold start 시뮬: currentUserId=null
    expect(readCacheKey("userA")).not.toBeNull();

    logStore.invalidateIfUserChanged("userA");

    expect(readCacheKey("userA")).not.toBeNull(); // localStorage 보존
    expect(logStore.getRecentLogs()).toBeNull(); // 인메모리는 비어있는 상태 유지 (baseline은 reset 안 부름)
  });

  it("로그아웃 (prev=userA, next=null): 인메모리는 reset, 영구 캐시는 보존", () => {
    logStore.invalidateIfUserChanged("userA");
    logStore.setRecentLogs([makeLog("2024-01-15")]);
    logStore.saveHomeCache("userA", [makeLog("2024-01-15")], makeLog("2024-01-15"));

    logStore.invalidateIfUserChanged(null);

    expect(logStore.getRecentLogs()).toBeNull();
    expect(readCacheKey("userA")).not.toBeNull();
  });

  it("사용자 교체 (prev=A, next=B): 인메모리 reset, A/B 양쪽 영구 캐시 모두 보존", () => {
    logStore.invalidateIfUserChanged("userA");
    logStore.setRecentLogs([makeLog("2024-01-15")]);
    logStore.saveHomeCache("userA", [makeLog("2024-01-15")], makeLog("2024-01-15"));
    logStore.saveHomeCache("userB", [makeLog("2024-01-16")], makeLog("2024-01-16"));

    logStore.invalidateIfUserChanged("userB");

    expect(logStore.getRecentLogs()).toBeNull();
    expect(readCacheKey("userA")).not.toBeNull();
    expect(readCacheKey("userB")).not.toBeNull();
  });

  it("동일 유저 재진입 (prev=A, next=A): no-op", () => {
    logStore.invalidateIfUserChanged("userA");
    logStore.setRecentLogs([makeLog("2024-01-15")]);
    logStore.saveHomeCache("userA", [makeLog("2024-01-15")], makeLog("2024-01-15"));

    logStore.invalidateIfUserChanged("userA");

    expect(logStore.getRecentLogs()).not.toBeNull();
    expect(readCacheKey("userA")).not.toBeNull();
  });
});

describe("LogStore - 영구 캐시 명시 삭제", () => {
  it("clearHomeCacheForUser(A) → A키만 삭제, B키 보존", () => {
    logStore.saveHomeCache("userA", [makeLog("2024-01-15")], makeLog("2024-01-15"));
    logStore.saveHomeCache("userB", [makeLog("2024-01-16")], makeLog("2024-01-16"));

    logStore.clearHomeCacheForUser("userA");

    expect(readCacheKey("userA")).toBeNull();
    expect(readCacheKey("userB")).not.toBeNull();
  });

  it("clearAllHomeCaches() → 모든 prefix 키 + legacy 키 삭제", () => {
    logStore.saveHomeCache("userA", [makeLog("2024-01-15")], makeLog("2024-01-15"));
    logStore.saveHomeCache("userB", [makeLog("2024-01-16")], makeLog("2024-01-16"));
    localStorage.setItem("somalog_home_v1", JSON.stringify({ legacy: true }));

    logStore.clearAllHomeCaches();

    expect(readCacheKey("userA")).toBeNull();
    expect(readCacheKey("userB")).toBeNull();
    expect(localStorage.getItem("somalog_home_v1")).toBeNull();
  });
});

describe("LogStore - LRU (N=3)", () => {
  it("4명째 저장 시 가장 오래된 1명 키가 삭제됨", () => {
    const baseTime = 1_700_000_000_000;
    const nowSpy = vi.spyOn(Date, "now");
    nowSpy.mockReturnValueOnce(baseTime);
    logStore.saveHomeCache("userA", [makeLog("2024-01-15")], null);
    nowSpy.mockReturnValueOnce(baseTime + 1000);
    logStore.saveHomeCache("userB", [makeLog("2024-01-15")], null);
    nowSpy.mockReturnValueOnce(baseTime + 2000);
    logStore.saveHomeCache("userC", [makeLog("2024-01-15")], null);
    nowSpy.mockReturnValueOnce(baseTime + 3000);
    logStore.saveHomeCache("userD", [makeLog("2024-01-15")], null);

    expect(readCacheKey("userA")).toBeNull();
    expect(readCacheKey("userB")).not.toBeNull();
    expect(readCacheKey("userC")).not.toBeNull();
    expect(readCacheKey("userD")).not.toBeNull();

    nowSpy.mockRestore();
  });
});

describe("LogStore - 마이그레이션 & schemaVersion", () => {
  it("legacy 단일 키(somalog_home_v1)가 있으면 loadHomeCache 호출 시 1회 삭제 + 미스 처리", () => {
    localStorage.setItem("somalog_home_v1", JSON.stringify({ userId: "userA", recentLogs: [] }));

    const result = logStore.loadHomeCache("userA");

    expect(result).toBeNull();
    expect(localStorage.getItem("somalog_home_v1")).toBeNull();
  });

  it("schemaVersion 불일치 시 해당 키 삭제 + null 반환", () => {
    const stale = {
      userId: "userA",
      recentLogs: [makeLog("2024-01-15")],
      activeLog: null,
      cachedAt: Date.now(),
      schemaVersion: 999,
    };
    localStorage.setItem("somalog_home_v1:userA", JSON.stringify(stale));

    const result = logStore.loadHomeCache("userA");

    expect(result).toBeNull();
    expect(readCacheKey("userA")).toBeNull();
  });

  it("정상 캐시 (current schemaVersion) → 데이터 반환 + cachedAt 메타데이터 보존", () => {
    const log = makeLog("2024-01-15");
    logStore.saveHomeCache("userA", [log], log);

    const result = logStore.loadHomeCache("userA");

    expect(result).not.toBeNull();
    expect(result?.recentLogs).toHaveLength(1);
    expect(result?.activeLog?.date).toBe("2024-01-15");

    const record = readCacheKey("userA");
    expect(record?.schemaVersion).toBe(1);
    expect(typeof record?.cachedAt).toBe("number");
  });
});

describe("LogStore - resetInMemory 부수효과 없음", () => {
  it("resetInMemory()는 인메모리만 비우고 localStorage는 건드리지 않는다", () => {
    logStore.invalidateIfUserChanged("userA");
    logStore.setRecentLogs([makeLog("2024-01-15")]);
    logStore.saveHomeCache("userA", [makeLog("2024-01-15")], makeLog("2024-01-15"));

    logStore.resetInMemory();

    expect(logStore.getRecentLogs()).toBeNull();
    expect(readCacheKey("userA")).not.toBeNull();
  });
});
