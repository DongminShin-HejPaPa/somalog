export const dynamic = "force-dynamic";

import { WeightChart } from "@/components/graph/weight-chart";
import { getRecentDailyLogs } from "@/lib/services/daily-log-service";
import { getSettings } from "@/lib/services/settings-service";
import { getLowestWeight } from "@/lib/services/stats-service";

export default async function GraphPage() {
  const [logs, settings, lowest] = await Promise.all([
    getRecentDailyLogs(90),
    getSettings(),
    getLowestWeight(),
  ]);

  return (
    <div className="pb-6">
      <header className="px-4 pt-4 pb-2">
        <h1 className="text-lg font-bold">체중 그래프</h1>
      </header>
      <WeightChart
        logs={logs}
        startWeight={settings.startWeight}
        targetWeight={settings.targetWeight}
        startDate={settings.dietStartDate}
        targetMonths={settings.targetMonths}
        lowestWeight={lowest.weight}
        lowestWeightDate={lowest.date}
      />
    </div>
  );
}
