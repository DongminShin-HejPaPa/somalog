"use client";

import { useState, useEffect, useRef } from "react";
import { X, Trash2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useKeyboardOffset } from "@/lib/hooks/use-keyboard-offset";
import { useModalFocusTrap } from "@/lib/hooks/use-modal-focus-trap";
import { PresetChips } from "./preset-chips";
import {
  MAX_PRESETS_PER_FIELD,
  canRegisterPreset,
  togglePresetInText,
} from "@/lib/utils/input-presets";
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
  /** 현재 항목에 등록된 자주 쓰는 메뉴 (운동/아침/점심/저녁/야식) */
  presets?: string[];
  /** 저장한 입력값을 자주 쓰는 메뉴로 등록 */
  onRegisterPreset?: (value: string) => void;
  /** 등록된 자주 쓰는 메뉴 삭제 */
  onDeletePreset?: (value: string) => void;
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
  className,
}: {
  onClick: () => void;
  disabled?: boolean;
  isSaving?: boolean;
  testId?: string;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || isSaving}
      data-testid={testId ?? "modal-save"}
      className={cn(
        "py-3 rounded-xl bg-navy text-white text-sm font-semibold min-h-[48px] disabled:opacity-40 flex items-center justify-center gap-2",
        className ?? "w-full"
      )}
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

function AlcoholToggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className={cn(
        "py-3 px-3 rounded-xl text-sm font-semibold min-h-[48px] w-[60px] shrink-0 transition-colors flex flex-col items-center justify-center gap-0.5",
        checked
          ? "bg-red-50 text-red-500 border border-red-200"
          : "bg-secondary text-muted-foreground border border-border"
      )}
    >
      <span className="text-base leading-none">🍺</span>
      <span className="text-[10px] leading-none font-normal">술</span>
    </button>
  );
}

/**
 * 텍스트 입력 + "자주 쓰는 메뉴" 등록 체크박스(위) + 등록된 칩 목록(아래).
 * 운동·아침·점심·저녁·야식이 공통으로 사용한다.
 */
function PresetTextField({
  value,
  onChange,
  onEnter,
  placeholder,
  testId,
  presets,
  register,
  onRegisterChange,
  onDeletePreset,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onEnter: () => void;
  placeholder: string;
  testId: string;
  presets: string[];
  register: boolean;
  onRegisterChange: (v: boolean) => void;
  onDeletePreset: (preset: string) => void;
  disabled?: boolean;
}) {
  const isFull = presets.length >= MAX_PRESETS_PER_FIELD;
  const alreadyRegistered = presets.includes(value.trim());
  const registerable = canRegisterPreset(presets, value);

  const label = alreadyRegistered
    ? "이미 자주 쓰는 메뉴예요"
    : isFull
      ? `자주 쓰는 메뉴가 가득 찼어요 (최대 ${MAX_PRESETS_PER_FIELD}개)`
      : "자주 이용하는 메뉴로 추가";

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => onRegisterChange(!register)}
        disabled={disabled || !registerable}
        data-testid="preset-register-check"
        aria-pressed={register && registerable}
        className={cn(
          "flex items-center gap-1.5 text-[11px] transition-colors",
          registerable && !disabled
            ? "text-muted-foreground hover:text-navy"
            : "text-muted-foreground/50 cursor-default"
        )}
      >
        <span
          className={cn(
            "w-4 h-4 rounded border flex items-center justify-center shrink-0",
            register && registerable
              ? "bg-navy border-navy text-white"
              : "bg-white border-border"
          )}
        >
          {register && registerable && <Check className="w-3 h-3" />}
        </span>
        {label}
        {registerable && (
          <span className="text-muted-foreground/60">
            ({presets.length}/{MAX_PRESETS_PER_FIELD})
          </span>
        )}
      </button>

      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onEnter()}
        autoFocus
        data-testid={testId}
        className="w-full px-4 py-3 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-navy/20 min-h-[52px]"
      />

      <PresetChips
        presets={presets}
        value={value}
        onToggle={(preset) => onChange(togglePresetInText(value, preset))}
        onDelete={onDeletePreset}
        disabled={disabled}
      />
    </div>
  );
}

