import type { DailyLog, Settings } from "@/lib/types";
import { getDayNumber, formatDate } from "./date-utils";

/** D+N 계산 */
export function computeDay(date: string, dietStartDate: string): number {
  return getDayNumber(date, dietStartDate);
}

/** 시작 대비 체중 변화 */
export function computeWeightChange(weight: number, startWeight: number): number {
  return Math.round((weight - startWeight) * 10) / 10;
}

/** 신체 정보 기반 권장 수분량 계산 (남성: 체중 × 35ml, 여성: 체중 × 31ml) */
export function computeRecommendedWater(weight: number, gender: "남성" | "여성" | string): number {
  const ml = gender === "남성" ? weight * 35 : weight * 31;
  return Math.round(ml / 100) / 10;
}

/**
 * 3일 이동평균 (오늘 포함 최근 3 달력일, weight !== null인 것만)
 * logs: 최신순 정렬 (date desc)
 */
export function computeAvgWeight3d(date: string, logs: DailyLog[]): number | null {
  const dateObj = new Date(date + "T00:00:00");
  const threeDaysAgo = new Date(dateObj);
  threeDaysAgo.setDate(dateObj.getDate() - 2);
  const threeAgoStr = formatDate(threeDaysAgo);

  const window = logs.filter(
    (l) => l.date >= threeAgoStr && l.date <= date && l.weight !== null
  );
  if (window.length === 0) return null;

  const avg = window.reduce((sum, l) => sum + l.weight!, 0) / window.length;
  return Math.round(avg * 10) / 10;
}

/**
 * Intensive Day 판정
 * '역대최저' → weight > lowestWeight
 * '0.5kg'   → weight > lowestWeight + 0.5
 * '1.0kg'   → weight > lowestWeight + 1.0
 * '직접입력' → weight > lowestWeight (타입에 커스텀 임계값 없음)
 */
export function computeIntensiveDay(
  weight: number,
  criteria: string,
  lowestWeight: number
): boolean {
  if (lowestWeight === Infinity) return false;
  switch (criteria) {
    case "역대최저": return weight > lowestWeight;
    case "0.5kg":   return weight > lowestWeight + 0.5;
    case "1.0kg":   return weight > lowestWeight + 1.0;
    default: {
      // 직접입력 커스텀 값: 숫자 문자열 (e.g. "1.5")
      const custom = parseFloat(criteria);
      return !isNaN(custom) ? weight > lowestWeight + custom : weight > lowestWeight;
    }
  }
}

/**
 * 로그 배열에서 직접 최저 체중 추출 (순환 의존 방지용 내부 헬퍼)
 * weight가 없으면 Infinity 반환
 */
export function getLowestWeightFromLogs(logs: DailyLog[]): number {
  const weights = logs
    .map((l) => l.weight)
    .filter((w): w is number => w !== null);
  return weights.length > 0 ? Math.min(...weights) : Infinity;
}
