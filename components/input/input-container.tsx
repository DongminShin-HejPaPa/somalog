"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useSettings } from "@/lib/contexts/settings-context";
import { formatDate, getDayNumber } from "@/lib/utils/date-utils";
import {
  actionGetDailyLog,
  actionUpsertDailyLog,
  actionCloseDailyLog,
  actionGetRecentDailyLogs,
} from "@/app/actions/log-actions";
import { DateHeader } from "./date-header";
import { InputChipList } from "./input-chip-list";
import { InputModal, type ItemKey } from "./input-modal";
import { FeedbackArea } from "./feedback-area";
import { FreeTextInput } from "./free-text-input";
import type { DailyLog, DailyLogUpdate } from "@/lib/types";

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return formatDate(d);
}

export function InputContainer() {
  const { settings } = useSettings();
  const [currentDate, setCurrentDate] = useState<string>(formatDate(new Date()));
  const [currentLog, setCurrentLog] = useState<DailyLog | null>(null);
  const [modalField, setModalField] = useState<ItemKey | null>(null);
  const [pendingDays, setPendingDays] = useState(0);
  const [prevWeight, setPrevWeight] = useState<number | null>(null);

  const loadLog = useCallback(async (date: string) => {
    let log = await actionGetDailyLog(date);
    // 오늘 로그가 없으면 빈 로그 자동 생성
    if (!log && date === formatDate(new Date())) {
      log = await actionUpsertDailyLog(date, {});
    }
    setCurrentLog(log);
    setCurrentDate(date);
  }, []);

  useEffect(() => {
    const init = async () => {
      // 가장 오래된 미완료(closed=false) 날짜 찾기
      const logs = await actionGetRecentDailyLogs(30);
      const unclosed = logs.filter((l) => !l.closed);
      const oldest = unclosed.length > 0
        ? unclosed[unclosed.length - 1]
        : null;

      setPendingDays(unclosed.length);

      // 가장 최근 체중 기록 (이전 날짜 기준)
      const today = formatDate(new Date());
      const withWeight = logs.filter((l) => l.weight !== null && l.date < today);
      setPrevWeight(withWeight.length > 0 ? withWeight[0].weight : null);

      const targetDate = oldest?.date ?? today;
      await loadLog(targetDate);
    };
    init();
  }, [loadLog]);

  const handlePrev = async () => {
    await loadLog(addDays(currentDate, -1));
  };

  const handleNext = async () => {
    const today = formatDate(new Date());
    const next = addDays(currentDate, 1);
    if (next <= today) {
      await loadLog(next);
    }
  };

  const handleChipClick = (field: ItemKey) => {
    if (currentLog?.closed) return;
    setModalField(field);
  };

  const handleModalSave = async (update: DailyLogUpdate) => {
    const updated = await actionUpsertDailyLog(currentDate, update);
    setCurrentLog(updated);
    setModalField(null);
  };

  const handleClose = async () => {
    if (!currentLog) return;
    const updated = await actionCloseDailyLog(currentDate);
    if (updated) setCurrentLog(updated);
  };

  const handleFreeText = async (update: DailyLogUpdate) => {
    const updated = await actionUpsertDailyLog(currentDate, update);
    setCurrentLog(updated);
  };

  if (!currentLog) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
        로딩 중...
      </div>
    );
  }

  const completedCount = (
    ["weight", "water", "exercise", "breakfast", "lunch", "dinner", "lateSnack", "energy"] as ItemKey[]
  ).filter((k) => currentLog[k] != null).length;

  const allCompleted = completedCount === 8;
  const day = getDayNumber(currentDate, settings.dietStartDate);

  return (
    <div className="pb-20">
      <DateHeader
        date={currentDate}
        day={day}
        isClosed={currentLog.closed}
        pendingDays={pendingDays}
        onPrev={handlePrev}
        onNext={handleNext}
      />

      {currentLog.intensiveDay && (
        <div className="mx-4 mt-2 px-3 py-2 bg-coral-light border border-coral/30 rounded-lg flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-coral inline-block" />
          <span className="text-xs font-semibold text-coral">Hard Reset Mode</span>
        </div>
      )}

      <InputChipList
        log={currentLog}
        waterGoal={settings.waterGoal}
        onChipClick={handleChipClick}
        isClosed={currentLog.closed}
      />

      <FeedbackArea
        feedback={currentLog.feedback}
        coachName={settings.coachName}
      />

      <div className="px-4 mt-4">
        <button
          onClick={!currentLog.closed ? handleClose : undefined}
          data-testid="close-button"
          className={cn(
            "w-full py-3 rounded-xl font-semibold text-sm min-h-[48px] transition-colors",
            currentLog.closed
              ? "bg-secondary text-muted-foreground cursor-default"
              : allCompleted
              ? "bg-navy text-white hover:bg-navy/90 ring-2 ring-navy/30"
              : "bg-navy/70 text-white hover:bg-navy/80"
          )}
        >
          {currentLog.closed ? "마감 완료" : "마감하기"}
        </button>
      </div>

      <FreeTextInput onSave={handleFreeText} />

      <InputModal
        field={modalField}
        log={currentLog}
        waterGoal={settings.waterGoal}
        prevWeight={prevWeight}
        onSave={handleModalSave}
        onClose={() => setModalField(null)}
      />
    </div>
  );
}
