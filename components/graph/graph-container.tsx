"use client";

import { useState, useEffect, useCallback } from "react";
import { useSettings } from "@/lib/contexts/settings-context";
import {
  actionGetAllDailyLogs,
  actionGetLowestWeight,
} from "@/app/actions/log-actions";
import { WeightChart } from "./weight-chart";
import type { DailyLog } from "@/lib/types";
import { logStore } from "@/lib/stores/log-store";

interface GraphContainerProps {
  userName: string;
  userId: string | null;
}

export function GraphContainer({ userName, userId }: GraphContainerProps) {
  const { settings, updateSettings } = useSettings();
  // familyTime ChatRoom 패턴: useState 초기화에서 캐시 동기 읽기.
  // 메모리 → localStorage → 빈 상태 순.
  const [bootCache] = useState<{ allLogs: DailyLog[]; lowest: { weight: number; date: string } } | null>(() => {
    if (typeof window === "undefined") return null;
    const memAll = logStore.getAllLogs();
    if (memAll && logStore.hasLowestWeight()) {
      return {
        allLogs: memAll,
        lowest: logStore.getLowestWeight() ?? { weight: Infinity, date: "" },
      };
    }
    if (!userId) return null;
    try {
      const fromLs = logStore.loadGraphCache(userId);
      if (fromLs) {
        return {
          allLogs: fromLs.allLogs,
          lowest: fromLs.lowestWeight ?? { weight: Infinity, date: "" },
        };
      }
    } catch {
      // 무시
    }
    return null;
  });
  const [logs, setLogs] = useState<DailyLog[]>(bootCache?.allLogs ?? []);
  const [lowest, setLowest] = useState<{ weight: number; date: string }>(
    bootCache?.lowest ?? { weight: Infinity, date: "" }
  );

  const handleActivityLevelChange = useCallback(
    (level: number) => updateSettings({ activityLevel: level }),
    [updateSettings]
  );

  useEffect(() => {
    // bootCache 를 메모리 logStore 에도 즉시 주입
    if (bootCache) {
      logStore.setAllLogs(bootCache.allLogs);
      if (bootCache.lowest.weight !== Infinity) {
        logStore.setLowestWeight(bootCache.lowest);
      }
    }

    // 백그라운드 최신화. memory fresh 면 생략.
    const hasFreshMemory =
      logStore.getAllLogs() && logStore.hasLowestWeight() && !logStore.isStale();
    if (hasFreshMemory) return;

    Promise.all([actionGetAllDailyLogs(), actionGetLowestWeight()])
      .then(([freshLogs, freshLowest]) => {
        logStore.setAllLogs(freshLogs);
        logStore.setLowestWeight(freshLowest);
        setLogs(freshLogs);
        setLowest(freshLowest);
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <WeightChart
      logs={logs}
      startWeight={settings.startWeight}
      targetWeight={settings.targetWeight}
      startDate={settings.dietStartDate}
      targetMonths={settings.targetMonths}
      lowestWeight={lowest.weight}
      lowestWeightDate={lowest.date}
      height={settings.height}
      gender={settings.gender}
      birthDate={settings.birthDate}
      activityLevel={settings.activityLevel}
      onActivityLevelChange={handleActivityLevelChange}
      userName={userName}
    />
  );
}
