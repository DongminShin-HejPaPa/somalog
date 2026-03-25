"use client";

import Link from "next/link";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface WeightMiniGraphProps {
  data: { date: string; weight: number | null }[];
}

export function WeightMiniGraph({ data }: WeightMiniGraphProps) {
  const chartData = data
    .filter((d) => d.weight !== null)
    .map((d) => ({
      date: d.date.slice(5),
      weight: d.weight,
    }))
    .reverse();

  const weights = chartData.map((d) => d.weight!);
  const minW = Math.floor(Math.min(...weights) - 1);
  const maxW = Math.ceil(Math.max(...weights) + 1);

  return (
    <div className="mx-4 mt-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-sm">최근 14일 체중</h3>
        <Link href="/graph" className="text-xs text-navy font-medium">
          전체 보기
        </Link>
      </div>
      <div className="h-[160px] bg-secondary/30 rounded-xl p-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
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
              formatter={(value: number) => [`${value} kg`, "체중"]}
            />
            <Line
              type="monotone"
              dataKey="weight"
              stroke="#1e3a5f"
              strokeWidth={2}
              dot={{ r: 3, fill: "#1e3a5f" }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
