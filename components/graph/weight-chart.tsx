"use client";

import { useState, useRef, useEffect } from "react";
import { Expand, X, GripHorizontal, Info } from "lucide-react";
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
  height: number;
  gender: "남성" | "여성";
  birthDate: string | null;
  activityLevel: number;
  onActivityLevelChange: (level: number) => void;
}

// ── 건강 지표 계산 헬퍼 ──────────────────────────────────────────────────────

function calcAge(birthDate: string): number {
  const today = new Date();
  const birth = new Date(birthDate + "T00:00:00");
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return Math.max(0, age);
}

function calcAgeAtDate(birthDate: string, dateStr: string): number {
  const birth = new Date(birthDate + "T00:00:00");
  const at = new Date(dateStr + "T00:00:00");
  let age = at.getFullYear() - birth.getFullYear();
  const m = at.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && at.getDate() < birth.getDate())) age--;
  return Math.max(0, age);
}

const ACTIVITY_OPTIONS = [
  { level: 1.2,   label: "거의 안 움직임", sublabel: "(사무직)" },
  { level: 1.375, label: "가벼운 운동",     sublabel: "(주 1~3일)" },
  { level: 1.55,  label: "중간 운동",       sublabel: "(주 3~5일)" },
  { level: 1.725, label: "강한 운동",       sublabel: "(주 6~7일)" },
];

function activityLabel(level: number): string {
  return ACTIVITY_OPTIONS.find((o) => o.level === level)?.label ?? "사무직";
}

function calcBMI(weight: number, heightCm: number): number {
  if (heightCm <= 0 || weight <= 0) return 0;
  return weight / Math.pow(heightCm / 100, 2);
}

type BmiLevel = "낮음" | "건강" | "높음" | "비만";

function getBmiLevel(bmi: number): BmiLevel {
  if (bmi < 18.5) return "낮음";
  if (bmi < 24) return "건강";
  if (bmi < 30) return "높음";
  return "비만";
}

function getBmiAdvice(level: BmiLevel): string {
  switch (level) {
    case "낮음": return "체중이 다소 적습니다. 균형 잡힌 식단으로 건강을 챙기세요.";
    case "건강": return "건강 체중 범위예요. 지금처럼 꾸준히 유지하세요!";
    case "높음": return "체중이 다소 높습니다. 꾸준한 운동과 식단 관리를 권장해요.";
    case "비만": return "비만 범위입니다. 전문가 상담과 함께 체중 감량을 시작하세요.";
  }
}

// Mifflin-St Jeor 공식
function calcBMR(weight: number, heightCm: number, age: number, gender: "남성" | "여성"): number {
  const base = 10 * weight + 6.25 * heightCm - 5 * age;
  return Math.round(gender === "남성" ? base + 5 : base - 161);
}

// Deurenberg (1991) 체지방률 공식
function calcBodyFatPct(bmi: number, age: number, gender: "남성" | "여성"): number {
  const sex = gender === "남성" ? 1 : 0;
  return (1.20 * bmi) + (0.23 * age) - (10.8 * sex) - 5.4;
}

// ── 미니 BMI 게이지 바 ───────────────────────────────────────────────────────
// 표시 범위: 14 ~ 40 / 구분: 낮음(~18.5), 건강(~24), 높음(~30), 비만(30~)

function BmiGaugeBar({ bmi }: { bmi: number }) {
  const MIN = 14, MAX = 40, RANGE = MAX - MIN;
  const pct = Math.min(100, Math.max(0, ((bmi - MIN) / RANGE) * 100));
  // 세그먼트 비율: 낮음 4.5, 건강 5.5, 높음 6, 비만 10 → 합 26
  return (
    <div className="mt-2.5">
      <div className="relative">
        <div className="flex h-2.5 rounded-full overflow-hidden">
          <div style={{ flex: 4.5 }} className="bg-amber-400" />
          <div style={{ flex: 5.5 }} className="bg-teal-400" />
          <div style={{ flex: 6 }} className="bg-orange-400" />
          <div style={{ flex: 10 }} className="bg-red-500" />
        </div>
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-white border-2 border-slate-700 rounded-full shadow"
          style={{ left: `${pct}%` }}
        />
      </div>
      <div className="flex mt-1.5 text-[9px] text-muted-foreground">
        <div style={{ flex: 4.5 }}>낮음</div>
        <div style={{ flex: 5.5 }}>건강</div>
        <div style={{ flex: 6 }}>높음</div>
        <div style={{ flex: 10 }}>비만</div>
      </div>
    </div>
  );
}

