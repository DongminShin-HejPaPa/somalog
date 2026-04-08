import type { DailyLog } from "@/lib/types";

interface DailySummaryProps {
  todayLog: DailyLog;
  recentLogs: DailyLog[];
  coachName: string;
}

export function DailySummary({
  todayLog,
  coachName,
}: DailySummaryProps) {
  if (!todayLog.closed) return null;
  if (!todayLog.dailySummary) return null;

  return (
    <div className="mx-4 mt-4 mb-4">
      <h3 className="font-semibold text-sm mb-3">{coachName}의 총평</h3>
      <div className="p-4 bg-secondary/50 rounded-xl border border-border">
        <p className="text-sm leading-relaxed whitespace-pre-line">{todayLog.dailySummary}</p>
      </div>
    </div>
  );
}
