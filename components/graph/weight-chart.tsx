"use client";

import { useState, useRef, useEffect } from "react";
import { Expand, X, GripHorizontal } from "lucide-react";
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

// ── LOESS (Locally Estimated Scatterplot Smoothing) ──────────────────────────
// Span: 0.8, Degree: 2 (Quadratic)

function tricube(u: number): number {
  const a = Math.abs(u);
  if (a >= 1) return 0;
  const v = 1 - a * a * a;
  return v * v * v;
}

function solveLinear3(A: number[][], b: number[]): number[] | null {
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < 3; col++) {
    let maxRow = col;
    for (let row = col + 1; row < 3; row++) {
      if (Math.abs(M[row][col]) > Math.abs(M[maxRow][col])) maxRow = row;
    }
    [M[col], M[maxRow]] = [M[maxRow], M[col]];
    if (Math.abs(M[col][col]) < 1e-12) return null;
    for (let row = col + 1; row < 3; row++) {
      const f = M[row][col] / M[col][col];
      for (let j = col; j <= 3; j++) M[row][j] -= f * M[col][j];
    }
  }
  const x = [0, 0, 0];
  for (let row = 2; row >= 0; row--) {
    x[row] = M[row][3];
    for (let c = row + 1; c < 3; c++) x[row] -= M[row][c] * x[c];
    x[row] /= M[row][row];
  }
  return x;
}

/**
 * LOESS 추세 곡선 계산
 * xs, ys: 실제 데이터 (null 제외), evalXs: 추정할 x 좌표 목록
 */
function computeLoess(
  xs: number[],
  ys: number[],
  evalXs: number[],
  span = 0.8
): (number | null)[] {
  const n = xs.length;
  if (n < 3) return evalXs.map(() => null);

  const windowSize = Math.max(3, Math.round(span * n));

  return evalXs.map((xi) => {
    // 거리 기준 가장 가까운 windowSize개 선택
    const dists = xs.map((x, i) => ({ i, d: Math.abs(x - xi) }));
    dists.sort((a, b) => a.d - b.d);
    const win = dists.slice(0, windowSize);
    const h = win[win.length - 1].d || 1;

    // tricube 가중치 + 중심/스케일 정규화
    const pts = win.map(({ i, d }) => ({
      x: xs[i],
      y: ys[i],
      w: tricube(d / h),
    }));

    const sumW = pts.reduce((s, p) => s + p.w, 0);
    if (sumW === 0) return null;

    const xBar = pts.reduce((s, p) => s + p.w * p.x, 0) / sumW;
    const xScale = Math.max(...pts.map(p => Math.abs(p.x - xBar))) || 1;

    // 가중 이차 회귀 행렬 구성
    const A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    const bv = [0, 0, 0];
    for (const { x, y, w } of pts) {
      const t = (x - xBar) / xScale;
      const basis = [1, t, t * t];
      for (let r = 0; r < 3; r++) {
        bv[r] += w * basis[r] * y;
        for (let c = 0; c < 3; c++) A[r][c] += w * basis[r] * basis[c];
      }
    }

    const beta = solveLinear3(A, bv);
    if (!beta) return sumW > 0 ? pts.reduce((s, p) => s + p.w * p.y, 0) / sumW : null;

    const t = (xi - xBar) / xScale;
    return beta[0] + beta[1] * t + beta[2] * t * t;
  });
}