// 상세 BMI 게이지 (정보 시트용)
function BmiGaugeDetail({ bmi }: { bmi: number }) {
  const MIN = 14, MAX = 40, RANGE = MAX - MIN;
  const pct = Math.min(100, Math.max(0, ((bmi - MIN) / RANGE) * 100));
  const cutpoints = [{ v: 18.5 }, { v: 24 }, { v: 30 }];
  return (
    <div className="my-4">
      <div className="relative">
        <div className="flex h-4 rounded-full overflow-hidden">
          <div style={{ flex: 4.5 }} className="bg-amber-400" />
          <div style={{ flex: 5.5 }} className="bg-teal-400" />
          <div style={{ flex: 6 }} className="bg-orange-400" />
          <div style={{ flex: 10 }} className="bg-red-500" />
        </div>
        {cutpoints.map(({ v }) => (
          <div
            key={v}
            className="absolute top-0 bottom-0 w-0.5 bg-white/60"
            style={{ left: `${((v - MIN) / RANGE) * 100}%` }}
          />
        ))}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 bg-white border-2 border-slate-700 rounded-full shadow flex items-center justify-center"
          style={{ left: `${pct}%` }}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-slate-700" />
        </div>
      </div>
      <div className="relative flex mt-1 text-[10px] text-muted-foreground">
        <div style={{ flex: 4.5 }}>낮음</div>
        <div style={{ flex: 5.5 }}>건강</div>
        <div style={{ flex: 6 }}>높음</div>
        <div style={{ flex: 10 }}>비만</div>
      </div>
      <div className="relative flex mt-0.5 text-[10px] font-medium text-foreground/50">
        {cutpoints.map(({ v }) => (
          <div
            key={v}
            className="absolute -translate-x-1/2"
            style={{ left: `${((v - MIN) / RANGE) * 100}%` }}
          >
            {v}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 정보 바텀시트 ────────────────────────────────────────────────────────────

function InfoSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-background rounded-t-2xl max-h-[80dvh] overflow-y-auto">
        <div className="sticky top-0 bg-background flex items-center justify-between px-5 pt-5 pb-3 border-b border-border">
          <h3 className="font-bold text-base">{title}</h3>
          <button onClick={onClose} className="p-1.5 text-muted-foreground hover:bg-secondary rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3 text-sm text-muted-foreground leading-relaxed pb-10">
          {children}
        </div>
      </div>
    </div>
  );
}

// ── 카드 제목 + 정보 아이콘 ──────────────────────────────────────────────────

function CardTitle({ children, onInfo }: { children: React.ReactNode; onInfo: () => void }) {
  return (
    <div className="flex items-center gap-1 mb-1">
      <p className="text-xs text-muted-foreground">{children}</p>
      <button
        onClick={onInfo}
        className="text-muted-foreground/50 hover:text-muted-foreground transition-colors"
        aria-label="자세히 보기"
      >
        <Info size={12} />
      </button>
    </div>
  );
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

type ChartMode = "weight" | "bodyfat";

export function WeightChart({
  logs,
  startWeight,
  targetWeight,
  startDate,
  targetMonths,
  lowestWeight,
  lowestWeightDate,
  height,
  gender,
  birthDate,
  activityLevel,
  onActivityLevelChange,
}: WeightChartProps) {
  const [period, setPeriod] = useState<Period>("all");
  const [chartMode, setChartMode] = useState<ChartMode>("weight");
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPortrait, setIsPortrait] = useState(false);
  const [legendPos, setLegendPos] = useState({ x: 0, y: 0 });
  const [infoSheet, setInfoSheet] = useState<"bmi" | "metabolism" | "body" | null>(null);
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

    let bodyFatEst: number | null = null;
    if (height > 0 && birthDate && log.weight !== null) {
      const ageAt = calcAgeAtDate(birthDate, log.date);
      const bmiAt = calcBMI(log.weight, height);
      bodyFatEst = parseFloat(Math.max(0, calcBodyFatPct(bmiAt, ageAt, gender)).toFixed(1));
    }

    return {
      date: log.date.slice(5),
      fullDate: log.date,
      weight: log.weight,
      bodyFatEst,
      isLowest: log.weight !== null && log.weight === lowestWeight,
      isSurge: surge,
      isMonday: new Date(log.date).getDay() === 1,
    };
  });

  // LOESS 추세 곡선 — 체중
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

  // LOESS 추세 곡선 — 체지방률 추정
  const bfValidPts = chartData
    .map((d, i) => ({ i, y: d.bodyFatEst as number }))
    .filter((p) => chartData[p.i].bodyFatEst !== null);

  const bfLoessValues = bfValidPts.length >= 3
    ? computeLoess(
        bfValidPts.map((p) => p.i),
        bfValidPts.map((p) => p.y),
        chartData.map((_, i) => i),
        0.8
      )
    : chartData.map(() => null);

  const canShowBodyFat = height > 0 && birthDate !== null;

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

  // ── 건강 지표 계산 ──────────────────────────────────────────────────────────
  const age = birthDate ? calcAge(birthDate) : null;
  const bmi = height > 0 && currentWeight > 0 ? calcBMI(currentWeight, height) : null;
  const bmiLv = bmi ? getBmiLevel(bmi) : null;
  const bmr = (age !== null && height > 0 && currentWeight > 0)
    ? calcBMR(currentWeight, height, age, gender)
    : null;
  const tdee = bmr ? Math.round(bmr * activityLevel) : null;
  const bodyFatPct = (bmi !== null && age !== null)
    ? Math.max(0, calcBodyFatPct(bmi, age, gender))
    : null;
  const leanBodyMass = (bodyFatPct !== null)
    ? currentWeight * (1 - bodyFatPct / 100)
    : null;

  const finalChartData = chartData.map((d, i) => ({
    ...d,
    loessTrend: loessValues[i] !== null ? Math.round(loessValues[i]! * 10) / 10 : null,
    bfLoessTrend: bfLoessValues[i] !== null ? Math.round(bfLoessValues[i]! * 10) / 10 : null,
    goalWeight: goalLineData[i],
  }));

  const allBF = finalChartData.map((d) => d.bodyFatEst).filter((v): v is number => v !== null);
  const minBF = allBF.length ? Number((Math.min(...allBF) - 1).toFixed(1)) : 0;
  const maxBF = allBF.length ? Number((Math.max(...allBF) + 1).toFixed(1)) : 50;

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

      {/* 차트 모드 토글 (체지방 가능할 때만) */}
      {!isFullscreen && canShowBodyFat && (
        <div className="px-4 mb-2 flex items-center gap-1.5">
          {(["weight", "bodyfat"] as ChartMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setChartMode(m)}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium transition-colors",
                chartMode === m
                  ? "bg-navy text-white"
                  : "bg-secondary text-muted-foreground"
              )}
            >
              {m === "weight" ? "체중" : "체지방률 추정"}
            </button>
          ))}
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
        {chartMode === "weight" ? (
          <>
            <div className={cn("flex flex-wrap gap-x-4 gap-y-1 text-[10px] sm:text-xs text-muted-foreground", !isFullscreen && "pointer-events-auto")}>
              <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-navy inline-block" /> 일별 체중</span>
              <span className="flex items-center gap-1">
                <svg width="16" height="4" className="inline-block"><line x1="0" y1="2" x2="16" y2="2" stroke="#f97316" strokeWidth="2" strokeDasharray="5 3" /></svg>
                추세
              </span>
              <span className="flex items-center gap-1">
                <svg width="16" height="4" className="inline-block"><line x1="0" y1="2" x2="16" y2="2" stroke="#86efac" strokeWidth="2" strokeDasharray="5 3" /></svg>
                목표 감량선
              </span>
              <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-green-600 inline-block" /> 목표 체중</span>
            </div>
            <div className={cn("flex flex-wrap gap-x-4 gap-y-1 text-[10px] sm:text-xs text-muted-foreground", !isFullscreen && "pointer-events-auto")}>
              <span className="flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 12 12"><polygon points="6,1 7.18,4.38 10.76,4.45 7.9,6.62 8.94,10.05 6,8 3.06,10.05 4.1,6.62 1.24,4.45 4.82,4.38" fill="#1e3a5f" /></svg>
                역대 최저
              </span>
              <span className="flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 12 12"><rect x="2" y="2" width="8" height="8" fill="#1e3a5f" /></svg>
                전일 대비 1kg↑
              </span>
            </div>
          </>
        ) : (
          <div className={cn("flex flex-wrap gap-x-4 gap-y-1 text-[10px] sm:text-xs text-muted-foreground", !isFullscreen && "pointer-events-auto")}>
            <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-purple-500 inline-block" /> 체지방률 추정</span>
            <span className="flex items-center gap-1">
              <svg width="16" height="4" className="inline-block"><line x1="0" y1="2" x2="16" y2="2" stroke="#f97316" strokeWidth="2" strokeDasharray="5 3" /></svg>
              추세
            </span>
            <span className="text-muted-foreground/60 text-[9px] pl-1">Deurenberg 공식 추정값</span>
          </div>
        )}
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
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            {chartMode === "weight" ? (
              <YAxis domain={[minW, maxW]} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={35} unit=" kg" />
            ) : (
              <YAxis domain={[minBF, maxBF]} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={35} unit="%" />
            )}
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
              formatter={(value: number, name: string) => {
                if (chartMode === "bodyfat") {
                  const labels: Record<string, string> = { bodyFatEst: "체지방률 추정", bfLoessTrend: "추세" };
                  return [`${value} %`, labels[name] ?? name];
                }
                const labels: Record<string, string> = { weight: "체중", loessTrend: "추세", goalWeight: "목표선" };
                return [`${value} kg`, labels[name] ?? name];
              }}
            />
            {chartMode === "weight" && (
              <ReferenceLine y={targetWeight} stroke="#16a34a" strokeWidth={1.5} />
            )}
            {/* 목표 감량선 (체중 모드만) */}
            {chartMode === "weight" && (
            <Line
              type="linear"
              dataKey="goalWeight"
              stroke="#86efac"
              strokeWidth={1.5}
              strokeDasharray="8 4"
              dot={false}
              connectNulls
            />
            )}
            {/* 추세 곡선 */}
            <Line
              type="monotone"
              dataKey={chartMode === "weight" ? "loessTrend" : "bfLoessTrend"}
              stroke="#f97316"
              strokeWidth={2}
              strokeDasharray="6 3"
              dot={false}
              connectNulls
            />
            {/* 일별 체중 (체중 모드) */}
            {chartMode === "weight" && (
              <Line
                type="monotone"
                dataKey="weight"
                stroke="#1e3a5f"
                strokeWidth={2}
                dot={<CustomDot />}
                activeDot={{ r: 6 }}
                connectNulls
              />
            )}
            {/* 일별 체지방률 (체지방 모드) */}
            {chartMode === "bodyfat" && (
              <Line
                type="monotone"
                dataKey="bodyFatEst"
                stroke="#a855f7"
                strokeWidth={2}
                dot={<circle r={4} fill="#a855f7" stroke="white" strokeWidth={2} />}
                activeDot={{ r: 6 }}
                connectNulls
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {!isFullscreen && (
        <div className="px-4 mt-4 space-y-3 pb-4">
          {/* ── 기존 4개 카드 ── */}
          <div className="grid grid-cols-2 gap-3">
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
                <p className="text-xs text-muted-foreground">예상 {fmtCardDate(estimatedDate)}</p>
              )}
            </div>
          </div>

          {/* ── 스마트 바디 분석 (full width, compact) ── */}
          <div className="px-3 py-2 bg-secondary rounded-xl flex items-center gap-3">
            <p className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">스마트 바디 분석</p>
            <p className="text-sm font-bold truncate">
              {gender === "남성" ? "남자" : "여자"}
              {height > 0 && ` | ${height}cm`}
              {currentWeight > 0 && ` | ${currentWeight}kg`}
              {age !== null
                ? ` | 만 ${age}세 (${new Date(birthDate! + "T00:00:00").getFullYear()}년생)`
                : " | 나이 미입력"}
            </p>
          </div>

          {/* ── BMI (full width) ── */}
          {bmi !== null && bmiLv !== null ? (
            <div className="p-3 bg-secondary rounded-xl">
              <CardTitle onInfo={() => setInfoSheet("bmi")}>BMI</CardTitle>
              <p className="text-lg font-bold">{bmi.toFixed(1)} <span className="text-sm font-medium text-muted-foreground">({bmiLv})</span></p>
              <BmiGaugeBar bmi={bmi} />
              <p className="text-xs text-muted-foreground mt-2">{getBmiAdvice(bmiLv)}</p>
            </div>
          ) : (
            <div className="p-3 bg-secondary rounded-xl">
              <p className="text-xs text-muted-foreground">BMI</p>
              <p className="text-xs text-muted-foreground/60 mt-1">키·체중 정보를 입력하시면 확인할 수 있어요.</p>
            </div>
          )}

          {/* ── 대사량/에너지 + 체성분 추정 ── */}
          <div className="grid grid-cols-2 gap-3">
            {/* 대사량/에너지 */}
            <div className="p-3 bg-secondary rounded-xl">
              <CardTitle onInfo={() => setInfoSheet("metabolism")}>대사량/에너지</CardTitle>
              {bmr !== null && tdee !== null ? (
                <>
                  <p className="text-sm font-bold">BMR: {bmr.toLocaleString()} kcal</p>
                  <p className="text-sm font-bold">TDEE: {tdee.toLocaleString()} kcal</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{activityLabel(activityLevel)} 기준</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">오늘의 칼로리: (곧 오픈)</p>
                </>
              ) : (
                <div className="mt-1 space-y-2">
                  <p className="text-xs text-muted-foreground/80 leading-relaxed">
                    생년월일을 알면 <strong className="text-foreground">기초대사량(BMR)</strong>과 <strong className="text-foreground">하루 권장 칼로리(TDEE)</strong>를 딱 맞게 계산해 드려요.
                  </p>
                  <a href="/settings?highlightBirthDate=true" className="block text-xs text-navy font-medium underline underline-offset-2">
                    생년월일 입력하러 가기 →
                  </a>
                </div>
              )}
            </div>

            {/* 체성분 추정 */}
            <div className="p-3 bg-secondary rounded-xl">
              <CardTitle onInfo={() => setInfoSheet("body")}>체성분 추정</CardTitle>
              {bodyFatPct !== null && leanBodyMass !== null ? (
                <>
                  <p className="text-sm font-bold">제지방량: {leanBodyMass.toFixed(1)} kg</p>
                  <p className="text-sm font-bold">체지방률: {bodyFatPct.toFixed(1)} %</p>
                </>
              ) : (
                <div className="mt-1 space-y-2">
                  <p className="text-xs text-muted-foreground/80 leading-relaxed">
                    나이를 알면 <strong className="text-foreground">체지방률</strong>과 <strong className="text-foreground">근육 추정량</strong>까지 보여드릴 수 있어요.
                  </p>
                  <a href="/settings?highlightBirthDate=true" className="block text-xs text-navy font-medium underline underline-offset-2">
                    생년월일 입력하러 가기 →
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 정보 바텀시트 (z-[100]로 하단 탭바 위에 표시) ── */}
      <InfoSheet open={infoSheet === "bmi"} onClose={() => setInfoSheet(null)} title="BMI (체질량지수)">
        <p>BMI(Body Mass Index)는 체중(kg)을 신장(m)의 제곱으로 나눈 값으로, 비만 여부를 판단하는 표준 지표입니다.</p>
        <div className="p-3 bg-secondary rounded-xl text-sm">
          <p className="font-semibold text-foreground mb-1">계산 공식</p>
          <p>BMI = 체중(kg) ÷ 신장(m)²</p>
          {bmi !== null && (
            <p className="mt-1 text-navy font-medium">
              현재: {currentWeight} ÷ {(height / 100).toFixed(2)}² = <strong>{bmi.toFixed(1)}</strong>
            </p>
          )}
        </div>
        {bmi !== null && <BmiGaugeDetail bmi={bmi} />}
        <div className="space-y-2">
          {[
            { color: "bg-amber-400", label: "낮음 (18.5 미만)", desc: "저체중. 영양 불균형에 주의하세요." },
            { color: "bg-teal-400", label: "건강 (18.5–24)", desc: "정상 체중. 현재 상태를 유지하세요." },
            { color: "bg-orange-400", label: "높음 (24–30)", desc: "과체중. 생활 습관 개선을 권장해요." },
            { color: "bg-red-500", label: "비만 (30 이상)", desc: "건강 위험 증가. 전문가 상담을 권장합니다." },
          ].map(({ color, label, desc }) => (
            <div key={label} className="flex items-start gap-2">
              <span className={`mt-0.5 w-2 h-2 rounded-sm ${color} flex-shrink-0`} />
              <p><strong className="text-foreground">{label}</strong> — {desc}</p>
            </div>
          ))}
        </div>
        <p className="text-xs bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-amber-800">
          ⚠ BMI는 근육량을 구별하지 못해 운동선수 등에선 부정확할 수 있습니다. 참고 지표로만 활용하세요.
        </p>
      </InfoSheet>

      <InfoSheet open={infoSheet === "metabolism"} onClose={() => setInfoSheet(null)} title="대사량 / 에너지">
        <div className="space-y-3">
          <div>
            <p className="font-semibold text-foreground">BMR (기초대사량)</p>
            <p>아무것도 안 해도 생명 유지에 필요한 최소 칼로리예요.</p>
            <div className="mt-2 p-3 bg-secondary rounded-xl text-xs">
              <p className="font-medium text-foreground mb-1">Mifflin-St Jeor 공식</p>
              <p>남성: 10 × 체중 + 6.25 × 키 − 5 × 나이 + 5</p>
              <p>여성: 10 × 체중 + 6.25 × 키 − 5 × 나이 − 161</p>
            </div>
          </div>
          <div>
            <p className="font-semibold text-foreground mb-2">내 활동 수준 선택</p>
            <div className="space-y-1.5">
              {ACTIVITY_OPTIONS.map(({ level, label, sublabel }) => (
                <button
                  key={level}
                  onClick={() => { onActivityLevelChange(level); setInfoSheet(null); }}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-left transition-colors text-sm",
                    activityLevel === level
                      ? "border-navy bg-navy/5 text-foreground font-medium"
                      : "border-border text-muted-foreground"
                  )}
                >
                  <span>{label} <span className="text-xs opacity-70">{sublabel}</span></span>
                  <span className="text-xs font-mono">× {level}</span>
                </button>
              ))}
            </div>
            {bmr !== null && (
              <p className="mt-2 text-xs text-navy font-medium">
                현재 적용 TDEE: {Math.round(bmr * activityLevel).toLocaleString()} kcal/일
              </p>
            )}
          </div>
          <p className="text-xs bg-navy/5 border border-navy/10 rounded-lg px-3 py-2 text-navy">
            💡 TDEE보다 하루 약 500 kcal 적게 먹으면 주당 약 0.5 kg 감량이 가능해요.
          </p>
        </div>
      </InfoSheet>

      <InfoSheet open={infoSheet === "body"} onClose={() => setInfoSheet(null)} title="체성분 추정">
        <p>Deurenberg(1991) 공식으로 BMI·나이·성별에 따른 체지방률을 추정합니다. 실제 InBody 측정과 차이가 있을 수 있으니 참고로 활용하세요.</p>
        <div className="p-3 bg-secondary rounded-xl text-xs space-y-1">
          <p className="font-medium text-foreground mb-1">계산 공식</p>
          <p>체지방률 = (1.20 × BMI) + (0.23 × 나이) − (10.8 × 성별*) − 5.4</p>
          <p className="text-muted-foreground">* 성별: 남성 = 1, 여성 = 0</p>
          <p className="mt-1">제지방량 = 체중 × (1 − 체지방률 / 100)</p>
        </div>
        <div className="space-y-2 text-xs">
          <p className="font-semibold text-foreground">건강 체지방률 기준 (참고)</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { title: "남성", items: ["저체지방: ~8%", "건강: 8~20%", "과체지방: 20~25%", "비만: 25%↑"] },
              { title: "여성", items: ["저체지방: ~15%", "건강: 15~30%", "과체지방: 30~35%", "비만: 35%↑"] },
            ].map(({ title, items }) => (
              <div key={title} className="p-2 bg-secondary rounded-lg">
                <p className="font-medium mb-1">{title}</p>
                {items.map((i) => <p key={i}>{i}</p>)}
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-amber-800">
          ⚠ 이 수치는 통계적 추정이며 근육량·수분 상태에 따라 오차가 발생할 수 있습니다.
        </p>
      </InfoSheet>
    </div>
  );
}
