"use client";

import dynamic from "next/dynamic";
import { useSettings } from "@/lib/contexts/settings-context";
import { DietProgressBanner } from "./diet-progress-banner";
import { InputStatusChips } from "./input-status-chips";
import { CoachOneLiner } from "./coach-one-liner";
import type { DailyLog } from "@/lib/types";
import { formatDate } from "@/lib/utils/date-utils";

// recharts(무거움)를 home 임계 번들에서 분리 — cold start JS 다운로드 비용 절감.
// 외곽 치수를 실제 컴포넌트와 동일하게 맞춰 청크 로딩 중 CLS(레이아웃 이동) 없음.
// Graph 탭(weight-chart.tsx)의 recharts 는 빠른 경로 보호를 위해 정적 유지.
const WeightMiniGraph = dynamic(
  () => import("./weight-mini-graph").then((m) => m.WeightMiniGraph),
  {
    ssr: false,
    loading: () => (
      <div className="mx-4 mt-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-sm">최근 14일 체중</h3>
          <span className="text-xs text-navy font-medium">전체 보기</span>
        </div>
        <div className="h-[160px] bg-secondary/30 rounded-xl animate-pulse" />
      </div>
    ),
  }
);

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

  // 오늘 표시 중인 로그가 마감되지 않았다면, 그 이전의 "가장 최근 마감된 로그"를 찾아 하루평가 표시
  const lastClosedLog = recentLogs.find(l => l.closed && l.date < todayLog.date);

  const shownLog = todayLog.closed ? todayLog : (lastClosedLog ?? null);
  const dailySummary = shownLog?.dailySummary ?? null;
  const oneLiner = shownLog?.oneLiner ?? null;

  let badgeText = "";
  if (shownLog) {
    const realToday = formatDate(new Date());
    const realYesterdayObj = new Date();
    realYesterdayObj.setDate(realYesterdayObj.getDate() - 1);
    const realYesterday = formatDate(realYesterdayObj);

    if (shownLog.date === realToday) {
      badgeText = "오늘 기준";
    } else if (shownLog.date === realYesterday) {
      badgeText = "어제 기준";
    } else {
      const [, m, d] = shownLog.date.split("-");
      badgeText = `${parseInt(m)}/${parseInt(d)} 기준`;
    }
  }

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

      <InputStatusChips log={todayLog} customFieldDef={settings.customField} onCloseToday={onCloseToday} isClosingToday={isClosingToday} />

      {(dailySummary || oneLiner) && (
        <CoachOneLiner
          coachName={settings.coachName}
          dailySummary={dailySummary}
          oneLiner={oneLiner}
          badgeText={badgeText}
        />
      )}

      <WeightMiniGraph
        data={recentLogs.slice(0, 14).map((d) => ({
          date: d.date,
          weight: d.weight,
        }))}
      />
    </>
  );
}
