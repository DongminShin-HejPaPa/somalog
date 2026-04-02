"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, ArrowRight, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSettings } from "@/lib/contexts/settings-context";
import type { Settings } from "@/lib/types";

const coachStyles = [
  { value: "strong", label: "팩트 위주 / 강한 코치", desc: "위로보다 수치와 사실로 강하게", example: "\"어제 야식 먹고 오늘 체중 올랐잖아. 당연한 결과야. 오늘 저녁은 관리식단 필수.\"" },
  { value: "balanced", label: "균형잡힌 조언", desc: "팩트 기반 + 격려 병행", example: "\"체중이 좀 올랐지만, 이번 주 운동 3일은 잘했어. 식단만 잡으면 금방 회복할 수 있어.\"" },
  { value: "empathy", label: "위로와 공감 중심", desc: "부드럽게, 정서 우선", example: "\"주말에 힘들었구나. 그래도 월요일에 다시 기록하는 거 자체가 대단한 거야.\"" },
  { value: "data", label: "데이터 리포터", desc: "감정 없이 수치와 트렌드만", example: "\"주간 평균 89.4kg. 전주 대비 +0.3kg. 운동 3/7일. 야식 2회.\"" },
];

const dietPresets = [
  { value: "easygoing", label: "여유롭게", desc: "월 약 1kg · 코칭 보통", ratePerMonth: 1 },
  { value: "sustainable", label: "착실하게", desc: "월 약 2kg · 코칭 보통", badge: "추천", ratePerMonth: 2 },
  { value: "medium", label: "집중해서", desc: "월 약 3kg · 코칭 높음", ratePerMonth: 3 },
  { value: "intensive", label: "전력 질주", desc: "월 약 4kg · 코칭 최강", ratePerMonth: 4 },
  { value: "custom", label: "내가 정할게", desc: "목표 체중·기간 직접 입력", ratePerMonth: 0 },
];

function calcMonths(totalLoss: number, rate: number): number {
  if (totalLoss <= 0 || rate <= 0) return 1;
  return Math.ceil(totalLoss / rate);
}

const intensiveCriteriaOptions = [
  { value: "역대최저", label: "역대 최저 체중 초과 시", desc: "가장 엄격 (추천)" },
  { value: "0.5kg", label: "최저 +0.5kg 초과 시", desc: "소폭 완화" },
  { value: "1.0kg", label: "최저 +1.0kg 초과 시", desc: "관대한 기준" },
];

interface StepConfig {
  id: number;
  message: string;
}

const steps: StepConfig[] = [
  { id: 1, message: "안녕? 나는 오늘부터 너의 다이어트 코치로 일하게 될 Soma야. 앞으로 매일 같이 기록하고, 분석하고, 가끔은 따끔하게 말할 수도 있어. 혹시 나를 다른 이름으로 부르고 싶어?" },
  { id: 2, message: "기본 정보부터 알아야겠어. 키랑 지금 몸무게, 그리고 성별 알려줄 수 있어? 이거 알아야 수분 목표도 딱 맞게 잡아줄 수 있거든." },
  { id: 3, message: "좋아! 그럼 목표부터 잡아보자. 최종 목표 체중을 먼저 알려줘. 그리고 어떤 방식으로 다이어트 할지 골라봐." },
  { id: 4, message: "하루 수분 목표야. 신체 정보 기반으로 계산한 권장량을 적어뒀어. 어떻게 할래?" },
  { id: 5, message: "내가 맥락에 맞는 말을 하려면 네 루틴을 알아야 해. 몸무게는 언제 재? 체력은 몇 시쯤 입력할 것 같아? 기본값은 몸무게는 아침 기상 직후, 체력은 21시 기준인데, 이대로 할까?" },
  { id: 6, message: "한 가지만 더! 체중이 역대 최저보다 높은 날을 'Hard Reset Mode'로 지정하면, 그날 코치가 좀 더 강하게 말해줄 거야. 기본은 ON이야. 켜둘까?" },
  { id: 7, message: "마지막으로, 나 어떤 스타일로 말할까? 사람마다 맞는 방식이 달라서. 골라봐." },
  { id: 8, message: "좋아, 준비됐어. 오늘부터 D+1이야. 첫 번째 기록 남겨보자." },
];

