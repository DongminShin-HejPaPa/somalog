"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DailyLog, CustomFieldDef } from "@/lib/types";
import type { ItemKey } from "./input-modal";

interface InputChipListProps {
  log: DailyLog;
  waterGoal: number;
  customFieldDef?: CustomFieldDef | null;
  onChipClick: (key: ItemKey) => void;
  isClosed: boolean;
}

const BASE_ITEMS: { key: ItemKey; label: string }[] = [
  { key: "weight", label: "체중" },
  { key: "water", label: "수분" },
  { key: "exercise", label: "운동" },
  { key: "breakfast", label: "아침" },
  { key: "lunch", label: "점심" },
  { key: "dinner", label: "저녁" },
  { key: "lateSnack", label: "야식" },
];

function formatValue(key: ItemKey, value: unknown, waterGoal: number): string {
  if (value === null || value === undefined) return "";
  switch (key) {
    case "weight":
      return `${value} kg`;
    case "water":
      return `${value}L / ${waterGoal}L`;
    case "exercise":
      return value === "Y" ? "했음" : "안 했음";
    case "lateSnack":
      return value === "Y" ? "먹음" : "안 먹음";
    default:
      return value as string;
  }
}

export function InputChipList({
  log,
  waterGoal,
  customFieldDef,
  onChipClick,
  isClosed,
}: InputChipListProps) {
  const items: { key: ItemKey; label: string }[] = customFieldDef
    ? [...BASE_ITEMS, { key: "customFieldValue", label: customFieldDef.name }]
    : BASE_ITEMS;

  const totalCount = items.length;
  const completedCount = items.filter(
    (item) => log[item.key] !== null && log[item.key] !== undefined
  ).length;

  return (
    <div className="px-4 mt-4">
      <div className="space-y-2">
        {items.map((item) => {
          const value = log[item.key];
          const completed = value !== null && value !== undefined;
          const display = formatValue(item.key, value, waterGoal);

          return (
            <button
              key={item.key}
              onClick={() => onChipClick(item.key)}
              disabled={isClosed}
              data-testid={`chip-${item.key}`}
              className={cn(
                "w-full flex items-center justify-between px-4 py-3 rounded-xl min-h-[52px] transition-colors text-left",
                isClosed ? "cursor-not-allowed opacity-70" : "cursor-pointer",
                completed
                  ? "bg-navy/5 border border-navy/20"
                  : "bg-secondary border border-border hover:border-navy/30"
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center",
                    completed ? "bg-navy" : "bg-border"
                  )}
                >
                  {completed && <Check className="w-3.5 h-3.5 text-white" />}
                </div>
                <span
                  className={cn(
                    "text-sm font-medium",
                    completed ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {item.label}
                </span>
              </div>
              {completed && (
                <span className="text-sm text-navy font-medium">{display}</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
          <span>진행률</span>
          <span>{completedCount}/{totalCount}</span>
        </div>
        <div data-testid="progress-bar" className="w-full h-2 bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full bg-navy rounded-full transition-all"
            style={{ width: `${(completedCount / totalCount) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
