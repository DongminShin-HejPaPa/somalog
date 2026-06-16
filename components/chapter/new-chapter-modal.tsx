"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { Settings } from "@/lib/types";
import { actionStartNewChapter } from "@/app/actions/chapter-actions";
import { getDayNumber, formatDate } from "@/lib/utils/date-utils";

interface NewChapterModalProps {
  dietStartDate: string;
  currentTargetWeight: number;
  /** 새 챕터 시작 체중 기본값 (보통 최근 기록 체중) */
  defaultStartWeight: number;
  onSuccess: (settings: Settings) => void;
  onClose: () => void;
}

export function NewChapterModal({
  dietStartDate,
  currentTargetWeight,
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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = formatDate(new Date());
  const currentChapterDays = dietStartDate
    ? Math.max(getDayNumber(today, dietStartDate), 1)
    : 0;

  const tw = Number(targetWeight) || 0;
  const sw = Number(startWeight) || 0;
  const invalid = tw <= 0 || sw <= 0 || tw >= sw;

  const handleConfirm = async () => {
    if (invalid || submitting) return;
    setSubmitting(true);
    setError(null);
    const result = await actionStartNewChapter({
      targetWeight: tw,
      startWeight: sw,
    });
    if (result) {
      onSuccess(result);
    } else {
      setError("새 챕터 시작에 실패했어요. 잠시 후 다시 시도해주세요.");
      setSubmitting(false);
    }
  };

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
            <ConseqRow emoji="⚖️" text={<>시작 체중과 목표가 아래 값으로 새로 맞춰져요</>} />
          </div>

          {/* 입력 */}
          <div className="space-y-3 pt-1">
            <Field
              label="새 시작 체중 (오늘)"
              value={startWeight}
              onChange={setStartWeight}
              suffix="kg"
            />
            <Field
              label="새 목표 체중"
              value={targetWeight}
              onChange={setTargetWeight}
              suffix="kg"
            />
            <p className="text-xs text-muted-foreground">
              새 시작일: <b>{today}</b> · 이전 챕터는 그대로 보존돼요
            </p>
            {tw > 0 && sw > 0 && tw >= sw && (
              <p className="text-xs text-red-500">목표 체중은 시작 체중보다 낮아야 해요</p>
            )}
            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>

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
                invalid || submitting
                  ? "bg-navy/40 text-white/70"
                  : "bg-navy text-white hover:bg-navy/90"
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
