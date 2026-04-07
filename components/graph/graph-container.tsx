"use client";

import { useState, useEffect } from "react";
import { useSettings } from "@/lib/contexts/settings-context";
import {
  actionGetAllDailyLogs,
  actionGetLowestWeight,
} from "@/app/actions/log-actions";
import { WeightChart } from "./weight-chart";
import type { DailyLog } from "@/lib/types";

export function GraphContainer() {
  const { settings } = useSettings();
  const [logs, setLogs] = useState<DailyLog[] | undefined>(undefined);
  const [lowest, setLowest] = useState<{ weight: number; date: string } | undefined>(undefined);

  useEffect(() => {
    Promise.all([
      actionGetAllDailyLogs(),
      actionGetLowestWeight(),
    ]).then(([fetchedLogs, fetchedLowest]) => {
      setLogs(fetchedLogs);
      setLowest(fetchedLowest);
    });
  }, []);

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
