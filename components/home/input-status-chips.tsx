"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DailyLog } from "@/lib/types";

interface InputStatusChipsProps {
  log: DailyLog;
}

const items = [
  { key: "weight", label: "체중" },
  { key: "water", label: "수분" },
  { key: "exercise", label: "운동" },
  { key: "breakfast", label: "아침" },
  { key: "lunch", label: "점심" },
  { key: "dinner", label: "저녁" },
  { key: "lateSnack", label: "야식" },
  { key: "energy", label: "체력" },
] as const;

export function InputStatusChips({ log }: InputStatusChipsProps) {
  const completedCount = items.filter(
    (item) => log[item.key] !== null && log[item.key] !== undefined
  ).length;

  return (
    <div className="px-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm">오늘 입력 현황</h3>
        <span className="text-xs text-muted-foreground">
          {completedCount}/8 완료
        </span>
      </div>

      <div className="grid grid-cols-4 gap-2 mb-3">
        {items.map((item) => {
          const value = log[item.key];
          const completed = value !== null && value !== undefined;
          return (
            <Link
              key={item.key}
              href="/input"
              className={cn(
                "flex items-center justify-center gap-1 px-2 py-2.5 rounded-lg text-xs font-medium min-h-[44px] transition-colors",
                completed
                  ? "bg-navy text-white"
                  : "bg-secondary text-muted-foreground border border-border"
              )}
            >
              {completed && <Check className="w-3.5 h-3.5" />}
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>

      <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
        <div
          className="h-full bg-navy rounded-full transition-all"
          style={{ width: `${(completedCount / 8) * 100}%` }}
        />
      </div>

      <Link
        href="/input"
        className="block mt-3 text-center py-2.5 rounded-lg bg-navy text-white text-sm font-medium min-h-[44px] flex items-center justify-center"
      >
        기록하기
      </Link>
    </div>
  );
}
