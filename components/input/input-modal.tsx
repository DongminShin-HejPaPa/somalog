"use client";

import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DailyLog, DailyLogUpdate } from "@/lib/types";

export type ItemKey =
  | "weight"
  | "water"
  | "exercise"
  | "breakfast"
  | "lunch"
  | "dinner"
  | "lateSnack"
  | "energy";

interface InputModalProps {
  field: ItemKey | null;
  log: DailyLog;
  waterGoal: number;
  onSave: (update: DailyLogUpdate) => void;
  onClose: () => void;
}

const fieldLabels: Record<ItemKey, string> = {
  weight: "체중",
  water: "수분",
  exercise: "운동",
  breakfast: "아침",
  lunch: "점심",
  dinner: "저녁",
  lateSnack: "야식",
  energy: "체력",
};

const waterPresets = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5];

export function InputModal({
  field,
  log,
  waterGoal,
  onSave,
  onClose,
}: InputModalProps) {
  const [weightValue, setWeightValue] = useState("");
  const [waterValue, setWaterValue] = useState<number | null>(null);
  const [textValue, setTextValue] = useState("");
  const overlayRef = useRef<HTMLDivElement>(null);

  // Pre-fill existing values when modal opens
  useEffect(() => {
    if (!field) return;
    if (field === "weight") {
      setWeightValue(log.weight != null ? String(log.weight) : "");
    } else if (field === "water") {
      setWaterValue(log.water);
    } else if (field === "breakfast") {
      setTextValue(log.breakfast ?? "");
    } else if (field === "lunch") {
      setTextValue(log.lunch ?? "");
    } else if (field === "dinner") {
      setTextValue(log.dinner ?? "");
    }
  }, [field, log]);

  if (!field) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  const handleWeightSave = () => {
    const num = parseFloat(weightValue);
    if (isNaN(num)) return;
    onSave({ weight: Math.round(num * 10) / 10 });
  };

  const handleWaterSave = () => {
    if (waterValue == null) return;
    onSave({ water: waterValue });
  };

  const handleTextSave = () => {
    const trimmed = textValue.trim();
    if (!trimmed) return;
    onSave({ [field]: trimmed } as DailyLogUpdate);
  };

  const label = fieldLabels[field];

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center"
    >
      <div className="w-full max-w-[480px] bg-white rounded-t-2xl px-4 pb-8 pt-4 animate-in slide-in-from-bottom-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold">{label} 입력</h3>
          <button
            onClick={onClose}
            className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-secondary"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Weight */}
        {field === "weight" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.1"
                placeholder="0.0"
                value={weightValue}
                onChange={(e) => setWeightValue(e.target.value)}
                autoFocus
                className="flex-1 px-4 py-3 text-lg text-right border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-navy/20 min-h-[52px]"
              />
              <span className="text-base text-muted-foreground font-medium">kg</span>
            </div>
            <button
              onClick={handleWeightSave}
              className="w-full py-3 rounded-xl bg-navy text-white text-sm font-semibold min-h-[48px]"
            >
              저장
            </button>
          </div>
        )}

        {/* Water */}
        {field === "water" && (
          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-2">
              {waterPresets.map((v) => (
                <button
                  key={v}
                  onClick={() => setWaterValue(v)}
                  className={cn(
                    "py-3 rounded-xl text-sm font-medium min-h-[48px] transition-colors",
                    waterValue === v
                      ? "bg-navy text-white"
                      : "bg-secondary text-foreground border border-border"
                  )}
                >
                  {v}L
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground text-center">
              목표: {waterGoal}L
            </p>
            <button
              onClick={handleWaterSave}
              disabled={waterValue == null}
              className="w-full py-3 rounded-xl bg-navy text-white text-sm font-semibold min-h-[48px] disabled:opacity-40"
            >
              저장
            </button>
          </div>
        )}

        {/* Exercise */}
        {field === "exercise" && (
          <div className="flex gap-3">
            <button
              onClick={() => onSave({ exercise: "Y" })}
              className={cn(
                "flex-1 py-4 rounded-xl text-sm font-semibold min-h-[60px] transition-colors",
                log.exercise === "Y"
                  ? "bg-navy text-white"
                  : "bg-secondary text-foreground border border-border"
              )}
            >
              했음
            </button>
            <button
              onClick={() => onSave({ exercise: "N" })}
              className={cn(
                "flex-1 py-4 rounded-xl text-sm font-semibold min-h-[60px] transition-colors",
                log.exercise === "N"
                  ? "bg-coral text-white"
                  : "bg-secondary text-foreground border border-border"
              )}
            >
              안 했음
            </button>
          </div>
        )}

        {/* Breakfast / Lunch / Dinner */}
        {(field === "breakfast" || field === "lunch" || field === "dinner") && (
          <div className="space-y-3">
            <input
              type="text"
              placeholder="예: 관리식단, 소식 한식, 고칼로리 외식"
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleTextSave()}
              autoFocus
              className="w-full px-4 py-3 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-navy/20 min-h-[52px]"
            />
            <button
              onClick={handleTextSave}
              className="w-full py-3 rounded-xl bg-navy text-white text-sm font-semibold min-h-[48px]"
            >
              저장
            </button>
          </div>
        )}

        {/* LateSnack */}
        {field === "lateSnack" && (
          <div className="flex gap-3">
            <button
              onClick={() => onSave({ lateSnack: "Y" })}
              className={cn(
                "flex-1 py-4 rounded-xl text-sm font-semibold min-h-[60px] transition-colors",
                log.lateSnack === "Y"
                  ? "bg-coral text-white"
                  : "bg-secondary text-foreground border border-border"
              )}
            >
              먹음
            </button>
            <button
              onClick={() => onSave({ lateSnack: "N" })}
              className={cn(
                "flex-1 py-4 rounded-xl text-sm font-semibold min-h-[60px] transition-colors",
                log.lateSnack === "N"
                  ? "bg-navy text-white"
                  : "bg-secondary text-foreground border border-border"
              )}
            >
              안 먹음
            </button>
          </div>
        )}

        {/* Energy */}
        {field === "energy" && (
          <div className="flex gap-3">
            {(["여유", "보통", "피곤"] as const).map((e) => (
              <button
                key={e}
                onClick={() => onSave({ energy: e })}
                className={cn(
                  "flex-1 py-4 rounded-xl text-sm font-semibold min-h-[60px] transition-colors",
                  log.energy === e
                    ? "bg-navy text-white"
                    : "bg-secondary text-foreground border border-border"
                )}
              >
                {e}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
