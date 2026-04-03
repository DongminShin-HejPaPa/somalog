"use client";

import { useState, useEffect } from "react";
import {
  actionGetRecentDailyLogs,
  actionGetWeeklyLogs,
} from "@/app/actions/log-actions";
import { LogList } from "./log-list";
import type { DailyLog, WeeklyLog } from "@/lib/types";

export function LogContainer() {
  const [logs, setLogs] = useState<DailyLog[] | undefined>(undefined);
  const [weeklyLogs, setWeeklyLogs] = useState<WeeklyLog[] | undefined>(undefined);

  useEffect(() => {
    Promise.all([
      actionGetRecentDailyLogs(30),
      actionGetWeeklyLogs(4),
    ]).then(([fetchedLogs, fetchedWeekly]) => {
      setLogs(fetchedLogs);
      setWeeklyLogs(fetchedWeekly);
    });
  }, []);

  if (logs === undefined || weeklyLogs === undefined) {
    return (
      <div className="px-4 space-y-3 mt-2 animate-pulse">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-20 bg-secondary rounded-xl" />
        ))}
      </div>
    );
  }

  return <LogList logs={logs} weeklyLogs={weeklyLogs} />;
}
