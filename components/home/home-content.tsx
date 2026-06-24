"use client";

import Link from "next/link";
import { Trophy, ChevronRight } from "lucide-react";
import { useSettings } from "@/lib/contexts/settings-context";
import { DietProgressBanner } from "./diet-progress-banner";
import { InputStatusChips } from "./input-status-chips";
import { CoachOneLiner } from "./coach-one-liner";
import type { DailyLog } from "@/lib/types";
import { formatDate, getDayNumber } from "@/lib/utils/date-utils";

interface HomeContentProps {
  todayLog: DailyLog | null;
  recentLogs: DailyLog[];
  /** 첫 기록일부터의 누적 일수 (이전 챕터 보조 표시용) */
  cumulativeDay?: number;
  onCloseToday?: () => void;
  isClosingToday?: boolean;
}

export function HomeContent({ todayLog, recentLogs, cumulativeDay, onCloseToday, isClosingToday }: HomeContentProps) {
  const { settings } = useSettings();

  if (!todayLog) {
    return (
      <div className="px-4 mt-8 text-center">
        <p className="text-sm text-muted-foreground">
          당신의 건강 상태를 이해 중입니다
        </p>
      </div>
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

  // 오늘 체중 미입력 시 최근 기록 체중으로 진행률/남은 kg 표시 (변화량은 배너에서 startWeight 기준 live 계산)
  const lastKnownWithWeight = recentLogs.find(
    (l) => l.date !== todayLog.date && l.weight !== null
  );
  const fallbackWeight = todayLog.weight === null ? (lastKnownWithWeight?.weight ?? null) : null;

  const currentChapterDay = settings.dietStartDate
    ? Math.max(getDayNumber(todayLog.date, settings.dietStartDate), 1)
    : todayLog.day;
  // 이전 챕터가 있을 때만 명예의 전당 재진입 노출 (이미 계산된 cumulativeDay 활용 — 신규 쿼리 0)
  const hasPriorChapters = cumulativeDay !== undefined && cumulativeDay > currentChapterDay;

  return (
    <>
      <DietProgressBanner
        date={todayLog.date}
        day={currentChapterDay}
        cumulativeDay={cumulativeDay}
        currentWeight={todayLog.weight}
        fallbackWeight={fallbackWeight}
        startWeight={settings.startWeight}
        targetWeight={settings.targetWeight}
        isIntensiveDay={settings.intensiveDayOn && todayLog.intensiveDay === true}
      />

      {hasPriorChapters && (
        <Link
          href="/settings/chapters"
          className="mx-4 mt-3 flex items-center justify-between px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-200/70 active:scale-[0.99] transition-transform"
        >
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-700">
            <Trophy className="w-4 h-4 text-amber-500" />
            명예의 전당 · 지난 도전 기록
          </span>
          <ChevronRight className="w-4 h-4 text-amber-400" />
        </Link>
      )}

      <InputStatusChips log={todayLog} customFieldDef={settings.customField} onCloseToday={onCloseToday} isClosingToday={isClosingToday} />

      {(dailySummary || oneLiner) && (
        <CoachOneLiner
          dailySummary={dailySummary}
          oneLiner={oneLiner}
          badgeText={badgeText}
        />
      )}
    </>
  );
}
