"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useSettings } from "@/lib/contexts/settings-context";
import type { Settings } from "@/lib/types";
import Link from "next/link";
import { LogOut, UserPen, ChevronRight } from "lucide-react";
import { serverResetAllData, serverLoadDemoData } from "@/app/actions/data-actions";
import { logout } from "@/app/actions/auth-actions";
import { AccountInfoDialog } from "./account-info-dialog";

type DialogState = "idle" | "confirm-reset" | "confirm-onboarding" | "confirm-demo";

const coachStyles = [
  { value: "strong", label: "팩트 위주 / 강한 코치", desc: "위로보다 수치와 사실로 강하게" },
  { value: "balanced", label: "균형잡힌 조언", desc: "팩트 기반 + 격려 병행" },
  { value: "empathy", label: "위로와 공감 중심", desc: "부드럽게, 정서 우선" },
  { value: "data", label: "데이터 리포터", desc: "감정 없이 수치와 트렌드만" },
];

const dietPresets = [
  { value: "easygoing", label: "여유롭게", months: 18, coaching: "코칭 보통" },
  { value: "sustainable", label: "착실하게", months: 12, coaching: "코칭 보통", badge: "추천" },
  { value: "medium", label: "집중해서", months: 6, coaching: "코칭 높음" },
  { value: "intensive", label: "전력 질주", months: 3, coaching: "코칭 최강" },
  { value: "custom", label: "내가 정할게", months: 0, coaching: "" },
];

// 각 프리셋의 고정 월간 감량 속도 (kg/월)
const presetRates: Partial<Record<string, number>> = {
  easygoing: 0.5, sustainable: 0.75, medium: 1.5, intensive: 3.0,
};

function computePresetMonths(preset: string, startWeight: number, targetWeight: number): number {
  const rate = presetRates[preset];
  if (!rate || startWeight <= 0 || targetWeight <= 0 || targetWeight >= startWeight) {
    const defaults: Record<string, number> = { easygoing: 18, sustainable: 12, medium: 6, intensive: 3 };
    return defaults[preset] ?? 12;
  }
  return Math.max(1, Math.ceil((startWeight - targetWeight) / rate));
}

function getDietPresetDesc(preset: typeof dietPresets[0], startWeight: number, targetWeight: number): string {
  if (preset.value === "custom") return "목표 기간 직접 입력";
  const rate = presetRates[preset.value];
  const months = computePresetMonths(preset.value, startWeight, targetWeight);
  const hasValidWeights = startWeight > 0 && targetWeight > 0 && targetWeight < startWeight;
  return hasValidWeights && rate
    ? `${months}개월, ~${rate}kg/월, ${preset.coaching}`
    : `${months}개월, ${preset.coaching}`;
}

const presetMonths: Partial<Record<string, number>> = {
  easygoing: 18, sustainable: 12, medium: 6, intensive: 3,
};

const PRESET_CRITERIA = ["역대최저", "0.5kg", "1.0kg"];

const intensiveCriteria = [
  { value: "역대최저", label: "역대 최저 체중 초과 시", desc: "가장 엄격 (추천)" },
  { value: "0.5kg", label: "최저 +0.5kg 초과 시", desc: "소폭 완화" },
  { value: "1.0kg", label: "최저 +1.0kg 초과 시", desc: "관대한 기준" },
  { value: "직접입력", label: "직접 기준 입력", desc: "" },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-4 border-b border-border">
      <h3 className="text-sm font-semibold mb-3">{title}</h3>
      {children}
    </div>
  );
}

