import { describe, it, expect } from "vitest";
import { computeCumulativeRate, didOccur, didRecord } from "@/lib/utils/metric-trend";
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
    expect(computeCumulativeRate([], "exercise")).toEqual([]);
  });

  it("기록한 날만 분모로 센다 — 기록 없는 날은 pct=null", () => {
    // 1/1 운동함, 1/2 미기록, 1/3 안함, 1/5 운동함
    // 기록일 기준 누적: 1/1=1/1=100%, 1/2=null, 1/3=1/2=50%, 1/5=2/3=67%
    const series = [
      pt("2024-01-01", { exercise: "Y" }),
      pt("2024-01-02"),
      pt("2024-01-03", { exercise: "N" }),
      pt("2024-01-05", { exercise: "Y" }),
    ];
    const r = computeCumulativeRate(series, "exercise");
    expect(r).toEqual([
      { date: "2024-01-01", pct: 100 },
      { date: "2024-01-02", pct: null },
      { date: "2024-01-03", pct: 50 },
      { date: "2024-01-05", pct: 67 },
    ]);
  });

  it("SKIP/안함도 기록으로 인정 → 분모에 포함", () => {
    const series = [
      pt("2024-03-10", { exercise: "SKIP" }),
      pt("2024-03-12", { exercise: "Y" }),
    ];
    const r = computeCumulativeRate(series, "exercise");
    // 3/10: 0/1=0%, 3/12: 1/2=50%
    expect(r).toEqual([
      { date: "2024-03-10", pct: 0 },
      { date: "2024-03-12", pct: 50 },
    ]);
  });

  it("술: 저녁/야식 술 플래그가 non-null 인 날만 기록으로 센다", () => {
    // 1/1 저녁 술O(기록·발생), 1/2 야식 술X=false(기록·미발생), 1/3 미기록(null)
    const series = [
      pt("2024-01-01", { dinnerAlcohol: true }),
      pt("2024-01-02", { lateSnackAlcohol: false }),
      pt("2024-01-03"),
    ];
    const r = computeCumulativeRate(series, "alcohol");
    expect(r).toEqual([
      { date: "2024-01-01", pct: 100 },
      { date: "2024-01-02", pct: 50 },
      { date: "2024-01-03", pct: null },
    ]);
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

describe("didRecord", () => {
  it("운동/야식: 값이 있으면(했음/안했음 모두) 기록", () => {
    expect(didRecord("exercise", pt("d", { exercise: "Y" }))).toBe(true);
    expect(didRecord("exercise", pt("d", { exercise: "SKIP" }))).toBe(true);
    expect(didRecord("exercise", pt("d", { exercise: null }))).toBe(false);
    expect(didRecord("lateSnack", pt("d", { lateSnack: "N" }))).toBe(true);
    expect(didRecord("lateSnack", pt("d", { lateSnack: null }))).toBe(false);
  });

  it("술: 저녁 또는 야식 술 플래그가 non-null 이면 기록", () => {
    expect(didRecord("alcohol", pt("d", { dinnerAlcohol: false }))).toBe(true);
    expect(didRecord("alcohol", pt("d", { lateSnackAlcohol: true }))).toBe(true);
    expect(didRecord("alcohol", pt("d"))).toBe(false);
  });
});
