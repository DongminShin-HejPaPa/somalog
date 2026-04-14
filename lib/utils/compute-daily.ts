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

/**
 * 로그 배열 전체의 intensiveDay를 재계산·보정한다.
 *
 * - weight가 있는 날: 그 체중으로 판정
 * - weight가 없는 날: 직전 체중(lastKnownWeight)으로 판정
 * - 아직 체중 기록이 한 번도 없는 날: intensiveDay = false (판단 불가)
 *
 * DB에 이미 저장된 값이 stale 하거나 null 이더라도 읽기 시점에 항상 올바른 값을 반환.
 */
export function enrichIntensiveDay(
  logs: DailyLog[],
  criteria: string,
  lowestWeight: number
): DailyLog[] {
  if (lowestWeight === Infinity) return logs; // 체중 기록 없음 → 변경 불필요

  // 날짜 오름차순으로 순회해야 직전 체중을 올바르게 추적할 수 있음
  const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date));
  let lastKnownWeight: number | null = null;

  const enriched = sorted.map((log) => {
    if (log.weight !== null) lastKnownWeight = log.weight;
    const effective = log.weight ?? lastKnownWeight;
    if (effective === null) {
      // 아직 체중이 한 번도 입력되지 않은 초기 날짜
      return { ...log, intensiveDay: false };
    }
    return {
      ...log,
      intensiveDay: computeIntensiveDay(effective, criteria, lowestWeight),
    };
  });

  // 원래 순서(내림차순)로 복원
  return enriched.sort((a, b) => b.date.localeCompare(a.date));
}
