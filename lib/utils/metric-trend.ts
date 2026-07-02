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
 * - 술: 저녁 또는 야식을 기록한 날을 기록일로 인정.
 *   (술 여부는 저녁·야식 입력에 딸린 토글이며, 안 마신 날은 플래그가
 *    NULL 로 남아 술 플래그만으론 '기록했으나 안 마신 날'을 구분할 수 없다.
 *    그래서 저녁/야식 기록 유무로 분모를 센다.)
 */
export function didRecord(metric: MetricKey, p: DailyEventPoint): boolean {
  if (metric === "exercise") return p.exercise !== null;
  if (metric === "lateSnack") return p.lateSnack !== null;
  return p.hasDinner || p.lateSnack !== null;
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
