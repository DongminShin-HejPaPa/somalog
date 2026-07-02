import { describe, it, expect } from "vitest";
import {
  decideGoalEventKind,
  decideMilestoneReached,
  decideStreakMilestone,
  computeCurrentStreak,
  decideNewLow,
  decideEtaMilestone,
  computeConsecutiveLossWeeks,
  decideWeeklyLossMilestone,
  decideAnniversary,
  decideBirthday,
} from "@/lib/services/achievement-service";

describe("decideGoalEventKind", () => {
  const base = {
    targetWeight: 70,
    mode: "losing" as const,
    hasExistingAchievement: false,
    prevWeight: 72,
  };

  it("체중 미입력 → null", () => {
    expect(decideGoalEventKind({ ...base, weight: null })).toBeNull();
  });

  it("목표 미설정(0) → null", () => {
    expect(
      decideGoalEventKind({ ...base, weight: 65, targetWeight: 0 })
    ).toBeNull();
  });

  it("목표 초과(아직 미도달) → null", () => {
    expect(decideGoalEventKind({ ...base, weight: 71 })).toBeNull();
  });

  it("최초 도달(이력 없음) → first", () => {
    expect(decideGoalEventKind({ ...base, weight: 70 })).toBe("first");
    expect(decideGoalEventKind({ ...base, weight: 68 })).toBe("first");
  });

  it("이력 있음 + 유지 모드 + 직전 체중 목표 이하 → null (목표 이하 유지 중 매일 토스트 방지)", () => {
    expect(
      decideGoalEventKind({
        ...base,
        weight: 68,
        hasExistingAchievement: true,
        mode: "maintaining",
        prevWeight: 69, // 직전도 목표 이하
      })
    ).toBeNull();
  });

  it("이력 있음 + 유지 모드 + 직전 체중 목표 위 → repeat (유지 중 요요 복귀도 격려)", () => {
    expect(
      decideGoalEventKind({
        ...base,
        weight: 68,
        hasExistingAchievement: true,
        mode: "maintaining",
        prevWeight: 72, // 요요로 목표 위였다가 복귀
      })
    ).toBe("repeat");
  });

  it("이력 있음 + 감량 모드 + 직전 체중 목표 위 → repeat (요요 후 복귀)", () => {
    expect(
      decideGoalEventKind({
        ...base,
        weight: 69,
        hasExistingAchievement: true,
        prevWeight: 72,
      })
    ).toBe("repeat");
  });

  it("이력 있음 + 감량 모드 + 직전 체중도 목표 이하 → null (연속 목표 이하, 매일 토스트 방지)", () => {
    expect(
      decideGoalEventKind({
        ...base,
        weight: 69,
        hasExistingAchievement: true,
        prevWeight: 69,
      })
    ).toBeNull();
  });

  it("이력 있음 + 감량 모드 + 직전 체중 없음(null) → repeat", () => {
    expect(
      decideGoalEventKind({
        ...base,
        weight: 69,
        hasExistingAchievement: true,
        prevWeight: null,
      })
    ).toBe("repeat");
  });

  it("정확히 목표 체중(경계값) → 달성으로 처리", () => {
    expect(decideGoalEventKind({ ...base, weight: 70 })).toBe("first");
  });
});

describe("decideMilestoneReached", () => {
  const base = { startWeight: 90, reachedMilestones: [] as number[] };

  it("체중 미입력 → null", () => {
    expect(decideMilestoneReached({ ...base, weight: null })).toBeNull();
  });

  it("감량 5kg 미만 → null", () => {
    expect(decideMilestoneReached({ ...base, weight: 86 })).toBeNull();
  });

  it("정확히 5kg 감량 → 5 (경계)", () => {
    expect(decideMilestoneReached({ ...base, weight: 85 })).toBe(5);
  });

  it("7kg 감량 → 5 (5단위 내림)", () => {
    expect(decideMilestoneReached({ ...base, weight: 83 })).toBe(5);
  });

  it("12kg 감량인데 5는 이미 달성 → 10", () => {
    expect(
      decideMilestoneReached({ ...base, weight: 78, reachedMilestones: [5] })
    ).toBe(10);
  });

  it("이미 최고 마일스톤(10) 달성 + 더 감량 안 됨 → null (중복 방지)", () => {
    expect(
      decideMilestoneReached({ ...base, weight: 79, reachedMilestones: [5, 10] })
    ).toBeNull();
  });

  it("점프 감량 12kg + 이력 없음 → 10 (최고만 인정, 중간 5 건너뜀)", () => {
    expect(decideMilestoneReached({ ...base, weight: 78 })).toBe(10);
  });

  it("startWeight 0 → null", () => {
    expect(
      decideMilestoneReached({ weight: 70, startWeight: 0, reachedMilestones: [] })
    ).toBeNull();
  });
});

