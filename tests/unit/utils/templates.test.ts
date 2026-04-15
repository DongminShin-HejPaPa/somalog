import {
  generateFeedback,
  generateDailySummary,
  generateOneLiner,
  generateWeeklySummary,
} from "../../../lib/utils/templates";
import type { DailyLog } from "../../../lib/types";

const baseDailyLog: DailyLog = {
  date: "2024-01-15",
  day: 15,
  weight: 80.0,
  avgWeight3d: 80.0,
  weightChange: -5.0,
  water: 2.0,
  exercise: "Y",
  breakfast: "오트밀",
  lunch: "샐러드",
  dinner: "닭가슴살",
  lateSnack: "N",
  note: null,
  closed: false,
  intensiveDay: false,
  feedback: null,
  dailySummary: null,
  oneLiner: null,
};

// ─────────────────────────────────────────────
// generateFeedback
// ─────────────────────────────────────────────
describe("generateFeedback", () => {
  const waterGoal = 2.5;

  it("1. prevWeight 있고 체중 감소: '전날 대비 -1kg' 포함", () => {
    const log: DailyLog = { ...baseDailyLog, weight: 80 };
    const result = generateFeedback(log, 81, 79, waterGoal);
    expect(result).toContain("전날 대비 -1kg");
  });

  it("2. prevWeight 있고 체중 증가: '전날 대비 +0.5kg' 포함 (+ 부호 확인)", () => {
    const log: DailyLog = { ...baseDailyLog, weight: 80.5 };
    const result = generateFeedback(log, 80, 79, waterGoal);
    expect(result).toContain("전날 대비 +0.5kg");
  });

  it("3. prevWeight=null → '체중 80kg 기록 완료.' 포함, '전날 대비' 미포함", () => {
    const log: DailyLog = { ...baseDailyLog, weight: 80 };
    const result = generateFeedback(log, null, 79, waterGoal);
    expect(result).toContain("체중 80kg 기록 완료.");
    expect(result).not.toContain("전날 대비");
  });

  it("4. weight > lowestWeight → 역대 최저 경고 문구 없음 (제거됨)", () => {
    const log: DailyLog = { ...baseDailyLog, weight: 80 };
    const result = generateFeedback(log, null, 79, waterGoal);
    expect(result).not.toContain("역대 최저(79kg)보다");
  });

  it("5. weight <= lowestWeight → '역대 최저 기록 갱신!' 포함", () => {
    const log: DailyLog = { ...baseDailyLog, weight: 79 };
    const result = generateFeedback(log, null, 79, waterGoal);
    expect(result).toContain("역대 최저 기록 갱신!");
  });

  it("6. lowestWeight=Infinity → 역대최저 관련 문구 없음", () => {
    const log: DailyLog = { ...baseDailyLog, weight: 80 };
    const result = generateFeedback(log, null, Infinity, waterGoal);
    expect(result).not.toContain("역대 최저");
  });

  it("7. water=2.0, waterGoal=2.5 (목표 미달) → '수분 80%' 포함, 'L 남았어' 포함", () => {
    const log: DailyLog = { ...baseDailyLog, water: 2.0 };
    const result = generateFeedback(log, null, Infinity, waterGoal);
    expect(result).toContain("수분 80%");
    expect(result).toContain("L 남았어");
  });

  it("8. water=2.5, waterGoal=2.5 (목표 달성) → '수분 목표 달성!' 포함", () => {
    const log: DailyLog = { ...baseDailyLog, water: 2.5 };
    const result = generateFeedback(log, null, Infinity, waterGoal);
    expect(result).toContain("수분 목표 달성!");
  });

  it("9. water=null → 수분 관련 문구 없음", () => {
    const log: DailyLog = { ...baseDailyLog, water: null };
    const result = generateFeedback(log, null, Infinity, waterGoal);
    expect(result).not.toContain("수분");
  });

  it("10. intensiveDay=true → 'Hard Reset Mode' 포함", () => {
    const log: DailyLog = { ...baseDailyLog, intensiveDay: true };
    const result = generateFeedback(log, null, Infinity, waterGoal);
    expect(result).toContain("Hard Reset Mode");
  });

  it("11. intensiveDay=false, 입력 없음 → '이 흐름 이어가자' 포함", () => {
    // 체중·수분·운동 모두 null이어야 parts가 비어서 else 분기 실행됨
    const log: DailyLog = { ...baseDailyLog, weight: null, water: null, exercise: null, lateSnack: null, intensiveDay: false };
    const result = generateFeedback(log, null, Infinity, waterGoal);
    expect(result).toContain("이 흐름 이어가자");
  });
});

