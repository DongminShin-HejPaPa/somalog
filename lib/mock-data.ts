export interface DailyLog {
  date: string;
  day: number;
  weight: number | null;
  avgWeight3d: number | null;
  weightChange: number | null;
  water: number | null;
  exercise: "Y" | "N" | null;
  breakfast: string | null;
  lunch: string | null;
  dinner: string | null;
  lateSnack: "Y" | "N" | null;
  energy: "여유" | "보통" | "피곤" | null;
  note: string | null;
  closed: boolean;
  intensiveDay: boolean | null;
  feedback: string | null;
  dailySummary: string | null;
  oneLiner: string | null;
}

export interface WeeklyLog {
  weekStart: string;
  weekEnd: string;
  avgWeight: number;
  exerciseDays: number;
  lateSnackCount: number;
  weeklySummary: string;
}

export interface Settings {
  coachName: string;
  height: number;
  currentWeight: number;
  gender: "남성" | "여성";
  dietStartDate: string;
  startWeight: number;
  targetWeight: number;
  dietPreset: "sustainable" | "medium" | "intensive" | "custom";
  targetMonths: number;
  waterGoal: number;
  routineWeightTime: string;
  routineEnergyTime: string;
  routineExtra: string[];
  intensiveDayOn: boolean;
  intensiveDayCriteria: "역대최저" | "0.5kg" | "1.0kg" | "직접입력";
  coachStylePreset: "strong" | "balanced" | "empathy" | "data";
  coachStyleExtra: string[];
  defaultTab: "input" | "home";
  onboardingComplete: boolean;
}

export const mockSettings: Settings = {
  coachName: "Soma",
  height: 178.0,
  currentWeight: 89.2,
  gender: "남성",
  dietStartDate: "2026-01-08",
  startWeight: 93.5,
  targetWeight: 73.0,
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
  onboardingComplete: true,
};

