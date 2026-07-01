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
  ReferenceLine,
} from "recharts";
import type { DailyEventPoint } from "@/lib/types";
import { computeCumulativeRate, didOccur, didRecord, type MetricKey } from "@/lib/utils/metric-trend";

export type { MetricKey };

const META: Record<MetricKey, { label: string; color: string; verb: string }> = {
  exercise: { label: "운동", color: "#1e3a5f", verb: "한" },
  lateSnack: { label: "야식", color: "#d97706", verb: "먹은" },
  alcohol: { label: "술", color: "#b91c1c", verb: "마신" },
};

// 평균선은 3개 차트 공통 색(중립 회색)으로 통일
const AVG_COLOR = "#94a3b8";

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
 * 누적 발생 평균(%) 추세 — 그 항목을 '기록한 날'만 분모로 센다.
 * 각 기록일까지의 (발생일 수 ÷ 기록일 수) × 100. 마지막(가장 최근 기록) 점 위에 현재 % 표시.
 * 평균선·y축·요약 문구 모두 기록한 날 기준으로 계산한다.
 * 체중 그래프와 동일한 라인차트 UI로 통일감 유지.
 */
export function MetricTrendChart({
  series,
  metric,
}: {
  series: DailyEventPoint[];
  metric: MetricKey;
}) {
  const meta = META[metric];

  const { data, occurrences, totalDays, yDomain, avg, lastIndex } = useMemo(() => {
    const points = computeCumulativeRate(series, metric).map((p) => ({
      date: p.date.slice(5),
      pct: p.pct,
    }));

    // 발생/기록 모두 기록한 날 기준
    const occ = series.filter((p) => didOccur(metric, p)).length;
    const recorded = series.filter((p) => didRecord(metric, p)).length;

    // 실제로 찍히는(기록된) 점들만 평균·y축·마지막 라벨에 반영
    const pcts = points
      .map((p) => p.pct)
      .filter((v): v is number => v !== null);
    const lastIdx = points.reduce((acc, p, i) => (p.pct !== null ? i : acc), -1);

    // 평균선: 누적 비율 포인트들의 산술 평균(%)
    const mean =
      pcts.length > 0
        ? Math.round(pcts.reduce((s, v) => s + v, 0) / pcts.length)
        : 0;

    // y축: 실제 범위를 10% 단위로 올림/내림, 최소 범위 10 보장
    const rawMin = pcts.length > 0 ? Math.min(...pcts) : 0;
    const rawMax = pcts.length > 0 ? Math.max(...pcts) : 100;
    let yMin = Math.max(0, Math.floor(rawMin / 10) * 10);
    let yMax = Math.min(100, Math.ceil(rawMax / 10) * 10);
    if (yMin === yMax) {
      yMin = Math.max(0, yMin - 10);
      yMax = Math.min(100, yMax + 10);
    }

    return {
      data: points,
      occurrences: occ,
      totalDays: recorded,
      yDomain: [yMin, yMax] as [number, number],
      avg: mean,
      lastIndex: lastIdx,
    };
  }, [series, metric]);

  if (data.length === 0 || lastIndex < 0) return null;

  const dense = data.length > 180;

  return (
    <div className="mb-3 px-1">
      <div className="flex items-baseline justify-between mb-1.5">
        <p className="text-xs font-semibold text-foreground">
          {meta.label}{meta.verb} 날 누적 비율
        </p>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <span
              className="inline-block w-3 border-t-2 border-dashed"
              style={{ borderColor: AVG_COLOR }}
            />
            평균 {avg}%
          </span>
          <p className="text-xs text-muted-foreground">
            기록한 {totalDays}일 중{" "}
            <span className="font-bold" style={{ color: meta.color }}>{occurrences}일</span>{" "}
            {meta.label}
          </p>
        </div>
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
            <ReferenceLine
              y={avg}
              stroke={AVG_COLOR}
              strokeDasharray="4 4"
              strokeWidth={1.5}
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
