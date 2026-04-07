"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface DateHeaderProps {
  date: string;
  day: number;
  isClosed: boolean;
  pendingDays?: number;
  canGoPrev: boolean;
  canGoNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  minDate?: string;
  onDateSelect?: (date: string) => void;
}

function getDayOfWeek(dateStr: string) {
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return days[new Date(dateStr + "T00:00:00").getDay()];
}

function formatDateLabel(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function CalendarPicker({
  currentDate,
  minDate,
  maxDate,
  onSelect,
  onClose,
}: {
  currentDate: string;
  minDate: string;
  maxDate: string;
  onSelect: (date: string) => void;
  onClose: () => void;
}) {
  const initDate = new Date(currentDate + "T00:00:00");
  const [viewYear, setViewYear] = useState(initDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initDate.getMonth());
  const [showYearPicker, setShowYearPicker] = useState(false);

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  // Build day cells (pad start with nulls for day-of-week offset, always 6 rows)
  const firstDow = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  // 항상 6행(42칸)으로 패딩 — 월 이동 시 달력 높이 고정
  while (cells.length < 42) cells.push(null);

  // Year range from minDate year to maxDate year
  const minYear = new Date(minDate + "T00:00:00").getFullYear();
  const maxYear = new Date(maxDate + "T00:00:00").getFullYear();
  const years = Array.from({ length: maxYear - minYear + 1 }, (_, i) => minYear + i);

  const todayStr = maxDate;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-[400px] mx-auto p-4 pb-6">
        {/* Month navigation header */}
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={prevMonth}
            className="p-2 rounded-lg hover:bg-secondary min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="이전 달"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => setShowYearPicker((v) => !v)}
            className="text-base font-bold px-3 py-1.5 rounded-lg hover:bg-secondary transition-colors"
          >
            {viewYear}년 {viewMonth + 1}월
          </button>
          <button
            onClick={nextMonth}
            className="p-2 rounded-lg hover:bg-secondary min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="다음 달"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {showYearPicker ? (
          <div className="grid grid-cols-3 gap-2 py-2">
            {years.map((y) => (
              <button
                key={y}
                onClick={() => {
                  setViewYear(y);
                  setShowYearPicker(false);
                }}
                className={cn(
                  "py-2.5 rounded-xl text-sm font-medium transition-colors",
                  y === viewYear
                    ? "bg-navy text-white"
                    : "bg-secondary text-foreground hover:bg-secondary/70"
                )}
              >
                {y}년
              </button>
            ))}
          </div>
        ) : (
          <>
            {/* Day-of-week headers */}
            <div className="grid grid-cols-7 mb-1">
              {["일", "월", "화", "수", "목", "금", "토"].map((dow) => (
                <div
                  key={dow}
                  className="text-center text-xs text-muted-foreground py-1.5 font-medium"
                >
                  {dow}
                </div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7 gap-y-1">
              {cells.map((day, i) => {
                if (!day) return <div key={i} />;
                const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const isDisabled = dateStr > maxDate || dateStr < minDate;
                const isSelected = dateStr === currentDate;
                const isToday = dateStr === todayStr;
                return (
                  <button
                    key={i}
                    disabled={isDisabled}
                    onClick={() => {
                      onSelect(dateStr);
                      onClose();
                    }}
                    className={cn(
                      "aspect-square flex items-center justify-center text-sm rounded-full transition-colors mx-auto w-9 h-9",
                      isSelected
                        ? "bg-navy text-white font-bold"
                        : isDisabled
                        ? "text-muted-foreground/30 cursor-default"
                        : isToday
                        ? "text-navy font-bold hover:bg-secondary"
                        : "text-foreground hover:bg-secondary"
                    )}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </>
        )}

        <button
          onClick={onClose}
          className="mt-4 w-full py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-secondary transition-colors"
        >
          닫기
        </button>
      </div>
    </div>
  );
}

export function DateHeader({
  date,
  day,
  isClosed,
  pendingDays,
  canGoPrev,
  canGoNext,
  onPrev,
  onNext,
  minDate,
  onDateSelect,
}: DateHeaderProps) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const dayLabel = Number.isFinite(day) && day > 0 ? `D+${day}` : null;
  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div className="px-4 pt-4">
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={canGoPrev ? onPrev : undefined}
          disabled={!canGoPrev}
          data-testid="date-prev"
          className={cn(
            "p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg transition-colors",
            canGoPrev
              ? "hover:bg-secondary text-foreground"
              : "text-muted-foreground/30 cursor-default"
          )}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div data-testid="date-display" className="text-center">
          <button
            onClick={() => onDateSelect && setCalendarOpen(true)}
            className={cn(
              "flex items-center gap-2 text-lg font-bold rounded-lg px-2 py-1 transition-colors",
              onDateSelect
                ? "hover:bg-secondary cursor-pointer"
                : "cursor-default"
            )}
          >
            <span>
              {formatDateLabel(date)} {getDayOfWeek(date)}요일
            </span>
            {dayLabel && (
              <span className="text-muted-foreground text-sm font-normal">
                {dayLabel}
              </span>
            )}
          </button>
          {isClosed && (
            <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
              마감됨
            </span>
          )}
        </div>

        <button
          onClick={canGoNext ? onNext : undefined}
          disabled={!canGoNext}
          data-testid="date-next"
          className={cn(
            "p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg transition-colors",
            canGoNext
              ? "hover:bg-secondary text-foreground"
              : "text-muted-foreground/30 cursor-default"
          )}
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {pendingDays !== undefined && pendingDays >= 3 && (
        <div className="bg-coral-light border border-coral/30 rounded-lg px-3 py-2 text-xs text-coral font-medium text-center">
          {pendingDays}일치 기록이 밀려 있어요
        </div>
      )}

      {calendarOpen && onDateSelect && (
        <CalendarPicker
          currentDate={date}
          minDate={minDate ?? "2020-01-01"}
          maxDate={todayStr}
          onSelect={onDateSelect}
          onClose={() => setCalendarOpen(false)}
        />
      )}
    </div>
  );
}
