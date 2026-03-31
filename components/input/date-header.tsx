"use client";

import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";

interface DateHeaderProps {
  date: string;
  day: number;
  isClosed: boolean;
  pendingDays?: number;
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
  onPrev,
  onNext,
}: DateHeaderProps) {
  return (
    <div className="px-4 pt-4">
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={onPrev}
          className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-secondary"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <div className="flex items-center gap-2 text-lg font-bold">
            <span>
              {formatDate(date)} {getDayOfWeek(date)}요일
            </span>
            <span className="text-muted-foreground text-sm font-normal">
              D+{day}
            </span>
            <Calendar className="w-4 h-4 text-muted-foreground" />
          </div>
          {isClosed && (
            <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
              마감됨
            </span>
          )}
        </div>
        <button
          onClick={onNext}
          className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-secondary"
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