// ─────────────────────────────────────────────────────────────────────────────

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
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPortrait, setIsPortrait] = useState(false);
  const [legendPos, setLegendPos] = useState({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    isDragging.current = true;
    dragStart.current = { x: e.clientX - legendPos.x, y: e.clientY - legendPos.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging.current) return;
    setLegendPos({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
  };
  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    isDragging.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  useEffect(() => {
    if (!isFullscreen) setLegendPos({ x: 0, y: 0 });
  }, [isFullscreen]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const handleResize = () => setIsPortrait(window.innerHeight > window.innerWidth);
      handleResize();
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }
  }, []);

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
      isLowest: log.weight !== null && log.weight === lowestWeight,
      isSurge: surge,
      isMonday: new Date(log.date).getDay() === 1,
    };
  });

  // LOESS 추세 곡선 계산
  const validPts = chartData
    .map((d, i) => ({ i, y: d.weight as number }))
    .filter((p) => chartData[p.i].weight !== null);

  const loessValues = validPts.length >= 3
    ? computeLoess(
        validPts.map((p) => p.i),
        validPts.map((p) => p.y),
        chartData.map((_, i) => i),
        0.8
      )
    : chartData.map(() => null);

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
  const minW = Number((Math.min(...allWeights) - 0.5).toFixed(1));
  const maxW = Number((Math.max(...allWeights) + 0.5).toFixed(1));

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

  const finalChartData = chartData.map((d, i) => ({
    ...d,
    loessTrend:
      loessValues[i] !== null
        ? Math.round(loessValues[i]! * 10) / 10
        : null,
    goalWeight: goalLineData[i],
  }));

  return (
    <div
      data-testid="graph-weight-chart"
      ref={containerRef}
      className={cn(
        "bg-background transition-all",
        isFullscreen ? "fixed inset-0 z-[100] flex flex-col bg-background w-full h-[100dvh] overflow-hidden" : ""
      )}
    >
      {isFullscreen && isPortrait && (
        <div className="absolute inset-0 z-[200] flex flex-col items-center justify-center bg-background/95 backdrop-blur-md px-6 text-center">
          <svg className="w-16 h-16 mb-6 text-primary animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <h3 className="text-xl font-bold mb-2">화면을 가로로 눕혀주세요</h3>
          <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
            일부 모바일 환경에서는 자동 회전이 지원되지 않습니다.<br/>기기를 직접 돌리시면 꽉 찬 차트가 나타납니다.
          </p>
          <button
            onClick={toggleFullscreen}
            className="px-6 py-2.5 bg-secondary text-foreground font-medium rounded-full"
          >
            전체화면 닫기
          </button>
        </div>
      )}

      <div className={cn(
        "flex gap-1.5 flex-shrink-0 z-20 transition-opacity",
        isFullscreen ? "absolute bottom-6 left-6 bg-background/80 p-2.5 rounded-2xl backdrop-blur-md shadow-sm" : "px-4 mb-3"
      )}>
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

      {/* 범례 */}
      <div
        className={cn(
          isFullscreen
            ? "absolute top-6 right-20 z-20 flex flex-col gap-1.5 bg-secondary/40 p-3 rounded-xl backdrop-blur-md shadow-lg border border-border cursor-grab active:cursor-grabbing touch-none select-none max-w-[70%]"
            : "px-4 mb-2 space-y-1.5 flex-shrink-0"
        )}
        style={isFullscreen ? { transform: `translate(${legendPos.x}px, ${legendPos.y}px)` } : undefined}
        onPointerDown={isFullscreen ? handlePointerDown : undefined}
        onPointerMove={isFullscreen ? handlePointerMove : undefined}
        onPointerUp={isFullscreen ? handlePointerUp : undefined}
        onPointerCancel={isFullscreen ? handlePointerUp : undefined}
      >
        {isFullscreen && (
          <div className="flex justify-center w-full mb-0.5 opacity-40">
            <GripHorizontal size={16} />
          </div>
        )}
        {/* 선 범례 */}
        <div className={cn("flex flex-wrap gap-x-4 gap-y-1 text-[10px] sm:text-xs text-muted-foreground", !isFullscreen && "pointer-events-auto")}>
          <span className="flex items-center gap-1">
            <span className="w-4 h-0.5 bg-navy inline-block" /> 일별 체중
          </span>
          <span className="flex items-center gap-1">
            {/* 주황 점선 */}
            <svg width="16" height="4" className="inline-block">
              <line x1="0" y1="2" x2="16" y2="2" stroke="#f97316" strokeWidth="2" strokeDasharray="5 3" />
            </svg>
            <span>추세</span>
          </span>
          <span className="flex items-center gap-1">
            {/* 연초록 점선 */}
            <svg width="16" height="4" className="inline-block">
              <line x1="0" y1="2" x2="16" y2="2" stroke="#86efac" strokeWidth="2" strokeDasharray="5 3" />
            </svg>
            목표 감량선
          </span>
          <span className="flex items-center gap-1">
            <span className="w-4 h-0.5 bg-green-600 inline-block" /> 목표 체중
          </span>
        </div>
        {/* 점 마커 범례 */}
        <div className={cn("flex flex-wrap gap-x-4 gap-y-1 text-[10px] sm:text-xs text-muted-foreground", !isFullscreen && "pointer-events-auto")}>
          <span className="flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 12 12">
              <polygon
                points="6,1 7.18,4.38 10.76,4.45 7.9,6.62 8.94,10.05 6,8 3.06,10.05 4.1,6.62 1.24,4.45 4.82,4.38"
                fill="#1e3a5f"
              />
            </svg>
            역대 최저
          </span>
          <span className="flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 12 12">
              <rect x="2" y="2" width="8" height="8" fill="#1e3a5f" />
            </svg>
            전일 대비 1kg↑
          </span>
        </div>
      </div>

      <div className={cn("relative", isFullscreen ? "flex-1 w-full h-[100dvh]" : "px-2 h-[300px]")}>
        <button
          onClick={toggleFullscreen}
          className={cn(
            "absolute z-30 flex items-center justify-center bg-background/80 hover:bg-secondary rounded-full transition-colors text-muted-foreground shadow-sm backdrop-blur-sm",
            isFullscreen ? "top-4 right-4 p-3 border-none" : "top-1 right-2 p-1.5 border border-border"
          )}
          aria-label={isFullscreen ? "전체화면 종료" : "전체화면 확대"}
        >
          {isFullscreen ? <X size={24} /> : <Expand size={16} />}
        </button>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            margin={{ top: 10, right: 30, left: 0, bottom: 5 }}
            data={finalChartData}
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
                  loessTrend: "추세",
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
            {/* 목표 감량선 */}
            <Line
              type="linear"
              dataKey="goalWeight"
              stroke="#86efac"
              strokeWidth={1.5}
              strokeDasharray="8 4"
              dot={false}
              connectNulls
            />
            {/* 추세 곡선 */}
            <Line
              type="monotone"
              dataKey="loessTrend"
              stroke="#f97316"
              strokeWidth={2}
              strokeDasharray="6 3"
              dot={false}
              connectNulls
            />
            {/* 일별 체중 */}
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

      {!isFullscreen && (
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
      )}
    </div>
  );
}
