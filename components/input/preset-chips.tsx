"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { isPresetInText } from "@/lib/utils/input-presets";

interface PresetChipsProps {
  /** 이 항목에 등록된 자주 쓰는 메뉴 */
  presets: string[];
  /** 현재 입력창 텍스트 — 칩 선택 상태 판정에 사용 */
  value: string;
  /** 칩 탭 → 입력창에 추가/제거 */
  onToggle: (preset: string) => void;
  /** 칩 × 탭 → 등록 목록에서 삭제 */
  onDelete: (preset: string) => void;
  disabled?: boolean;
}

/**
 * 입력창 바로 아래에 붙는 "자주 쓰는 메뉴" 칩 목록.
 * 탭 한 번으로 입력창에 채워지고, 칩의 ×로 등록을 해제한다.
 */
export function PresetChips({
  presets,
  value,
  onToggle,
  onDelete,
  disabled,
}: PresetChipsProps) {
  if (presets.length === 0) return null;

  return (
    <div
      data-testid="preset-chips"
      className="flex flex-wrap gap-1.5"
    >
      {presets.map((preset) => {
        const selected = isPresetInText(value, preset);
        return (
          <span
            key={preset}
            className={cn(
              "inline-flex items-center rounded-full text-xs font-medium transition-colors",
              selected
                ? "bg-navy text-white"
                : "bg-navy/5 text-navy border border-navy/20"
            )}
          >
            <button
              type="button"
              onClick={() => onToggle(preset)}
              disabled={disabled}
              data-testid={`preset-chip-${preset}`}
              className="pl-3 pr-1.5 py-2 min-h-[36px] disabled:opacity-50"
            >
              {preset}
            </button>
            <button
              type="button"
              onClick={() => onDelete(preset)}
              disabled={disabled}
              aria-label={`${preset} 등록 해제`}
              data-testid={`preset-chip-delete-${preset}`}
              className={cn(
                "pr-2.5 pl-0.5 py-2 min-h-[36px] rounded-r-full transition-colors disabled:opacity-50",
                selected ? "hover:bg-white/20" : "hover:bg-navy/10"
              )}
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        );
      })}
    </div>
  );
}
