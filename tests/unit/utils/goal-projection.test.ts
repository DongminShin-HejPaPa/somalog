import { describe, it, expect } from "vitest";
import { projectGoalEta } from "@/lib/utils/goal-projection";

describe("projectGoalEta", () => {
  // 시작 90kg, 목표 80kg, 시작일 2026-01-01
  const base = {
    startWeight: 90,
    targetWeight: 80,
    startDate: "2026-01-01",
  };
  const day = 86_400_000;
  const start = new Date("2026-01-01T00:00:00").getTime();

  it("100일 경과·현재 85kg(하루 0.05kg 감량) → 남은 5kg ÷ 0.05 = 100일", () => {
    const nowMs = start + 100 * day;
    const { daysToGoal } = projectGoalEta({ ...base, currentWeight: 85, nowMs });
    // dailyRate = (90-85)/100 = 0.05, remaining = 5 → 100일
    expect(daysToGoal).toBe(100);
  });

  it("예상 도달일(estimatedAtMs)은 nowMs + daysToGoal", () => {
    const nowMs = start + 100 * day;
    const { daysToGoal, estimatedAtMs } = projectGoalEta({
      ...base,
      currentWeight: 85,
      nowMs,
    });
    expect(estimatedAtMs).toBe(nowMs + daysToGoal! * day);
  });

  it("이미 목표 도달(remaining ≤ 0) → null", () => {
    const nowMs = start + 100 * day;
    const { daysToGoal, estimatedAtMs } = projectGoalEta({
      ...base,
      currentWeight: 79,
      nowMs,
    });
    expect(daysToGoal).toBeNull();
    expect(estimatedAtMs).toBeNull();
  });

  it("감량 추세 없음(현재 ≥ 시작) → null", () => {
    const nowMs = start + 100 * day;
    const { daysToGoal } = projectGoalEta({
      ...base,
      currentWeight: 91,
      nowMs,
    });
    expect(daysToGoal).toBeNull();
  });

  it("경과일 0 이하 → null (0 나눗셈 방지)", () => {
    const { daysToGoal } = projectGoalEta({
      ...base,
      currentWeight: 85,
      nowMs: start,
    });
    expect(daysToGoal).toBeNull();
  });
});
