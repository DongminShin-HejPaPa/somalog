"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useSettings } from "@/lib/contexts/settings-context";
import { formatDate, getDayNumber } from "@/lib/utils/date-utils";
import {
  actionGetDailyLog,
  actionUpsertDailyLog,
  actionCloseDailyLog,
  actionReopenDailyLog,
  actionGetRecentDailyLogs,
} from "@/app/actions/log-actions";
import { actionParseFreText } from "@/app/actions/parse-actions";
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
  const [isLoading, setIsLoading] = useState(true);
  const [modalField, setModalField] = useState<ItemKey | null>(null);
  const [pendingDays, setPendingDays] = useState(0);
  const [prevWeight, setPrevWeight] = useState<number | null>(null);
  const [minDate, setMinDate] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isFreeTextSaving, setIsFreeTextSaving] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);
  const [closeNavMessage, setCloseNavMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const loadLog = useCallback(async (date: string) => {
    setIsLoading(true);
    try {
      let log = await actionGetDailyLog(date);
      // 로그가 없으면 빈 로그 자동 생성 (오늘 포함, 과거 날짜도 동일하게 적용)
      if (!log && date <= formatDate(new Date())) {
        log = await actionUpsertDailyLog(date, {});
      }
      setCurrentLog(log);
      setCurrentDate(date);
    } catch {
      // 로드 실패 시에도 날짜는 업데이트 (오늘 날짜 기준 재시도 가능하게)
      setCurrentLog(null);
      setCurrentDate(date);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      const logs = await actionGetRecentDailyLogs(30);
      const unclosed = logs.filter((l) => !l.closed);
      setPendingDays(unclosed.length);

      const today = formatDate(new Date());

      // 가장 최근 체중 기록 (이전 날짜 기준)
      const withWeight = logs.filter((l) => l.weight !== null && l.date < today);
      setPrevWeight(withWeight.length > 0 ? withWeight[0].weight : null);

      // 네비게이션 하한선: dietStartDate 우선, 없으면 가장 오래된 로그 날짜
      const dietStart = settings.dietStartDate;
      const dates = logs.map((l) => l.date).sort();
      const lowerBound = dietStart || (dates.length > 0 ? dates[0] : today);
      setMinDate(lowerBound);

      // 타겟 날짜: dietStart부터 시작해서 첫 번째 마감되지 않은 날짜
      let targetDate = today;
      if (dietStart) {
        const closedDates = new Set(logs.filter((l) => l.closed).map((l) => l.date));
        let candidate = dietStart;
        while (candidate < today && closedDates.has(candidate)) {
          candidate = addDays(candidate, 1);
        }
        targetDate = candidate;
      } else {
        targetDate = unclosed.length > 0 ? unclosed[unclosed.length - 1].date : today;
      }

      await loadLog(targetDate);
    };
    init();
  }, [loadLog]); // eslint-disable-line react-hooks/exhaustive-deps

  const today = formatDate(new Date());
  const canGoPrev = !!minDate && currentDate > minDate;
  const canGoNext = currentDate < today;

  const handlePrev = async () => {
    if (!canGoPrev) return;
    await loadLog(addDays(currentDate, -1));
  };

  const handleNext = async () => {
    if (!canGoNext) return;
    await loadLog(addDays(currentDate, 1));
  };

  const handleChipClick = (field: ItemKey) => {
    if (currentLog?.closed) return;
    setModalField(field);
  };

  const handleModalSave = async (update: DailyLogUpdate) => {
    const previousLog = currentLog;

    // 낙관적 업데이트: 모달 즉시 닫고 UI 먼저 반영
    setCurrentLog(currentLog ? { ...currentLog, ...update } as DailyLog : null);
    setModalField(null);

    try {
      const updated = await actionUpsertDailyLog(currentDate, update);
      setCurrentLog(updated); // 서버 응답(계산 필드 포함)으로 교체
    } catch {
      // 실패 시 롤백
      setCurrentLog(previousLog);
      setSaveError("저장에 실패했습니다. 다시 시도해주세요.");
      setTimeout(() => setSaveError(null), 4000);
    }
  };

  const handleReopen = async () => {
    const updated = await actionReopenDailyLog(currentDate);
    if (updated) setCurrentLog(updated);
  };

  const handleClose = async () => {
    if (!currentLog || isClosing) return;
    setIsClosing(true);
    setCloseError(null);
    try {
      const updated = await actionCloseDailyLog(currentDate, currentLog ?? undefined);
      if (!updated) {
        setCloseError("마감에 실패했습니다. 잠시 후 다시 시도해주세요.");
        return;
      }
      setCurrentLog(updated);

      // 마감 후 다음 미완료 날짜로 이동
      const logs = await actionGetRecentDailyLogs(30);
      const unclosed = logs.filter((l) => !l.closed);
      setPendingDays(unclosed.length);

      const dates = logs.map((l) => l.date).sort();
      if (dates.length > 0) setMinDate(dates[0]);

      // 마감 후 다음 날짜(오늘 이하)로 이동
      const nextDate = addDays(currentDate, 1);
      if (nextDate <= today) {
        setCloseNavMessage(`${nextDate.slice(5).replace("-", "/")} 로 이동합니다`);
        setTimeout(() => setCloseNavMessage(null), 3000);
        await loadLog(nextDate);
      }
    } catch {
      setCloseError("마감에 실패했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setIsClosing(false);
    }
  };

  const handleFreeText = async (text: string) => {
    setIsFreeTextSaving(true);
    try {
      const update = await actionParseFreText(text, currentLog?.weight ?? null, prevWeight);
      if (Object.keys(update).length > 0) {
        const updated = await actionUpsertDailyLog(currentDate, update);
        setCurrentLog(updated);
      }
    } finally {
      setIsFreeTextSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
        로딩 중...
      </div>
    );
  }

  if (!currentLog) {
    return (
      <div className="pb-20">
        <DateHeader
          date={currentDate}
          day={getDayNumber(currentDate, settings.dietStartDate)}
          isClosed={false}
          pendingDays={pendingDays}
          canGoPrev={canGoPrev}
          canGoNext={canGoNext}
          onPrev={handlePrev}
          onNext={handleNext}
        />
        <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
          이 날짜의 기록이 없습니다
        </div>
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
        canGoPrev={canGoPrev}
        canGoNext={canGoNext}
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

      {closeNavMessage && (
        <div className="fixed bottom-20 inset-x-0 flex justify-center z-50 pointer-events-none px-4">
          <div className="bg-navy text-white text-sm font-semibold px-5 py-2.5 rounded-full shadow-xl flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="none">
              <path d="M3 8l3.5 3.5L13 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>마감 완료 · {closeNavMessage}</span>
          </div>
        </div>
      )}
      {closeError && (
        <div className="mx-4 mt-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600 text-center">
          {closeError}
        </div>
      )}
      {saveError && (
        <div className="mx-4 mt-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600 text-center">
          {saveError}
        </div>
      )}
      <div className="px-4 mt-4 flex gap-2">
        {currentLog.closed ? (
          <button
            onClick={handleReopen}
            data-testid="reopen-button"
            className="flex-1 py-3 rounded-xl font-semibold text-sm min-h-[48px] border border-border text-muted-foreground hover:bg-secondary transition-colors"
          >
            수정하기
          </button>
        ) : (
          <button
            onClick={handleClose}
            disabled={isClosing}
            data-testid="close-button"
            className={cn(
              "flex-1 py-3 rounded-xl font-semibold text-sm min-h-[48px] transition-colors flex items-center justify-center gap-2",
              allCompleted
                ? "bg-navy text-white hover:bg-navy/90 ring-2 ring-navy/30"
                : "bg-navy text-white hover:bg-navy/90",
              isClosing && "opacity-60"
            )}
          >
            {isClosing ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                마감 중...
              </>
            ) : "마감하기"}
          </button>
        )}
      </div>

      <FreeTextInput onSubmit={handleFreeText} isSaving={isFreeTextSaving} />

      <InputModal
        field={modalField}
        log={currentLog}
        waterGoal={settings.waterGoal}
        prevWeight={prevWeight ?? (settings.currentWeight > 0 ? settings.currentWeight : null)}
        isSaving={isSaving}
        onSave={handleModalSave}
        onClose={() => setModalField(null)}
      />
    </div>
  );
}
