"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSettings } from "@/lib/contexts/settings-context";
import { useChapterScope } from "@/lib/contexts/chapter-scope-context";
import { actionGetWeightSeries } from "@/app/actions/log-actions";
import { WeightChart } from "./weight-chart";
import type { WeightPoint } from "@/lib/types";
import { logStore } from "@/lib/stores/log-store";

interface GraphContainerProps {
  userName: string;
  userId: string | null;
}

export function GraphContainer({ userName, userId }: GraphContainerProps) {
  const { settings, updateSettings } = useSettings();
  const { selectedScope } = useChapterScope();
  const searchParams = useSearchParams();
  const router = useRouter();

  // 월간 자랑 팝업에서 ?share=1 로 진입하면 공유 시트를 자동으로 연다.
  // 한 번 소비한 뒤 쿼리를 제거해 새로고침 시 재발동되지 않게 한다.
  const [autoShare, setAutoShare] = useState(false);
  useEffect(() => {
    if (searchParams.get("share") === "1") {
      setAutoShare(true);
      router.replace("/graph", { scroll: false });
    }
  }, [searchParams, router]);

  // familyTime ChatRoom 패턴: useState 초기화에서 캐시 동기 읽기.
  // 메모리 → localStorage → 빈 상태 순. 전체 시리즈를 한 번만 로드해 두고,
  // 챕터 스코프는 클라이언트에서 슬라이스만 한다(추가 네트워크 0 → 전환 즉시).
  const [bootLogs] = useState<WeightPoint[]>(() => {
    if (typeof window === "undefined") return [];
    const memAll = logStore.getAllLogs();
    if (memAll) return memAll;
    if (!userId) return [];
    try {
      return logStore.loadGraphCache(userId)?.allLogs ?? [];
    } catch {
      return [];
    }
  });
  const [logs, setLogs] = useState<WeightPoint[]>(bootLogs);

  const handleActivityLevelChange = useCallback(
    (level: number) => updateSettings({ activityLevel: level }),
    [updateSettings]
  );

  useEffect(() => {
    if (bootLogs.length > 0) logStore.setAllLogs(bootLogs);

    // 백그라운드 최신화. memory fresh 면 생략.
    const hasFreshMemory = logStore.getAllLogs() && !logStore.isStale();
    if (hasFreshMemory) return;

    actionGetWeightSeries()
      .then((freshLogs) => {
        logStore.setAllLogs(freshLogs);
        setLogs(freshLogs);
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 선택 챕터 범위로 시리즈를 슬라이스 (전체면 그대로).
  const scopedLogs = useMemo(() => {
    const { rangeStart, rangeEnd } = selectedScope;
    if (rangeStart == null && rangeEnd == null) return logs;
    return logs.filter(
      (l) =>
        (rangeStart == null || l.date >= rangeStart) &&
        (rangeEnd == null || l.date <= rangeEnd)
    );
  }, [logs, selectedScope]);

  // 스코프 내 최저 체중 (그래프 별표·'역대 최저' 카드 기준).
  const scopedLowest = useMemo(() => {
    let best = { weight: Infinity, date: "" };
    for (const l of scopedLogs) {
      if (l.weight != null && l.weight < best.weight) {
        best = { weight: l.weight, date: l.date };
      }
    }
    return best;
  }, [scopedLogs]);

  return (
    <WeightChart
      logs={scopedLogs}
      startWeight={selectedScope.startWeight}
      targetWeight={selectedScope.targetWeight}
      startDate={selectedScope.startDate}
      targetEndDate={selectedScope.targetEndDate}
      isOngoing={selectedScope.isOngoing}
      lowestWeight={scopedLowest.weight}
      lowestWeightDate={scopedLowest.date}
      height={settings.height}
      gender={settings.gender}
      birthDate={settings.birthDate}
      activityLevel={settings.activityLevel}
      onActivityLevelChange={handleActivityLevelChange}
      userName={userName}
      autoShare={autoShare}
    />
  );
}
