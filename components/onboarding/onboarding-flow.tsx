"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, ArrowRight } from "lucide-react";
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
  { value: "sustainable", label: "Sustainable Diet", desc: "12개월 · ~1.7kg/월 · 코칭 보통", badge: "추천", months: 12 },
  { value: "medium", label: "중기 집중", desc: "6개월 · ~2.5kg/월 · 코칭 높음", months: 6 },
  { value: "intensive", label: "단기 강력", desc: "3개월 · ~3.3kg/월 · 코칭 최강", months: 3 },
  { value: "custom", label: "자유 설정", desc: "목표 체중·기간 직접 입력", months: 12 },
];

interface StepConfig {
  id: number;
  message: string;
}

const steps: StepConfig[] = [
  { id: 1, message: "안녕? 나는 오늘부터 너의 다이어트 코치로 일하게 될 Soma야. 앞으로 매일 같이 기록하고, 분석하고, 가끔은 따끔하게 말할 수도 있어. 혹시 나를 다른 이름으로 부르고 싶어?" },
  { id: 2, message: "기본 정보부터 알아야겠어. 키랑 지금 몸무게, 그리고 성별 알려줄 수 있어? 이거 알아야 수분 목표도 딱 맞게 잡아줄 수 있거든." },
  { id: 3, message: "좋아! 그럼 목표부터 잡아보자. 어떤 방식으로 다이어트 할 거야?" },
  { id: 4, message: "하루 수분 목표는 네 신체 정보 기반으로 계산하면 3.1L인데, Default는 2.8L로 잡아뒀어. 어떻게 할래?" },
  { id: 5, message: "내가 맥락에 맞는 말을 하려면 네 루틴을 알아야 해. 몸무게는 언제 재? 체력은 몇 시쯤 입력할 것 같아? 기본값은 몸무게는 아침 기상 직후, 체력은 21시 기준인데, 이대로 할까?" },
  { id: 6, message: "한 가지만 더! '오늘 체중이 역대 최저보다 높으면 나한테 더 세게 맞을 준비 해' 모드가 있어. 이걸 Intensive Day라고 부르는데, 기본은 ON이야. 솔직히 이게 없으면 느슨해지거든. 켜둘까?" },
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
  const [selectedPreset, setSelectedPreset] = useState("sustainable");
  const [targetMonths, setTargetMonths] = useState(12);

  // Step 4
  const [waterGoal, setWaterGoal] = useState(2.8);

  // Step 5
  const [routineWeightTime, setRoutineWeightTime] = useState("아침 기상 직후");
  const [routineEnergyTime, setRoutineEnergyTime] = useState("21:00");
  const [showRoutineEdit, setShowRoutineEdit] = useState(false);

  // Step 6
  const [intensiveDayOn, setIntensiveDayOn] = useState(true);

  // Step 7
  const [selectedStyle, setSelectedStyle] = useState("strong");

  const step = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePresetSelect = (value: string) => {
    setSelectedPreset(value);
    const preset = dietPresets.find((p) => p.value === value);
    if (preset) setTargetMonths(preset.months);
  };

  const handleComplete = () => {
    const today = new Date().toISOString().split("T")[0];
    const weightNum = Number(weight) || 0;

    initializeSettings({
      coachName: coachName || "Soma",
      height: Number(height) || 0,
      currentWeight: weightNum,
      gender,
      dietStartDate: today,
      startWeight: weightNum,
      targetWeight: 73,
      dietPreset: selectedPreset as Settings["dietPreset"],
      targetMonths,
      waterGoal,
      routineWeightTime,
      routineEnergyTime,
      routineExtra: [],
      intensiveDayOn,
      intensiveDayCriteria: "역대최저",
      coachStylePreset: selectedStyle as Settings["coachStylePreset"],
      coachStyleExtra: [],
      defaultTab: "input",
    });

    router.push("/input");
  };

  return (
    <div className="min-h-dvh flex flex-col">
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
          <span>Step {currentStep + 1} / {steps.length}</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
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
          {step.id === 1 && (
            <div className="space-y-3">
              <input
                type="text"
                placeholder="코치 이름 (최대 10자)"
                value={coachName}
                onChange={(e) => setCoachName(e.target.value)}
                maxLength={10}
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
                <span className="text-sm text-muted-foreground">cm</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="현재 체중"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  className="flex-1 px-3 py-3 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-navy/20 min-h-[48px]"
                />
                <span className="text-sm text-muted-foreground">kg</span>
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

          {step.id === 3 && (
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
          )}

          {step.id === 4 && (
            <div className="space-y-2">
              <button
                onClick={() => { setWaterGoal(2.8); nextStep(); }}
                className="w-full px-4 py-3 rounded-xl border border-border text-sm text-left min-h-[48px] hover:border-navy/30 transition-colors"
              >
                2.8L로 할게
              </button>
              <button
                onClick={() => { setWaterGoal(3.1); nextStep(); }}
                className="w-full px-4 py-3 rounded-xl border border-border text-sm text-left min-h-[48px] hover:border-navy/30 transition-colors"
              >
                권장값 (3.1L)으로 할게
              </button>
              <button
                onClick={() => nextStep()}
                className="w-full px-4 py-3 rounded-xl border border-border text-sm text-left min-h-[48px] hover:border-navy/30 transition-colors"
              >
                직접 입력
              </button>
            </div>
          )}

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

          {step.id === 6 && (
            <div className="space-y-2">
              <button
                onClick={() => { setIntensiveDayOn(true); nextStep(); }}
                className="w-full py-3 rounded-xl bg-navy text-white text-sm font-medium min-h-[48px]"
              >
                응, 켜줘
              </button>
              <button
                onClick={nextStep}
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
            </div>
          )}

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

          {step.id === 8 && (
            <button
              onClick={handleComplete}
              className="w-full py-3 rounded-xl bg-navy text-white text-sm font-semibold text-center min-h-[48px]"
            >
              첫 기록 남기러 가기
            </button>
          )}
        </div>
      </div>

      {step.id !== 8 && step.id !== 4 && step.id !== 5 && step.id !== 6 && (
        <div className="px-4 pb-6">
          <button
            onClick={nextStep}
            className="w-full py-3 rounded-xl bg-navy text-white text-sm font-semibold flex items-center justify-center gap-2 min-h-[48px]"
          >
            다음
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
