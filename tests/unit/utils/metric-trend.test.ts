import { describe, it, expect } from "vitest";
import { computeCumulativeRate, didOccur } from "@/lib/utils/metric-trend";
import type { DailyEventPoint } from "@/lib/types";

function pt(date: string, over: Partial<DailyEventPoint> = {}): DailyEventPoint {
  return {
    date,
    exercise: null,
    lateSnack: null,
    dinnerAlcohol: null,
    lateSnackAlcohol: null,
    ...over,
  };
}

describe("computeCumulativeRate", () => {
  it("빈 시리즈 → []", () => {
    expect(computeCumulativeRate([], "exercise", "2024-01-01")).toEqual([]);
  });

  it("사용자 예시: 시작 1/1, 1/5 점 = (1/1~1/5 운동일) ÷ 5", () => {
    // 1/1 운동, 1/2 안함, 1/5 운동 → 누적: 100% / 50% / 40%
    const series = [
      pt("2024-01-01", { exercise: "Y" }),
      pt("2024-01-02", { exercise: "N" }),
      pt("2024-01-05", { exercise: "Y" }),
    ];
    const r = computeCumulativeRate(series, "exercise", "2024-01-01");
    expect(r).toEqual([
      { date: "2024-01-01", pct: 100 },
      { date: "2024-01-02", pct: 50 },
      { date: "2024-01-05", pct: 40 },
    ]);
  });

  it("startDate=null 이면 시리즈 첫 날짜를 시작으로 사용", () => {
    const series = [pt("2024-03-10", { exercise: "Y" }), pt("2024-03-12", { exercise: "Y" })];
    const r = computeCumulativeRate(series, "exercise", null);
    // 3/10: 1/1=100%, 3/12: 2/3=67%
    expect(r[0]).toEqual({ date: "2024-03-10", pct: 100 });
    expect(r[1]).toEqual({ date: "2024-03-12", pct: 67 });
  });

  it("술: 저녁/야식 술 둘 중 하나라도 true 면 발생", () => {
    const series = [
      pt("2024-01-01", { dinnerAlcohol: true }),
      pt("2024-01-02", { lateSnackAlcohol: true }),
      pt("2024-01-03"),
    ];
    const r = computeCumulativeRate(series, "alcohol", "2024-01-01");
    expect(r.map((p) => p.pct)).toEqual([100, 100, 67]);
  });
});

describe("didOccur", () => {
  it("운동: Y/실제값은 발생, N·SKIP·null 은 미발생", () => {
    expect(didOccur("exercise", pt("d", { exercise: "Y" }))).toBe(true);
    expect(didOccur("exercise", pt("d", { exercise: "N" }))).toBe(false);
    expect(didOccur("exercise", pt("d", { exercise: "SKIP" }))).toBe(false);
    expect(didOccur("exercise", pt("d", { exercise: null }))).toBe(false);
  });
});
