import { vi } from "vitest";
import {
  formatDate,
  isToday,
  getDayNumber,
  getWeekRange,
} from "../../../lib/utils/date-utils";

describe("formatDate", () => {
  it("월/일이 한 자리 수일 때 두 자리로 패딩한다", () => {
    const date = new Date(2024, 0, 5); // 2024년 1월 5일
    expect(formatDate(date)).toBe("2024-01-05");
  });

  it("12월 31일을 올바르게 포맷한다", () => {
    const date = new Date(2024, 11, 31); // 2024년 12월 31일
    expect(formatDate(date)).toBe("2024-12-31");
  });

  it("반환 형식이 YYYY-MM-DD (하이픈 2개, 길이 10)이다", () => {
    const date = new Date(2024, 5, 15); // 2024년 6월 15일
    const result = formatDate(date);
    const parts = result.split("-");
    expect(parts).toHaveLength(3);
    expect(result).toHaveLength(10);
  });
});

describe("isToday", () => {
  it("고정된 오늘 날짜를 전달하면 true를 반환한다", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 5, 15)); // 2024년 6월 15일로 고정
    const today = formatDate(new Date());
    expect(isToday(today)).toBe(true);
    vi.useRealTimers();
  });

  it("어제 날짜를 전달하면 false를 반환한다", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 5, 15)); // 2024년 6월 15일로 고정
    const yesterday = formatDate(new Date(2024, 5, 14)); // 6월 14일
    expect(isToday(yesterday)).toBe(false);
    vi.useRealTimers();
  });

  it("내일 날짜를 전달하면 false를 반환한다", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 5, 15)); // 2024년 6월 15일로 고정
    const tomorrow = formatDate(new Date(2024, 5, 16)); // 6월 16일
    expect(isToday(tomorrow)).toBe(false);
    vi.useRealTimers();
  });
});

describe("getDayNumber", () => {
  it("시작일 당일이면 1을 반환한다", () => {
    expect(getDayNumber("2024-01-01", "2024-01-01")).toBe(1);
  });

  it("시작일 1일 후이면 2를 반환한다", () => {
    expect(getDayNumber("2024-01-02", "2024-01-01")).toBe(2);
  });

  it("시작일 하루 전이면 0을 반환한다", () => {
    expect(getDayNumber("2023-12-31", "2024-01-01")).toBe(0);
  });
});

describe("getWeekRange", () => {
  it("월요일 입력 시 weekStart는 그 날, weekEnd는 6일 후 일요일이다", () => {
    // 2024-01-01은 월요일
    const { weekStart, weekEnd } = getWeekRange("2024-01-01");
    expect(weekStart).toBe("2024-01-01");
    expect(weekEnd).toBe("2024-01-07");
  });

  it("수요일 입력 시 weekStart는 그 주 월요일, weekEnd는 그 주 일요일이다", () => {
    // 2024-01-03은 수요일
    const { weekStart, weekEnd } = getWeekRange("2024-01-03");
    expect(weekStart).toBe("2024-01-01");
    expect(weekEnd).toBe("2024-01-07");
  });

  it("일요일 입력 시 weekStart는 6일 전 월요일, weekEnd는 그 날(일요일)이다", () => {
    // 2024-01-07은 일요일
    const { weekStart, weekEnd } = getWeekRange("2024-01-07");
    expect(weekStart).toBe("2024-01-01");
    expect(weekEnd).toBe("2024-01-07");
  });

  it("토요일 입력 시 weekStart는 그 주 월요일, weekEnd는 그 주 일요일이다", () => {
    // 2024-01-06은 토요일
    const { weekStart, weekEnd } = getWeekRange("2024-01-06");
    expect(weekStart).toBe("2024-01-01");
    expect(weekEnd).toBe("2024-01-07");
  });

  it("반환값 weekStart와 weekEnd가 모두 YYYY-MM-DD 형식이다", () => {
    const { weekStart, weekEnd } = getWeekRange("2024-01-03");
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    expect(weekStart).toMatch(datePattern);
    expect(weekEnd).toMatch(datePattern);
  });
});
