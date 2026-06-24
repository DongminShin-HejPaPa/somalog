import { describe, it, expect } from "vitest";
import { bragAnniversary, completedBragMilestones } from "@/lib/utils/brag-schedule";

describe("bragAnniversary", () => {
  // 사용자 예시: 1/5 시작 → 1번째 2/4, 2번째 3/4, 3번째 4/4
  it("시작 1/5 의 마일스톤 기념일은 2/4, 3/4, 4/4", () => {
    expect(bragAnniversary("2024-01-05", 1)).toBe("2024-02-04");
    expect(bragAnniversary("2024-01-05", 2)).toBe("2024-03-04");
    expect(bragAnniversary("2024-01-05", 3)).toBe("2024-04-04");
  });
});

describe("completedBragMilestones", () => {
  it("기념일 하루 전엔 0 (아직 도달 안 함)", () => {
    expect(completedBragMilestones("2024-01-05", "2024-02-03")).toBe(0);
  });

  it("기념일 당일 1 도달", () => {
    expect(completedBragMilestones("2024-01-05", "2024-02-04")).toBe(1);
  });

  it("그 다음 날에도 여전히 1 (다음 기념일 전까지)", () => {
    expect(completedBragMilestones("2024-01-05", "2024-02-20")).toBe(1);
  });

  it("2번째·3번째 기념일 도달", () => {
    expect(completedBragMilestones("2024-01-05", "2024-03-04")).toBe(2);
    expect(completedBragMilestones("2024-01-05", "2024-04-04")).toBe(3);
  });

  it("시작 당일엔 0", () => {
    expect(completedBragMilestones("2024-01-05", "2024-01-05")).toBe(0);
  });

  it("빈 시작일이면 0", () => {
    expect(completedBragMilestones("", "2024-04-04")).toBe(0);
  });
});
