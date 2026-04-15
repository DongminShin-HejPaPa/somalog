"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DailyLog, CustomFieldDef } from "@/lib/types";

interface InputStatusChipsProps {
  log: DailyLog;
  customFieldDef?: CustomFieldDef | null;
  onCloseToday?: () => void;
  isClosingToday?: boolean;
}

const BASE_ITEMS = [
  { key: "weight", label: "체중" },
  { key: "water", label: "수분" },
  { key: "exercise", label: "운동" },
  { key: "breakfast", label: "아침" },
  { key: "lunch", label: "점심" },
  { key: "dinner", label: "저녁" },
  { key: "lateSnack", label: "야식" },
] as const;

type BaseKey = typeof BASE_ITEMS[number]["key"];

export function InputStatusChips({ log, customFieldDef, onCloseToday, isClosingToday }: InputStatusChipsProps) {
  const items: { key: string; label: string }[] = customFieldDef
    ? [...BASE_ITEMS, { key: "customFieldValue", label: customFieldDef.name }]
    : [...BASE_ITEMS];

  const totalCount = items.length;
  const completedCount = items.filter(
    (item) => log[item.key as BaseKey | "customFieldValue"] !== null &&
              log[item.key as BaseKey | "customFieldValue"] !== undefined
  ).length;

  const isClosed = log.closed;

  return (
    <div className="px-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm">오늘 입력 현황</h3>
        <span className="text-xs text-muted-foreground">
          {completedCount}/{totalCount} 완료
        </span>
      </div>

      <div className="grid grid-cols-4 gap-2 mb-3">
        {items.map((item) => {
          const value = log[item.key as BaseKey | "customFieldValue"];
          const completed = value !== null && value !== undefined;
          // 마감된 날은 클릭 불가
          if (isClosed) {
            return (
              <div
                key={item.key}
                className={cn(
                  "flex items-center justify-center gap-1 px-2 py-2.5 rounded-lg text-xs font-medium min-h-[44px]",
                  completed
                    ? "bg-navy/60 text-white"
                    : "bg-secondary/60 text-muted-foreground/60 border border-border"
                )}
              >
                {completed && <Check className="w-3.5 h-3.5" />}
                <span>{item.label}</span>
              </div>
            );
          }
          return (
            <Link
              key={item.key}
              href={`/input?open=${item.key}`}
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
          style={{ width: `${(completedCount / totalCount) * 100}%` }}
        />
      </div>

      <div className="flex gap-2 mt-3">
        <Link
          href="/input"
          className="flex-1 text-center py-2.5 rounded-lg bg-navy text-white text-sm font-medium min-h-[44px] flex items-center justify-center"
        >
          {isClosed ? "기록 보기" : "기록하기"}
        </Link>
        {!isClosed && onCloseToday && (
          <button
            onClick={onCloseToday}
            disabled={isClosingToday}
            className="flex-1 py-2.5 rounded-lg border border-navy text-navy text-sm font-medium min-h-[44px] transition-colors hover:bg-navy/5 disabled:opacity-60"
          >
            {isClosingToday ? "마감 중..." : "이날은 이대로 마감하기"}
          </button>
        )}
      </div>
    </div>
  );
}
