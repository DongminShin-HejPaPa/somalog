import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  decideEntryRoute,
  kstToday,
  markHomeEntry,
  syncInputDone,
  clearEntryRouteState,
  ENTRY_DATE_KEY,
  INPUT_DONE_KEY,
} from "@/lib/utils/entry-route";

const TODAY = "2026-08-03";

describe("decideEntryRoute", () => {
  const base = {
    pathname: "/home",
    today: TODAY,
    entryDate: TODAY,
    inputDoneDate: null as string | null,
  };

  it("당일 첫 접속이면 홈 유지 (entryDate 미기록)", () => {
    expect(decideEntryRoute({ ...base, entryDate: null })).toBeNull();
  });

  it("당일 첫 접속이면 홈 유지 (entryDate 가 어제)", () => {
    expect(decideEntryRoute({ ...base, entryDate: "2026-08-02" })).toBeNull();
  });

  it("오늘 입력이 완료됐으면 홈 유지", () => {
    expect(decideEntryRoute({ ...base, inputDoneDate: TODAY })).toBeNull();
  });

  it("오늘 재접속 + 입력 미완료면 입력 탭으로", () => {
    expect(decideEntryRoute(base)).toBe("/input");
  });

  it("어제 마감했더라도 오늘 미완료면 입력 탭으로", () => {
    expect(decideEntryRoute({ ...base, inputDoneDate: "2026-08-02" })).toBe("/input");
  });

  it("루트 경로(/)도 동일하게 판정한다", () => {
    expect(decideEntryRoute({ ...base, pathname: "/" })).toBe("/input");
  });

  it("홈 진입점이 아닌 경로는 개입하지 않는다", () => {
    for (const pathname of ["/input", "/log", "/graph", "/settings", "/login", "/onboarding"]) {
      expect(decideEntryRoute({ ...base, pathname })).toBeNull();
    }
  });

  it("새로고침은 접속으로 보지 않는다", () => {
    expect(decideEntryRoute({ ...base, isReload: true })).toBeNull();
  });
});

describe("kstToday", () => {
  it("UTC 자정 직후는 이미 KST 로 같은 날 오전 9시", () => {
    expect(kstToday(Date.parse("2026-08-03T00:00:00Z"))).toBe("2026-08-03");
  });

  it("UTC 15:00 은 KST 로 다음 날 자정", () => {
    expect(kstToday(Date.parse("2026-08-03T15:00:00Z"))).toBe("2026-08-04");
  });

  it("UTC 14:59 는 아직 KST 로 같은 날", () => {
    expect(kstToday(Date.parse("2026-08-03T14:59:59Z"))).toBe("2026-08-03");
  });

  it("월/일을 2자리로 zero-pad 한다", () => {
    expect(kstToday(Date.parse("2026-01-05T00:00:00Z"))).toBe("2026-01-05");
  });
});

describe("localStorage 연동", () => {
  let store: Record<string, string>;

  beforeEach(() => {
    store = {};
    const localStorageMock = {
      getItem: (k: string) => (k in store ? store[k] : null),
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      removeItem: (k: string) => {
        delete store[k];
      },
    };
    vi.stubGlobal("window", { localStorage: localStorageMock });
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-03T04:00:00Z")); // KST 13:00
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("markHomeEntry 는 KST 오늘을 기록한다", () => {
    markHomeEntry();
    expect(store[ENTRY_DATE_KEY]).toBe(TODAY);
  });

  it("syncInputDone(오늘, closed=true) 는 오늘을 기록한다", () => {
    syncInputDone(TODAY, true);
    expect(store[INPUT_DONE_KEY]).toBe(TODAY);
  });

  it("syncInputDone(오늘, closed=false) 는 오늘 플래그를 해제한다 (마감 취소)", () => {
    store[INPUT_DONE_KEY] = TODAY;
    syncInputDone(TODAY, false);
    expect(store[INPUT_DONE_KEY]).toBeUndefined();
  });

  it("과거 날짜 로그는 오늘 플래그를 건드리지 않는다", () => {
    store[INPUT_DONE_KEY] = TODAY;
    syncInputDone("2026-08-01", false);
    expect(store[INPUT_DONE_KEY]).toBe(TODAY);
  });

  it("clearEntryRouteState 는 두 키를 모두 지운다", () => {
    store[ENTRY_DATE_KEY] = TODAY;
    store[INPUT_DONE_KEY] = TODAY;
    clearEntryRouteState();
    expect(store[ENTRY_DATE_KEY]).toBeUndefined();
    expect(store[INPUT_DONE_KEY]).toBeUndefined();
  });

  it("window 가 없으면(SSR) 아무 것도 하지 않는다", () => {
    vi.unstubAllGlobals();
    expect(() => {
      markHomeEntry();
      syncInputDone(TODAY, true);
      clearEntryRouteState();
    }).not.toThrow();
  });
});
