import type { DailyLog } from "@/lib/types";

/**
 * 체중 입력 시 즉시 피드백 생성 (Hard Reset 편향 없이, 오늘 행동 중심)
 */
export function generateFeedback(
  log: DailyLog,
  prevWeight: number | null,
  lowestWeight: number,
  waterGoal: number
): string {
  const parts: string[] = [];

  if (log.weight !== null) {
    if (prevWeight !== null) {
      const diff = Math.round((log.weight - prevWeight) * 10) / 10;
      const sign = diff > 0 ? "+" : "";
      if (diff < 0) {
        parts.push(`체중 ${log.weight}kg, 전날 대비 ${sign}${diff}kg. 좋은 흐름이야.`);
      } else if (diff > 0) {
        parts.push(`체중 ${log.weight}kg, 전날 대비 ${sign}${diff}kg. 등락은 자연스러운 거야.`);
      } else {
        parts.push(`체중 ${log.weight}kg, 전날과 동일. 안정적이야.`);
      }
    } else {
      parts.push(`체중 ${log.weight}kg 기록 완료.`);
    }

    if (lowestWeight !== Infinity && log.weight <= lowestWeight) {
      parts.push(`역대 최저 기록 갱신! 🎉`);
    }
  }

  if (log.water !== null && waterGoal > 0) {
    const pct = Math.round((log.water / waterGoal) * 100);
    const remaining = Math.round((waterGoal - log.water) * 10) / 10;
    if (remaining <= 0) {
      parts.push(`수분 목표 달성!`);
    } else {
      parts.push(`수분 ${pct}%, ${remaining}L 남았어.`);
    }
  }

  if (log.exercise === "Y") {
    parts.push("오늘 운동까지 했어? 👍");
  }

  if (log.lateSnack === "N" && log.exercise === "N") {
    parts.push("야식 참은 것만으로도 오늘 잘 한 거야.");
  }

  // Hard Reset Mode는 하나의 맥락 정보로만 활용
  if (log.intensiveDay) {
    parts.push("오늘은 Hard Reset Mode — 식단 신경 쓰자.");
  } else if (parts.length === 0) {
    parts.push("기록 완료. 이 흐름 이어가자.");
  }

  return parts.join(" ");
}

/**
 * 마감 시 일일 총평 생성 — 데이터 나열 아닌 전문가 코칭 관점
 */
export function generateDailySummary(log: DailyLog, waterGoal: number): string {
  const lines: string[] = [];

  // 체중 평가
  if (log.weight !== null) {
    const change = log.weightChange ?? 0;
    if (change < -0.5) {
      lines.push(`오늘 체중 ${log.weight}kg — 시작 대비 ${Math.abs(change)}kg 빠졌어. 착실히 가고 있는 거야.`);
    } else if (change > 0.5) {
      lines.push(`오늘 체중 ${log.weight}kg — 시작 대비 ${change}kg 올랐어. 아직 여유 있어, 지금부터 잡으면 돼.`);
    } else {
      lines.push(`오늘 체중 ${log.weight}kg — 크게 변동 없어. 안정 구간이야.`);
    }
  }

  // 식단 패턴 평가
  const mealCount = [log.breakfast, log.lunch, log.dinner].filter(Boolean).length;
  if (mealCount === 3) {
    lines.push("세 끼 다 챙겼네 — 규칙적인 식사 패턴이 다이어트의 기본이야.");
  } else if (mealCount === 0) {
    lines.push("오늘 식사 기록이 없어 — 내일은 최소 한 끼라도 적어봐.");
  }

  // 운동+야식 복합 평가
  if (log.exercise === "Y" && log.lateSnack === "N") {
    lines.push("운동하고 야식도 참았어 — 오늘 하루 완벽하게 관리했어. 이런 날이 쌓여야 결과가 나와.");
  } else if (log.exercise === "Y" && log.lateSnack === "Y") {
    lines.push("운동한 건 좋은데, 야식이 그 효과를 일부 상쇄했어. 내일은 야식을 이겨내보자.");
  } else if (log.exercise === "N" && log.lateSnack === "Y") {
    lines.push("운동도 야식도 아쉬운 하루야. 하지만 기록한 것만으로 내일을 바꿀 수 있어.");
  } else if (log.exercise === "N" && log.lateSnack === "N") {
    lines.push("야식은 참았어 — 운동 없이도 절제한 건 충분히 가치 있는 행동이야.");
  }

  // 수분 평가
  if (log.water !== null && waterGoal > 0) {
    if (log.water >= waterGoal) {
      lines.push("수분도 목표를 채웠어. 대사 효율에 직접 영향을 줘 — 계속 유지해.");
    } else if (log.water < waterGoal * 0.5) {
      lines.push(`수분이 목표의 절반도 안 됐어. 내일은 의식적으로 물을 더 마셔봐.`);
    }
  }

  // Hard Reset Mode는 하나의 맥락으로만
  if (log.intensiveDay) {
    lines.push("오늘은 Hard Reset Mode였어 — 이 시기를 잘 버티면 다음 단계로 넘어갈 수 있어.");
  } else {
    lines.push("내일도 오늘처럼 꾸준하게.");
  }

  return lines.join("\n");
}

/**
 * 홈 탭 코치 한마디 (oneLiner) 생성
 */
export function generateOneLiner(log: DailyLog): string {
  if (log.exercise === "Y" && log.lateSnack === "N") {
    if (log.intensiveDay) return `Hard Reset Mode에 운동까지 — 오늘 정말 잘 버텼어.`;
    return `운동하고 야식 안 먹은 하루 — 착실한 관리야.`;
  }
  if (log.exercise === "Y" && log.lateSnack === "Y") {
    return `운동했지만 야식은 아쉬웠어 — 그래도 움직인 것 자체가 의미 있어.`;
  }
  if (log.exercise === "N" && log.lateSnack === "N") {
    return `운동은 없었지만 야식 절제 — 작은 승리가 쌓이는 거야.`;
  }
  if (log.exercise === "N" && log.lateSnack === "Y") {
    if (log.intensiveDay) return `Hard Reset Mode인데 야식까지 — 내일은 반드시 만회하자.`;
    return `운동도 야식도 아쉬운 하루 — 내일 반드시 만회해.`;
  }
  if (log.weight !== null && (log.weightChange ?? 0) < -1) {
    return `체중 ${log.weight}kg, 시작 대비 ${Math.abs(log.weightChange!)}kg 감량 — 순항 중이야.`;
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
