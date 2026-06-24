"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
  type ReactNode,
} from "react";
import type { ChapterScope, Settings } from "@/lib/types";
import { useSettings } from "@/lib/contexts/settings-context";
import { actionGetChapterScopes } from "@/app/actions/chapter-actions";
import { formatDate } from "@/lib/utils/date-utils";

// 선택 챕터는 기기에 영속(사용자 결정). 스코프 목록도 캐시해 재방문 시 즉시 표시.
const SELECTED_KEY_PREFIX = "somalog_chapter_sel_v1:";
const SCOPES_KEY_PREFIX = "somalog_chapter_scopes_v1:";

function selKey(userId: string | null) {
  return SELECTED_KEY_PREFIX + (userId ?? "anon");
}
function scopesKey(userId: string | null) {
  return SCOPES_KEY_PREFIX + (userId ?? "anon");
}

function addMonths(date: string, months: number): string {
  const d = new Date(date + "T00:00:00");
  d.setMonth(d.getMonth() + months);
  return formatDate(d);
}

/**
 * settings 만으로 즉시 만들 수 있는 기본 스코프(전체·진행중).
 * 서버 getChapterScopes 의 all/current 와 값이 일치하도록 동일 로직을 미러링한다.
 * 종료 챕터는 서버 fetch 후 합쳐진다(기본 동작/속도엔 영향 없음).
 */
function buildBaseScopes(settings: Settings): ChapterScope[] {
  // settings 가 아직 로드 전(빈 dietStartDate)이면 Invalid Date/NaN 방지를 위해 오늘로 폴백.
  // (온보딩 완료 사용자만 탭에 진입하므로 실사용에선 항상 실제 시작일이 들어온다)
  const start = settings.dietStartDate || formatDate(new Date());
  const targetEnd = addMonths(start, settings.targetMonths || 12);
  const current: ChapterScope = {
    id: "current",
    label: settings.mode === "maintaining" ? "유지 중인 챕터" : "진행 중인 챕터",
    status: "current",
    rangeStart: start,
    rangeEnd: null,
    startDate: start,
    startWeight: settings.startWeight,
    targetWeight: settings.targetWeight,
    targetEndDate: targetEnd,
    isOngoing: true,
    displayStart: start,
    displayEnd: null,
  };
  const all: ChapterScope = {
    id: "all",
    label: "전체 기간",
    status: "all",
    rangeStart: null,
    rangeEnd: null,
    startDate: start,
    startWeight: settings.startWeight,
    targetWeight: settings.targetWeight,
    targetEndDate: targetEnd,
    isOngoing: true,
    displayStart: start,
    displayEnd: null,
  };
  return [all, current];
}

interface ChapterScopeContextValue {
  scopes: ChapterScope[];
  selectedId: string;
  selectedScope: ChapterScope; // 항상 정의됨(settings 기반 fallback)
  setSelectedId: (id: string) => void;
  refresh: () => void;
}

const ChapterScopeContext = createContext<ChapterScopeContextValue | null>(null);

export function ChapterScopeProvider({
  children,
  userId,
}: {
  children: ReactNode;
  userId: string | null;
}) {
  const { settings } = useSettings();

  // 선택 id: localStorage 동기 읽기(기본 current).
  const [selectedId, setSelectedIdState] = useState<string>(() => {
    if (typeof window === "undefined") return "current";
    try {
      return localStorage.getItem(selKey(userId)) || "current";
    } catch {
      return "current";
    }
  });

  // 서버 스코프 목록: localStorage 캐시 동기 시드 → 마운트 시 백그라운드 최신화.
  const [fetchedScopes, setFetchedScopes] = useState<ChapterScope[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(scopesKey(userId));
      return raw ? (JSON.parse(raw) as ChapterScope[]) : [];
    } catch {
      return [];
    }
  });

  const loadScopes = useCallback(() => {
    actionGetChapterScopes()
      .then((list) => {
        if (!list || list.length === 0) return;
        setFetchedScopes(list);
        try {
          localStorage.setItem(scopesKey(userId), JSON.stringify(list));
        } catch {
          // 용량 초과 등 무시
        }
      })
      .catch(() => {});
  }, [userId]);

  useEffect(() => {
    loadScopes();
  }, [loadScopes]);

  const baseScopes = useMemo(() => buildBaseScopes(settings), [settings]);

  // 목록: 서버 스코프가 있으면 그것을, 없으면 settings 기반 기본(전체·진행중).
  const scopes = fetchedScopes.length > 0 ? fetchedScopes : baseScopes;

  const setSelectedId = useCallback(
    (id: string) => {
      setSelectedIdState(id);
      try {
        localStorage.setItem(selKey(userId), id);
      } catch {
        // 무시
      }
    },
    [userId]
  );

  // 선택 스코프 해석: 목록에서 찾고, 없으면 settings 기반 current/all fallback,
  // 그래도 없으면 첫 항목. 어떤 경우에도 null 이 되지 않게 한다.
  const selectedScope = useMemo<ChapterScope>(() => {
    const found = scopes.find((s) => s.id === selectedId);
    if (found) return found;
    const base = baseScopes.find((s) => s.id === selectedId);
    if (base) return base;
    return (
      scopes.find((s) => s.id === "current") ??
      baseScopes.find((s) => s.id === "current") ??
      baseScopes[0]
    );
  }, [scopes, baseScopes, selectedId]);

  const value = useMemo(
    () => ({ scopes, selectedId, selectedScope, setSelectedId, refresh: loadScopes }),
    [scopes, selectedId, selectedScope, setSelectedId, loadScopes]
  );

  return (
    <ChapterScopeContext.Provider value={value}>
      {children}
    </ChapterScopeContext.Provider>
  );
}

export function useChapterScope(): ChapterScopeContextValue {
  const ctx = useContext(ChapterScopeContext);
  if (!ctx) {
    throw new Error("useChapterScope must be used within ChapterScopeProvider");
  }
  return ctx;
}
