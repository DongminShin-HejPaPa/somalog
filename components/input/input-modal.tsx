"use client";

import { useState, useEffect, useRef } from "react";
import { X, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useKeyboardOffset } from "@/lib/hooks/use-keyboard-offset";
import type { DailyLog, DailyLogUpdate, ClearableField, CustomFieldDef } from "@/lib/types";

export type ItemKey =
  | "weight"
  | "water"
  | "exercise"
  | "breakfast"
  | "lunch"
  | "dinner"
  | "lateSnack"
  | "customFieldValue";

interface InputModalProps {
  field: ItemKey | null;
  log: DailyLog;
  waterGoal: number;
  prevWeight: number | null;
  customFieldDef?: CustomFieldDef | null;
  isSaving?: boolean;
  onSave: (update: DailyLogUpdate) => void;
  onDelete: (field: ClearableField) => void;
  onClose: () => void;
}

const fieldLabels: Record<Exclude<ItemKey, "customFieldValue">, string> = {
  weight: "체중",
  water: "수분",
  exercise: "운동",
  breakfast: "아침",
  lunch: "점심",
  dinner: "저녁",
  lateSnack: "야식",
};

const waterPresets = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5];

function SaveButton({
  onClick,
  disabled,
  isSaving,
  testId,
}: {
  onClick: () => void;
  disabled?: boolean;
  isSaving?: boolean;
  testId?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || isSaving}
      data-testid={testId ?? "modal-save"}
      className="w-full py-3 rounded-xl bg-navy text-white text-sm font-semibold min-h-[48px] disabled:opacity-40 flex items-center justify-center gap-2"
    >
      {isSaving ? (
        <>
          <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          저장 중...
        </>
      ) : "저장"}
    </button>
  );
}

function DeleteButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      data-testid="modal-delete"
      className="w-full py-2.5 rounded-xl border border-border text-muted-foreground text-sm font-medium min-h-[44px] flex items-center justify-center gap-1.5 hover:bg-red-50 hover:border-red-200 hover:text-red-500 transition-colors disabled:opacity-40"
    >
      <Trash2 className="w-3.5 h-3.5" />
      삭제
    </button>
  );
}