// ─────────────────────────────────────────────
// generateDailySummary
// ─────────────────────────────────────────────
describe("generateDailySummary", () => {
  const waterGoal = 2.5;

  it("12. weight=80, weightChange=-5 → '오늘 체중 80kg' 및 '빠졌어' 포함", () => {
    const log: DailyLog = { ...baseDailyLog, weight: 80, weightChange: -5 };
    const result = generateDailySummary(log, waterGoal);
    expect(result).toContain("오늘 체중 80kg");
    expect(result).toContain("빠졌어");
  });

  it("13. weight=80, weightChange=+2 → '시작 대비 2kg 올랐어' 포함 (+ 부호 없음)", () => {
    const log: DailyLog = { ...baseDailyLog, weight: 80, weightChange: 2 };
    const result = generateDailySummary(log, waterGoal);
    expect(result).toContain("시작 대비 2kg 올랐어");
  });

  it("14. weight=80, weightChange=null → '시작 대비' 미포함", () => {
    const log: DailyLog = { ...baseDailyLog, weight: 80, weightChange: null };
    const result = generateDailySummary(log, waterGoal);
    expect(result).not.toContain("시작 대비");
  });

  it("15. weight=null → 체중 관련 문구 없음", () => {
    const log: DailyLog = { ...baseDailyLog, weight: null };
    const result = generateDailySummary(log, waterGoal);
    expect(result).not.toContain("체중");
  });

  it("16. breakfast/lunch/dinner 모두 있음 → '세 끼 다 챙겼네' 포함", () => {
    const log: DailyLog = {
      ...baseDailyLog,
      breakfast: "오트밀",
      lunch: "샐러드",
      dinner: "닭가슴살",
    };
    const result = generateDailySummary(log, waterGoal);
    expect(result).toContain("세 끼 다 챙겼네");
  });

  it("17. breakfast만 있음 → '세 끼' 미포함 (1끼는 특수 문구 없음)", () => {
    const log: DailyLog = {
      ...baseDailyLog,
      breakfast: "오트밀",
      lunch: null,
      dinner: null,
    };
    const result = generateDailySummary(log, waterGoal);
    expect(result).not.toContain("세 끼");
    expect(result).not.toContain("기록이 없어");
  });

  it("18. exercise='Y', lateSnack='N' → '운동하고 야식도 참았어' 포함", () => {
    const log: DailyLog = { ...baseDailyLog, exercise: "Y", lateSnack: "N" };
    const result = generateDailySummary(log, waterGoal);
    expect(result).toContain("운동하고 야식도 참았어");
  });

  it("19. exercise='N', lateSnack='N' → '야식은 참았어' 포함", () => {
    const log: DailyLog = { ...baseDailyLog, exercise: "N", lateSnack: "N" };
    const result = generateDailySummary(log, waterGoal);
    expect(result).toContain("야식은 참았어");
  });

  it("20. exercise='Y', lateSnack='Y' → '야식이 그 효과를 일부 상쇄했어' 포함", () => {
    const log: DailyLog = { ...baseDailyLog, exercise: "Y", lateSnack: "Y" };
    const result = generateDailySummary(log, waterGoal);
    expect(result).toContain("야식이 그 효과를 일부 상쇄했어");
  });

  it("21. intensiveDay=true → 'Hard Reset Mode였어' 포함", () => {
    const log: DailyLog = { ...baseDailyLog, intensiveDay: true };
    const result = generateDailySummary(log, waterGoal);
    expect(result).toContain("Hard Reset Mode였어");
  });

  it("22. intensiveDay=false → '내일도 오늘처럼 꾸준하게.' 포함", () => {
    const log: DailyLog = { ...baseDailyLog, intensiveDay: false };
    const result = generateDailySummary(log, waterGoal);
    expect(result).toContain("내일도 오늘처럼 꾸준하게.");
  });
});

// ─────────────────────────────────────────────
// generateOneLiner
// ─────────────────────────────────────────────
describe("generateOneLiner", () => {
  it("23. intensiveDay=true, exercise=Y, lateSnack=N → 'Hard Reset Mode에 운동까지' 포함 (1순위)", () => {
    const log: DailyLog = {
      ...baseDailyLog,
      intensiveDay: true,
      exercise: "Y",
      lateSnack: "N",
    };
    const result = generateOneLiner(log);
    expect(result).toContain("Hard Reset Mode에 운동까지");
  });

  it("24. intensiveDay=true, lateSnack=Y → 'Hard Reset Mode인데 야식까지' 포함 (2순위)", () => {
    const log: DailyLog = {
      ...baseDailyLog,
      intensiveDay: true,
      exercise: "N",
      lateSnack: "Y",
    };
    const result = generateOneLiner(log);
    expect(result).toContain("Hard Reset Mode인데 야식까지");
  });

  it("25. exercise=Y, lateSnack=N → '운동하고 야식 안 먹은 하루' 포함 (3순위)", () => {
    const log: DailyLog = {
      ...baseDailyLog,
      intensiveDay: false,
      exercise: "Y",
      lateSnack: "N",
    };
    const result = generateOneLiner(log);
    expect(result).toContain("운동하고 야식 안 먹은 하루");
  });

  it("26. exercise=N, lateSnack=Y → '운동도 야식도 아쉬운 하루' 포함 (4순위)", () => {
    const log: DailyLog = {
      ...baseDailyLog,
      intensiveDay: false,
      exercise: "N",
      lateSnack: "Y",
    };
    const result = generateOneLiner(log);
    expect(result).toContain("운동도 야식도 아쉬운 하루");
  });

  it("27. weight=75, weightChange=-4 (<-3), exercise=null, lateSnack=null → 'kg 감량 — 순항 중이야' 포함 (5순위)", () => {
    const log: DailyLog = {
      ...baseDailyLog,
      intensiveDay: false,
      weight: 75,
      weightChange: -4,
      exercise: null,
      lateSnack: null,
    };
    const result = generateOneLiner(log);
    expect(result).toContain("kg 감량 — 순항 중이야");
  });

  it("28. (우선순위 검증) exercise=Y, lateSnack=N, weightChange=-4 → 3순위('운동하고 야식 안 먹은 하루') 반환, 5순위 아님", () => {
    const log: DailyLog = {
      ...baseDailyLog,
      intensiveDay: false,
      exercise: "Y",
      lateSnack: "N",
      weightChange: -4,
    };
    const result = generateOneLiner(log);
    expect(result).toContain("운동하고 야식 안 먹은 하루");
    expect(result).not.toContain("kg 감량 — 순항 중이야");
  });

  it("29. 조건 없음 (모두 null) → '오늘 하루 수고했어' 포함 (기본값)", () => {
    const log: DailyLog = {
      ...baseDailyLog,
      intensiveDay: false,
      exercise: null,
      lateSnack: null,
      weight: null,
      weightChange: null,
    };
    const result = generateOneLiner(log);
    expect(result).toContain("오늘 하루 수고했어");
  });
});

