"use client";

import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  CartesianGrid,
} from "recharts";
import { cn } from "@/lib/utils";
import type { DailyLog } from "@/lib/types";

interface WeightChartProps {
  logs: DailyLog[];
  startWeight: number;
  targetWeight: number;
  startDate: string;
  targetMonths: number;
  lowestWeight: number;
  lowestWeightDate: string;
}

type Period = "2w" | "1m" | "3m" | "all";

const periodLabels: Record<Period, string> = {
  "2w": "2주",
  "1m": "1개월",
  "3m": "3개월",
  all: "전체",
};

interface CustomDotProps {
  cx?: number;
  cy?: number;
  payload?: {
    date: string;
    weight: number | null;
    isLowest: boolean;
    isSurge: boolean;
    isIntensive: boolean;
  };
}

function CustomDot({ cx, cy, payload }: CustomDotProps) {
  if (!cx || !cy || !payload || payload.weight === null) return null;

  if (payload.isLowest) {
    const size = 6;
    const points = [];
    for (let i = 0; i < 5; i++) {
      const angle = (i * 72 - 90) * (Math.PI / 180);
      const innerAngle = ((i * 72 + 36) - 90) * (Math.PI / 180);
      points.push(`${cx + size * Math.cos(angle)},${cy + size * Math.sin(angle)}`);
      points.push(`${cx + size * 0.4 * Math.cos(innerAngle)},${cy + size * 0.4 * Math.sin(innerAngle)}`);
    }
    return <polygon points={points.join(" ")} fill="#1e3a5f" stroke="#1e3a5f" />;
  }

  if (payload.isSurge) {
    return (
      <rect
        x={cx - 4}
        y={cy - 4}
        width={8}
        height={8}
        fill={payload.isIntensive ? "#f87171" : "#1e3a5f"}
        stroke={payload.isIntensive ? "#f87171" : "#1e3a5f"}
      />
    );
  }

  return (
    <circle
      cx={cx}
      cy={cy}
      r={4}
      fill={payload.isIntensive ? "#f87171" : "#1e3a5f"}
      stroke="white"
      strokeWidth={2}
    />
  );
}