export const mockDailyLogs: DailyLog[] = [
  {
    date: "2026-03-25",
    day: 77,
    weight: 89.2,
    avgWeight3d: 89.1,
    weightChange: -4.3,
    water: 1.5,
    exercise: "Y",
    breakfast: "관리식단",
    lunch: "소식 한식",
    dinner: null,
    lateSnack: null,
    energy: null,
    note: null,
    closed: false,
    intensiveDay: true,
    feedback: "체중이 어제보다 0.3kg 올랐어. 역대 최저 88.5kg보다 0.7kg 높은 상태야. 오늘 저녁 식단 관리가 핵심이야.",
    dailySummary: null,
    oneLiner: null,
  },
  {
    date: "2026-03-24",
    day: 76,
    weight: 88.9,
    avgWeight3d: 88.8,
    weightChange: -4.6,
    water: 2.5,
    exercise: "Y",
    breakfast: "관리식단",
    lunch: "관리식단",
    dinner: "소식 한식",
    lateSnack: "N",
    energy: "보통",
    note: null,
    closed: true,
    intensiveDay: true,
    feedback: null,
    dailySummary:
      "오늘 전체적으로 괜찮은 관리를 했지만, 체중이 역대 최저(88.5kg)보다 여전히 0.4kg 높아. 3일 평균이 조금씩 내려가고 있는 건 긍정적이야. 내일도 오늘처럼 식단 유지하고, 수분을 2.8L까지 채워봐. 운동은 잘 하고 있어. 야식 안 먹은 거 좋았어.",
    oneLiner: "식단 괜찮았지만 역대 최저 회복이 최우선 — 내일도 이 페이스 유지해.",
  },
  {
    date: "2026-03-23",
    day: 75,
    weight: 88.5,
    avgWeight3d: 88.7,
    weightChange: -5.0,
    water: 3.0,
    exercise: "Y",
    breakfast: "관리식단",
    lunch: "관리식단",
    dinner: "관리식단",
    lateSnack: "N",
    energy: "여유",
    note: "컨디션 좋음",
    closed: true,
    intensiveDay: false,
    feedback: null,
    dailySummary:
      "완벽한 하루. 모든 항목 관리식단, 수분 3.0L, 운동까지. 체중 88.5kg은 역대 최저 타이야. 내일도 이 흐름 유지하면 새 최저 기록 가능해.",
    oneLiner: "완벽한 하루 — 역대 최저 타이 달성. 이 흐름 유지가 관건.",
  },
  {
    date: "2026-03-22",
    day: 74,
    weight: 88.8,
    avgWeight3d: 89.0,
    weightChange: -4.7,
    water: 2.0,
    exercise: "N",
    breakfast: "관리식단",
    lunch: "고칼로리 외식",
    dinner: "관리식단",
    lateSnack: "N",
    energy: "피곤",
    note: null,
    closed: true,
    intensiveDay: true,
    feedback: null,
    dailySummary:
      "점심에 외식한 것 빼고는 무난했어. 운동을 안 한 게 아쉬워. 수분도 2.0L로 목표에 한참 못 미쳤어. 피곤한 날이라도 수분만큼은 챙겨.",
    oneLiner: "외식 + 운동 미수행이 겹쳤어. 내일은 반드시 운동 포함시켜.",
  },
  {
    date: "2026-03-21",
    day: 73,
    weight: 89.3,
    avgWeight3d: 89.2,
    weightChange: -4.2,
    water: 2.8,
    exercise: "Y",
    breakfast: "관리식단",
    lunch: "소식 한식",
    dinner: "고칼로리 외식",
    lateSnack: "Y",
    energy: "보통",
    note: null,
    closed: true,
    intensiveDay: true,
    feedback: null,
    dailySummary:
      "저녁 외식에 야식까지. 체중 89.3kg은 지난주 평균보다 높아. 운동한 건 다행이지만 식단 관리 실패가 치명적이야. 야식은 반드시 끊어야 해.",
    oneLiner: "야식이 모든 걸 망쳤어. 저녁 외식은 봐줘도 야식은 안 돼.",
  },
  {
    date: "2026-03-20",
    day: 72,
    weight: 89.0,
    avgWeight3d: 89.1,
    weightChange: -4.5,
    water: 2.5,
    exercise: "Y",
    breakfast: "관리식단",
    lunch: "관리식단",
    dinner: "소식 한식",
    lateSnack: "N",
    energy: "보통",
    note: null,
    closed: true,
    intensiveDay: true,
    feedback: null,
    dailySummary:
      "전체적으로 좋은 관리. 체중 89.0kg으로 감소 추세. 수분 목표는 좀 더 채워보자.",
    oneLiner: "좋은 관리 유지 중. 수분만 조금 더 채워.",
  },
  {
    date: "2026-03-19",
    day: 71,
    weight: 89.2,
    avgWeight3d: 89.3,
    weightChange: -4.3,
    water: 2.8,
    exercise: "N",
    breakfast: "관리식단",
    lunch: "관리식단",
    dinner: "관리식단",
    lateSnack: "N",
    energy: "여유",
    note: null,
    closed: true,
    intensiveDay: true,
    feedback: null,
    dailySummary: "식단은 완벽했지만 운동을 안 했어. 내일은 운동 필수.",
    oneLiner: "식단 완벽, 운동만 빠졌어. 내일 보충 필수.",
  },
  {
    date: "2026-03-18",
    day: 70,
    weight: 89.5,
    avgWeight3d: 89.5,
    weightChange: -4.0,
    water: 2.2,
    exercise: "Y",
    breakfast: "고칼로리 외식",
    lunch: "관리식단",
    dinner: "관리식단",
    lateSnack: "N",
    energy: "보통",
    note: null,
    closed: true,
    intensiveDay: true,
    feedback: null,
    dailySummary: "아침 외식이 아쉬웠어. 그래도 점심·저녁 잘 관리한 건 좋아.",
    oneLiner: "아침 외식 아쉽지만 점심·저녁으로 만회.",
  },
  {
    date: "2026-03-17",
    day: 69,
    weight: 89.7,
    avgWeight3d: 89.8,
    weightChange: -3.8,
    water: 1.8,
    exercise: "N",
    breakfast: "고칼로리 외식",
    lunch: "고칼로리 외식",
    dinner: "관리식단",
    lateSnack: "Y",
    energy: "피곤",
    note: "주말 후유증",
    closed: true,
    intensiveDay: true,
    feedback: null,
    dailySummary: "월요일부터 외식 2끼에 야식까지. 주말 패턴이 월요일까지 이어졌어.",
    oneLiner: "주말 패턴 연장. 화요일부터 반드시 리셋.",
  },
  {
    date: "2026-03-16",
    day: 68,
    weight: 90.1,
    avgWeight3d: 90.0,
    weightChange: -3.4,
    water: 1.5,
    exercise: "N",
    breakfast: "고칼로리 외식",
    lunch: "고칼로리 외식",
    dinner: "고칼로리 외식",
    lateSnack: "Y",
    energy: "피곤",
    note: "주말 모임",
    closed: true,
    intensiveDay: true,
    feedback: null,
    dailySummary: "일요일 폭식. 세 끼 모두 외식, 야식까지. 체중 90kg 돌파. 빨리 되돌려야 해.",
    oneLiner: "일요일 폭식으로 90kg 돌파. 월요일부터 즉시 복구.",
  },
  {
    date: "2026-03-15",
    day: 67,
    weight: 89.5,
    avgWeight3d: 89.3,
    weightChange: -4.0,
    water: 2.0,
    exercise: "Y",
    breakfast: "관리식단",
    lunch: "소식 한식",
    dinner: "고칼로리 외식",
    lateSnack: "N",
    energy: "보통",
    note: null,
    closed: true,
    intensiveDay: true,
    feedback: null,
    dailySummary: "저녁 외식 외에는 무난. 토요일치고는 괜찮은 편.",
    oneLiner: "토요일 저녁 외식. 일요일도 관리해야 월요일 체중 안 오른다.",
  },
  {
    date: "2026-03-14",
    day: 66,
    weight: 89.0,
    avgWeight3d: 89.0,
    weightChange: -4.5,
    water: 3.0,
    exercise: "Y",
    breakfast: "관리식단",
    lunch: "관리식단",
    dinner: "관리식단",
    lateSnack: "N",
    energy: "여유",
    note: null,
    closed: true,
    intensiveDay: true,
    feedback: null,
    dailySummary: "완벽한 금요일. 이 패턴을 주말에도 유지하는 게 핵심.",
    oneLiner: "완벽한 금요일. 주말이 진짜 승부처.",
  },
  {
    date: "2026-03-13",
    day: 65,
    weight: 88.8,
    avgWeight3d: 88.9,
    weightChange: -4.7,
    water: 2.8,
    exercise: "Y",
    breakfast: "관리식단",
    lunch: "관리식단",
    dinner: "소식 한식",
    lateSnack: "N",
    energy: "보통",
    note: null,
    closed: true,
    intensiveDay: true,
    feedback: null,
    dailySummary: "좋은 관리. 3일 평균 하락 추세 유지 중.",
    oneLiner: "착실한 관리. 3일 평균 하락 추세 좋아.",
  },
  {
    date: "2026-03-12",
    day: 64,
    weight: 89.1,
    avgWeight3d: 89.2,
    weightChange: -4.4,
    water: 2.5,
    exercise: "N",
    breakfast: "관리식단",
    lunch: "소식 한식",
    dinner: "관리식단",
    lateSnack: "N",
    energy: "피곤",
    note: null,
    closed: true,
    intensiveDay: true,
    feedback: null,
    dailySummary: "운동 미수행 외에는 괜찮아. 내일 운동 보충해.",
    oneLiner: "운동만 빠졌어. 식단은 양호.",
  },
];

export const mockWeeklyLog: WeeklyLog = {
  weekStart: "2026-03-16",
  weekEnd: "2026-03-22",
  avgWeight: 89.4,
  exerciseDays: 3,
  lateSnackCount: 2,
  weeklySummary:
    "이번 주 체중은 89.4kg 평균으로 지난주(89.1kg)보다 0.3kg 상승했어. 일요일 폭식(90.1kg)이 주 평균을 끌어올린 주범이야. 운동은 7일 중 3일로 절반도 안 돼. 야식도 2회. 주말 관리가 반복적으로 무너지는 패턴이 보여. 다음 주 핵심 전략: 1) 토·일 저녁 외식 최소화 2) 야식 완전 차단 3) 운동 주 5일 이상 목표.",
};

export const lowestWeight = 88.5;
export const lowestWeightDate = "2026-03-23";
