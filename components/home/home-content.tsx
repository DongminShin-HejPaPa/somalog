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
  onCloseToday?: () => void;
  isClosingToday?: boolean;
}

export function HomeContent({ todayLog, recentLogs, onCloseToday, isClosingToday }: HomeContentProps) {
  const { settings } = useSettings();

  if (!todayLog) {
    return (
      <>
        <div className="px-4 mt-8 text-center">
          <p className="text-sm text-muted-foreground">
            입력 탭에서 오늘의 기록을 시작하세요
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

  // 오늘 체중 미입력 시 최근 기록 기준으로 진행률/남은 kg 표시
  const lastKnownWithWeight = recentLogs.find(
    (l) => l.date !== todayLog.date && l.weight !== null && l.weightChange !== null
  );
  const fallbackWeightChange = todayLog.weight === null ? (lastKnownWithWeight?.weightChange ?? null) : null;

  return (
    <>
      <DietProgressBanner
        date={todayLog.date}
        day={todayLog.day}
        currentWeight={todayLog.weight}
        startWeight={settings.startWeight}
        targetWeight={settings.targetWeight}
        weightChange={todayLog.weightChange}
        fallbackWeightChange={fallbackWeightChange}
        isIntensiveDay={settings.intensiveDayOn && todayLog.intensiveDay === true}
      />

      <InputStatusChips log={todayLog} onCloseToday={onCloseToday} isClosingToday={isClosingToday} />

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
