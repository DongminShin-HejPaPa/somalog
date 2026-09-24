"use client";

import type { DailyLog } from "@/lib/types";
import {
  actionGetDailyLog,
  actionUpsertDailyLog,
  actionGetRecentDailyLogs,
  actionGetFirstUnclosedLog,
} from "@/app/actions/log-actions";
import { fetchJson, jsonPost } from "./fetch-json";

/** 날짜 로그 1건. ensure=true 면 없을 때 빈 로그를 만들어 돌려준다. */
export async function fetchDailyLog(date: string, ensure: boolean): Promise<DailyLog | null> {
  const { log } = await fetchJson<{ log: DailyLog | null }>(
    "/api/daily-log",
    async () => {
      const found = await actionGetDailyLog(date);
      if (found || !ensure) return { log: found };
      return { log: await actionUpsertDailyLog(date, {}) };
    },
    jsonPost({ date, ensure })
  );
  return log;
}

/** 최근 로그 N건 (+선택: 가장 오래된 미마감 로그). */
export function fetchRecentLogs(
  count: number,
  withFirstUnclosed = false
): Promise<{ logs: DailyLog[]; firstUnclosed: DailyLog | null }> {
  return fetchJson(
    `/api/daily-log/recent?count=${count}${withFirstUnclosed ? "&firstUnclosed=1" : ""}`,
    async () => {
      const [logs, firstUnclosed] = await Promise.all([
        actionGetRecentDailyLogs(count),
        withFirstUnclosed ? actionGetFirstUnclosedLog() : Promise.resolve(null),
      ]);
      return { logs, firstUnclosed };
    }
  );
}
