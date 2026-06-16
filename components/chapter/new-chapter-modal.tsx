"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import type { Settings } from "@/lib/types";
import { actionStartNewChapter } from "@/app/actions/chapter-actions";
import { getDayNumber, formatDate } from "@/lib/utils/date-utils";
import { DIET_PRESETS, computePresetMonths } from "@/lib/utils/diet-presets";

interface NewChapterModalProps {
  dietStartDate: string;
  currentTargetWeight: number;
  currentPreset: Settings["dietPreset"];
  currentTargetMonths: number;
  /** 새 챕터 시작 체중 기본값 (보통 최근 기록 체중) */
  defaultStartWeight: number;
  onSuccess: (settings: Settings) => void;
  onClose: () => void;
}

/** 오늘부터 N개월 뒤 날짜를 "YYYY년 M월 D일"로 */
function projectedEndLabel(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + Math.max(1, months));
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

export function NewChapterModal({
  dietStartDate,
  currentTargetWeight,
  currentPreset,
  currentTargetMonths,
  defaultStartWeight,
  onSuccess,
  onClose,
}: NewChapterModalProps) {
  const [targetWeight, setTargetWeight] = useState(
    currentTargetWeight > 0 ? String(currentTargetWeight) : ""
  );
  const [startWeight, setStartWeight] = useState(
    defaultStartWeight > 0 ? String(defaultStartWeight) : ""
  );
  const [preset, setPreset] = useState<Settings["dietPreset"]>(currentPreset);
  const [targetMonths, setTargetMonths] = useState(currentTargetMonths || 12);
  const [monthsInput, setMonthsInput] = useState(String(currentTargetMonths || 12));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = formatDate(new Date());
  const currentChapterDays = dietStartDate
    ? Math.max(getDayNumber(today, dietStartDate), 1)
    : 0;

  const tw = Number(targetWeight) || 0;
  const sw = Number(startWeight) || 0;
  const invalid = tw <= 0 || sw <= 0 || tw >= sw || targetMonths <= 0;

  // 시작/목표 체중·프리셋 변경 시 비커스텀 프리셋의 기간 자동 재계산 (설정·온보딩과 동일 로직)
  useEffect(() => {
    if (preset === "custom") return;
    const months = computePresetMonths(preset, sw, tw);
    setTargetMonths(months);
    setMonthsInput(String(months));
  }, [preset, sw, tw]);

  const handleConfirm = async () => {
    if (invalid || submitting) return;
    setSubmitting(true);
    setError(null);
    const result = await actionStartNewChapter({
      targetWeight: tw,
      startWeight: sw,
      dietPreset: preset,
      targetMonths,
    });
    if (result) {
      onSuccess(result);
    } else {
      setError("새 챕터 시작에 실패했어요. 잠시 후 다시 시도해주세요.");
      setSubmitting(false);
    }
  };

  const totalLoss = sw > 0 && tw > 0 && tw < sw ? Math.round((sw - tw) * 10) / 10 : 0;

  return (
    <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-black/50 px-4 py-6">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="bg-gradient-to-br from-navy to-[#0f1f33] px-6 py-5 text-white">
          <p className="text-xs font-semibold text-white/60 mb-1">새 출발</p>
          <h2 className="text-xl font-extrabold">새 챕터 시작하기</h2>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* 무슨 일이 일어나는지 명확히 */}
          <div className="space-y-2.5">
            <ConseqRow
              emoji="🏁"
              text={
                currentChapterDays > 0 ? (
                  <>
                    지금까지의 챕터(<b>{currentChapterDays}일</b>)가 종료되고{" "}
                    <b>명예의 전당</b>에 보관돼요
                  </>
                ) : (
                  <>지금 챕터가 종료되고 기록에 보관돼요</>
                )
              }
            />
            <ConseqRow emoji="📚" text={<>지금까지의 기록은 <b>하나도 사라지지 않아요</b></>} />
            <ConseqRow emoji="🔄" text={<><b>며칠째</b> 카운터가 오늘(Day 1)부터 다시 시작돼요</>} />
            <ConseqRow emoji="⚖️" text={<>시작 체중·목표·기간이 아래 값으로 새로 맞춰져요</>} />
          </div>

          {/* 체중 입력 */}
          <div className="space-y-3 pt-1">
            <Field label="새 시작 체중 (오늘)" value={startWeight} onChange={setStartWeight} suffix="kg" />
            <Field label="새 목표 체중" value={targetWeight} onChange={setTargetWeight} suffix="kg" />
            {tw > 0 && sw > 0 && tw >= sw && (
              <p className="text-xs text-red-500">목표 체중은 시작 체중보다 낮아야 해요</p>
            )}
          </div>

          {/* 프리셋(감량 속도) 선택 → 기간 자동 추천 */}
          <div className="space-y-1.5">
            <p className="text-sm text-muted-foreground">감량 속도</p>
            {DIET_PRESETS.map((p) => {
              const months = p.value !== "custom" ? computePresetMonths(p.value, sw, tw) : null;
              const rate = months && totalLoss > 0 ? (totalLoss / months).toFixed(1) : null;
              const desc =
                p.value === "custom"
                  ? "기간 직접 입력"
                  : months != null
                    ? `${months}개월 · 월 약 ${rate}kg`
                    : `월 약 ${p.ratePerMonth}kg`;
              return (
                <button
                  key={p.value}
                  onClick={() => setPreset(p.value as Settings["dietPreset"])}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-left min-h-[48px] transition-colors",
                    preset === p.value ? "border-navy bg-navy/5" : "border-border"
                  )}
                >
                  <span>
                    <span className="text-sm font-medium">{p.label}</span>
                    {p.badge && (
                      <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-navy text-white">
                        {p.badge}
                      </span>
                    )}
                    <span className="block text-xs text-muted-foreground mt-0.5">{desc}</span>
                  </span>
                  <span
                    className={cn(
                      "w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                      preset === p.value ? "border-navy" : "border-border"
                    )}
                  >
                    {preset === p.value && <span className="w-2 h-2 rounded-full bg-navy" />}
                  </span>
                </button>
              );
            })}
            {preset === "custom" && (
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  inputMode="numeric"
                  value={monthsInput}
                  onChange={(e) => {
                    setMonthsInput(e.target.value);
                    const n = parseInt(e.target.value, 10);
                    if (!isNaN(n) && n > 0) setTargetMonths(n);
                  }}
                  className="flex-1 px-3 py-2.5 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-navy/20 min-h-[44px]"
                  placeholder="목표 기간"
                />
                <span className="text-sm text-muted-foreground">개월</span>
              </div>
            )}
          </div>

          {/* 요약: 새 시작일 · 예상 종료일 */}
          <div className="px-3 py-2.5 bg-navy/5 border border-navy/10 rounded-xl text-xs space-y-1">
            <Row label="새 시작일" value={today} />
            <Row label="목표 기간" value={`${targetMonths}개월`} />
            <Row label="예상 종료일" value={projectedEndLabel(targetMonths)} />
            {totalLoss > 0 && <Row label="총 감량 목표" value={`${totalLoss}kg`} />}
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          {/* 버튼 */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              disabled={submitting}
              className="flex-1 py-3 rounded-full bg-secondary text-muted-foreground font-semibold text-sm min-h-[44px] disabled:opacity-50"
            >
              취소
            </button>
            <button
              onClick={handleConfirm}
              disabled={invalid || submitting}
              className={cn(
                "flex-[1.5] py-3 rounded-full font-bold text-sm min-h-[44px] transition-colors",
                invalid || submitting ? "bg-navy/40 text-white/70" : "bg-navy text-white hover:bg-navy/90"
              )}
            >
              {submitting ? "시작하는 중..." : "새 챕터 시작하기"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConseqRow({ emoji, text }: { emoji: string; text: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="text-base leading-5 mt-0.5">{emoji}</span>
      <p className="text-sm text-foreground leading-relaxed">{text}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  suffix,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  suffix?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <label className="text-sm text-muted-foreground">{label}</label>
      <div className="flex items-center gap-1">
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-24 text-right px-2 py-1.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-navy/20 min-h-[40px]"
        />
        {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  );
}
