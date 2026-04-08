"use client";

import { useState, useRef, useEffect } from "react";
import { Expand, X } from "lucide-react";
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

function fmtCardDate(d: Date): string {
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}/${mm}/${dd}`;
}

interface CustomDotProps {
  cx?: number;
  cy?: number;
  payload?: {
    date: string;
    weight: number | null;
    isLowest: boolean;
    isSurge: boolean;
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
        fill="#1e3a5f"
        stroke="#1e3a5f"
      />
    );
  }

  return (
    <circle
      cx={cx}
      cy={cy}
      r={4}
      fill="#1e3a5f"
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && !(document as any).webkitFullscreenElement) {
        setIsFullscreen(false);
        (screen.orientation as any)?.unlock?.();
      }
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = async () => {
    if (!isFullscreen) {
      if (containerRef.current) {
        try {
          if (containerRef.current.requestFullscreen) {
            await containerRef.current.requestFullscreen();
          } else if ((containerRef.current as any).webkitRequestFullscreen) {
            await ((containerRef.current as any).webkitRequestFullscreen)();
          }
          if (screen.orientation && (screen.orientation as any).lock) {
            await ((screen.orientation as any).lock("landscape")).catch(() => {});
          }
        } catch (err) {
          console.warn("Fullscreen API failed", err);
        }
      }
      setIsFullscreen(true);
    } else {
      try {
        if (document.fullscreenElement || (document as any).webkitFullscreenElement) {
          if (document.exitFullscreen) {
            await document.exitFullscreen();
          } else if ((document as any).webkitExitFullscreen) {
            await ((document as any).webkitExitFullscreen)();
          }
        }
        if (screen.orientation && (screen.orientation as any).unlock) {
          (screen.orientation as any).unlock();
        }
      } catch (err) {
        console.warn("Exit Fullscreen API failed", err);
      }
      setIsFullscreen(false);
    }
  };

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
  const minW = Math.floor(Math.min(...allWeights) - 1);
  const maxW = Math.ceil(Math.max(...allWeights) + 1);

  // 카드 계산은 항상 전체 로그 기준 최신 체중 사용 (표시 기간과 무관)
  const allSortedWeights = sortedLogs
    .map((l) => l.weight)
    .filter((w): w is number => w !== null);
  const currentWeight =
    allSortedWeights.length > 0
      ? allSortedWeights[allSortedWeights.length - 1]
      : startWeight;
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
    <div
      data-testid="graph-weight-chart"
      ref={containerRef}
      className={cn(
        "bg-background transition-all",
        isFullscreen ? "fixed inset-0 z-[100] flex flex-col p-4 sm:p-6 overflow-y-auto w-full h-[100dvh]" : ""
      )}
    >
      <div className="px-4 mb-3 flex items-center justify-between flex-shrink-0">
        <div className="flex gap-1.5">
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
        <button
          onClick={toggleFullscreen}
          className="p-2 -mr-2 text-muted-foreground hover:bg-secondary rounded-full transition-colors"
          aria-label={isFullscreen ? "전체화면 종료" : "전체화면 확대"}
        >
          {isFullscreen ? <X size={20} /> : <Expand size={20} />}
        </button>
      </div>

      <div className="px-4 mb-2 space-y-1.5 flex-shrink-0">
        {/* 선 범례 */}
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
        {/* 점 마커 범례 */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            {/* 별 = 역대 최저 */}
            <svg width="12" height="12" viewBox="0 0 12 12">
              <polygon
                points="6,1 7.18,4.38 10.76,4.45 7.9,6.62 8.94,10.05 6,8 3.06,10.05 4.1,6.62 1.24,4.45 4.82,4.38"
                fill="#1e3a5f"
              />
            </svg>
            역대 최저
          </span>
<span className="flex items-center gap-1.5">
            {/* 사각형 = 전일 대비 1kg↑ */}
            <svg width="12" height="12" viewBox="0 0 12 12">
              <rect x="2" y="2" width="8" height="8" fill="#1e3a5f" />
            </svg>
            전일 대비 1kg↑
          </span>
        </div>
      </div>

      <div className={cn("px-2", isFullscreen ? "flex-1 min-h-[300px]" : "h-[300px]")}>
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
              type="linear"
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
          <p className="text-xs text-muted-foreground">{fmtCardDate(new Date(startDate + "T00:00:00"))}</p>
        </div>
        <div className="p-3 bg-secondary rounded-xl">
          <p className="text-xs text-muted-foreground">목표 체중</p>
          <p className="text-lg font-bold">{targetWeight} kg</p>
          <p className="text-xs text-muted-foreground">{fmtCardDate(targetEndDate)}</p>
        </div>
        <div className="p-3 bg-secondary rounded-xl">
          <p className="text-xs text-muted-foreground">역대 최저</p>
          <p className="text-lg font-bold">{lowestWeight} kg</p>
          <p className="text-xs text-muted-foreground">{fmtCardDate(new Date(lowestWeightDate + "T00:00:00"))}</p>
        </div>
        <div className="p-3 bg-secondary rounded-xl">
          <p className="text-xs text-muted-foreground">목표까지</p>
          <p className="text-lg font-bold">{remaining.toFixed(1)} kg</p>
          {estimatedDate && (
            <p className="text-xs text-muted-foreground">
              예상 {fmtCardDate(estimatedDate)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
