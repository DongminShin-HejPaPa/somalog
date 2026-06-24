import type { DailyEventPoint } from "@/lib/types";
import { getDayNumber } from "./date-utils";

export type MetricKey = "exercise" | "lateSnack" | "alcohol";

/** 해당 날짜에 지표(운동/야식/술)가 '발생'했는지 판정 */
export function didOccur(metric: MetricKey, p: DailyEventPoint): boolean {
  if (metric === "exercise")
    return p.exercise !== null && p.exercise !== "N" && p.exercise !== "SKIP";
  if (metric === "lateSnack")
    return p.lateSnack !== null && p.lateSnack !== "N" && p.lateSnack !== "SKIP";
  return p.dinnerAlcohol === true || p.lateSnackAlcohol === true;
}

export interface CumulativePoint {
  date: string; // YYYY-MM-DD
  pct: number;  // 0~100
}

/**
 * 누적 발생 비율(%) 시계열.
 * 각 날짜 D 에서: (시작일~D 의 발생일 수) ÷ (시작일~D 의 경과 달력일수) × 100.
 * 예) 시작 1/1, 1/5 점 = (1/1~1/5 운동일 수) ÷ 5.
 *
 * @param series 날짜 오름차순 이벤트 포인트
 * @param metric 운동/야식/술
 * @param startDate 챕터 시작일(YYYY-MM-DD). null 이면 시리즈 첫 날짜를 시작으로.
 */
export function computeCumulativeRate(
  series: DailyEventPoint[],
  metric: MetricKey,
  startDate: string | null
): CumulativePoint[] {
  if (series.length === 0) return [];
  const effStart = startDate ?? series[0].date;
  let count = 0;
  return series.map((p) => {
    if (didOccur(metric, p)) count += 1;
    const elapsed = Math.max(1, getDayNumber(p.date, effStart)); // 시작일 포함 경과일수
    return { date: p.date, pct: Math.round((count / elapsed) * 100) };
  });
}
