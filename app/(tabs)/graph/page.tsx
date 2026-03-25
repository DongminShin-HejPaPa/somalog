import { WeightChart } from "@/components/graph/weight-chart";
import { mockDailyLogs, mockSettings, lowestWeight, lowestWeightDate } from "@/lib/mock-data";

export default function GraphPage() {
  return (
    <div className="pb-6">
      <header className="px-4 pt-4 pb-2">
        <h1 className="text-lg font-bold">체중 그래프</h1>
      </header>
      <WeightChart
        logs={mockDailyLogs}
        startWeight={mockSettings.startWeight}
        targetWeight={mockSettings.targetWeight}
        startDate={mockSettings.dietStartDate}
        targetMonths={mockSettings.targetMonths}
        lowestWeight={lowestWeight}
        lowestWeightDate={lowestWeightDate}
      />
    </div>
  );
}
