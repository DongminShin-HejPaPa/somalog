import { describe, it, expect } from "vitest";
import {
  decideGoalEventKind,
  decideMilestoneReached,
  decideStreakMilestone,
  computeCurrentStreak,
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

describe("decideStreakMilestone", () => {
  it("7일 미만 → null", () => {
    expect(
      decideStreakMilestone({ currentStreak: 6, reachedMilestones: [] })
    ).toBeNull();
  });

  it("정확히 7일 → 7 (경계)", () => {
    expect(
      decideStreakMilestone({ currentStreak: 7, reachedMilestones: [] })
    ).toBe(7);
  });

  it("8일인데 7은 이미 달성 → null (다음 단위 30 미도달)", () => {
    expect(
      decideStreakMilestone({ currentStreak: 8, reachedMilestones: [7] })
    ).toBeNull();
  });

  it("30일 + 7만 달성 → 30", () => {
    expect(
      decideStreakMilestone({ currentStreak: 30, reachedMilestones: [7] })
    ).toBe(30);
  });

  it("백필로 120일 + 이력 없음 → 100 (최고만 인정, 중간 건너뜀)", () => {
    expect(
      decideStreakMilestone({ currentStreak: 120, reachedMilestones: [] })
    ).toBe(100);
  });

  it("최고 마일스톤(365) 달성 후 더 길어져도 → null", () => {
    expect(
      decideStreakMilestone({
        currentStreak: 400,
        reachedMilestones: [7, 30, 100, 200, 365],
      })
    ).toBeNull();
  });
});
