import { LogList } from "@/components/log/log-list";
import { mockDailyLogs, mockWeeklyLog } from "@/lib/mock-data";

export default function LogPage() {
  return (
    <div className="pb-6">
      <header className="px-4 pt-4 pb-2">
        <h1 className="text-lg font-bold">기록</h1>
      </header>
      <LogList logs={mockDailyLogs} weeklyLog={mockWeeklyLog} />
    </div>
  );
}
