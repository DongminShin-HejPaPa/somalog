import type { DailyLog } from "@/lib/types";

/**
 * 체중 입력 시 즉시 피드백 생성
 * 체중 변화, Intensive Day 여부, 수분 진행률 중심
 */
export function generateFeedback(
  log: DailyLog,
  prevWeight: number | null,
  lowestWeight: number,
  waterGoal: number
): string {
  const parts: string[] = [];

  if (log.weight !== null) {
    // 체중 변화
    if (prevWeight !== null) {
      const diff = Math.round((log.weight - prevWeight) * 10) / 10;
      const sign = diff > 0 ? "+" : "";
      parts.push(`체중 ${log.weight}kg (어제 대비 ${sign}${diff}kg).`);
    } else {
      parts.push(`체중 ${log.weight}kg.`);
    }

    // 역대 최저 대비
    if (lowestWeight !== Infinity && log.weight > lowestWeight) {
      const diff = Math.round((log.weight - lowestWeight) * 10) / 10;
      parts.push(`역대 최저(${lowestWeight}kg)보다 ${diff}kg 높은 상태야.`);
    } else if (lowestWeight !== Infinity && log.weight <= lowestWeight) {
      parts.push(`역대 최저 기록이야!`);
    }
  }

  // 수분 진행률
  if (log.water !== null) {
    const pct = Math.round((log.water / waterGoal) * 100);
    const remaining = Math.round((waterGoal - log.water) * 10) / 10;
    if (remaining > 0) {
      parts.push(`수분은 목표의 ${pct}%, ${remaining}L 남았어.`);
    } else {
      parts.push(`수분 목표 달성!`);
    }
  }

  // 동기 메시지
  if (log.intensiveDay) {
    parts.push("오늘 식단 관리가 핵심이야.");
  } else {
    parts.push("이 흐름 유지해.");
  }

  return parts.join(" ");
}

/**
 * 마감 시 일일 총평 생성
 */
export function generateDailySummary(log: DailyLog, waterGoal: number): string {
  const parts: string[] = [];

  // 체중
  if (log.weight !== null) {
    const change =
      log.weightChange !== null
        ? ` (시작 대비 ${log.weightChange > 0 ? "+" : ""}${log.weightChange}kg)`
        : "";
    parts.push(`체중 ${log.weight}kg${change}.`);
  }

  // 수분
  if (log.water !== null) {
    parts.push(`수분 ${log.water}/${waterGoal}L.`);
  }

  // 식단
  const meals = [
    log.breakfast && `아침: ${log.breakfast}`,
    log.lunch && `점심: ${log.lunch}`,
    log.dinner && `저녁: ${log.dinner}`,
  ].filter(Boolean);
  if (meals.length > 0) {
    parts.push(meals.join(", ") + ".");
  }

  // 운동
  if (log.exercise === "Y") {
    parts.push("운동 완료.");
  } else if (log.exercise === "N") {
    parts.push("운동 미수행.");
  }

  // 야식
  if (log.lateSnack === "Y") {
    parts.push("야식 있음.");
  } else if (log.lateSnack === "N") {
    parts.push("야식 없음.");
  }

  // 체력
  if (log.energy) {
    parts.push(`체력 ${log.energy}.`);
  }

  // 마무리
  if (log.intensiveDay) {
    parts.push("오늘은 체중 집중 관리가 필요한 날이었어 — 내일도 집중 유지해.");
  } else {
    parts.push("내일도 꾸준히.");
  }

  return parts.join(" ");
}

/**
 * 총평 기반 한줄 요약 생성 (Home 탭 코치 한마디용)
 */
export function generateOneLiner(log: DailyLog): string {
  if (log.intensiveDay && log.exercise === "Y" && log.lateSnack === "N") {
    return `집중 관리일에 운동까지 — 오늘 잘 버텼어.`;
  }
  if (log.intensiveDay && log.lateSnack === "Y") {
    return `집중 관리일에 야식은 아쉬워 — 내일 만회하자.`;
  }
  if (log.exercise === "Y" && log.lateSnack === "N") {
    return `운동하고 야식 안 먹은 하루 — 착실한 관리야.`;
  }
  if (log.exercise === "N" && log.lateSnack === "Y") {
    return `운동도 야식도 아쉬운 하루 — 내일 반드시 만회해.`;
  }
  if (log.weight !== null && log.weightChange !== null && log.weightChange < -3) {
    return `체중 ${log.weight}kg, 시작 대비 ${Math.abs(log.weightChange)}kg 감량 — 순항 중이야.`;
  }
  return `오늘 하루 수고했어 — 내일도 이 흐름 이어가자.`;
}

/**
 * 주간 요약 생성
 */
export function generateWeeklySummary(
  weekLogs: DailyLog[],
  avgWeight: number,
  exerciseDays: number,
  lateSnackCount: number
): string {
  const parts: string[] = [];

  parts.push(`이번 주 평균 체중은 ${avgWeight}kg.`);
  parts.push(`운동 ${exerciseDays}일, 야식 ${lateSnackCount}회.`);

  if (exerciseDays >= 5) {
    parts.push("운동 습관 훌륭해.");
  } else if (exerciseDays <= 2) {
    parts.push("운동 일수가 부족해 — 다음 주는 최소 4일 목표.");
  }

  if (lateSnackCount >= 3) {
    parts.push("야식이 잦았어 — 다음 주는 야식 차단이 최우선.");
  } else if (lateSnackCount === 0) {
    parts.push("야식 0회 — 완벽한 절제야.");
  }

  // 체중 추세
  const weights = weekLogs
    .map((l) => l.weight)
    .filter((w): w is number => w !== null);
  if (weights.length >= 2) {
    const first = weights[weights.length - 1];
    const last = weights[0];
    const trend = Math.round((last - first) * 10) / 10;
    if (trend < 0) {
      parts.push(`주 초 대비 ${Math.abs(trend)}kg 감소 — 좋은 흐름이야.`);
    } else if (trend > 0) {
      parts.push(`주 초 대비 ${trend}kg 증가 — 다음 주 식단 점검이 필요해.`);
    }
  }

  parts.push("다음 주도 꾸준히.");
  return parts.join(" ");
}
