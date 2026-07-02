/**
 * 목표 도달 예측(ETA) — 단일 소스.
 *
 * 그래프 탭 "목표까지 카드"(components/graph/weight-chart.tsx)와
 * D-day 예측 이벤트(achievement-service.detectEta)가 이 함수를 함께 쓴다.
 * 두 화면의 "예상 도달일"이 절대 어긋나지 않도록 계산을 한 곳에 모은다.
 *
 * 로직(기존 그래프 카드와 동일):
 *   dailyRate  = (시작체중 - 현재체중) / 시작일로부터 경과일   → 전체 기간 평균 감량속도
 *   daysToGoal = ceil((현재체중 - 목표체중) / dailyRate)
 * 이미 목표 도달(remaining ≤ 0)이거나 감량 추세가 없으면(dailyRate ≤ 0) 투영하지 않는다.
 */
export interface GoalEta {
  /** 오늘로부터 목표까지 예상 남은 일수 (양수) 또는 null(투영 불가) */
  daysToGoal: number | null;
  /** 예상 도달일(ms epoch) 또는 null */
  estimatedAtMs: number | null;
}

export function projectGoalEta(params: {
  startWeight: number;
  currentWeight: number;
  targetWeight: number;
  startDate: string; // YYYY-MM-DD
  /** 기준 시각(ms). 기본 Date.now() — 테스트에서 고정값 주입용 */
  nowMs?: number;
}): GoalEta {
  const { startWeight, currentWeight, targetWeight, startDate } = params;
  const nowMs = params.nowMs ?? Date.now();

  const remaining = currentWeight - targetWeight;
  const daysSoFar = Math.ceil(
    (nowMs - new Date(startDate + "T00:00:00").getTime()) / 86_400_000
  );
  const dailyRate = daysSoFar > 0 ? (startWeight - currentWeight) / daysSoFar : 0;

  const daysToGoal =
    remaining > 0 && dailyRate > 0 ? Math.ceil(remaining / dailyRate) : null;

  return {
    daysToGoal,
    estimatedAtMs: daysToGoal !== null ? nowMs + daysToGoal * 86_400_000 : null,
  };
}
