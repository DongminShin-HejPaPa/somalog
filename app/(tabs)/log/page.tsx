import { LogList } from "@/components/log/log-list";
import { getRecentDailyLogs } from "@/lib/services/daily-log-service";
import { getWeeklyLogs } from "@/lib/services/weekly-log-service";

export default async function LogPage() {
  const [logs, weeklyLogs] = await Promise.all([
    getRecentDailyLogs(30),
    getWeeklyLogs(4),
  ]);

  return (
    <div className="pb-6">
      <header className="px-4 pt-4 pb-2">
        <h1 className="text-lg font-bold">기록</h1>
      </header>
      <LogList logs={logs} weeklyLogs={weeklyLogs} />
    </div>
  );
}
