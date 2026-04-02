export function formatDate(date: Date): string {
  // KST (Asia/Seoul, UTC+9) 기준 날짜 — 서버가 UTC여도 한국 날짜로 반환
  return date.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
}

export function isToday(date: string): boolean {
  return date === formatDate(new Date());
}

export function getDayNumber(date: string, dietStartDate: string): number {
  const start = new Date(dietStartDate + "T00:00:00");
  const current = new Date(date + "T00:00:00");
  const diffMs = current.getTime() - start.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
}

export function getWeekRange(date: string): {
  weekStart: string;
  weekEnd: string;
} {
  const d = new Date(date + "T00:00:00");
  const dayOfWeek = d.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    weekStart: formatDate(monday),
    weekEnd: formatDate(sunday),
  };
}
