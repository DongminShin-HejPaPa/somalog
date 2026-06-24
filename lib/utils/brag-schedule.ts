import { formatDate } from "./date-utils";

/** YYYY-MM-DD 에 개월 수를 더한다(달력 기준). chapter-service.addMonths 와 동일 규칙. */
function addMonths(date: string, months: number): string {
  const d = new Date(date + "T00:00:00");
  d.setMonth(d.getMonth() + months);
  return formatDate(d);
}

/** YYYY-MM-DD 의 하루 전 날짜. */
function dayBefore(date: string): string {
  const d = new Date(date + "T00:00:00");
  d.setDate(d.getDate() - 1);
  return formatDate(d);
}

/**
 * k번째 "한달 째 되는 날"(마일스톤 기념일).
 * 시작일로부터 k개월 후의 하루 전 = 그 달을 꽉 채운 날.
 * 예) 시작 1/5 → 1번째=2/4, 2번째=3/4, 3번째=4/4.
 */
export function bragAnniversary(startDate: string, k: number): string {
  return dayBefore(addMonths(startDate, k));
}

/**
 * 시작일 기준 오늘까지 도달한 월간 마일스톤 개수(0 이상).
 * 각 마일스톤은 "시작일로부터 k개월 째 되는 날"(bragAnniversary)이며,
 * 그 날짜가 오늘 이하이면 도달한 것으로 본다.
 *
 * @param startDate 현 챕터 다이어트 시작일(YYYY-MM-DD)
 * @param today     오늘(YYYY-MM-DD)
 * @returns 도달한 마일스톤 수. 1 이상이면 자랑 팝업 후보.
 */
export function completedBragMilestones(startDate: string, today: string): number {
  if (!startDate) return 0;
  let k = 0;
  // 과도한 루프 방지(최대 50년치). 실제론 마일스톤 수만큼만 반복.
  while (k < 600) {
    if (bragAnniversary(startDate, k + 1) <= today) k += 1;
    else break;
  }
  return k;
}
