"use client";

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
}

function getDayOfWeek(dateStr: string) {
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return days[new Date(dateStr + "T00:00:00").getDay()];
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getMonth() + 1}/${d.getDate()}`;
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
}: DateHeaderProps) {
  const dayLabel = Number.isFinite(day) && day > 0 ? `D+${day}` : null;

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
          <div className="flex items-center gap-2 text-lg font-bold">
            <span>
              {formatDate(date)} {getDayOfWeek(date)}요일
            </span>
            {dayLabel && (
              <span className="text-muted-foreground text-sm font-normal">
                {dayLabel}
              </span>
            )}
          </div>
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
    </div>
  );
}