function InputField({
  label,
  value,
  suffix,
  onChange,
  testId,
  inputMode,
  type,
}: {
  label: string;
  value: string;
  suffix?: string;
  onChange: (v: string) => void;
  testId?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  type?: string;
}) {
  const [localVal, setLocalVal] = useState(value);

  // 부모에서 value가 바뀌면 (예: 프리셋 선택) 동기화
  useEffect(() => {
    setLocalVal(value);
  }, [value]);

  return (
    <div className="flex items-center justify-between py-2">
      <label className="text-sm text-muted-foreground">{label}</label>
      <div className="flex items-center gap-1">
        <input
          type={type ?? "text"}
          inputMode={inputMode}
          value={localVal}
          onChange={(e) => setLocalVal(e.target.value)}
          onBlur={() => onChange(localVal)}
          onKeyDown={(e) => { if (e.key === "Enter") onChange(localVal); }}
          data-testid={testId}
          className="w-24 text-right px-2 py-1.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-navy/20 min-h-[36px]"
        />
        {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  );
}

/** 루틴/코치스타일 추가 항목 리스트 — 추가/수정/삭제 지원 */
function ExtraItemList({
  items,
  placeholder,
  onChange,
}: {
  items: string[];
  placeholder: string;
  onChange: (items: string[]) => void;
}) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [newValue, setNewValue] = useState("");

  const handleEditStart = (i: number) => {
    setEditingIndex(i);
    setEditingValue(items[i]);
  };

  const handleEditSave = (i: number) => {
    if (!editingValue.trim()) return;
    const updated = [...items];
    updated[i] = editingValue.trim();
    onChange(updated);
    setEditingIndex(null);
  };

  const handleEditCancel = () => {
    setEditingIndex(null);
    setEditingValue("");
  };

  const handleDelete = (i: number) => {
    onChange(items.filter((_, idx) => idx !== i));
    if (editingIndex === i) setEditingIndex(null);
  };

  const handleAddConfirm = () => {
    if (!newValue.trim()) return;
    onChange([...items, newValue.trim()]);
    setIsAdding(false);
    setNewValue("");
  };

  const handleAddCancel = () => {
    setIsAdding(false);
    setNewValue("");
  };

  return (
    <div className="space-y-1.5 mt-2">
      {items.map((item, i) =>
        editingIndex === i ? (
          <div key={i} className="flex items-center gap-2">
            <input
              type="text"
              value={editingValue}
              onChange={(e) => setEditingValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleEditSave(i);
                if (e.key === "Escape") handleEditCancel();
              }}
              autoFocus
              className="flex-1 px-2 py-1.5 text-sm border border-navy rounded-lg focus:outline-none focus:ring-2 focus:ring-navy/20 min-h-[36px]"
            />
            <button
              onClick={() => handleEditSave(i)}
              className="px-2 py-1 text-sm text-navy font-medium min-h-[36px]"
            >
              저장
            </button>
            <button
              onClick={handleEditCancel}
              className="px-2 py-1 text-sm text-muted-foreground min-h-[36px]"
            >
              취소
            </button>
          </div>
        ) : (
          <div key={i} className="flex items-center gap-2 py-1.5 px-3 bg-secondary rounded-lg">
            <span className="flex-1 text-sm truncate">{item}</span>
            <button
              onClick={() => handleEditStart(i)}
              className="text-xs text-navy px-2 py-1 rounded hover:bg-navy/10 transition-colors"
            >
              수정
            </button>
            <button
              onClick={() => handleDelete(i)}
              className="text-xs text-coral px-2 py-1 rounded hover:bg-coral/10 transition-colors"
            >
              삭제
            </button>
          </div>
        )
      )}
      {isAdding ? (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddConfirm();
              if (e.key === "Escape") handleAddCancel();
            }}
            placeholder={placeholder}
            autoFocus
            className="flex-1 px-2 py-1.5 text-sm border border-navy rounded-lg focus:outline-none focus:ring-2 focus:ring-navy/20 min-h-[36px]"
          />
          <button
            onClick={handleAddConfirm}
            className="px-2 py-1 text-sm text-navy font-medium min-h-[36px]"
          >
            추가
          </button>
          <button
            onClick={handleAddCancel}
            className="px-2 py-1 text-sm text-muted-foreground min-h-[36px]"
          >
            취소
          </button>
        </div>
      ) : (
        <button
          onClick={() => setIsAdding(true)}
          className="text-sm text-navy font-medium mt-1"
        >
          + 추가
        </button>
      )}
    </div>
  );
}

