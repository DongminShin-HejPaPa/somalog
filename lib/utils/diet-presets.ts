/** 다이어트 프리셋 공유 상수 — 온보딩·설정 양쪽이 이 파일을 바라본다 */

export interface DietPreset {
  value: string;
  label: string;
  /** kg/월 감량 속도 (custom은 0) */
  ratePerMonth: number;
  coaching: string;
  badge?: string;
}

export const DIET_PRESETS: DietPreset[] = [
  { value: "easygoing",  label: "여유롭게",    ratePerMonth: 1, coaching: "코칭 보통" },
  { value: "sustainable",label: "착실하게",    ratePerMonth: 2, coaching: "코칭 보통", badge: "추천" },
  { value: "medium",     label: "집중해서",    ratePerMonth: 3, coaching: "코칭 높음" },
  { value: "intensive",  label: "전력 질주",   ratePerMonth: 4, coaching: "코칭 최강" },
  { value: "custom",     label: "내가 정할게", ratePerMonth: 0, coaching: "" },
];

/** 체중 정보 없을 때 보여줄 기본 개월 수 */
const DEFAULT_MONTHS: Record<string, number> = {
  easygoing: 10, sustainable: 5, medium: 4, intensive: 3,
};

/**
 * 프리셋 하나의 목표 개월 수 계산.
 * startWeight·targetWeight가 유효하면 동적 계산, 아니면 기본값 반환.
 */
export function computePresetMonths(
  preset: string,
  startWeight: number,
  targetWeight: number
): number {
  const p = DIET_PRESETS.find((d) => d.value === preset);
  if (
    !p || p.ratePerMonth === 0 ||
    startWeight <= 0 || targetWeight <= 0 || targetWeight >= startWeight
  ) {
    return DEFAULT_MONTHS[preset] ?? 12;
  }
  return Math.max(1, Math.ceil((startWeight - targetWeight) / p.ratePerMonth));
}

/**
 * 여러 프리셋의 개월 수를 한꺼번에 계산하고, 순서 보장(느린 쪽 ≥ 빠른 쪽 + 1).
 * 온보딩처럼 4개를 동시에 표시할 때 사용.
 */
export function calcAllPresetMonths(totalLoss: number, rates: number[]): number[] {
  const months = rates.map((r) => (r > 0 ? Math.max(1, Math.ceil(totalLoss / r)) : 0));
  for (let i = months.length - 2; i >= 0; i--) {
    if (months[i] <= months[i + 1]) {
      months[i] = months[i + 1] + 1;
    }
  }
  return months;
}
