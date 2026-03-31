export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
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
