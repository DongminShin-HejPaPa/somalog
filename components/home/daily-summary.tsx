import { cn } from "@/lib/utils";
import type { DailyLog } from "@/lib/types";

interface DailySummaryProps {
  todayLog: DailyLog;
  recentLogs: DailyLog[];
  coachName: string;
}

export function DailySummary({
  todayLog,
  recentLogs,
  coachName,
}: DailySummaryProps) {
  if (!todayLog.closed) return null;

  const last7 = recentLogs.slice(0, 7);

  return (
    <div className="mx-4 mt-4">
      <h3 className="font-semibold text-sm mb-3">오늘의 총평</h3>

      <div className="overflow-x-auto -mx-4 px-4 mb-4">
        <table className="w-full text-xs min-w-[600px]">
          <thead>
            <tr className="border-b border-border">
              <th className="py-2 px-1 text-left font-medium text-muted-foreground">날짜</th>
              <th className="py-2 px-1 text-left font-medium text-muted-foreground">Day</th>
              <th className="py-2 px-1 text-right font-medium text-muted-foreground">체중</th>
              <th className="py-2 px-1 text-right font-medium text-muted-foreground">3일평균</th>
              <th className="py-2 px-1 text-right font-medium text-muted-foreground">수분</th>
              <th className="py-2 px-1 text-center font-medium text-muted-foreground">운동</th>
              <th className="py-2 px-1 text-left font-medium text-muted-foreground">아침</th>
              <th className="py-2 px-1 text-left font-medium text-muted-foreground">점심</th>
              <th className="py-2 px-1 text-left font-medium text-muted-foreground">저녁</th>
              <th className="py-2 px-1 text-center font-medium text-muted-foreground">야식</th>
              <th className="py-2 px-1 text-center font-medium text-muted-foreground">체력</th>
            </tr>
          </thead>
          <tbody>
            {last7.map((log) => (
              <tr
                key={log.date}
                className={cn(
                  "border-b border-border/50",
                  log.date === todayLog.date && "bg-navy-light/30"
                )}
              >
                <td className="py-1.5 px-1">{log.date.slice(5)}</td>
                <td className="py-1.5 px-1">D+{log.day}</td>
                <td className="py-1.5 px-1 text-right">{log.weight ?? ""}</td>
                <td className="py-1.5 px-1 text-right">{log.avgWeight3d ?? ""}</td>
                <td className="py-1.5 px-1 text-right">{log.water ? `${log.water}L` : ""}</td>
                <td className="py-1.5 px-1 text-center">{log.exercise ?? ""}</td>
                <td className="py-1.5 px-1 truncate max-w-[60px]">{log.breakfast ?? ""}</td>
                <td className="py-1.5 px-1 truncate max-w-[60px]">{log.lunch ?? ""}</td>
                <td className="py-1.5 px-1 truncate max-w-[60px]">{log.dinner ?? ""}</td>
                <td className="py-1.5 px-1 text-center">{log.lateSnack ?? ""}</td>
                <td className="py-1.5 px-1 text-center">{log.energy ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {todayLog.dailySummary && (
        <div className="p-4 bg-secondary/50 rounded-xl border border-border">
          <p className="text-xs font-medium text-muted-foreground mb-1">
            {coachName}의 총평
          </p>
          <p className="text-sm leading-relaxed">{todayLog.dailySummary}</p>
        </div>
      )}
    </div>
  );
}