describe("computeCurrentStreak", () => {
  it("endDate에 기록 없음 → 0", () => {
    expect(computeCurrentStreak(["2026-06-10"], "2026-06-12")).toBe(0);
  });

  it("당일만 기록 → 1", () => {
    expect(computeCurrentStreak(["2026-06-12"], "2026-06-12")).toBe(1);
  });

  it("연속 3일 → 3", () => {
    expect(
      computeCurrentStreak(
        ["2026-06-10", "2026-06-11", "2026-06-12"],
        "2026-06-12"
      )
    ).toBe(3);
  });

  it("중간에 하루 빠지면 끊겨서 직전 연속분만 카운트", () => {
    // 6/9 기록, 6/10 없음, 6/11·6/12 연속 → endDate 기준 2
    expect(
      computeCurrentStreak(
        ["2026-06-09", "2026-06-11", "2026-06-12"],
        "2026-06-12"
      )
    ).toBe(2);
  });

  it("월 경계를 넘는 연속도 정확히 카운트", () => {
    expect(
      computeCurrentStreak(
        ["2026-05-31", "2026-06-01", "2026-06-02"],
        "2026-06-02"
      )
    ).toBe(3);
  });

  it("순서가 뒤섞여도 동일 결과 (Set 기반)", () => {
    expect(
      computeCurrentStreak(
        ["2026-06-12", "2026-06-10", "2026-06-11"],
        "2026-06-12"
      )
    ).toBe(3);
  });
});

describe("decideStreakMilestone (10일 단위)", () => {
  it("10일 미만 → null", () => {
    expect(
      decideStreakMilestone({ currentStreak: 9, reachedMilestones: [] })
    ).toBeNull();
  });

  it("정확히 10일 → 10 (경계)", () => {
    expect(
      decideStreakMilestone({ currentStreak: 10, reachedMilestones: [] })
    ).toBe(10);
  });

  it("14일 → 10 (10단위 내림)", () => {
    expect(
      decideStreakMilestone({ currentStreak: 14, reachedMilestones: [] })
    ).toBe(10);
  });

  it("15일인데 10은 이미 달성 → null (다음 단위 20 미도달)", () => {
    expect(
      decideStreakMilestone({ currentStreak: 15, reachedMilestones: [10] })
    ).toBeNull();
  });

  it("20일 + 10만 달성 → 20", () => {
    expect(
      decideStreakMilestone({ currentStreak: 20, reachedMilestones: [10] })
    ).toBe(20);
  });

  it("백필로 47일 + 이력 없음 → 40 (최고만 인정, 중간 건너뜀)", () => {
    expect(
      decideStreakMilestone({ currentStreak: 47, reachedMilestones: [] })
    ).toBe(40);
  });

  it("이미 40 달성 + 45일 → null (다음 50 미도달)", () => {
    expect(
      decideStreakMilestone({ currentStreak: 45, reachedMilestones: [10, 20, 30, 40] })
    ).toBeNull();
  });
});

describe("decideNewLow", () => {
  it("역대 최저보다 낮음 → true (최저 경신마다 축하)", () => {
    expect(decideNewLow({ weight: 79, prevMin: 80 })).toBe(true);
  });

  it("하강 구간(직전이 곧 최저)에도 매일 true (의도된 동작)", () => {
    // 어제가 최저 80이고 오늘 79 → 여전히 갱신으로 축하
    expect(decideNewLow({ weight: 79, prevMin: 80 })).toBe(true);
  });

  it("역대 최저와 같음(경계) → false", () => {
    expect(decideNewLow({ weight: 80, prevMin: 80 })).toBe(false);
  });

  it("최저 위에 머무름 → false", () => {
    expect(decideNewLow({ weight: 81, prevMin: 80 })).toBe(false);
  });

  it("체중 또는 이전 최저가 null → false (최초 기록은 갱신 아님)", () => {
    expect(decideNewLow({ weight: null, prevMin: 80 })).toBe(false);
    expect(decideNewLow({ weight: 79, prevMin: null })).toBe(false);
  });
});

