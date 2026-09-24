import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/app/actions/log-actions", () => ({
  actionGetDailyLog: vi.fn(),
  actionUpsertDailyLog: vi.fn(),
  actionGetRecentDailyLogs: vi.fn(),
  actionGetFirstUnclosedLog: vi.fn(),
}));

import * as actions from "@/app/actions/log-actions";
import { fetchDailyLog, fetchRecentLogs } from "@/lib/api/input-api";

const log = { date: "2026-09-24", closed: false } as never;

function jsonResponse(body: unknown, init: { status?: number; redirected?: boolean } = {}) {
  return {
    ok: (init.status ?? 200) < 400,
    status: init.status ?? 200,
    redirected: init.redirected ?? false,
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => body,
  } as Response;
}

describe("input-api — Server Action 큐 우회 읽기", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("fetchDailyLog: Route Handler 응답을 그대로 쓰고 Server Action 은 부르지 않는다", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ log }));
    await expect(fetchDailyLog("2026-09-24", true)).resolves.toBe(log);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/daily-log",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ date: "2026-09-24", ensure: true }) })
    );
    expect(actions.actionGetDailyLog).not.toHaveBeenCalled();
  });

  it("fetchDailyLog: 실패하면 기존 액션 경로(get → upsert)로 폴백", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "failed" }, { status: 500 }));
    vi.mocked(actions.actionGetDailyLog).mockResolvedValue(null);
    vi.mocked(actions.actionUpsertDailyLog).mockResolvedValue(log);
    await expect(fetchDailyLog("2026-09-24", true)).resolves.toBe(log);
    expect(actions.actionUpsertDailyLog).toHaveBeenCalledWith("2026-09-24", {});
  });

  it("fetchDailyLog: 비로그인 리다이렉트(HTML)도 실패로 보고 폴백, ensure=false 면 upsert 안 함", async () => {
    fetchMock.mockResolvedValue({
      ok: true, status: 200, redirected: true,
      headers: new Headers({ "content-type": "text/html" }),
      json: async () => { throw new Error("not json"); },
    } as unknown as Response);
    vi.mocked(actions.actionGetDailyLog).mockResolvedValue(null);
    await expect(fetchDailyLog("2026-09-30", false)).resolves.toBeNull();
    expect(actions.actionUpsertDailyLog).not.toHaveBeenCalled();
  });

  it("fetchRecentLogs: firstUnclosed 요청 여부가 쿼리에 반영되고, 실패 시 액션으로 폴백", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ logs: [log], firstUnclosed: log }));
    await expect(fetchRecentLogs(30, true)).resolves.toEqual({ logs: [log], firstUnclosed: log });
    expect(fetchMock.mock.calls[0][0]).toBe("/api/daily-log/recent?count=30&firstUnclosed=1");

    fetchMock.mockRejectedValueOnce(new TypeError("offline"));
    vi.mocked(actions.actionGetRecentDailyLogs).mockResolvedValue([log]);
    await expect(fetchRecentLogs(30)).resolves.toEqual({ logs: [log], firstUnclosed: null });
    expect(actions.actionGetFirstUnclosedLog).not.toHaveBeenCalled();
  });
});