// ─────────────────────────────────────────────
// generateWeeklySummary
// ─────────────────────────────────────────────
describe("generateWeeklySummary", () => {
  const makeLog = (weight: number | null): DailyLog => ({
    ...baseDailyLog,
    weight,
  });

  it("30. 평균체중 고정 문장: avgWeight=80.1 → '이번 주 평균 체중은 80.1kg.' 항상 포함", () => {
    const result = generateWeeklySummary([], 80.1, 3, 1);
    expect(result).toContain("이번 주 평균 체중은 80.1kg.");
  });

  it("31. exerciseDays=5 → '운동 습관 훌륭해.' 포함", () => {
    const result = generateWeeklySummary([], 80, 5, 1);
    expect(result).toContain("운동 습관 훌륭해.");
  });

  it("32. exerciseDays=6 → '운동 습관 훌륭해.' 포함 (>=5)", () => {
    const result = generateWeeklySummary([], 80, 6, 1);
    expect(result).toContain("운동 습관 훌륭해.");
  });

  it("33. exerciseDays=2 → '운동 일수가 부족해' 포함", () => {
    const result = generateWeeklySummary([], 80, 2, 1);
    expect(result).toContain("운동 일수가 부족해");
  });

  it("34. exerciseDays=3 → 운동 특수 문구 없음 (중간값)", () => {
    const result = generateWeeklySummary([], 80, 3, 1);
    expect(result).not.toContain("운동 습관 훌륭해.");
    expect(result).not.toContain("운동 일수가 부족해");
  });

  it("35. lateSnackCount=3 → '야식이 잦았어' 포함", () => {
    const result = generateWeeklySummary([], 80, 3, 3);
    expect(result).toContain("야식이 잦았어");
  });

  it("36. lateSnackCount=0 → '야식 0회 — 완벽한 절제야.' 포함", () => {
    const result = generateWeeklySummary([], 80, 3, 0);
    expect(result).toContain("야식 0회 — 완벽한 절제야.");
  });

  it("37. lateSnackCount=1 → 야식 특수 문구 없음", () => {
    const result = generateWeeklySummary([], 80, 3, 1);
    expect(result).not.toContain("야식이 잦았어");
    expect(result).not.toContain("야식 0회");
  });

  it("38. 체중 감소 추세: logs=[{weight:79(최신)}, {weight:80(가장 오래됨)}] → 'kg 감소' 포함", () => {
    // weights[0]=79(newest=last), weights[length-1]=80(oldest=first)
    // trend = last - first = 79 - 80 = -1 → 감소
    const logs = [makeLog(79), makeLog(80)];
    const result = generateWeeklySummary(logs, 80, 3, 1);
    expect(result).toContain("kg 감소");
  });

  it("39. 체중 증가 추세: logs=[{weight:81(최신)}, {weight:79(가장 오래됨)}] → 'kg 증가' 포함", () => {
    // weights[0]=81(newest=last), weights[length-1]=79(oldest=first)
    // trend = last - first = 81 - 79 = +2 → 증가
    const logs = [makeLog(81), makeLog(79)];
    const result = generateWeeklySummary(logs, 80, 3, 1);
    expect(result).toContain("kg 증가");
  });

  it("40. 체중 데이터 1개 → 추세 문구 없음", () => {
    const logs = [makeLog(80)];
    const result = generateWeeklySummary(logs, 80, 3, 1);
    expect(result).not.toContain("kg 감소");
    expect(result).not.toContain("kg 증가");
  });

  it("41. 고정 마지막 문장: '다음 주도 꾸준히.' 항상 포함", () => {
    const result = generateWeeklySummary([], 80, 3, 1);
    expect(result).toContain("다음 주도 꾸준히.");
  });
});