describe("decideEtaMilestone", () => {
  it("예상 잔여일 null(투영 불가) → null", () => {
    expect(
      decideEtaMilestone({ daysToGoal: null, reachedThresholds: [] })
    ).toBeNull();
  });

  it("40일 → null (30 임계 미진입)", () => {
    expect(
      decideEtaMilestone({ daysToGoal: 40, reachedThresholds: [] })
    ).toBeNull();
  });

  it("25일 → 30 (30 임계 첫 진입)", () => {
    expect(
      decideEtaMilestone({ daysToGoal: 25, reachedThresholds: [] })
    ).toBe(30);
  });

  it("10일 + 30 이미 축하 → 14 (다음 임계)", () => {
    expect(
      decideEtaMilestone({ daysToGoal: 10, reachedThresholds: [30] })
    ).toBe(14);
  });

  it("한 번에 5일로 급락 + 이력 없음 → 30 (큰 것부터 한 단계씩)", () => {
    expect(
      decideEtaMilestone({ daysToGoal: 5, reachedThresholds: [] })
    ).toBe(30);
  });

  it("5일 + 30·14 이미 축하 → 7 (마지막 임계)", () => {
    expect(
      decideEtaMilestone({ daysToGoal: 5, reachedThresholds: [30, 14] })
    ).toBe(7);
  });

  it("모든 임계 축하 완료 → null", () => {
    expect(
      decideEtaMilestone({ daysToGoal: 3, reachedThresholds: [30, 14, 7] })
    ).toBeNull();
  });
});

describe("computeConsecutiveLossWeeks", () => {
  it("연속 3주 감량(최신순) → 3", () => {
    expect(computeConsecutiveLossWeeks([70, 71, 72, 73])).toBe(3);
  });

  it("최신 주가 증가 → 0", () => {
    expect(computeConsecutiveLossWeeks([72, 71, 70])).toBe(0);
  });

  it("2주 감량 후 정체로 끊김 → 2", () => {
    expect(computeConsecutiveLossWeeks([70, 71, 72, 72, 73])).toBe(2);
  });

  it("데이터 1개 이하 → 0", () => {
    expect(computeConsecutiveLossWeeks([70])).toBe(0);
    expect(computeConsecutiveLossWeeks([])).toBe(0);
  });
});

describe("decideWeeklyLossMilestone", () => {
  it("2주 미만 → null", () => {
    expect(
      decideWeeklyLossMilestone({ consecutiveLossWeeks: 1, reachedMilestones: [] })
    ).toBeNull();
  });

  it("정확히 2주 → 2", () => {
    expect(
      decideWeeklyLossMilestone({ consecutiveLossWeeks: 2, reachedMilestones: [] })
    ).toBe(2);
  });

  it("5주 + 2·4 달성 → null (다음 8 미도달)", () => {
    expect(
      decideWeeklyLossMilestone({ consecutiveLossWeeks: 5, reachedMilestones: [2, 4] })
    ).toBeNull();
  });

  it("9주 + 2·4 달성 → 8", () => {
    expect(
      decideWeeklyLossMilestone({ consecutiveLossWeeks: 9, reachedMilestones: [2, 4] })
    ).toBe(8);
  });
});

describe("decideAnniversary", () => {
  it("364일 → null", () => {
    expect(decideAnniversary({ elapsedDays: 364, reachedYears: [] })).toBeNull();
  });

  it("365일 → 1 (1주년)", () => {
    expect(decideAnniversary({ elapsedDays: 365, reachedYears: [] })).toBe(1);
  });

  it("400일 + 1주년 이미 축하 → null", () => {
    expect(decideAnniversary({ elapsedDays: 400, reachedYears: [1] })).toBeNull();
  });

  it("730일 + 1주년만 축하 → 2 (2주년)", () => {
    expect(decideAnniversary({ elapsedDays: 730, reachedYears: [1] })).toBe(2);
  });
});

describe("decideBirthday", () => {
  it("생일 미설정 → null", () => {
    expect(
      decideBirthday({ today: "2026-07-02", birthDate: null, reachedYears: [] })
    ).toBeNull();
  });

  it("월-일 불일치 → null", () => {
    expect(
      decideBirthday({ today: "2026-07-02", birthDate: "1990-08-15", reachedYears: [] })
    ).toBeNull();
  });

  it("월-일 일치(연도 무관) → 해당 연도", () => {
    expect(
      decideBirthday({ today: "2026-08-15", birthDate: "1990-08-15", reachedYears: [] })
    ).toBe(2026);
  });

  it("올해 이미 축하 → null", () => {
    expect(
      decideBirthday({ today: "2026-08-15", birthDate: "1990-08-15", reachedYears: [2026] })
    ).toBeNull();
  });
});
