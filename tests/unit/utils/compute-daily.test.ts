import { vi } from "vitest";
import type { DailyLog } from "@/lib/types";
import {
  computeDay,
  computeWeightChange,
  computeAvgWeight3d,
  computeIntensiveDay,
  getLowestWeightFromLogs,
} from "@/lib/utils/compute-daily";

// DailyLog partial 생성 헬퍼
function makeLog(date: string, weight: number | null): DailyLog {
  return {
    date,
    day: 1,
    weight,
    avgWeight3d: null,
    weightChange: null,
    water: null,
    exercise: null,
    breakfast: null,
    lunch: null,
    dinner: null,
    lateSnack: null,
    energy: null,
    note: null,
    closed: false,
    intensiveDay: null,
    feedback: null,
    dailySummary: null,
    oneLiner: null,
  };
}

describe("computeDay", () => {
  it("시작일 당일은 1을 반환한다", () => {
    expect(computeDay("2024-01-01", "2024-01-01")).toBe(1);
  });

  it("1일 후는 2를 반환한다", () => {
    expect(computeDay("2024-01-02", "2024-01-01")).toBe(2);
  });

  it("30일 후는 31을 반환한다", () => {
    expect(computeDay("2024-01-31", "2024-01-01")).toBe(31);
  });

  it("시작일 하루 전은 0을 반환한다", () => {
    expect(computeDay("2023-12-31", "2024-01-01")).toBe(0);
  });
});

describe("computeWeightChange", () => {
  it("체중 감소 시 음수를 반환한다: 75 - 80 = -5.0", () => {
    expect(computeWeightChange(75, 80)).toBe(-5.0);
  });

  it("체중 증가 시 양수를 반환한다: 82 - 80 = 2.0", () => {
    expect(computeWeightChange(82, 80)).toBe(2.0);
  });

  it("체중 동일 시 0.0을 반환한다", () => {
    expect(computeWeightChange(80, 80)).toBe(0.0);
  });

  it("소수점 반올림: 79.85 - 80.0 = -0.2 (Math.round(-0.15*10)/10)", () => {
    expect(computeWeightChange(79.85, 80.0)).toBe(-0.2);
  });
});

describe("computeAvgWeight3d", () => {
  it("3일 데이터 모두 있을 때 평균을 반환한다: (81+80+79)/3 = 80.0", () => {
    const logs: DailyLog[] = [
      makeLog("2024-01-03", 81),
      makeLog("2024-01-02", 80),
      makeLog("2024-01-01", 79),
    ];
    expect(computeAvgWeight3d("2024-01-03", logs)).toBe(80.0);
  });

  it("오늘 하루 데이터만 있을 때 그 값을 반환한다", () => {
    const logs: DailyLog[] = [makeLog("2024-01-03", 80)];
    expect(computeAvgWeight3d("2024-01-03", logs)).toBe(80.0);
  });

  it("범위 내 weight=null이 포함된 경우 null을 제외하고 평균을 낸다", () => {
    const logs: DailyLog[] = [
      makeLog("2024-01-03", 81),
      makeLog("2024-01-02", null),
      makeLog("2024-01-01", 79),
    ];
    // 81 + 79 = 160 / 2 = 80.0
    expect(computeAvgWeight3d("2024-01-03", logs)).toBe(80.0);
  });

  it("범위 내 데이터가 전부 null이면 null을 반환한다", () => {
    const logs: DailyLog[] = [
      makeLog("2024-01-03", null),
      makeLog("2024-01-02", null),
    ];
    expect(computeAvgWeight3d("2024-01-03", logs)).toBeNull();
  });

  it("빈 배열이면 null을 반환한다", () => {
    expect(computeAvgWeight3d("2024-01-03", [])).toBeNull();
  });

  it("범위 밖 데이터(4일 전 이상)는 평균에서 제외된다", () => {
    // date="2024-01-05", 범위: 2024-01-03 ~ 2024-01-05
    // 2024-01-02는 범위 밖이므로 제외
    const logs: DailyLog[] = [
      makeLog("2024-01-05", 81),
      makeLog("2024-01-02", 70), // 범위 밖 (4일 전)
    ];
    expect(computeAvgWeight3d("2024-01-05", logs)).toBe(81.0);
  });

  it("소수점 반올림: (80.0 + 79.5) / 2 = 79.75 → 79.8", () => {
    const logs: DailyLog[] = [
      makeLog("2024-01-02", 80.0),
      makeLog("2024-01-01", 79.5),
    ];
    expect(computeAvgWeight3d("2024-01-02", logs)).toBe(79.8);
  });
});

describe("computeIntensiveDay", () => {
  it("역대최저 기준: weight > lowestWeight이면 true를 반환한다", () => {
    expect(computeIntensiveDay(80.1, "역대최저", 80)).toBe(true);
  });

  it("역대최저 기준: weight === lowestWeight이면 false를 반환한다", () => {
    expect(computeIntensiveDay(80, "역대최저", 80)).toBe(false);
  });

  it("역대최저 기준: weight < lowestWeight이면 false를 반환한다", () => {
    expect(computeIntensiveDay(79, "역대최저", 80)).toBe(false);
  });

  it("0.5kg 기준: weight = lowestWeight + 0.6이면 true를 반환한다", () => {
    expect(computeIntensiveDay(80.6, "0.5kg", 80)).toBe(true);
  });

  it("0.5kg 기준: weight = lowestWeight + 0.5 (경계)이면 false를 반환한다 (strictly greater)", () => {
    expect(computeIntensiveDay(80.5, "0.5kg", 80)).toBe(false);
  });

  it("1.0kg 기준: weight = lowestWeight + 1.1이면 true를 반환한다", () => {
    expect(computeIntensiveDay(81.1, "1.0kg", 80)).toBe(true);
  });

  it("1.0kg 기준: weight = lowestWeight + 1.0 (경계)이면 false를 반환한다", () => {
    expect(computeIntensiveDay(81.0, "1.0kg", 80)).toBe(false);
  });

  it("직접입력 기준: weight > lowestWeight이면 true를 반환한다", () => {
    expect(computeIntensiveDay(80.1, "직접입력", 80)).toBe(true);
  });

  it("lowestWeight=Infinity이면 항상 false를 반환한다", () => {
    expect(computeIntensiveDay(9999, "역대최저", Infinity)).toBe(false);
  });
});

describe("getLowestWeightFromLogs", () => {
  it("빈 배열이면 Infinity를 반환한다", () => {
    expect(getLowestWeightFromLogs([])).toBe(Infinity);
  });

  it("전부 weight=null이면 Infinity를 반환한다", () => {
    const logs: DailyLog[] = [makeLog("2024-01-01", null), makeLog("2024-01-02", null)];
    expect(getLowestWeightFromLogs(logs)).toBe(Infinity);
  });

  it("정상 배열 [80, 79, 78]에서 78을 반환한다", () => {
    const logs: DailyLog[] = [
      makeLog("2024-01-03", 80),
      makeLog("2024-01-02", 79),
      makeLog("2024-01-01", 78),
    ];
    expect(getLowestWeightFromLogs(logs)).toBe(78);
  });

  it("null이 혼재된 배열 [80, null, 75, null]에서 75를 반환한다", () => {
    const logs: DailyLog[] = [
      makeLog("2024-01-04", 80),
      makeLog("2024-01-03", null),
      makeLog("2024-01-02", 75),
      makeLog("2024-01-01", null),
    ];
    expect(getLowestWeightFromLogs(logs)).toBe(75);
  });
});