export function InputModal({
  field,
  log,
  waterGoal,
  prevWeight,
  customFieldDef,
  isSaving,
  onSave,
  onDelete,
  onClose,
}: InputModalProps) {
  const [weightValue, setWeightValue] = useState("");
  const [waterValue, setWaterValue] = useState<number | null>(null);
  const [textValue, setTextValue] = useState("");
  const overlayRef = useRef<HTMLDivElement>(null);

  const keyboardOffset = useKeyboardOffset();

  // Pre-fill existing values when modal opens
  useEffect(() => {
    if (!field) return;
    if (field === "weight") {
      setWeightValue(log.weight != null ? String(log.weight) : (prevWeight != null ? String(prevWeight) : "70"));
    } else if (field === "water") {
      setWaterValue(log.water ?? waterGoal);
    } else if (field === "breakfast") {
      setTextValue(log.breakfast ?? "");
    } else if (field === "lunch") {
      setTextValue(log.lunch ?? "");
    } else if (field === "dinner") {
      setTextValue(log.dinner ?? "");
    } else if (field === "customFieldValue") {
      setTextValue(log.customFieldValue ?? "");
    }
  }, [field, log]);

  if (!field) return null;

  // 체중 슬라이더 범위 계산
  const weightAnchor = log.weight ?? prevWeight ?? 70;
  const sliderMin = Math.max(30, Math.round((weightAnchor - 5) * 10) / 10);
  const sliderMax = Math.round((weightAnchor + 5) * 10) / 10;
  const sliderValue = parseFloat(weightValue) || weightAnchor;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  const handleWeightSave = () => {
    const trimmed = weightValue.trim();
    // 빈 입력 or NaN → 삭제
    if (!trimmed || isNaN(parseFloat(trimmed))) {
      if (log.weight != null) onDelete("weight");
      else onClose();
      return;
    }
    onSave({ weight: Math.round(parseFloat(trimmed) * 10) / 10 });
  };

  const handleWaterSave = () => {
    if (waterValue == null) return;
    onSave({ water: waterValue });
  };

  const handleTextSave = () => {
    const trimmed = textValue.trim();
    // 빈 텍스트 저장 → 해당 필드 삭제
    if (!trimmed) {
      const mealField = field as "breakfast" | "lunch" | "dinner";
      const hasValue = log[mealField] != null;
      if (hasValue) onDelete(mealField);
      else onClose();
      return;
    }
    onSave({ [field]: trimmed } as DailyLogUpdate);
  };

  const label = field === "customFieldValue"
    ? (customFieldDef?.name ?? "맞춤 입력")
    : fieldLabels[field as Exclude<ItemKey, "customFieldValue">];

  // 현재 값이 있는지 (삭제 버튼 노출 여부)
  const hasCurrentValue = ((): boolean => {
    if (field === "weight") return log.weight != null;
    if (field === "water") return log.water != null;
    if (field === "exercise") return log.exercise != null;
    if (field === "breakfast") return log.breakfast != null;
    if (field === "lunch") return log.lunch != null;
    if (field === "dinner") return log.dinner != null;
    if (field === "lateSnack") return log.lateSnack != null;
    if (field === "customFieldValue") return log.customFieldValue != null;
    return false;
  })();

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 bg-black/40 z-[60] flex items-end justify-center"
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

        {/* 체중 슬라이더 */}
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
              {/* 이전 체중 대비 +- 표시 */}
              {prevWeight != null && (() => {
                const current = parseFloat(weightValue);
                if (isNaN(current)) return null;
                const delta = Math.round((current - prevWeight) * 10) / 10;
                const sign = delta > 0 ? "+" : "";
                const isPositive = delta > 0;
                const isNeutral = delta === 0;
                return (
                  <div className="flex justify-end mt-1">
                    <span className={cn(
                      "text-xs font-semibold",
                      isNeutral ? "text-muted-foreground" : isPositive ? "text-coral" : "text-emerald-500"
                    )}>
                      {sign}{delta}kg
                    </span>
                  </div>
                );
              })()}
            </div>
            {/* 직접 입력 */}
            <div className="flex items-center gap-2">
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                placeholder="직접 입력"
                value={weightValue}
                onChange={(e) => setWeightValue(e.target.value)}
                data-testid="modal-weight-input"
                className="flex-1 px-4 py-3 text-lg text-right border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-navy/20 min-h-[52px]"
              />
              <span className="text-base text-muted-foreground font-medium">kg</span>
            </div>
            <SaveButton onClick={handleWeightSave} isSaving={isSaving} />
            {hasCurrentValue && (
              <DeleteButton onClick={() => onDelete("weight")} disabled={isSaving} />
            )}
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

            <SaveButton
              onClick={handleWaterSave}
              disabled={waterValue == null || waterValue === 0}
              isSaving={isSaving}
            />
            {hasCurrentValue && (
              <DeleteButton onClick={() => onDelete("water")} disabled={isSaving} />
            )}
          </div>
        )}

        {/* Exercise */}
        {field === "exercise" && (
          <div className="space-y-3">
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
            {hasCurrentValue && (
              <DeleteButton onClick={() => onDelete("exercise")} disabled={isSaving} />
            )}
          </div>
        )}

        {/* Breakfast / Lunch / Dinner */}
        {(field === "breakfast" || field === "lunch" || field === "dinner") && (
          <div className="space-y-3">
            <input
              type="text"
              placeholder="예: 버섯크림파스타와 콜라ㅠㅠ, 한식 소식, 고칼로리 식단"
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleTextSave()}
              autoFocus
              data-testid="modal-meal-input"
              className="w-full px-4 py-3 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-navy/20 min-h-[52px]"
            />
            <SaveButton onClick={handleTextSave} isSaving={isSaving} />
            {hasCurrentValue && (
              <DeleteButton
                onClick={() => onDelete(field as ClearableField)}
                disabled={isSaving}
              />
            )}
          </div>
        )}

        {/* LateSnack */}
        {field === "lateSnack" && (
          <div className="space-y-3">
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
            {hasCurrentValue && (
              <DeleteButton onClick={() => onDelete("lateSnack")} disabled={isSaving} />
            )}
          </div>
        )}

        {/* 맞춤 입력 — 선택형 */}
        {field === "customFieldValue" && customFieldDef?.type === "select" && (
          <div className="space-y-3">
            <div className="flex flex-col gap-2">
              {(customFieldDef.options ?? []).map((opt) => (
                <button
                  key={opt}
                  onClick={() => onSave({ customFieldValue: opt })}
                  className={cn(
                    "w-full py-4 rounded-xl text-sm font-semibold min-h-[60px] transition-colors",
                    log.customFieldValue === opt
                      ? "bg-navy text-white"
                      : "bg-secondary text-foreground border border-border"
                  )}
                >
                  {opt}
                </button>
              ))}
            </div>
            {hasCurrentValue && (
              <DeleteButton onClick={() => onDelete("customFieldValue")} disabled={isSaving} />
            )}
          </div>
        )}

        {/* 맞춤 입력 — 직접 입력형 */}
        {field === "customFieldValue" && customFieldDef?.type === "text" && (
          <div className="space-y-3">
            <input
              type="text"
              placeholder={`${customFieldDef.name} 입력`}
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const trimmed = textValue.trim();
                  if (trimmed) onSave({ customFieldValue: trimmed });
                  else if (hasCurrentValue) onDelete("customFieldValue");
                  else onClose();
                }
              }}
              autoFocus
              className="w-full px-4 py-3 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-navy/20 min-h-[52px]"
            />
            <SaveButton
              onClick={() => {
                const trimmed = textValue.trim();
                if (trimmed) onSave({ customFieldValue: trimmed });
                else if (hasCurrentValue) onDelete("customFieldValue");
                else onClose();
              }}
              isSaving={isSaving}
            />
            {hasCurrentValue && (
              <DeleteButton onClick={() => onDelete("customFieldValue")} disabled={isSaving} />
            )}
          </div>
        )}

      </div>
    </div>
  );
}
