"use client";

import { useEffect } from "react";
import { logStore } from "@/lib/stores/log-store";

/**
 * 사용자 transition(cold start / 로그아웃 / 사용자 교체)을 SettingsProvider 한 곳에서 감지해
 * logStore의 인메모리 캐시를 정리한다. 영구 캐시(localStorage)는 logStore가 보존한다.
 *
 * 분기 책임은 logStore.invalidateIfUserChanged 내부에 캡슐화되어 있고,
 * 이 훅은 단지 transition trigger 역할만 한다.
 */
export function useUserCacheLifecycle(userId: string | null): void {
  useEffect(() => {
    logStore.invalidateIfUserChanged(userId);
  }, [userId]);
}
