import type { DailyEventPoint } from "@/lib/types";

export type MetricKey = "exercise" | "lateSnack" | "alcohol";

/** 해당 날짜에 지표(운동/야식/술)가 '발생'했는지 판정 */
export function didOccur(metric: MetricKey, p: DailyEventPoint): boolean {
  if (metric === "exercise")
    return p.exercise !== null && p.exercise !== "N" && p.exercise !== "SKIP";
  if (metric === "lateSnack")
    return p.lateSnack !== null && p.lateSnack !== "N" && p.lateSnack !== "SKIP";
  return p.dinnerAlcohol === true || p.lateSnackAlcohol === true;
}

/**
 * 해당 날짜에 지표를 '기록'했는지 판정.
 * - 운동/야식: 값이 있으면(했음/안했음 모두) 기록으로 인정
 * - 술: 저녁 또는 야식을 저장한 날에만 술 플래그가 채워지므로,
 *   둘 중 하나라도 non-null 이면 그날 술 여부를 기록한 것으로 인정
 */
export function didRecord(metric: MetricKey, p: DailyEventPoint): boolean {
  if (metric === "exercise") return p.exercise !== null;
  if (metric === "lateSnack") return p.lateSnack !== null;
  return p.dinnerAlcohol !== null || p.lateSnackAlcohol !== null;
}

export interface CumulativePoint {
  date: string;        // YYYY-MM-DD
  pct: number | null;  // 0~100. 기록이 없던 날은 null(점 미표시)
}

/**
 * 누적 발생 비율(%) 시계열 — 기록한 날만 분모로 센다.
 * 각 '기록한' 날 D 에서: (시작~D 발생일 수) ÷ (시작~D 기록일 수) × 100.
 * 기록이 없는 날은 pct=null 로 두어 점을 찍지 않는다(라인은 connectNulls 로 연결).
 *
 * @param series 날짜 오름차순 이벤트 포인트
 * @param metric 운동/야식/술
 */
export function computeCumulativeRate(
  series: DailyEventPoint[],
  metric: MetricKey
): CumulativePoint[] {
  if (series.length === 0) return [];
  let occ = 0;
  let rec = 0;
  return series.map((p) => {
    if (!didRecord(metric, p)) {
      return { date: p.date, pct: null };
    }
    rec += 1;
    if (didOccur(metric, p)) occ += 1;
    return { date: p.date, pct: Math.round((occ / rec) * 100) };
  });
}
