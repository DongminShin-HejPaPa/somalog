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
  actionGetFirstUnclosedLog,
} from "@/app/actions/log-actions";
import { actionParseFreText } from "@/app/actions/parse-actions";
import { DateHeader } from "./date-header";
import { InputChipList } from "./input-chip-list";
import { InputModal, type ItemKey } from "./input-modal";
import { FeedbackArea } from "./feedback-area";
import { FreeTextInput } from "./free-text-input";
import type { DailyLog, DailyLogUpdate } from "@/lib/types";
import { logStore } from "@/lib/stores/log-store";

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return formatDate(d);
}

export function InputContainer() {
  const { settings } = useSettings();
  const searchParams = useSearchParams();
  const [currentDate, setCurrentDate] = useState<string>(formatDate(new Date()));
  const [currentLog, setCurrentLog] = useState<DailyLog | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [modalField, setModalField] = useState<ItemKey | null>(null);
  const [pendingDays, setPendingDays] = useState(0);
  const [allLogs, setAllLogs] = useState<DailyLog[]>([]);
  const [minDate, setMinDate] = useState<string | null>(null);
  const [autoCloseToast, setAutoCloseToast] = useState<number | null>(null);

  // currentDate 기준 이전 최신 체중 (날짜 이동 시마다 자동 재계산)
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
    // 글로벌 캐시 히트
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
      // 로그가 없으면 빈 로그 자동 생성 (오늘 포함, 과거 날짜도 동일하게 적용)
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
    const init = async () => {
      actionAutoCloseOldLogs().then(async (autoClosedCount) => {
        if (autoClosedCount > 0) {
          setAutoCloseToast(autoClosedCount);
          setTimeout(() => setAutoCloseToast(null), 5000);
          // 조용히 최신 데이터로 다시 덮어씌움 (화면 불일치 방지)
          const updatedLogs = await actionGetRecentDailyLogs(30);
          logStore.setRecentLogs(updatedLogs);
          setAllLogs(updatedLogs);
        }
      }).catch(() => {});

      // 2. 글로벌 캐시 유효성 확인
      const today = formatDate(new Date());
      let logs: DailyLog[];
      let firstUnclosed: DailyLog | null;

      if (!logStore.isStale() && logStore.getRecentLogs()) {
        logs = logStore.getRecentLogs()!;
        firstUnclosed = logStore.getFirstUnclosedLog();
      } else {
        const [fetchedLogs, fetchedFirstUnclosed] = await Promise.all([
          actionGetRecentDailyLogs(30),
          actionGetFirstUnclosedLog(),
        ]);
        logs = fetchedLogs;
        firstUnclosed = fetchedFirstUnclosed;
        logStore.setRecentLogs(logs);
      }

      const unclosed = logs.filter((l) => !l.closed);
      setPendingDays(unclosed.length);
      setAllLogs(logs);

      // 네비게이션 하한선
      const dietStart = settings.dietStartDate;
      const dates = logs.map((l) => l.date).sort();
      const lowerBound = dietStart || (dates.length > 0 ? dates[0] : today);
      setMinDate(lowerBound);

      // 타겟 날짜: DB에서 직접 조회한 첫 미마감 날짜 (없으면 오늘)
      const targetDate = firstUnclosed?.date ?? today;
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
      setCurrentLog(updated);
      updateCache(updated);
      // prevWeight 파생값이 다음 날짜 이동 시 올바르도록 allLogs 동기화
      setAllLogs((prev) => {
        const exists = prev.some((l) => l.date === currentDate);
        if (exists) return prev.map((l) => (l.date === currentDate ? updated : l));
        return [...prev, updated].sort((a, b) => b.date.localeCompare(a.date));
      });
    } catch {
      setCurrentLog(previousLog);
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

      // 마감 후 상태 갱신
      const logs = await actionGetRecentDailyLogs(30);
      logStore.setRecentLogs(logs);
      const unclosed = logs.filter((l) => !l.closed);
      setPendingDays(unclosed.length);
      setAllLogs(logs);

      const dates = logs.map((l) => l.date).sort();
      if (dates.length > 0) setMinDate(dates[0]);

      // 마감 후 가장 오래된 미마감 날짜로 이동
      const sortedUnclosed = [...unclosed]
        .filter((l) => l.date <= today)
        .sort((a, b) => a.date.localeCompare(b.date));
      const nextTarget = sortedUnclosed.length > 0
        ? sortedUnclosed[0].date
        : today;
      if (nextTarget <= today) {
        setCloseNavMessage(`${nextTarget.slice(5).replace("-", "/")} 로 이동합니다`);
        setTimeout(() => setCloseNavMessage(null), 3000);
        await loadLog(nextTarget);
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
        updateCache(updated);
      }
    } finally {
      setIsFreeTextSaving(false);
    }
  };

  // URL ?open= 파라미터로 모달 자동 열기
  const hasAutoOpened = useRef(false);
  useEffect(() => {
    const open = searchParams.get("open") as ItemKey | null;
    if (open && !isLoading && currentLog && !currentLog.closed && !hasAutoOpened.current) {
      setModalField(open);
      hasAutoOpened.current = true;
      // Optional: Replace URL state to remove query parameter
      window.history.replaceState(null, '', '/input');
    }
  }, [searchParams, isLoading, currentLog]);

  const completedCount = currentLog
    ? (["weight", "water", "exercise", "breakfast", "lunch", "dinner", "lateSnack"] as ItemKey[])
        .filter((k) => currentLog[k] != null).length
    : 0;

  // 로그가 로드(또는 재오픈)될 때의 completedCount를 기준으로 저장
  // → 이미 7개가 채워진 상태로 열렸다면 자동 마감 비활성화
  const loadTimeCountRef = useRef<number>(0);
  const autoCloseFiredRef = useRef(false);
  useEffect(() => {
    if (isLoading || !currentLog) return;
    loadTimeCountRef.current = completedCount;
    autoCloseFiredRef.current = false;
  }, [currentLog?.date, currentLog?.closed, isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // 7개 항목 모두 입력 시 자동 마감 (로드 시점 기준값이 7 미만이었을 때만)
  useEffect(() => {
    if (!currentLog || currentLog.closed || isLoading) return;
    if (completedCount === 7 && !autoCloseFiredRef.current && loadTimeCountRef.current < 7) {
      autoCloseFiredRef.current = true;
      const timer = setTimeout(() => {
        handleClose();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [completedCount, currentLog, isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const allCompleted = completedCount === 7;
  const day = getDayNumber(currentDate, settings.dietStartDate);

  return (
    <div className="pb-20">
      {autoCloseToast && (
        <div className="fixed top-16 inset-x-0 flex justify-center z-50 pointer-events-none px-4">
          <div className="bg-foreground text-background text-sm font-medium px-4 py-2.5 rounded-full shadow-xl flex items-center gap-2 max-w-xs text-center">
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M8 5v3.5M8 11v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <span>한 달 넘게 지난 미마감 날짜 {autoCloseToast}일을 자동 마감했어요</span>
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

      <FreeTextInput onSubmit={handleFreeText} isSaving={isFreeTextSaving} isClosed={currentLog.closed} />

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
