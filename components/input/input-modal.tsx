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
  prevWeight: number | null;
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
  prevWeight,
  onSave,
  onClose,
}: InputModalProps) {
  const [weightValue, setWeightValue] = useState("");
  const [waterValue, setWaterValue] = useState<number | null>(null);
  const [textValue, setTextValue] = useState("");
  const overlayRef = useRef<HTMLDivElement>(null);

  // iOS 키보드 높이 감지 → 패널 bottom offset 조정
  const [keyboardOffset, setKeyboardOffset] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      const kbHeight = Math.max(
        0,
        window.innerHeight - vv.height - vv.offsetTop
      );
      setKeyboardOffset(kbHeight);
    };

    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      setKeyboardOffset(0);
    };
  }, []);

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

  // 체중 슬라이더 범위 계산
  const weightAnchor = log.weight ?? prevWeight ?? 70;
  const sliderMin = Math.max(30, Math.round((weightAnchor - 10) * 10) / 10);
  const sliderMax = Math.round((weightAnchor + 10) * 10) / 10;
  const sliderValue = parseFloat(weightValue) || weightAnchor;

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
      <div
        className="w-full max-w-[480px] bg-white rounded-t-2xl px-4 pt-4 animate-in slide-in-from-bottom-4"
        style={{ paddingBottom: `${keyboardOffset + 32}px` }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold">{label} 입력</h3>
          <button
            onClick={onClose}
            data-testid="modal-close"
            className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-secondary"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Weight */}
        {field === "weight" && (
          <div className="space-y-3">
            {/* 슬라이더 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">{sliderMin}kg</span>
                <span className="text-xl font-bold text-navy">
                  {weightValue || weightAnchor.toFixed(1)} kg
                </span>
                <span className="text-xs text-muted-foreground">{sliderMax}kg</span>
              </div>
              <input
                type="range"
                min={sliderMin}
                max={sliderMax}
                step={0.1}
                value={sliderValue}
                onChange={(e) =>
                  setWeightValue(
                    String(Math.round(Number(e.target.value) * 10) / 10)
                  )
                }
                className="w-full h-2 rounded-full appearance-none cursor-pointer accent-navy bg-secondary"
              />
            </div>
            {/* 직접 입력 */}
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.1"
                placeholder="직접 입력"
                value={weightValue}
                onChange={(e) => setWeightValue(e.target.value)}
                data-testid="modal-weight-input"
                className="flex-1 px-4 py-3 text-lg text-right border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-navy/20 min-h-[52px]"
              />
              <span className="text-base text-muted-foreground font-medium">kg</span>
            </div>
            <button
              onClick={handleWeightSave}
              data-testid="modal-save"
              className="w-full py-3 rounded-xl bg-navy text-white text-sm font-semibold min-h-[48px]"
            >
              저장
            </button>
          </div>
        )}

        {/* Water */}
        {field === "water" && (
          <div className="space-y-4">
            {/* 슬라이더 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">0L</span>
                <span className="text-xl font-bold text-navy">
                  {waterValue != null ? waterValue.toFixed(1) : "0.0"}L
                </span>
                <span className="text-xs text-muted-foreground">4L</span>
              </div>
              <input
                type="range"
                min={0}
                max={4}
                step={0.1}
                value={waterValue ?? 0}
                onChange={(e) => setWaterValue(Math.round(Number(e.target.value) * 10) / 10)}
                className="w-full h-2 rounded-full appearance-none cursor-pointer accent-navy bg-secondary"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>목표 {waterGoal}L</span>
                {waterValue != null && waterValue > 0 && waterValue < waterGoal && (
                  <span>목표까지 {(waterGoal - waterValue).toFixed(1)}L 남음</span>
                )}
                {waterValue != null && waterValue >= waterGoal && (
                  <span className="text-success font-medium">목표 달성!</span>
                )}
              </div>
            </div>

            {/* 빠른 선택 버튼 */}
            <div className="grid grid-cols-4 gap-2">
              {waterPresets.map((v) => (
                <button
                  key={v}
                  onClick={() => setWaterValue(v)}
                  data-testid={`modal-water-${v}`}
                  className={cn(
                    "py-2.5 rounded-xl text-sm font-medium min-h-[44px] transition-colors",
                    waterValue === v
                      ? "bg-navy text-white"
                      : "bg-secondary text-foreground border border-border"
                  )}
                >
                  {v}L
                </button>
              ))}
            </div>

            <button
              onClick={handleWaterSave}
              disabled={waterValue == null || waterValue === 0}
              data-testid="modal-save"
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
              data-testid="modal-exercise-y"
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
              data-testid="modal-exercise-n"
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
              data-testid="modal-meal-input"
              className="w-full px-4 py-3 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-navy/20 min-h-[52px]"
            />
            <button
              onClick={handleTextSave}
              data-testid="modal-save"
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
              data-testid="modal-late-snack-y"
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
              data-testid="modal-late-snack-n"
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
                data-testid={`modal-energy-${e}`}
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
