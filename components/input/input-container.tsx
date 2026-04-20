"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { useSettings } from "@/lib/contexts/settings-context";
import { formatDate, getDayNumber } from "@/lib/utils/date-utils";
import {
  actionGetDailyLog,
  actionUpsertDailyLog,
  actionCloseDailyLog,
  actionReopenDailyLog,
  actionGetRecentDailyLogs,
  actionAutoCloseOldLogs,
  actionCloseAllUnclosedExceptToday,
  actionGetFirstUnclosedLog,
  actionClearDailyLogField,
} from "@/app/actions/log-actions";
import { actionParseFreText } from "@/app/actions/parse-actions";
import { DateHeader } from "./date-header";
import { InputChipList } from "./input-chip-list";
import { InputModal, type ItemKey } from "./input-modal";
import { FeedbackArea } from "./feedback-area";
import { FreeTextInput } from "./free-text-input";
import type { DailyLog, DailyLogUpdate, ClearableField } from "@/lib/types";
import { logStore } from "@/lib/stores/log-store";

function fmtShort(dateStr: string): string {
  const [, m, d] = dateStr.split("-");
  return `${parseInt(m)}/${parseInt(d)}`;
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return formatDate(d);
}

export function InputContainer({ userId }: { userId: string | null }) {
  const { settings } = useSettings();
  const searchParams = useSearchParams();
  const [currentDate, setCurrentDate] = useState<string>(formatDate(new Date()));
  const [currentLog, setCurrentLog] = useState<DailyLog | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [modalField, setModalField] = useState<ItemKey | null>(null);
  const [pendingDays, setPendingDays] = useState(0);
  const [allLogs, setAllLogs] = useState<DailyLog[]>([]);
  const [minDate, setMinDate] = useState<string | null>(null);
  const [autoCloseToast, setAutoCloseToast] = useState<string | null>(null);
  const [pendingOldClose, setPendingOldClose] = useState<{ from: string; to: string } | null>(null);

  const prevWeight = useMemo(() => {
    const before = allLogs
      .filter((l) => l.weight !== null && l.date < currentDate)
      .sort((a, b) => b.date.localeCompare(a.date));
    return before.length > 0 ? before[0].weight : null;
  }, [allLogs, currentDate]);

  const [isSaving, setIsSaving] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isFreeTextSaving, setIsFreeTextSaving] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);
  const [closeNavMessage, setCloseNavMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const updateCache = useCallback((log: DailyLog) => {
    logStore.setLog(log);
  }, []);

  const loadLog = useCallback(async (date: string) => {
    const cached = logStore.getLog(date);
    if (cached) {
      setCurrentLog(cached);
      setCurrentDate(date);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      let log = await actionGetDailyLog(date);
      if (!log && date <= formatDate(new Date())) {
        log = await actionUpsertDailyLog(date, {});
      }
      if (log) logStore.setLog(log);
      setCurrentLog(log);
      setCurrentDate(date);
    } catch {
      setCurrentLog(null);
      setCurrentDate(date);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    logStore.invalidateIfUserChanged(userId);
    const today = formatDate(new Date());

    const applyLogs = (logs: DailyLog[]) => {
      const unclosed = logs.filter((l) => !l.closed);
      setPendingDays(unclosed.length);
      setAllLogs(logs);
      const dietStart = settings.dietStartDate;
      const dates = logs.map((l) => l.date).sort();
      setMinDate(dietStart || (dates.length > 0 ? dates[0] : today));
    };

    const init = async () => {
      // Auto-close: deduplicated via logStore so only one container fires per session
      logStore.runAutoCloseOnce(() => actionAutoCloseOldLogs())
        ?.then(async (result) => {
          if (result.hadOldUnclosed && result.oldUnclosedRange) {
            setPendingOldClose(result.oldUnclosedRange);
          }
          const total = result.filledCount + result.closedCount;
          if (total > 0) {
            if (!result.hadOldUnclosed) {
              setAutoCloseToast(`한 달 넘게 지난 미마감 날짜 ${result.closedCount}일을 자동 마감했어요`);
              setTimeout(() => setAutoCloseToast(null), 5000);
            }
            const updatedLogs = await actionGetRecentDailyLogs(30);
            logStore.setRecentLogs(updatedLogs);
            applyLogs(updatedLogs);
            const newFirstUnclosed = logStore.getFirstUnclosedLog();
            const newTargetDate = newFirstUnclosed?.date ?? formatDate(new Date());
            await loadLog(newTargetDate);
          }
        })
        .catch(() => {});

      const cachedLogs = logStore.getRecentLogs();

      if (cachedLogs) {
        // Instant display from cache — no skeleton shown
        applyLogs(cachedLogs);
        const firstUnclosed = logStore.getFirstUnclosedLog();
        const targetDate = firstUnclosed?.date ?? today;
        await loadLog(targetDate); // per-date cache hit → instant; else single fetch

        // Stale: background refresh without blocking UI
        if (logStore.isStale()) {
          Promise.all([
            actionGetRecentDailyLogs(30),
            actionGetFirstUnclosedLog(),
          ])
            .then(([freshLogs]) => {
              logStore.setRecentLogs(freshLogs);
              applyLogs(freshLogs);
            })
            .catch(() => {});
        }
      } else {
        // No cache yet: fetch (skeleton shows until complete)
        const [fetchedLogs, fetchedFirstUnclosed] = await Promise.all([
          actionGetRecentDailyLogs(30),
          actionGetFirstUnclosedLog(),
        ]);
        logStore.setRecentLogs(fetchedLogs);
        applyLogs(fetchedLogs);
        const targetDate = fetchedFirstUnclosed?.date ?? today;
        await loadLog(targetDate);
      }
    };

    init();
  }, [loadLog]); // eslint-disable-line react-hooks/exhaustive-deps

  const today = formatDate(new Date());
  const canGoPrev = !!minDate && currentDate > minDate;
  const canGoNext = currentDate < today;

  const handleConfirmOldClose = async () => {
    setPendingOldClose(null);
    const count = await actionCloseAllUnclosedExceptToday();
    if (count > 0) {
      setAutoCloseToast(`미마감 날짜 ${count}일을 빈 채로 마감했어요`);
      setTimeout(() => setAutoCloseToast(null), 5000);
      const updatedLogs = await actionGetRecentDailyLogs(30);
      logStore.setRecentLogs(updatedLogs);
      setAllLogs(updatedLogs);
      const newFirstUnclosed = logStore.getFirstUnclosedLog();
      const newTargetDate = newFirstUnclosed?.date ?? formatDate(new Date());
      await loadLog(newTargetDate);
    }
  };

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

    setCurrentLog(currentLog ? { ...currentLog, ...update } as DailyLog : null);
    setModalField(null);

    try {
      const updated = await actionUpsertDailyLog(currentDate, update);
      setCurrentLog(updated);
      updateCache(updated);
      setAllLogs((prev) => {
        const exists = prev.some((l) => l.date === currentDate);
        if (exists) return prev.map((l) => (l.date === currentDate ? updated : l));
        return [...prev, updated].sort((a, b) => b.date.localeCompare(a.date));
      });
    } catch {
      setCurrentLog(previousLog);
      autoCloseFiredRef.current = false;
      setSaveError("저장에 실패했습니다. 다시 시도해주세요.");
      setTimeout(() => setSaveError(null), 4000);
    }
  };

  const handleReopen = async () => {
    const updated = await actionReopenDailyLog(currentDate);
    if (updated) {
      setCurrentLog(updated);
      updateCache(updated);
    }
  };

  const handleDelete = async (field: ClearableField) => {
    const previousLog = currentLog;
    setCurrentLog(currentLog ? { ...currentLog, [field]: null } as DailyLog : null);
    setModalField(null);
    try {
      const updated = await actionClearDailyLogField(currentDate, field);
      if (updated) {
        setCurrentLog(updated);
        updateCache(updated);
      }
    } catch {
      setCurrentLog(previousLog);
      setSaveError("삭제에 실패했습니다. 다시 시도해주세요.");
      setTimeout(() => setSaveError(null), 4000);
    }
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
      updateCache(updated);

      const logs = await actionGetRecentDailyLogs(30);
      logStore.setRecentLogs(logs);
      const unclosed = logs.filter((l) => !l.closed);
      setPendingDays(unclosed.length);
      setAllLogs(logs);

      const dates = logs.map((l) => l.date).sort();
      if (dates.length > 0) setMinDate(dates[0]);

      const sortedUnclosed = [...unclosed]
        .filter((l) => l.date <= today)
        .sort((a, b) => a.date.localeCompare(b.date));
      if (sortedUnclosed.length > 0) {
        const nextTarget = sortedUnclosed[0].date;
        setCloseNavMessage(`${nextTarget.slice(5).replace("-", "/")} 로 이동합니다`);
        setTimeout(() => setCloseNavMessage(null), 3000);
        await loadLog(nextTarget);
      } else {
        setCloseNavMessage("모든 날을 마감했습니다! 오늘 하루도 수고 많으셨어요 🎉");
        setTimeout(() => setCloseNavMessage(null), 4000);
        await loadLog(today);
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
      const update = await actionParseFreText(
        text,
        currentLog?.weight ?? null,
        prevWeight,
        {
          todayBreakfast: currentLog?.breakfast ?? null,
          todayLunch: currentLog?.lunch ?? null,
          todayDinner: currentLog?.dinner ?? null,
        }
      );
      if (Object.keys(update).length > 0) {
        const updated = await actionUpsertDailyLog(currentDate, update);
        setCurrentLog(updated);
        updateCache(updated);
      }
    } finally {
      setIsFreeTextSaving(false);
    }
  };

  const hasAutoOpened = useRef(false);
  useEffect(() => {
    const open = searchParams.get("open") as ItemKey | null;
    if (open && !isLoading && currentLog && !currentLog.closed && !hasAutoOpened.current) {
      setModalField(open);
      hasAutoOpened.current = true;
      window.history.replaceState(null, '', '/input');
    }
  }, [searchParams, isLoading, currentLog]);

  const BASE_FIELDS: ItemKey[] = ["weight", "water", "exercise", "breakfast", "lunch", "dinner", "lateSnack"];
  const allFields: ItemKey[] = settings.customField
    ? [...BASE_FIELDS, "customFieldValue"]
    : BASE_FIELDS;
  const totalCount = allFields.length;

  const completedCount = currentLog
    ? allFields.filter((k) => currentLog[k] != null).length
    : 0;

  const loadTimeCountRef = useRef<number>(0);
  const autoCloseFiredRef = useRef(false);
  useEffect(() => {
    if (isLoading || !currentLog) return;
    loadTimeCountRef.current = completedCount;
    autoCloseFiredRef.current = false;
  }, [currentLog?.date, currentLog?.closed, isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCloseRef = useRef(handleClose);
  useEffect(() => {
    handleCloseRef.current = handleClose;
  }, [handleClose]);

  useEffect(() => {
    if (isLoading || completedCount < totalCount) return;
    if (completedCount === totalCount && !autoCloseFiredRef.current && loadTimeCountRef.current < totalCount) {
      autoCloseFiredRef.current = true;
      const timer = setTimeout(() => {
        handleCloseRef.current();
      }, 2000);
      return () => {
        clearTimeout(timer);
        autoCloseFiredRef.current = false;
      };
    }
  }, [completedCount, totalCount, isLoading]);

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
          minDate={minDate ?? undefined}
          onDateSelect={loadLog}
        />
        <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
          이 날짜의 기록이 없습니다
        </div>
      </div>
    );
  }

  const allCompleted = completedCount === totalCount;
  const day = getDayNumber(currentDate, settings.dietStartDate);

  return (
    <div className="pb-20">
      {autoCloseToast && (
        <div className="fixed top-16 inset-x-0 flex justify-center z-50 pointer-events-none px-4">
          <div className="bg-foreground text-background text-sm font-medium px-4 py-2.5 rounded-full shadow-xl flex items-center gap-2 max-w-xs text-center">
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M8 5v3.5M8 11v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span>{autoCloseToast}</span>
          </div>
        </div>
      )}

      {pendingOldClose && (
        <div className="fixed top-16 inset-x-0 z-50 flex justify-center px-4">
          <div className="bg-foreground text-background text-sm font-medium px-4 py-3 rounded-2xl shadow-xl flex flex-col gap-2 max-w-sm w-full">
            <div className="flex items-start gap-2">
              <svg className="w-4 h-4 shrink-0 mt-0.5" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M8 5v3.5M8 11v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <span>
                오랜만에 접속 하셨네요! {fmtShort(pendingOldClose.from)} ~ {fmtShort(pendingOldClose.to)} 사이 마감하지 않은 날짜가 있어요. 빈 채로 마감할까요?
              </span>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setPendingOldClose(null)}
                className="px-3 py-1 rounded-full text-xs bg-background/20 hover:bg-background/30 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleConfirmOldClose}
                className="px-3 py-1 rounded-full text-xs bg-background text-foreground hover:bg-background/90 transition-colors font-semibold"
              >
                마감하기
              </button>
            </div>
          </div>
        </div>
      )}

      <DateHeader
        date={currentDate}
        day={day}
        isClosed={currentLog.closed}
        pendingDays={pendingDays}
        canGoPrev={canGoPrev}
        canGoNext={canGoNext}
        onPrev={handlePrev}
        onNext={handleNext}
        minDate={minDate ?? undefined}
        onDateSelect={loadLog}
      />

      {settings.intensiveDayOn && currentLog.intensiveDay && (
        <div className="mx-4 mt-2 px-3 py-2 bg-coral-light border border-coral/30 rounded-lg flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-coral inline-block" />
          <span className="text-xs font-semibold text-coral">Hard Reset Mode</span>
        </div>
      )}

      <InputChipList
        log={currentLog}
        waterGoal={settings.waterGoal}
        customFieldDef={settings.customField}
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
              <path d="M3 8l3.5 3.5L13 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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

      <FreeTextInput onSubmit={handleFreeText} isSaving={isFreeTextSaving} isClosed={currentLog.closed} />

      <InputModal
        field={modalField}
        log={currentLog}
        waterGoal={settings.waterGoal}
        prevWeight={prevWeight ?? (settings.currentWeight > 0 ? settings.currentWeight : null)}
        customFieldDef={settings.customField}
        isSaving={isSaving}
        onSave={handleModalSave}
        onDelete={handleDelete}
        onClose={() => setModalField(null)}
      />
    </div>
  );
}
