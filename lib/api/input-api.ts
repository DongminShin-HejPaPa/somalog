"use client";

import type { DailyLog } from "@/lib/types";
import {
  actionGetDailyLog,
  actionUpsertDailyLog,
  actionGetRecentDailyLogs,
  actionGetFirstUnclosedLog,
} from "@/app/actions/log-actions";

/**
 * 입력 탭의 **첫 화면에 필요한 읽기**를 Server Action 큐 밖에서 가져온다.
 *
 * Next 라우터는 Server Action 을 직렬로 하나씩 처리한다. 앱을 켜면 홈이 쏜
 * 초기 로드·프리페치·자동 마감, 설정·공지 로드가 큐를 채우고 있어서, 그 사이
 * 입력 탭으로 넘어가면 날짜 로드가 맨 뒤에서 수초를 기다렸다.
 * 여기 함수들은 Route Handler 를 plain fetch 로 불러 큐와 무관하게 즉시 나간다.
 *
 * Route Handler 가 실패하면(비로그인 리다이렉트로 HTML 이 오는 경우 포함)
 * 기존 Server Action 경로로 폴백한다 — 느려질 수는 있어도 깨지지는 않는다.
 */

async function getJson<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    cache: "no-store",
    credentials: "same-origin",
  });
  const type = res.headers.get("content-type") ?? "";
  if (!res.ok || res.redirected || !type.includes("application/json")) {
    throw new Error(`input-api ${res.status}`);
  }
  return res.json() as Promise<T>;
}

/** 날짜 로그 1건. ensure=true 면 없을 때 빈 로그를 만들어 돌려준다. */
export async function fetchDailyLog(date: string, ensure: boolean): Promise<DailyLog | null> {
  try {
    const { log } = await getJson<{ log: DailyLog | null }>("/api/daily-log", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ date, ensure }),
    });
    return log;
  } catch {
    const log = await actionGetDailyLog(date);
    if (log || !ensure) return log;
    return actionUpsertDailyLog(date, {});
  }
}

/** 최근 로그 N건 (+선택: 가장 오래된 미마감 로그). */
export async function fetchRecentLogs(
  count: number,
  withFirstUnclosed = false
): Promise<{ logs: DailyLog[]; firstUnclosed: DailyLog | null }> {
  try {
    return await getJson<{ logs: DailyLog[]; firstUnclosed: DailyLog | null }>(
      `/api/daily-log/recent?count=${count}${withFirstUnclosed ? "&firstUnclosed=1" : ""}`
    );
  } catch {
    const [logs, firstUnclosed] = await Promise.all([
      actionGetRecentDailyLogs(count),
      withFirstUnclosed ? actionGetFirstUnclosedLog() : Promise.resolve(null),
    ]);
    return { logs, firstUnclosed };
  }
}
