"use client";

import type { ChapterScope, Notice, Settings } from "@/lib/types";
import type { HomeInitialData } from "@/lib/services/home-service";
import {
  actionGetHomeInitialData,
  actionGetPrefetchData,
  actionAutoCloseOldLogs,
} from "@/app/actions/log-actions";
import { actionGetSettings } from "@/app/actions/settings-actions";
import { actionGetChapterScopes } from "@/app/actions/chapter-actions";
import { actionGetUnseenImportantNotices } from "@/app/actions/notice-actions";
import { fetchJson } from "./fetch-json";

/**
 * 앱 시작(홈·탭 공통 Provider 마운트) 때 한꺼번에 나가는 요청들.
 * Server Action 큐를 타지 않도록 Route Handler 로 보낸다 (근거: ./fetch-json.ts).
 */

type PrefetchData = Awaited<ReturnType<typeof actionGetPrefetchData>>;
type AutoCloseResult = Awaited<ReturnType<typeof actionAutoCloseOldLogs>>;

export function fetchHomeInitialData(): Promise<HomeInitialData> {
  return fetchJson("/api/home/initial", () => actionGetHomeInitialData());
}

export function fetchPrefetchData(records: boolean, graph: boolean): Promise<PrefetchData> {
  return fetchJson(
    `/api/home/prefetch?records=${records ? 1 : 0}&graph=${graph ? 1 : 0}`,
    () => actionGetPrefetchData(records, graph)
  );
}

/** 밀린 로그 채우기/자동 마감 — 쓰기지만 화면 캐시를 무효화하지 않는 백그라운드 작업이라 같은 경로. */
export function fetchAutoCloseOldLogs(): Promise<AutoCloseResult> {
  return fetchJson("/api/daily-log/auto-close", () => actionAutoCloseOldLogs(), {
    method: "POST",
  });
}

export function fetchSettings(): Promise<Settings> {
  return fetchJson("/api/settings", () => actionGetSettings());
}

export function fetchChapterScopes(): Promise<ChapterScope[]> {
  return fetchJson("/api/chapters", () => actionGetChapterScopes());
}

export function fetchUnseenImportantNotices(lastSeenAt: string | null): Promise<Notice[]> {
  const q = lastSeenAt ? `?lastSeenAt=${encodeURIComponent(lastSeenAt)}` : "";
  return fetchJson(`/api/notices/unseen${q}`, () =>
    actionGetUnseenImportantNotices(lastSeenAt)
  );
}
