"use client";

import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { DailyEventPoint } from "@/lib/types";
import { computeCumulativeRate, didOccur, type MetricKey } from "@/lib/utils/metric-trend";
import { getDayNumber } from "@/lib/utils/date-utils";

export type { MetricKey };

const META: Record<MetricKey, { label: string; color: string }> = {
  exercise: { label: "운동", color: "#1e3a5f" },
  lateSnack: { label: "야식", color: "#d97706" },
  alcohol: { label: "술", color: "#b91c1c" },
};

interface MetricDotProps {
  cx?: number;
  cy?: number;
  index?: number;
  value?: number; // recharts 가 주입하는 y 값(%)
  lastIndex?: number;
  dense?: boolean;
  color?: string;
}

// 마지막 점에는 % 라벨, 그 외엔 점(밀집 시 생략).
function MetricDot({ cx, cy, index, value, lastIndex, dense, color }: MetricDotProps) {
  if (cx == null || cy == null) return null;
  const isLast = index === lastIndex;
  if (isLast) {
    return (
      <g>
        <circle cx={cx} cy={cy} r={4} fill={color} stroke="white" strokeWidth={2} />
        <text
          x={cx}
          y={cy - 10}
          textAnchor="middle"
          fontSize={12}
          fontWeight={700}
          fill={color}
        >
          {value}%
        </text>
      </g>
    );
  }
  if (dense) return null;
  return <circle cx={cx} cy={cy} r={2.5} fill={color} stroke="white" strokeWidth={1.5} />;
}

/**
 * 누적 발생 평균(%) 추세 — 챕터 시작일부터 각 날짜까지의
 * (발생일 수 ÷ 경과 달력일수) × 100. 마지막 점 위에 현재 % 표시.
 * 체중 그래프와 동일한 라인차트 UI로 통일감 유지.
 */
export function MetricTrendChart({
  series,
  metric,
  startDate,
}: {
  series: DailyEventPoint[];
  metric: MetricKey;
  startDate: string | null;
}) {
  const meta = META[metric];

  const { data, occurrences, totalDays, yDomain } = useMemo(() => {
    const points = computeCumulativeRate(series, metric, startDate).map((p) => ({
      date: p.date.slice(5),
      pct: p.pct,
    }));

    const occ = series.filter((p) => didOccur(metric, p)).length;

    const effStart = startDate ?? (series.length > 0 ? series[0].date : null);
    const lastDate = series.length > 0 ? series[series.length - 1].date : null;
    const total = effStart && lastDate ? getDayNumber(lastDate, effStart) : occ;

    // y축: 실제 범위를 10% 단위로 올림/내림, 최소 범위 10 보장
    const pcts = points.map((p) => p.pct);
    const rawMin = pcts.length > 0 ? Math.min(...pcts) : 0;
    const rawMax = pcts.length > 0 ? Math.max(...pcts) : 100;
    let yMin = Math.max(0, Math.floor(rawMin / 10) * 10);
    let yMax = Math.min(100, Math.ceil(rawMax / 10) * 10);
    if (yMin === yMax) {
      yMin = Math.max(0, yMin - 10);
      yMax = Math.min(100, yMax + 10);
    }

    return { data: points, occurrences: occ, totalDays: total, yDomain: [yMin, yMax] as [number, number] };
  }, [series, metric, startDate]);

  if (data.length === 0) return null;

  const lastIndex = data.length - 1;
  const dense = data.length > 180;

  return (
    <div className="mb-3 px-1">
      <div className="flex items-baseline justify-between mb-1.5">
        <p className="text-xs font-semibold text-foreground">
          {meta.label}한 날 누적 비율
        </p>
        <p className="text-xs text-muted-foreground">
          전체 {totalDays}일 중{" "}
          <span className="font-bold" style={{ color: meta.color }}>{occurrences}일</span>{" "}
          {meta.label}
        </p>
      </div>
      <div className="h-[160px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              minTickGap={24}
            />
            <YAxis
              domain={yDomain}
              tick={{ fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              width={32}
              unit="%"
            />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
              formatter={(v: number) => [`${v}%`, `${meta.label} 누적 비율`]}
            />
            <Line
              type="monotone"
              dataKey="pct"
              stroke={meta.color}
              strokeWidth={2}
              connectNulls
              dot={<MetricDot lastIndex={lastIndex} dense={dense} color={meta.color} />}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