export function OnboardingFlow() {
  const router = useRouter();
  const { initializeSettings } = useSettings();

  const [currentStep, setCurrentStep] = useState(0);

  // Step 1
  const [coachName, setCoachName] = useState("");

  // Step 2
  const [height, setHeight] = useState("178");
  const [weight, setWeight] = useState("93.5");
  const [gender, setGender] = useState<"남성" | "여성">("남성");

  // Step 3
  const [targetWeight, setTargetWeight] = useState("");
  const [selectedPreset, setSelectedPreset] = useState("sustainable");
  const [targetMonths, setTargetMonths] = useState(12);
  const [targetMonthsInput, setTargetMonthsInput] = useState("12");

  // Step 4
  const [waterGoal, setWaterGoal] = useState(2.8);

  // Step 5
  const [routineWeightTime, setRoutineWeightTime] = useState("아침 기상 직후");
  const [routineEnergyTime, setRoutineEnergyTime] = useState("21:00");
  const [showRoutineEdit, setShowRoutineEdit] = useState(false);

  // Step 6
  const [intensiveDayOn, setIntensiveDayOn] = useState(true);
  const [showIntensiveCriteria, setShowIntensiveCriteria] = useState(false);
  const [intensiveDayCriteria, setIntensiveDayCriteria] = useState<Settings["intensiveDayCriteria"]>("역대최저");

  // Step 7
  const [selectedStyle, setSelectedStyle] = useState("strong");

  // 온보딩 없이 바로 사용
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);

  // 온보딩 완료 처리 중 (더블클릭 방지)
  const [isCompleting, setIsCompleting] = useState(false);

  const step = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;

  // 신체정보 기반 권장 수분량 (체중 × 35ml/남성, 31ml/여성)
  const recommendedWater = useMemo(() => {
    const w = Number(weight) || 0;
    if (w === 0) return 2.8;
    const ml = gender === "남성" ? w * 35 : w * 31;
    return Math.round(ml / 100) / 10; // ml → L, 소수점 1자리
  }, [weight, gender]);

  // targetWeight 변경 시 현재 선택된 프리셋 기준으로 개월 수 재계산
  useEffect(() => {
    if (selectedPreset === "custom") return;
    const preset = dietPresets.find((p) => p.value === selectedPreset);
    if (!preset) return;
    const totalLoss = Number(weight) - Number(targetWeight);
    const months = calcMonths(totalLoss, preset.ratePerMonth);
    setTargetMonths(months);
    setTargetMonthsInput(String(months));
  }, [targetWeight, selectedPreset, weight]);

  // 다이어트 목표 요약 (step 3)
  const dietStats = useMemo(() => {
    const start = Number(weight) || 0;
    const target = Number(targetWeight) || 0;
    const totalLoss = start - target;
    if (start === 0 || target === 0 || totalLoss <= 0) return null;
    const monthly = totalLoss / targetMonths;
    return { totalLoss, monthly };
  }, [weight, targetWeight, targetMonths]);

  const nextStep = () => {
    if (currentStep < steps.length - 1) setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setShowIntensiveCriteria(false);
      setShowRoutineEdit(false);
      setCurrentStep(currentStep - 1);
    }
  };

  const handlePresetSelect = (value: string) => {
    setSelectedPreset(value);
    if (value === "custom") return;
    const preset = dietPresets.find((p) => p.value === value);
    if (!preset) return;
    const totalLoss = Number(weight) - Number(targetWeight);
    const months = calcMonths(totalLoss, preset.ratePerMonth);
    setTargetMonths(months);
    setTargetMonthsInput(String(months));
  };

  const handleMonthsInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setTargetMonthsInput(raw);
    const n = parseInt(raw, 10);
    if (!isNaN(n) && n > 0) setTargetMonths(n);
  };

  const handleComplete = async () => {
    if (isCompleting) return;
    setIsCompleting(true);
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
    const weightNum = Number(weight) || 0;

    await initializeSettings({
      coachName: coachName || "Soma",
      height: Number(height) || 0,
      currentWeight: weightNum,
      gender,
      dietStartDate: today,
      startWeight: weightNum,
      targetWeight: Number(targetWeight) || 0,
      dietPreset: selectedPreset as Settings["dietPreset"],
      targetMonths,
      waterGoal,
      routineWeightTime,
      routineEnergyTime,
      routineExtra: [],
      intensiveDayOn,
      intensiveDayCriteria,
      coachStylePreset: selectedStyle as Settings["coachStylePreset"],
      coachStyleExtra: [],
      defaultTab: "input",
    });

    router.push("/input");
  };

  const handleSkip = async () => {
    if (isCompleting) return;
    setIsCompleting(true);
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
    await initializeSettings({
      coachName: "Soma",
      height: 0,
      currentWeight: 0,
      gender: "남성",
      dietStartDate: today,
      startWeight: 0,
      targetWeight: 0,
      dietPreset: "sustainable",
      targetMonths: 12,
      waterGoal: 2.8,
      routineWeightTime: "아침 기상 직후",
      routineEnergyTime: "21:00",
      routineExtra: [],
      intensiveDayOn: true,
      intensiveDayCriteria: "역대최저",
      coachStylePreset: "strong",
      coachStyleExtra: [],
      defaultTab: "input",
    });
    router.push("/input");
  };

  // step 3에서 다음으로 가려면 targetWeight가 입력되어야 함
  const step3CanProceed =
    Number(targetWeight) > 0 && Number(targetWeight) < Number(weight);

  return (
    <div className="min-h-dvh flex flex-col">
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
          <span data-testid="onboarding-step-indicator">Step {currentStep + 1} / {steps.length}</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div data-testid="onboarding-progress" className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full bg-navy rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="flex-1 px-4 py-6">
        <div className="flex items-start gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-navy flex items-center justify-center flex-shrink-0">
            <MessageCircle className="w-5 h-5 text-white" />
          </div>
          <div className="bg-secondary rounded-2xl rounded-tl-md px-4 py-3 max-w-[85%]">
            <p className="text-sm leading-relaxed">{step.message}</p>
          </div>
        </div>

        <div className="ml-[52px]">
          {/* Step 1: 코치 이름 */}
          {step.id === 1 && (
            <div className="space-y-3">
              <input
                type="text"
                placeholder="코치 이름 (최대 10자)"
                value={coachName}
                onChange={(e) => setCoachName(e.target.value)}
                maxLength={10}
                data-testid="onboarding-coach-name"
                className="w-full px-4 py-3 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-navy/20 min-h-[48px]"
              />
              <button
                onClick={nextStep}
                className="w-full py-3 rounded-xl bg-secondary text-sm font-medium text-foreground min-h-[48px]"
              >
                그냥 Soma로 할게
              </button>
            </div>
          )}

          {/* Step 2: 신체 정보 */}
          {step.id === 2 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="키"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  className="flex-1 px-3 py-3 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-navy/20 min-h-[48px]"
                />
                <span className="text-sm text-muted-foreground w-8">cm</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="현재 체중"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  className="flex-1 px-3 py-3 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-navy/20 min-h-[48px]"
                />
                <span className="text-sm text-muted-foreground w-8">kg</span>
              </div>
              <div className="flex gap-2">
                {(["남성", "여성"] as const).map((g) => (
                  <button
                    key={g}
                    onClick={() => setGender(g)}
                    className={cn(
                      "flex-1 py-3 rounded-xl text-sm font-medium min-h-[48px] transition-colors",
                      gender === g
                        ? "bg-navy text-white"
                        : "bg-secondary text-muted-foreground border border-border"
                    )}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: 다이어트 목표 */}
          {step.id === 3 && (
            <div className="space-y-3">
              {/* 목표 체중 입력 */}
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="목표 체중"
                  value={targetWeight}
                  onChange={(e) => setTargetWeight(e.target.value)}
                  className="flex-1 px-3 py-3 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-navy/20 min-h-[48px]"
                />
                <span className="text-sm text-muted-foreground w-8">kg</span>
              </div>

              {/* 감량 요약 */}
              {dietStats && (
                <div className="px-3 py-2.5 bg-navy/5 border border-navy/10 rounded-xl text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">총 감량 목표</span>
                    <span className="font-semibold">{dietStats.totalLoss.toFixed(1)} kg</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">기간</span>
                    <span className="font-semibold">{targetMonths}개월</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">월 평균 목표</span>
                    <span className="font-semibold">{dietStats.monthly.toFixed(1)} kg/월</span>
                  </div>
                </div>
              )}

              {/* 프리셋 선택 */}
              <div className="space-y-2">
                {dietPresets.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => handlePresetSelect(p.value)}
                    className={cn(
                      "w-full px-4 py-3 rounded-xl border text-left min-h-[52px] transition-colors",
                      selectedPreset === p.value
                        ? "border-navy bg-navy/5"
                        : "border-border"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{p.label}</span>
                      {p.badge && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-navy text-white">
                          {p.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{p.desc}</p>
                  </button>
                ))}
              </div>

              {/* custom 선택 시 기간 직접 입력 */}
              {selectedPreset === "custom" && (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="목표 기간"
                    value={targetMonthsInput}
                    onChange={handleMonthsInput}
                    className="flex-1 px-3 py-3 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-navy/20 min-h-[48px]"
                  />
                  <span className="text-sm text-muted-foreground w-12">개월</span>
                </div>
              )}
            </div>
          )}

          {/* Step 4: 수분 목표 */}
          {step.id === 4 && (
            <div className="space-y-2">
              <div className="px-3 py-2 bg-navy/5 border border-navy/10 rounded-xl text-xs mb-3">
                <span className="text-muted-foreground">신체 정보 기반 권장량: </span>
                <span className="font-semibold text-navy">{recommendedWater.toFixed(1)}L</span>
                <span className="text-muted-foreground ml-1">
                  ({gender === "남성" ? "남성 체중×35ml" : "여성 체중×31ml"})
                </span>
              </div>
              <button
                onClick={() => { setWaterGoal(2.8); nextStep(); }}
                className="w-full px-4 py-3 rounded-xl border border-border text-sm text-left min-h-[48px] hover:border-navy/30 transition-colors"
              >
                2.8L로 할게 (기본값)
              </button>
              <button
                onClick={() => { setWaterGoal(recommendedWater); nextStep(); }}
                className="w-full px-4 py-3 rounded-xl border border-navy bg-navy/5 text-sm text-left min-h-[48px] transition-colors"
              >
                권장량 ({recommendedWater.toFixed(1)}L)으로 할게
              </button>
              <button
                onClick={() => nextStep()}
                className="w-full px-4 py-3 rounded-xl border border-border text-sm text-left min-h-[48px] hover:border-navy/30 transition-colors"
              >
                직접 입력
              </button>
            </div>
          )}

          {/* Step 5: 루틴 */}
          {step.id === 5 && (
            <div className="space-y-3">
              <button
                onClick={nextStep}
                className="w-full py-3 rounded-xl bg-navy text-white text-sm font-medium min-h-[48px]"
              >
                응, 이대로 할게
              </button>
              <button
                onClick={() => setShowRoutineEdit(!showRoutineEdit)}
                className="w-full py-3 rounded-xl border border-border text-sm text-muted-foreground min-h-[48px]"
              >
                수정할게
              </button>
              {showRoutineEdit && (
                <div className="space-y-2 mt-2">
                  <input
                    type="text"
                    value={routineWeightTime}
                    onChange={(e) => setRoutineWeightTime(e.target.value)}
                    placeholder="몸무게 측정 시간"
                    className="w-full px-3 py-3 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-navy/20 min-h-[48px]"
                  />
                  <input
                    type="text"
                    value={routineEnergyTime}
                    onChange={(e) => setRoutineEnergyTime(e.target.value)}
                    placeholder="체력 기준 시각"
                    className="w-full px-3 py-3 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-navy/20 min-h-[48px]"
                  />
                  <button
                    onClick={nextStep}
                    className="w-full py-3 rounded-xl bg-navy text-white text-sm font-medium min-h-[48px]"
                  >
                    확인
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Step 6: Hard Reset Mode */}
          {step.id === 6 && (
            <div className="space-y-2">
              {/* 구체적인 예시 카드 */}
              <div className="px-3 py-2.5 bg-coral/5 border border-coral/20 rounded-xl text-xs space-y-1 mb-1">
                <p className="font-semibold text-coral">예시</p>
                <p className="text-muted-foreground">역대 최저 체중 <span className="font-semibold text-foreground">87.5 kg</span></p>
                <p className="text-muted-foreground">오늘 체중 측정 <span className="font-semibold text-foreground">88.2 kg</span> → Hard Reset Mode 발동</p>
                <p className="text-muted-foreground italic">코치: "87.5kg가 있는데 오늘 88.2kg? Hard Reset 날이야. 오늘 식단 전면 관리해."</p>
              </div>
              {!showIntensiveCriteria ? (
                <>
                  <button
                    onClick={() => { setIntensiveDayOn(true); nextStep(); }}
                    className="w-full py-3 rounded-xl bg-navy text-white text-sm font-medium min-h-[48px]"
                  >
                    응, 켜줘
                  </button>
                  <button
                    onClick={() => setShowIntensiveCriteria(true)}
                    className="w-full py-3 rounded-xl border border-border text-sm text-muted-foreground min-h-[48px]"
                  >
                    기준 바꿀게
                  </button>
                  <button
                    onClick={() => { setIntensiveDayOn(false); nextStep(); }}
                    className="w-full py-3 rounded-xl border border-border text-sm text-muted-foreground min-h-[48px]"
                  >
                    일단 꺼줘
                  </button>
                </>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground mb-2">
                    Hard Reset Mode 기준을 골라봐. 체중이 이 기준을 넘으면 발동돼.
                  </p>
                  {intensiveCriteriaOptions.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => setIntensiveDayCriteria(c.value as Settings["intensiveDayCriteria"])}
                      className={cn(
                        "w-full px-4 py-3 rounded-xl border text-left min-h-[48px] transition-colors",
                        intensiveDayCriteria === c.value
                          ? "border-navy bg-navy/5"
                          : "border-border"
                      )}
                    >
                      <span className="text-sm font-medium">{c.label}</span>
                      <span className="text-xs text-muted-foreground ml-2">{c.desc}</span>
                    </button>
                  ))}
                  <button
                    onClick={() => { setIntensiveDayOn(true); nextStep(); }}
                    className="w-full py-3 rounded-xl bg-navy text-white text-sm font-medium min-h-[48px] mt-1"
                  >
                    이 기준으로 켜줘
                  </button>
                </>
              )}
            </div>
          )}

          {/* Step 7: 코치 스타일 */}
          {step.id === 7 && (
            <div className="space-y-2">
              {coachStyles.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setSelectedStyle(s.value)}
                  className={cn(
                    "w-full px-4 py-3 rounded-xl border text-left transition-colors",
                    selectedStyle === s.value
                      ? "border-navy bg-navy/5"
                      : "border-border"
                  )}
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium">{s.label}</span>
                    {s.value === "strong" && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-navy text-white">
                        기본
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{s.desc}</p>
                  {selectedStyle === s.value && (
                    <p className="text-xs text-navy mt-2 italic">{s.example}</p>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Step 8: 완료 */}
          {step.id === 8 && (
            <button
              onClick={handleComplete}
              disabled={isCompleting}
              data-testid="onboarding-complete"
              className="w-full py-3 rounded-xl bg-navy text-white text-sm font-semibold text-center min-h-[48px] disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {isCompleting ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  저장 중...
                </>
              ) : "첫 기록 남기러 가기"}
            </button>
          )}
        </div>
      </div>

      {/* 하단 네비게이션: 이전 + 다음 */}
      <div className="px-4 pb-2 flex gap-3">
        {currentStep > 0 && (
          <button
            onClick={prevStep}
            className="py-3 px-4 rounded-xl border border-border text-sm font-medium text-muted-foreground flex items-center gap-1.5 min-h-[48px]"
          >
            <ArrowLeft className="w-4 h-4" />
            이전
          </button>
        )}
        {/* 다음 버튼: 자체 내비게이션이 없는 step에서만 표시 */}
        {step.id !== 8 && step.id !== 4 && step.id !== 5 && step.id !== 6 && (
          <button
            onClick={nextStep}
            disabled={step.id === 3 && !step3CanProceed}
            data-testid="onboarding-next"
            className={cn(
              "flex-1 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 min-h-[48px]",
              step.id === 3 && !step3CanProceed
                ? "bg-secondary text-muted-foreground cursor-not-allowed"
                : "bg-navy text-white"
            )}
          >
            다음
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 바로 사용 링크 */}
      <div className="px-4 pb-6 text-center">
        {!showSkipConfirm ? (
          <button
            onClick={() => setShowSkipConfirm(true)}
            className="text-xs text-muted-foreground underline underline-offset-2"
          >
            온보딩 없이 바로 사용할게요!
          </button>
        ) : (
          <div className="bg-secondary rounded-xl p-4 text-left space-y-3">
            <p className="text-sm font-medium">온보딩에서 나갈까요?</p>
            <p className="text-xs text-muted-foreground">
              모든 설정값이 기본값으로 지정돼요. 나중에 설정 탭에서 언제든지 바꿀 수 있어요.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleSkip}
                disabled={isCompleting}
                className="flex-1 py-2.5 rounded-xl bg-navy text-white text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {isCompleting ? (
                  <>
                    <span className="inline-block w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    저장 중...
                  </>
                ) : "네, 기본값으로 시작할게요"}
              </button>
              <button
                onClick={() => setShowSkipConfirm(false)}
                className="px-4 py-2.5 rounded-xl border border-border text-sm text-muted-foreground"
              >
                취소
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
