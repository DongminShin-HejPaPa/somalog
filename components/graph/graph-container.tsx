"use client";

import { useState, useEffect } from "react";
import { useSettings } from "@/lib/contexts/settings-context";
import {
  actionGetAllDailyLogs,
  actionGetLowestWeight,
} from "@/app/actions/log-actions";
import { WeightChart } from "./weight-chart";
import type { DailyLog } from "@/lib/types";
import { logStore } from "@/lib/stores/log-store";

export function GraphContainer({ userId }: { userId: string | null }) {
  const { settings } = useSettings();
  const [logs, setLogs] = useState<DailyLog[] | undefined>(undefined);
  const [lowest, setLowest] = useState<{ weight: number; date: string } | undefined>(undefined);

  useEffect(() => {
    logStore.invalidateIfUserChanged(userId);

    const applyFresh = (freshLogs: DailyLog[], freshLowest: { weight: number; date: string }) => {
      logStore.setAllLogs(freshLogs);
      logStore.setLowestWeight(freshLowest);
      setLogs(freshLogs);
      setLowest(freshLowest);
    };

    const fetchAll = () =>
      Promise.all([actionGetAllDailyLogs(), actionGetLowestWeight()])
        .then(([fetchedLogs, fetchedLowest]) => applyFresh(fetchedLogs, fetchedLowest));

    // Use hasLowestWeight() (not getLowestWeight()) so a null value (no data)
    // still counts as a valid cache hit and avoids an unnecessary re-fetch.
    if (logStore.getAllLogs() && logStore.hasLowestWeight()) {
      // Instant display from cache — no skeleton shown
      setLogs(logStore.getAllLogs()!);
      setLowest(logStore.getLowestWeight() ?? { weight: Infinity, date: "" });

      // Stale: background refresh without blocking UI
      if (logStore.isStale()) {
        fetchAll().catch(() => {});
      }
    } else {
      // No cache yet: fetch (skeleton shows until complete)
      fetchAll().catch(() => {});
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (logs === undefined || lowest === undefined) {
    return (
      <div className="px-4 space-y-3 mt-2 animate-pulse">
        <div className="h-64 bg-secondary rounded-xl" />
        <div className="h-10 bg-secondary rounded-xl" />
        <div className="h-10 bg-secondary rounded-xl" />
      </div>
    );
  }

  return (
    <WeightChart
      logs={logs}
      startWeight={settings.startWeight}
      targetWeight={settings.targetWeight}
      startDate={settings.dietStartDate}
      targetMonths={settings.targetMonths}
      lowestWeight={lowest.weight}
      lowestWeightDate={lowest.date}
    />
  );
}
