"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useSettings } from "@/lib/contexts/settings-context";
import type { Settings } from "@/lib/types";
import Link from "next/link";

const coachStyles = [
  { value: "strong", label: "팩트 위주 / 강한 코치", desc: "위로보다 수치와 사실로 강하게" },
  { value: "balanced", label: "균형잡힌 조언", desc: "팩트 기반 + 격려 병행" },
  { value: "empathy", label: "위로와 공감 중심", desc: "부드럽게, 정서 우선" },
  { value: "data", label: "데이터 리포터", desc: "감정 없이 수치와 트렌드만" },
];

const dietPresets = [
  { value: "sustainable", label: "Sustainable Diet", desc: "12개월, ~1.7kg/월, 코칭 보통", badge: "추천" },
  { value: "medium", label: "중기 집중", desc: "6개월, ~2.5kg/월, 코칭 높음" },
  { value: "intensive", label: "단기 강력", desc: "3개월, ~3.3kg/월, 코칭 최강" },
  { value: "custom", label: "자유 설정", desc: "직접 입력" },
];

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
}: {
  label: string;
  value: string;
  suffix?: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <label className="text-sm text-muted-foreground">{label}</label>
      <div className="flex items-center gap-1">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-24 text-right px-2 py-1.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-navy/20 min-h-[36px]"
        />
        {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  );
}

export function SettingsForm() {
  const { settings, updateSettings, isLoaded } = useSettings();
  const [form, setForm] = useState<Settings>(settings);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (isLoaded) {
      setForm(settings);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded]);

  const handleChange = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    updateSettings(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div>
      <Section title="코치 이름">
        <InputField
          label="이름"
          value={form.coachName}
          onChange={(v) => handleChange("coachName", v)}
        />
        <p className="text-xs text-muted-foreground mt-1">최대 10자</p>
      </Section>

      <Section title="신체 정보">
        <InputField
          label="키"
          value={form.height.toString()}
          suffix="cm"
          onChange={(v) => handleChange("height", Number(v) || 0)}
        />
        <InputField
          label="현재 체중"
          value={form.currentWeight.toString()}
          suffix="kg"
          onChange={(v) => handleChange("currentWeight", Number(v) || 0)}
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
            <button
              key={p.value}
              onClick={() => handleChange("dietPreset", p.value as Settings["dietPreset"])}
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
                <span className="text-xs text-muted-foreground">{p.desc}</span>
              </div>
              <div
                className={cn(
                  "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                  form.dietPreset === p.value
                    ? "border-navy"
                    : "border-border"
                )}
              >
                {form.dietPreset === p.value && (
                  <div className="w-2.5 h-2.5 rounded-full bg-navy" />
                )}
              </div>
            </button>
          ))}
        </div>
        <InputField
          label="시작일"
          value={form.dietStartDate}
          onChange={(v) => handleChange("dietStartDate", v)}
        />
        <InputField
          label="시작 체중"
          value={form.startWeight.toString()}
          suffix="kg"
          onChange={(v) => handleChange("startWeight", Number(v) || 0)}
        />
        <InputField
          label="목표 체중"
          value={form.targetWeight.toString()}
          suffix="kg"
          onChange={(v) => handleChange("targetWeight", Number(v) || 0)}
        />
        <InputField
          label="목표 기간"
          value={form.targetMonths.toString()}
          suffix="개월"
          onChange={(v) => handleChange("targetMonths", Number(v) || 0)}
        />
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
          value={form.waterGoal.toString()}
          suffix="L"
          onChange={(v) => handleChange("waterGoal", Number(v) || 0)}
        />
        <p className="text-xs text-muted-foreground mt-1">
          신체 정보 기반 권장: 3.1L
          <button className="ml-2 text-navy font-medium underline">권장값으로 변경</button>
        </p>
      </Section>

      <Section title="나의 루틴">
        <InputField
          label="몸무게 측정"
          value={form.routineWeightTime}
          onChange={(v) => handleChange("routineWeightTime", v)}
        />
        <InputField
          label="체력 기준 시각"
          value={form.routineEnergyTime}
          onChange={(v) => handleChange("routineEnergyTime", v)}
        />
        <button className="text-sm text-navy font-medium mt-2">+ 루틴 추가</button>
        <p className="text-xs text-muted-foreground mt-2 p-2 bg-secondary rounded-lg">
          루틴 설정은 AI 코치 맥락 필터링에 사용됩니다. 잘못 설정하면 맥락에 맞지 않는 조언을 받을 수 있어요.
        </p>
      </Section>

      <Section title="Intensive Day">
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
              onClick={() =>
                handleChange("intensiveDayCriteria", c.value as Settings["intensiveDayCriteria"])
              }
              className={cn(
                "w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-left min-h-[44px] transition-colors",
                form.intensiveDayCriteria === c.value
                  ? "border-navy bg-navy/5"
                  : "border-border"
              )}
            >
              <div>
                <span className="text-sm">{c.label}</span>
                {c.desc && (
                  <span className="text-xs text-muted-foreground ml-2">{c.desc}</span>
                )}
              </div>
              <div
                className={cn(
                  "w-4 h-4 rounded-full border-2 flex items-center justify-center",
                  form.intensiveDayCriteria === c.value
                    ? "border-navy"
                    : "border-border"
                )}
              >
                {form.intensiveDayCriteria === c.value && (
                  <div className="w-2 h-2 rounded-full bg-navy" />
                )}
              </div>
            </button>
          ))}
        </div>
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
                  form.coachStylePreset === s.value
                    ? "border-navy"
                    : "border-border"
                )}
              >
                {form.coachStylePreset === s.value && (
                  <div className="w-2.5 h-2.5 rounded-full bg-navy" />
                )}
              </div>
            </button>
          ))}
        </div>
        <button className="text-sm text-navy font-medium">+ 항목 추가</button>
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

      <div className="px-4 py-4">
        <button
          onClick={handleSave}
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

      <div className="px-4 pb-6">
        <Link
          href="/onboarding"
          className="block w-full py-3 rounded-xl text-center text-sm font-medium text-coral border border-coral/30 hover:bg-coral-light transition-colors min-h-[48px] leading-[48px]"
        >
          초기 설정 다시 하기
        </Link>
      </div>
    </div>
  );
}