export function WeightChart({
  logs,
  startWeight,
  targetWeight,
  startDate,
  targetMonths,
  lowestWeight,
  lowestWeightDate,
}: WeightChartProps) {
  const [period, setPeriod] = useState<Period>("all");
  const [show3dAvg, setShow3dAvg] = useState(true);

  const hasData = logs.some((log) => log.weight !== null);

  if (!hasData) {
    return (
      <div className="px-4 py-16 text-center text-sm text-muted-foreground">
        아직 체중 데이터가 없어요
      </div>
    );
  }

  const sortedLogs = [...logs].reverse();

  const periodDays: Record<Period, number> = {
    "2w": 14,
    "1m": 30,
    "3m": 90,
    all: sortedLogs.length,
  };
  const displayLogs = sortedLogs.slice(-periodDays[period]);

  const chartData = displayLogs.map((log, idx) => {
    const prevLog = idx > 0 ? displayLogs[idx - 1] : null;
    const surge =
      log.weight !== null &&
      prevLog?.weight !== null &&
      prevLog?.weight !== undefined &&
      log.weight - prevLog.weight >= 1.0;

    return {
      date: log.date.slice(5),
      fullDate: log.date,
      weight: log.weight,
      avg3d: log.avgWeight3d,
      isLowest: log.date === lowestWeightDate,
      isSurge: surge,
      isIntensive: log.intensiveDay === true,
      isMonday: new Date(log.date).getDay() === 1,
    };
  });

  const targetEndDate = new Date(startDate);
  targetEndDate.setMonth(targetEndDate.getMonth() + targetMonths);
  const totalDays = Math.ceil(
    (targetEndDate.getTime() - new Date(startDate).getTime()) / 86400000
  );

  const goalLineData = chartData.map((d) => {
    const daysSinceStart = Math.ceil(
      (new Date(d.fullDate).getTime() - new Date(startDate).getTime()) / 86400000
    );
    const progress = daysSinceStart / totalDays;
    return +(startWeight - (startWeight - targetWeight) * progress).toFixed(1);
  });

  const allWeights = chartData
    .map((d) => d.weight)
    .filter((w): w is number => w !== null);
  const minW = Math.floor(Math.min(...allWeights, targetWeight) - 1);
  const maxW = Math.ceil(Math.max(...allWeights, startWeight) + 1);

  const currentWeight = allWeights[allWeights.length - 1] ?? startWeight;
  const totalChange = currentWeight - startWeight;
  const remaining = currentWeight - targetWeight;

  const daysSoFar = Math.ceil(
    (Date.now() - new Date(startDate).getTime()) / 86400000
  );
  const dailyRate = daysSoFar > 0 ? (startWeight - currentWeight) / daysSoFar : 0;
  const daysToGoal = dailyRate > 0 ? Math.ceil(remaining / dailyRate) : null;
  const estimatedDate = daysToGoal
    ? new Date(Date.now() + daysToGoal * 86400000)
    : null;

  return (
    <div data-testid="graph-weight-chart">
      <div className="px-4 mb-3 flex gap-1.5">
        {(Object.keys(periodLabels) as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium transition-colors min-h-[36px]",
              period === p
                ? "bg-navy text-white"
                : "bg-secondary text-muted-foreground"
            )}
          >
            {periodLabels[p]}
          </button>
        ))}
      </div>

      <div className="px-4 mb-2">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="w-4 h-0.5 bg-navy inline-block" /> 일별 체중
          </span>
          <button
            onClick={() => setShow3dAvg((v) => !v)}
            className={cn("flex items-center gap-1 transition-opacity", !show3dAvg && "opacity-40")}
          >
            <span className="w-4 h-0.5 bg-gray-400 inline-block" /> 3일 이동평균
          </button>
          <span className="flex items-center gap-1">
            <span className="w-4 h-0.5 bg-green-300 inline-block" /> 목표 감량선
          </span>
          <span className="flex items-center gap-1">
            <span className="w-4 h-0.5 bg-green-600 inline-block" /> 목표 체중
          </span>
        </div>
      </div>

      <div className="px-2 h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData.map((d, i) => ({
              ...d,
              goalWeight: goalLineData[i],
            }))}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#e2e8f0"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[minW, maxW]}
              tick={{ fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              width={35}
            />
            <Tooltip
              contentStyle={{
                fontSize: 12,
                borderRadius: 8,
                border: "1px solid #e2e8f0",
              }}
              formatter={(value: number, name: string) => {
                const labels: Record<string, string> = {
                  weight: "체중",
                  avg3d: "3일 평균",
                  goalWeight: "목표선",
                };
                return [`${value} kg`, labels[name] ?? name];
              }}
            />
            <ReferenceLine
              y={targetWeight}
              stroke="#16a34a"
              strokeWidth={1.5}
            />
            <Line
              type="monotone"
              dataKey="goalWeight"
              stroke="#86efac"
              strokeWidth={1.5}
              strokeDasharray="8 4"
              dot={false}
              connectNulls
            />
            {show3dAvg && (
              <Line
                type="monotone"
                dataKey="avg3d"
                stroke="#9ca3af"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
                connectNulls
              />
            )}
            <Line
              type="monotone"
              dataKey="weight"
              stroke="#1e3a5f"
              strokeWidth={2}
              dot={<CustomDot />}
              activeDot={{ r: 6 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="px-4 mt-4 grid grid-cols-2 gap-3">
        <div className="p-3 bg-secondary rounded-xl">
          <p className="text-xs text-muted-foreground">시작 체중</p>
          <p className="text-lg font-bold">{startWeight} kg</p>
        </div>
        <div className="p-3 bg-secondary rounded-xl">
          <p className="text-xs text-muted-foreground">현재 체중</p>
          <p className="text-lg font-bold">{currentWeight} kg</p>
          <p className={cn("text-xs font-medium", totalChange < 0 ? "text-success" : "text-coral")}>
            {totalChange > 0 ? "+" : ""}{totalChange.toFixed(1)} kg
          </p>
        </div>
        <div className="p-3 bg-secondary rounded-xl">
          <p className="text-xs text-muted-foreground">역대 최저</p>
          <p className="text-lg font-bold">{lowestWeight} kg</p>
          <p className="text-xs text-muted-foreground">{lowestWeightDate.slice(5)}</p>
        </div>
        <div className="p-3 bg-secondary rounded-xl">
          <p className="text-xs text-muted-foreground">목표까지</p>
          <p className="text-lg font-bold">{remaining.toFixed(1)} kg</p>
          {estimatedDate && (
            <p className="text-xs text-muted-foreground">
              예상 {estimatedDate.getFullYear()}/{estimatedDate.getMonth() + 1}/{estimatedDate.getDate()}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
