"use client";

import { useSettings } from "@/lib/contexts/settings-context";
import { DietProgressBanner } from "./diet-progress-banner";
import { InputStatusChips } from "./input-status-chips";
import { CoachOneLiner } from "./coach-one-liner";
import { WeightMiniGraph } from "./weight-mini-graph";
import { DailySummary } from "./daily-summary";
import type { DailyLog } from "@/lib/types";

interface HomeContentProps {
  todayLog: DailyLog | null;
  recentLogs: DailyLog[];
}

export function HomeContent({ todayLog, recentLogs }: HomeContentProps) {
  const { settings } = useSettings();

  if (!todayLog) {
    return (
      <>
        <div className="px-4 mt-8 text-center">
          <p className="text-sm text-muted-foreground">
            Input 탭에서 오늘의 기록을 시작해보세요
          </p>
        </div>
        {recentLogs.length > 0 && (
          <WeightMiniGraph
            data={recentLogs.slice(0, 14).map((d) => ({
              date: d.date,
              weight: d.weight,
            }))}
          />
        )}
      </>
    );
  }

  const yesterday = recentLogs[1];
  const oneLiner = todayLog.closed
    ? todayLog.oneLiner
    : yesterday?.oneLiner;
  const isYesterday = !todayLog.closed && !!yesterday?.oneLiner;

  return (
    <>
      <DietProgressBanner
        day={todayLog.day}
        currentWeight={todayLog.weight}
        startWeight={settings.startWeight}
        targetWeight={settings.targetWeight}
        weightChange={todayLog.weightChange}
        isIntensiveDay={todayLog.intensiveDay === true}
      />

      <InputStatusChips log={todayLog} />

      {oneLiner && (
        <CoachOneLiner
          coachName={settings.coachName}
          oneLiner={oneLiner}
          isYesterday={isYesterday}
        />
      )}

      <WeightMiniGraph
        data={recentLogs.slice(0, 14).map((d) => ({
          date: d.date,
          weight: d.weight,
        }))}
      />

      <DailySummary
        todayLog={todayLog}
        recentLogs={recentLogs}
        coachName={settings.coachName}
      />
    </>
  );
}