export function InputModal({
  field,
  log,
  waterGoal,
  prevWeight,
  customFieldDef,
  presets = [],
  onRegisterPreset,
  onDeletePreset,
  isSaving,
  onSave,
  onDelete,
  onClose,
}: InputModalProps) {
  const [weightValue, setWeightValue] = useState("");
  const [waterValue, setWaterValue] = useState<number | null>(null);
  const [textValue, setTextValue] = useState("");
  const [dinnerAlcohol, setDinnerAlcohol] = useState(false);
  const [lateSnackAlcohol, setLateSnackAlcohol] = useState(false);
  const [lateSnackConnected, setLateSnackConnected] = useState(false);
  // "자주 이용하는 메뉴로 추가" 체크 상태 — 저장 시 프리셋으로 등록
  const [registerPreset, setRegisterPreset] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  // 블루투스 키보드로 전환되면 소프트 키보드는 사라지고 액세서리 바만 남는다 —
  // 하단 저장 버튼이 그 바에 가리지 않도록 최소 여백을 확보한다.
  const keyboardOffset = useKeyboardOffset({ accessoryBarFloor: true });

  // 액세서리 바의 이전/다음 필드 이동이 뒤 페이지 입력창으로 새는 것을 막는다.
  useModalFocusTrap(overlayRef, field !== null);

  // Pre-fill existing values when modal opens
  useEffect(() => {
    if (!field) return;
    setRegisterPreset(false);
    if (field === "weight") {
      setWeightValue(log.weight != null ? String(log.weight) : (prevWeight != null ? String(prevWeight) : "70"));
    } else if (field === "water") {
      setWaterValue(log.water ?? waterGoal);
    } else if (field === "exercise") {
      const v = log.exercise;
      setTextValue(!v || v === "Y" || v === "N" || v === "SKIP" ? "" : v);
    } else if (field === "breakfast") {
      setTextValue(log.breakfast === "SKIP" ? "" : (log.breakfast ?? ""));
    } else if (field === "lunch") {
      setTextValue(log.lunch === "SKIP" ? "" : (log.lunch ?? ""));
    } else if (field === "dinner") {
      setTextValue(log.dinner === "SKIP" ? "" : (log.dinner ?? ""));
      setDinnerAlcohol(log.dinnerAlcohol ?? false);
      setLateSnackConnected(false);
    } else if (field === "lateSnack") {
      const v = log.lateSnack;
      setTextValue(!v || v === "Y" || v === "N" || v === "SKIP" ? "" : v);
      setLateSnackAlcohol(log.lateSnackAlcohol ?? false);
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

  /** 체크되어 있으면 저장 직전에 입력값을 자주 쓰는 메뉴로 등록 */
  const registerIfChecked = (value: string) => {
    if (!registerPreset) return;
    if (!canRegisterPreset(presets, value)) return;
    onRegisterPreset?.(value.trim());
  };

  const handleExerciseSave = () => {
    const trimmed = textValue.trim();
    if (!trimmed) {
      if (log.exercise != null) onDelete("exercise");
      else onClose();
      return;
    }
    registerIfChecked(trimmed);
    onSave({ exercise: trimmed });
  };

  const handleMealSave = (mealField: "breakfast" | "lunch") => {
    const trimmed = textValue.trim();
    if (!trimmed) {
      if (log[mealField] != null) onDelete(mealField);
      else onClose();
      return;
    }
    registerIfChecked(trimmed);
    onSave({ [mealField]: trimmed } as DailyLogUpdate);
  };

  const handleDinnerSave = () => {
    const trimmed = textValue.trim();
    if (!trimmed) {
      if (log.dinner != null) onDelete("dinner");
      else onClose();
      return;
    }
    registerIfChecked(trimmed);
    const update: DailyLogUpdate = { dinner: trimmed, dinnerAlcohol };
    if (lateSnackConnected) update.lateSnack = "저녁 식사 연결";
    onSave(update);
  };

  const handleLateSnackSave = () => {
    const trimmed = textValue.trim();
    if (!trimmed) {
      if (log.lateSnack != null) onDelete("lateSnack");
      else onClose();
      return;
    }
    registerIfChecked(trimmed);
    onSave({ lateSnack: trimmed, lateSnackAlcohol });
  };

  const label = field === "customFieldValue"
    ? (customFieldDef?.name ?? "맞춤 입력")
    : fieldLabels[field as Exclude<ItemKey, "customFieldValue">];

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
      role="dialog"
      aria-modal="true"
      aria-label={`${label} 입력`}
      className="fixed inset-0 bg-black/40 z-[60] flex items-end justify-center"
    >
      {/*
        키보드 회피는 padding 이 아니라 transform 으로 처리한다.
        패딩을 늘렸다 줄이면 키보드가 사라지는 순간 시트 높이가 통째로 바뀌면서
        내용이 아래로 주저앉는다 (블루투스 키보드 전환 때 특히 눈에 띈다).
        transform 은 레이아웃을 건드리지 않아 부드럽게 따라 움직인다.
      */}
      <div
        className="w-full max-w-[480px] transition-transform duration-200 ease-out will-change-transform"
        style={{
          transform: `translate3d(0, -${keyboardOffset}px, 0)`,
          maxHeight: `calc(100dvh - ${keyboardOffset + 12}px)`,
        }}
      >
        <div
          className="bg-white rounded-t-2xl px-4 pt-4 max-h-[inherit] overflow-y-auto overscroll-contain animate-in slide-in-from-bottom-4"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)" }}
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
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">{sliderMin}kg</span>
                <span className="text-xl font-bold text-navy">
                  {weightValue || weightAnchor.toFixed(1)} kg
                </span>
                <span className="text-xs text-muted-foreground">{sliderMax}kg</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const next = Math.round((sliderValue - 0.1) * 10) / 10;
                    if (next >= sliderMin) setWeightValue(String(next));
                  }}
                  className="w-9 h-9 flex items-center justify-center rounded-lg bg-secondary border border-border text-foreground text-lg font-semibold shrink-0 hover:bg-border transition-colors"
                >
                  −
                </button>
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
                  className="flex-1 h-2 rounded-full appearance-none cursor-pointer accent-navy bg-secondary"
                />
                <button
                  type="button"
                  onClick={() => {
                    const next = Math.round((sliderValue + 0.1) * 10) / 10;
                    if (next <= sliderMax) setWeightValue(String(next));
                  }}
                  className="w-9 h-9 flex items-center justify-center rounded-lg bg-secondary border border-border text-foreground text-lg font-semibold shrink-0 hover:bg-border transition-colors"
                >
                  +
                </button>
              </div>
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
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">0L</span>
                <span className="text-xl font-bold text-navy">
                  {waterValue != null ? waterValue.toFixed(1) : "0.0"}L
                </span>
                <span className="text-xs text-muted-foreground">4L</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const next = Math.round(((waterValue ?? 0) - 0.1) * 10) / 10;
                    if (next >= 0) setWaterValue(next);
                  }}
                  className="w-9 h-9 flex items-center justify-center rounded-lg bg-secondary border border-border text-foreground text-lg font-semibold shrink-0 hover:bg-border transition-colors"
                >
                  −
                </button>
                <input
                  type="range"
                  min={0}
                  max={4}
                  step={0.1}
                  value={waterValue ?? 0}
                  onChange={(e) => setWaterValue(Math.round(Number(e.target.value) * 10) / 10)}
                  className="flex-1 h-2 rounded-full appearance-none cursor-pointer accent-navy bg-secondary"
                />
                <button
                  type="button"
                  onClick={() => {
                    const next = Math.round(((waterValue ?? 0) + 0.1) * 10) / 10;
                    if (next <= 4) setWaterValue(next);
                  }}
                  className="w-9 h-9 flex items-center justify-center rounded-lg bg-secondary border border-border text-foreground text-lg font-semibold shrink-0 hover:bg-border transition-colors"
                >
                  +
                </button>
              </div>
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

        {/* 운동 — 텍스트 입력 + 안 했음 */}
        {field === "exercise" && (
          <div className="space-y-3">
            <PresetTextField
              value={textValue}
              onChange={setTextValue}
              onEnter={handleExerciseSave}
              placeholder="예: 헬스 1시간, 줄넘기 30분, 산책"
              testId="modal-exercise-input"
              presets={presets}
              register={registerPreset}
              onRegisterChange={setRegisterPreset}
              onDeletePreset={(p) => onDeletePreset?.(p)}
              disabled={isSaving}
            />
            <SaveButton onClick={handleExerciseSave} isSaving={isSaving} />
            <button
              type="button"
              onClick={() => onSave({ exercise: "SKIP" })}
              disabled={isSaving}
              data-testid="modal-exercise-skip"
              className={cn(
                "w-full py-3 rounded-xl text-sm font-semibold min-h-[48px] transition-colors",
                log.exercise === "SKIP" || log.exercise === "N"
                  ? "bg-coral text-white"
                  : "bg-secondary text-foreground border border-border hover:border-coral/40 hover:text-coral"
              )}
            >
              안 했음
            </button>
            {hasCurrentValue && (
              <DeleteButton onClick={() => onDelete("exercise")} disabled={isSaving} />
            )}
          </div>
        )}

        {/* 아침 / 점심 */}
        {(field === "breakfast" || field === "lunch") && (
          <div className="space-y-3">
            <PresetTextField
              value={textValue}
              onChange={setTextValue}
              onEnter={() => handleMealSave(field)}
              placeholder="예: 버섯크림파스타와 콜라ㅠㅠ, 한식 소식, 고칼로리 식단"
              testId="modal-meal-input"
              presets={presets}
              register={registerPreset}
              onRegisterChange={setRegisterPreset}
              onDeletePreset={(p) => onDeletePreset?.(p)}
              disabled={isSaving}
            />
            <SaveButton onClick={() => handleMealSave(field)} isSaving={isSaving} />
            <button
              type="button"
              onClick={() => onSave({ [field]: "SKIP" } as DailyLogUpdate)}
              disabled={isSaving}
              data-testid="modal-meal-skip"
              className={cn(
                "w-full py-3 rounded-xl text-sm font-semibold min-h-[48px] transition-colors",
                log[field] === "SKIP"
                  ? "bg-coral text-white"
                  : "bg-secondary text-foreground border border-border hover:border-coral/40 hover:text-coral"
              )}
            >
              안 먹음
            </button>
            {hasCurrentValue && (
              <DeleteButton
                onClick={() => onDelete(field as ClearableField)}
                disabled={isSaving}
              />
            )}
          </div>
        )}

        {/* 저녁 — 텍스트 + 술 토글 + 야식 연결 */}
        {field === "dinner" && (
          <div className="space-y-3">
            <PresetTextField
              value={textValue}
              onChange={setTextValue}
              onEnter={handleDinnerSave}
              placeholder="예: 버섯크림파스타와 콜라ㅠㅠ, 한식 소식, 고칼로리 식단"
              testId="modal-meal-input"
              presets={presets}
              register={registerPreset}
              onRegisterChange={setRegisterPreset}
              onDeletePreset={(p) => onDeletePreset?.(p)}
              disabled={isSaving}
            />
            <div className="flex gap-2">
              <SaveButton onClick={handleDinnerSave} isSaving={isSaving} className="flex-1 py-3" />
              <AlcoholToggle checked={dinnerAlcohol} onChange={setDinnerAlcohol} disabled={isSaving} />
            </div>
            {/* 야식 연결 토글 */}
            <button
              type="button"
              onClick={() => setLateSnackConnected(!lateSnackConnected)}
              className={cn(
                "w-full py-2.5 px-4 rounded-xl text-sm font-medium min-h-[44px] flex items-center justify-between transition-colors",
                lateSnackConnected
                  ? "bg-navy/10 text-navy border border-navy/30"
                  : "bg-secondary text-muted-foreground border border-border hover:border-navy/30"
              )}
            >
              <span>🌙 야식 연결</span>
              <div className={cn(
                "relative w-10 h-6 rounded-full transition-colors shrink-0",
                lateSnackConnected ? "bg-navy" : "bg-border"
              )}>
                <div className={cn(
                  "absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform",
                  lateSnackConnected ? "translate-x-5" : "translate-x-1"
                )} />
              </div>
            </button>
            <button
              type="button"
              onClick={() => onSave({ dinner: "SKIP" })}
              disabled={isSaving}
              data-testid="modal-meal-skip"
              className={cn(
                "w-full py-3 rounded-xl text-sm font-semibold min-h-[48px] transition-colors",
                log.dinner === "SKIP"
                  ? "bg-coral text-white"
                  : "bg-secondary text-foreground border border-border hover:border-coral/40 hover:text-coral"
              )}
            >
              안 먹음
            </button>
            {hasCurrentValue && (
              <DeleteButton onClick={() => onDelete("dinner")} disabled={isSaving} />
            )}
          </div>
        )}

        {/* 야식 — 텍스트 + 술 토글 + 안 먹음 */}
        {field === "lateSnack" && (
          <div className="space-y-3">
            <PresetTextField
              value={textValue}
              onChange={setTextValue}
              onEnter={handleLateSnackSave}
              placeholder="예: 치킨, 라면, 과자"
              testId="modal-late-snack-input"
              presets={presets}
              register={registerPreset}
              onRegisterChange={setRegisterPreset}
              onDeletePreset={(p) => onDeletePreset?.(p)}
              disabled={isSaving}
            />
            <div className="flex gap-2">
              <SaveButton onClick={handleLateSnackSave} isSaving={isSaving} className="flex-1 py-3" />
              <AlcoholToggle checked={lateSnackAlcohol} onChange={setLateSnackAlcohol} disabled={isSaving} />
            </div>
            <button
              type="button"
              onClick={() => onSave({ lateSnack: "SKIP" })}
              disabled={isSaving}
              data-testid="modal-late-snack-skip"
              className={cn(
                "w-full py-3 rounded-xl text-sm font-semibold min-h-[48px] transition-colors",
                log.lateSnack === "SKIP" || log.lateSnack === "N"
                  ? "bg-navy text-white"
                  : "bg-secondary text-foreground border border-border hover:border-navy/30"
              )}
            >
              안 먹음
            </button>
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
    </div>
  );
}