export function SettingsForm() {
  const { settings, updateSettings, resetAllSettings, loadDemoSettings, isLoaded } = useSettings();
  const [form, setForm] = useState<Settings>(settings);
  const [saved, setSaved] = useState(false);
  const [dialog, setDialog] = useState<DialogState>("idle");
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showAccountInfo, setShowAccountInfo] = useState(false);
  const [isPending, startTransition] = useTransition();
  // 직접입력 기준 임시 입력값
  const [customCriteria, setCustomCriteria] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (isLoaded) {
      setForm(settings);
      // 저장된 값이 프리셋이 아닌 경우 커스텀 값으로 복원
      if (!PRESET_CRITERIA.includes(settings.intensiveDayCriteria) &&
          settings.intensiveDayCriteria !== "직접입력") {
        setCustomCriteria(settings.intensiveDayCriteria);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded]);

  const handleChange = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      // startWeight / targetWeight 변경 시 비커스텀 프리셋의 목표 기간 자동 재계산
      if ((key === "startWeight" || key === "targetWeight") && prev.dietPreset !== "custom") {
        const sw = key === "startWeight" ? (value as number) : prev.startWeight;
        const tw = key === "targetWeight" ? (value as number) : prev.targetWeight;
        next.targetMonths = computePresetMonths(prev.dietPreset, sw, tw);
      }
      return next;
    });
    setSaved(false);
  };

  const handlePresetChange = (value: Settings["dietPreset"]) => {
    setForm((prev) => ({
      ...prev,
      dietPreset: value,
      ...(value !== "custom"
        ? { targetMonths: computePresetMonths(value, prev.startWeight, prev.targetWeight) }
        : {}),
    }));
    setSaved(false);
  };

  // 의미적 검증
  const formErrors: string[] = [];
  if (form.startWeight > 0 && form.targetWeight > 0 && form.targetWeight >= form.startWeight) {
    formErrors.push("목표 체중이 시작 체중 이상입니다");
  }
  if (form.targetMonths <= 0) {
    formErrors.push("목표 기간은 1개월 이상이어야 합니다");
  }

  const handleSave = () => {
    if (formErrors.length > 0) return;
    // currentWeight는 startWeight와 동기화 (설정에서는 startWeight만 노출)
    updateSettings({ ...form, currentWeight: form.startWeight });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  /** 데이터 초기화 확인 → 서버 + 클라이언트 모두 리셋 → 온보딩 재시작 여부 묻기 */
  const handleResetConfirm = () => {
    startTransition(async () => {
      await serverResetAllData();
      resetAllSettings();
      setDialog("confirm-onboarding");
    });
  };

  /** 데모 데이터 불러오기 확인 → 서버 + 클라이언트 모두 데모 데이터로 교체 */
  const handleDemoConfirm = () => {
    startTransition(async () => {
      await serverLoadDemoData();
      loadDemoSettings();
      setDialog("idle");
      router.refresh();
    });
  };

  // 직접입력 선택 여부: 저장된 값이 프리셋 중 하나가 아니면 직접입력 상태
  const isCustomCriteriaSelected =
    !PRESET_CRITERIA.includes(form.intensiveDayCriteria) &&
    form.intensiveDayCriteria !== "직접입력";
  const criteriaButtonValue = isCustomCriteriaSelected ? "직접입력" : form.intensiveDayCriteria;

  // 수분 권장량 계산 (시작 체중 × 0.033L)
  const recommendedWater =
    form.startWeight > 0
      ? Math.round(form.startWeight * 0.033 * 10) / 10
      : null;

  return (
    <div>
      {/* 공지사항 메뉴 */}
      <Link
        href="/settings/notices"
        className="flex items-center justify-between px-4 py-4 border-b border-border hover:bg-secondary/50 active:bg-secondary transition-colors"
      >
        <span className="text-sm font-semibold">공지사항</span>
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
      </Link>

      <Section title="코치 이름">
        <InputField
          label="이름"
          value={form.coachName}
          onChange={(v) => handleChange("coachName", v)}
          testId="settings-coach-name"
        />
        <p className="text-xs text-muted-foreground mt-1">최대 10자</p>
      </Section>

      <Section title="신체 정보">
        <InputField
          label="키"
          value={form.height.toString()}
          suffix="cm"
          inputMode="decimal"
          onChange={(v) => handleChange("height", Number(v) || 0)}
        />
        <div className="flex items-center justify-between py-2">
          <label className="text-sm text-muted-foreground">성별</label>
          <div className="flex gap-1.5">
            {(["남성", "여성"] as const).map((g) => (
              <button
                key={g}
                onClick={() => handleChange("gender", g)}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-sm font-medium min-h-[36px] transition-colors",
                  form.gender === g
                    ? "bg-navy text-white"
                    : "bg-secondary text-muted-foreground"
                )}
              >
                {g}
              </button>
            ))}
          </div>
        </div>
      </Section>

      <Section title="다이어트 목표">
        <div className="space-y-2 mb-3">
          {dietPresets.map((p) => (
            <div key={p.value}>
              <button
                onClick={() => handlePresetChange(p.value as Settings["dietPreset"])}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-3 rounded-xl border text-left min-h-[52px] transition-colors",
                  form.dietPreset === p.value
                    ? "border-navy bg-navy/5"
                    : "border-border"
                )}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{p.label}</span>
                    {p.badge && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-navy text-white">
                        {p.badge}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">{getDietPresetDesc(p, form.startWeight, form.targetWeight)}</span>
                </div>
                <div
                  className={cn(
                    "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                    form.dietPreset === p.value ? "border-navy" : "border-border"
                  )}
                >
                  {form.dietPreset === p.value && (
                    <div className="w-2.5 h-2.5 rounded-full bg-navy" />
                  )}
                </div>
              </button>
              {/* 내가 정할게 선택 시 목표기간 인라인 표시 */}
              {p.value === "custom" && form.dietPreset === "custom" && (
                <div className="mt-2 ml-2 pl-3 border-l-2 border-navy/30">
                  <InputField
                    label="목표 기간"
                    value={form.targetMonths.toString()}
                    suffix="개월"
                    inputMode="numeric"
                    onChange={(v) => handleChange("targetMonths", Number(v) || 0)}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
        <InputField
          label="시작일"
          value={form.dietStartDate}
          type="date"
          onChange={(v) => handleChange("dietStartDate", v)}
        />
        <InputField
          label="시작 체중"
          value={form.startWeight.toString()}
          suffix="kg"
          inputMode="decimal"
          onChange={(v) => handleChange("startWeight", Number(v) || 0)}
        />
        <InputField
          label="목표 체중"
          value={form.targetWeight.toString()}
          suffix="kg"
          inputMode="decimal"
          onChange={(v) => handleChange("targetWeight", Number(v) || 0)}
        />
        {form.startWeight > 0 && form.targetWeight > 0 && form.targetWeight >= form.startWeight && (
          <p className="text-xs text-red-500 pb-1">목표 체중이 시작 체중 이상입니다</p>
        )}
        {/* 커스텀이 아닌 경우에만 목표 기간 별도 표시 */}
        {form.dietPreset !== "custom" && (
          <InputField
            label="목표 기간"
            value={form.targetMonths.toString()}
            suffix="개월"
            inputMode="numeric"
            onChange={(v) => {
              const n = Number(v);
              if (n > 0) handleChange("targetMonths", n);
            }}
          />
        )}
        {form.dietPreset !== "custom" && form.targetMonths <= 0 && (
          <p className="text-xs text-red-500 pb-1">목표 기간은 1개월 이상이어야 합니다</p>
        )}
        <div className="flex items-center justify-between py-2">
          <span className="text-sm text-muted-foreground">총 감량 목표</span>
          <span className="text-sm font-medium">
            {(form.startWeight - form.targetWeight).toFixed(1)} kg
          </span>
        </div>
        <div className="flex items-center justify-between py-2">
          <span className="text-sm text-muted-foreground">월 평균 목표</span>
          <span className="text-sm font-medium">
            {form.targetMonths > 0
              ? ((form.startWeight - form.targetWeight) / form.targetMonths).toFixed(1)
              : "0.0"}{" "}
            kg/월
          </span>
        </div>
      </Section>

      <Section title="하루 수분 목표">
        <InputField
          label="수분 목표"
          value={form.waterGoal.toFixed(1)}
          suffix="L"
          inputMode="decimal"
          onChange={(v) => handleChange("waterGoal", Number(v) || 0)}
        />
        <p className="text-xs text-muted-foreground mt-1">
          {recommendedWater !== null ? (
            <>
              신체 정보 기반 권장: {recommendedWater}L
              <button
                onClick={() => handleChange("waterGoal", recommendedWater)}
                className="ml-2 text-navy font-medium underline"
              >
                권장값으로 변경
              </button>
            </>
          ) : (
            "현재 체중을 입력하면 권장값을 계산해드려요"
          )}
        </p>
      </Section>

      <Section title="나의 루틴">
        <InputField
          label="몸무게 측정"
          value={form.routineWeightTime}
          onChange={(v) => handleChange("routineWeightTime", v)}
        />
<p className="text-xs text-muted-foreground mt-3 mb-1 font-medium">추가 루틴</p>
        <ExtraItemList
          items={form.routineExtra}
          placeholder="루틴 설명 (예: 점심 후 10분 산책)"
          onChange={(items) => handleChange("routineExtra", items)}
        />
        <p className="text-xs text-muted-foreground mt-3 p-2 bg-secondary rounded-lg">
          루틴 설정은 AI 코치 맥락 필터링에 사용됩니다. 잘못 설정하면 맥락에 맞지 않는 조언을 받을 수 있어요.
        </p>
      </Section>

      <Section title="Hard Reset Mode">
        <div className="flex items-center justify-between py-2 mb-3">
          <span className="text-sm">사용 여부</span>
          <button
            onClick={() => handleChange("intensiveDayOn", !form.intensiveDayOn)}
            className={cn(
              "relative w-12 h-7 rounded-full transition-colors",
              form.intensiveDayOn ? "bg-navy" : "bg-border"
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform",
                form.intensiveDayOn ? "left-[22px]" : "left-0.5"
              )}
            />
          </button>
        </div>
        <div className="space-y-2">
          {intensiveCriteria.map((c) => (
            <button
              key={c.value}
              onClick={() => {
                if (c.value === "직접입력") {
                  // 직접입력 선택 시: 기존 커스텀 값 유지, 아직 폼에 반영하지 않음
                  handleChange("intensiveDayCriteria", customCriteria || "직접입력");
                } else {
                  handleChange("intensiveDayCriteria", c.value);
                }
              }}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-left min-h-[44px] transition-colors",
                criteriaButtonValue === c.value
                  ? "border-navy bg-navy/5"
                  : "border-border"
              )}
            >
              <div>
                <span className="text-sm">{c.label}</span>
                {c.value === "직접입력" && isCustomCriteriaSelected && (
                  <span className="text-xs text-navy ml-2 font-medium">
                    (현재: +{form.intensiveDayCriteria}kg)
                  </span>
                )}
                {c.desc && (
                  <span className="text-xs text-muted-foreground ml-2">{c.desc}</span>
                )}
              </div>
              <div
                className={cn(
                  "w-4 h-4 rounded-full border-2 flex items-center justify-center",
                  criteriaButtonValue === c.value ? "border-navy" : "border-border"
                )}
              >
                {criteriaButtonValue === c.value && (
                  <div className="w-2 h-2 rounded-full bg-navy" />
                )}
              </div>
            </button>
          ))}
        </div>
        {/* 직접입력 선택 시 커스텀 값 입력 */}
        {criteriaButtonValue === "직접입력" && (
          <div className="mt-3 p-3 bg-secondary rounded-xl">
            <p className="text-xs text-muted-foreground mb-2">
              최저 체중 대비 초과 기준 (kg)
            </p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                min="0"
                value={customCriteria}
                onChange={(e) => setCustomCriteria(e.target.value)}
                placeholder="예: 1.5"
                className="flex-1 px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-navy/20 min-h-[40px]"
              />
              <span className="text-sm text-muted-foreground">kg</span>
              <button
                onClick={() => {
                  const val = parseFloat(customCriteria);
                  if (!isNaN(val) && val >= 0) {
                    handleChange("intensiveDayCriteria", customCriteria);
                  }
                }}
                className="px-3 py-2 text-sm bg-navy text-white rounded-lg font-medium min-h-[40px]"
              >
                적용
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              예: 1.5 입력 시 최저 체중 +1.5kg 초과할 때 Hard Reset
            </p>
          </div>
        )}
      </Section>

      <Section title="코치 스타일">
        <div className="space-y-2 mb-3">
          {coachStyles.map((s) => (
            <button
              key={s.value}
              onClick={() =>
                handleChange("coachStylePreset", s.value as Settings["coachStylePreset"])
              }
              className={cn(
                "w-full flex items-center justify-between px-3 py-3 rounded-xl border text-left min-h-[52px] transition-colors",
                form.coachStylePreset === s.value
                  ? "border-navy bg-navy/5"
                  : "border-border"
              )}
            >
              <div>
                <span className="text-sm font-medium">{s.label}</span>
                <p className="text-xs text-muted-foreground">{s.desc}</p>
              </div>
              <div
                className={cn(
                  "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                  form.coachStylePreset === s.value ? "border-navy" : "border-border"
                )}
              >
                {form.coachStylePreset === s.value && (
                  <div className="w-2.5 h-2.5 rounded-full bg-navy" />
                )}
              </div>
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mb-1 font-medium">추가 지시사항</p>
        <ExtraItemList
          items={form.coachStyleExtra}
          placeholder="예: 아침에는 부드럽게 말해줘"
          onChange={(items) => handleChange("coachStyleExtra", items)}
        />
        <p className="text-xs text-muted-foreground mt-2">
          10개 초과 시 조언 품질이 저하될 수 있어요
        </p>
      </Section>

      <Section title="앱 진입 기본 탭">
        <div className="flex gap-2">
          {(
            [
              { value: "input", label: "입력 탭" },
              { value: "home", label: "홈 탭" },
            ] as const
          ).map((t) => (
            <button
              key={t.value}
              onClick={() => handleChange("defaultTab", t.value)}
              className={cn(
                "flex-1 py-2.5 rounded-xl text-sm font-medium min-h-[44px] transition-colors",
                form.defaultTab === t.value
                  ? "bg-navy text-white"
                  : "bg-secondary text-muted-foreground border border-border"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </Section>

      {/* 저장 버튼 */}
      <div className="px-4 py-4 border-b border-border">
        <button
          onClick={handleSave}
          data-testid="settings-save"
          className={cn(
            "w-full py-3 rounded-xl text-sm font-semibold min-h-[48px] transition-colors",
            saved
              ? "bg-success text-white"
              : "bg-navy text-white active:scale-[0.98]"
          )}
        >
          {saved ? "저장 완료" : "저장"}
        </button>
      </div>

      {/* 초기 설정 다시 하기 */}
      <div className="px-4 py-4 border-b border-border">
        <Link
          href="/onboarding"
          className="block w-full py-3 rounded-xl text-center text-sm font-medium text-coral border border-coral/30 hover:bg-coral-light transition-colors min-h-[48px] leading-[48px]"
        >
          초기 설정 다시 하기
        </Link>
      </div>

      {/* 데이터 관리 */}
      <div className="px-4 py-4 space-y-3 pb-8">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          데이터 관리
        </h3>

        {dialog === "idle" && (
          <>
            <button
              onClick={() => setDialog("confirm-demo")}
              data-testid="settings-demo"
              className="w-full py-3 rounded-xl text-sm font-medium min-h-[48px] bg-secondary text-foreground border border-border hover:bg-secondary/80 transition-colors"
            >
              데모 데이터 불러오기
            </button>
            <button
              onClick={() => setDialog("confirm-reset")}
              data-testid="settings-reset"
              className="w-full py-3 rounded-xl text-sm font-medium min-h-[48px] text-coral border border-coral/30 hover:bg-coral-light transition-colors"
            >
              데이터 초기화
            </button>
          </>
        )}

        {dialog === "confirm-reset" && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-sm font-semibold text-red-800 mb-1">
              모든 기록과 설정이 삭제됩니다
            </p>
            <p className="text-xs text-red-600 mb-4">
              일별 기록, 주간 기록, 설정이 모두 초기화됩니다. 이 작업은 되돌릴 수 없어요.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleResetConfirm}
                disabled={isPending}
                className="flex-1 py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold min-h-[44px] disabled:opacity-50 transition-colors"
              >
                {isPending ? "초기화 중..." : "확인, 초기화할게요"}
              </button>
              <button
                onClick={() => setDialog("idle")}
                disabled={isPending}
                className="flex-1 py-2.5 rounded-lg bg-secondary text-foreground text-sm font-medium min-h-[44px] disabled:opacity-50 transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        )}

        {dialog === "confirm-onboarding" && (
          <div className="p-4 bg-secondary border border-border rounded-xl">
            <p className="text-sm font-semibold mb-1">초기화 완료 ✓</p>
            <p className="text-sm text-muted-foreground mb-4">
              온보딩을 다시 시작하시겠어요?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => router.push("/onboarding")}
                className="flex-1 py-2.5 rounded-lg bg-navy text-white text-sm font-semibold min-h-[44px] transition-colors"
              >
                예, 시작할게요
              </button>
              <button
                onClick={() => setDialog("idle")}
                className="flex-1 py-2.5 rounded-lg bg-secondary text-foreground text-sm font-medium min-h-[44px] border border-border transition-colors"
              >
                아니오
              </button>
            </div>
          </div>
        )}

        {dialog === "confirm-demo" && (
          <div className="p-4 bg-secondary border border-border rounded-xl">
            <p className="text-sm font-semibold mb-1 text-coral">⚠️ 기존 데이터가 모두 삭제됩니다</p>
            <p className="text-xs text-muted-foreground mb-4">
              현재 설정과 모든 기록이 삭제되고, 데모 데이터(3개월 97일 샘플)로 교체됩니다. 이 작업은 되돌릴 수 없어요.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleDemoConfirm}
                disabled={isPending}
                className="flex-1 py-2.5 rounded-lg bg-navy text-white text-sm font-semibold min-h-[44px] disabled:opacity-50 transition-colors"
              >
                {isPending ? "불러오는 중..." : "확인"}
              </button>
              <button
                onClick={() => setDialog("idle")}
                disabled={isPending}
                className="flex-1 py-2.5 rounded-lg bg-secondary text-foreground text-sm font-medium min-h-[44px] border border-border disabled:opacity-50 transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 계정 */}
      <div className="px-4 py-4 space-y-3 pb-24">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          계정
        </h3>

        <button
          type="button"
          onClick={() => setShowAccountInfo(true)}
          data-testid="settings-account-info"
          className="w-full py-3 rounded-xl text-sm font-medium min-h-[48px] text-foreground border border-border hover:bg-secondary transition-colors flex items-center justify-center gap-2"
        >
          <UserPen className="w-4 h-4" />
          개인정보 변경
        </button>

        {!showLogoutConfirm ? (
          <button
            onClick={() => setShowLogoutConfirm(true)}
            data-testid="settings-logout"
            className="w-full py-3 rounded-xl text-sm font-medium min-h-[48px] text-muted-foreground border border-border hover:bg-secondary transition-colors flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            로그아웃
          </button>
        ) : (
          <div className="p-4 bg-secondary border border-border rounded-xl">
            <p className="text-sm font-semibold mb-1">로그아웃 하시겠어요?</p>
            <p className="text-xs text-muted-foreground mb-4">
              로그아웃 후 다시 로그인하면 기존 데이터가 유지됩니다.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => startTransition(() => logout())}
                disabled={isPending}
                className="flex-1 py-2.5 rounded-lg bg-navy text-white text-sm font-semibold min-h-[44px] disabled:opacity-50 transition-colors"
              >
                {isPending ? "로그아웃 중..." : "로그아웃"}
              </button>
              <button
                onClick={() => setShowLogoutConfirm(false)}
                disabled={isPending}
                className="flex-1 py-2.5 rounded-lg bg-secondary text-foreground text-sm font-medium min-h-[44px] border border-border disabled:opacity-50 transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 개인정보 변경 다이얼로그 */}
      <AccountInfoDialog
        isOpen={showAccountInfo}
        onClose={() => setShowAccountInfo(false)}
      />
    </div>
  );
}
