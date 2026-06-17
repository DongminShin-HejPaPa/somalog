import { describe, it, expect } from "vitest";
import { decideGoalEventKind } from "@/lib/services/achievement-service";

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
