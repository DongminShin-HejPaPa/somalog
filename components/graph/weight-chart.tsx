"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Expand, X, GripHorizontal, Info, Share2 } from "lucide-react";
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
import type { WeightPoint } from "@/lib/types";

interface WeightChartProps {
  logs: WeightPoint[];
  startWeight: number;
  targetWeight: number;
  startDate: string;
  targetEndDate: string; // YYYY-MM-DD — 목표선 종료 기준일 (스코프별)
  isOngoing: boolean;    // 진행 중 스코프만 '예상 달성일' 미래 투영 표시
  lowestWeight: number;
  lowestWeightDate: string;
  height: number;
  gender: "남성" | "여성";
  birthDate: string | null;
  activityLevel: number;
  onActivityLevelChange: (level: number) => void;
  userName: string;
  autoShare?: boolean; // 월간 자랑 팝업에서 진입 시 공유 시트 자동 열기
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

type BmiLevel = "낮음" | "정상" | "과체중" | "비만 1단계" | "비만 2단계" | "비만 3단계";

// 대한비만학회 기준 (아시아): 18.5 / 23 / 25 / 30 / 35
function getBmiLevel(bmi: number): BmiLevel {
  if (bmi < 18.5) return "낮음";
  if (bmi < 23)   return "정상";
  if (bmi < 25)   return "과체중";
  if (bmi < 30)   return "비만 1단계";
  if (bmi < 35)   return "비만 2단계";
  return "비만 3단계";
}

function getBmiAdvice(level: BmiLevel): string {
  switch (level) {
    case "낮음":      return "저체중입니다. 균형 잡힌 식단으로 건강 체중을 만들어 보세요.";
    case "정상":      return "정상 체중이에요 (아시아 기준). 지금처럼 꾸준히 유지하세요!";
    case "과체중":    return "과체중 범위입니다. 가벼운 운동과 식단 조절로 정상 범위를 목표로 해요.";
    case "비만 1단계": return "비만 1단계입니다. 생활 습관 개선과 꾸준한 운동을 시작해 보세요.";
    case "비만 2단계": return "비만 2단계입니다. 전문가 상담과 함께 체계적인 감량 계획을 세우세요.";
    case "비만 3단계": return "고도비만입니다. 의료 전문가의 도움을 받아 체중 관리를 시작하세요.";
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

// BMI → 해당 키의 몸무게 경계 (kg)
function bmiToWeight(bmi: number, heightCm: number): number {
  return Math.round(bmi * Math.pow(heightCm / 100, 2) * 10) / 10;
}

// ── 미니 BMI 게이지 바 ───────────────────────────────────────────────────────
// 표시 범위: 14 ~ 40 / 대한비만학회 6단계: 18.5 / 23 / 25 / 30 / 35
// 세그먼트 flex: 낮음 4.5 / 정상 4.5 / 과체중 2 / 비만1 5 / 비만2 5 / 비만3 5 → 합 26

const BMI_SEGMENTS = [
  { flex: 4.5, color: "#60a5fa", label: "낮음" },      // sky-400
  { flex: 4.5, color: "#34d399", label: "정상" },      // emerald-400
  { flex: 2,   color: "#facc15", label: "과체중" },    // yellow-400
  { flex: 5,   color: "#fb923c", label: "비만1" },     // orange-400
  { flex: 5,   color: "#f87171", label: "비만2" },     // red-400
  { flex: 5,   color: "#b91c1c", label: "비만3" },     // red-700
];

function BmiGaugeBar({ bmi, startBmi }: { bmi: number; startBmi?: number }) {
  const MIN = 14, MAX = 40, RANGE = MAX - MIN;
  const pct = Math.min(100, Math.max(0, ((bmi - MIN) / RANGE) * 100));
  const startPct = startBmi !== undefined
    ? Math.min(100, Math.max(0, ((startBmi - MIN) / RANGE) * 100))
    : null;
  return (
    <div className="mt-2.5">
      {/* 마커 레이블 행 */}
      <div className="relative h-3.5 mb-0.5">
        {startPct !== null && (
          <span
            className="absolute text-[9px] text-slate-400 -translate-x-1/2 leading-none"
            style={{ left: `${startPct}%` }}
          >
            시작
          </span>
        )}
        <span
          className="absolute text-[9px] text-slate-600 font-medium -translate-x-1/2 leading-none"
          style={{ left: `${pct}%` }}
        >
          현재
        </span>
      </div>
      {/* 게이지 바 */}
      <div className="relative">
        <div className="flex h-2.5 rounded-full overflow-hidden">
          {BMI_SEGMENTS.map((s) => (
            <div key={s.label} style={{ flex: s.flex, backgroundColor: s.color }} />
          ))}
        </div>
        {startPct !== null && (
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 opacity-50"
            style={{ left: `${startPct}%` }}
          >
            <div className="w-0.5 h-4 bg-slate-500 rounded-full" />
          </div>
        )}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-white border-2 border-slate-700 rounded-full shadow"
          style={{ left: `${pct}%` }}
        />
      </div>
      <div className="flex mt-1.5 text-[9px] text-muted-foreground">
        {BMI_SEGMENTS.map((s) => (
          <div key={s.label} style={{ flex: s.flex }}>{s.label}</div>
        ))}
      </div>
    </div>
  );
}

// 상세 BMI 게이지 (정보 시트용) — 대한비만학회 기준 컷포인트: 18.5, 23, 25, 30, 35
function BmiGaugeDetail({ bmi, startBmi }: { bmi: number; startBmi?: number }) {
  const MIN = 14, MAX = 40, RANGE = MAX - MIN;
  const pct = Math.min(100, Math.max(0, ((bmi - MIN) / RANGE) * 100));
  const startPct = startBmi !== undefined
    ? Math.min(100, Math.max(0, ((startBmi - MIN) / RANGE) * 100))
    : null;
  const cutpoints = [18.5, 23, 25, 30, 35];
  return (
    <div className="my-4">
      {/* 마커 레이블 행 */}
      <div className="relative h-4 mb-0.5">
        {startPct !== null && (
          <span
            className="absolute text-[9px] text-slate-400 -translate-x-1/2 leading-none"
            style={{ left: `${startPct}%` }}
          >
            시작
          </span>
        )}
        <span
          className="absolute text-[9px] text-slate-600 font-medium -translate-x-1/2 leading-none"
          style={{ left: `${pct}%` }}
        >
          현재
        </span>
      </div>
      <div className="relative">
        <div className="flex h-4 rounded-full overflow-hidden">
          {BMI_SEGMENTS.map((s) => (
            <div key={s.label} style={{ flex: s.flex, backgroundColor: s.color }} />
          ))}
        </div>
        {cutpoints.map((v) => (
          <div
            key={v}
            className="absolute top-0 bottom-0 w-0.5 bg-white/60"
            style={{ left: `${((v - MIN) / RANGE) * 100}%` }}
          />
        ))}
        {startPct !== null && (
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 opacity-40"
            style={{ left: `${startPct}%` }}
          >
            <div className="w-0.5 h-6 bg-slate-700 rounded-full" />
          </div>
        )}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 bg-white border-2 border-slate-700 rounded-full shadow flex items-center justify-center"
          style={{ left: `${pct}%` }}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-slate-700" />
        </div>
      </div>
      <div className="relative flex mt-1 text-[10px] text-muted-foreground">
        {BMI_SEGMENTS.map((s) => (
          <div key={s.label} style={{ flex: s.flex }}>{s.label}</div>
        ))}
      </div>
      <div className="relative flex mt-0.5 text-[10px] font-medium text-foreground/50">
        {cutpoints.map((v) => (
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

type Period = "short" | "mid" | "long" | "all";

const PERIOD_ORDER: Period[] = ["short", "mid", "long", "all"];

// 총 다이어트 기간에 따라 단기/중기/장기 구간을 동적으로 결정한다.
// 단기는 최근 추세를 보는 용도라 짧게 유지하고, 중기·장기는 기간이 길수록 넓힌다.
interface PeriodConfig {
  short: { days: number; label: string };
  mid: { days: number; label: string };
  long: { days: number; label: string };
}

function getPeriodConfig(totalDays: number): PeriodConfig {
  if (totalDays < 180) {
    // 6개월 미만 — 기존과 동일 (2주 / 1개월 / 3개월)
    return {
      short: { days: 14, label: "2주" },
      mid: { days: 30, label: "1개월" },
      long: { days: 90, label: "3개월" },
    };
  }
  if (totalDays < 365) {
    // 6개월 ~ 1년 — 단기는 그대로, 중기·장기 확대
    return {
      short: { days: 14, label: "2주" },
      mid: { days: 60, label: "2개월" },
      long: { days: 180, label: "6개월" },
    };
  }
  if (totalDays < 730) {
    // 1년 ~ 2년
    return {
      short: { days: 14, label: "2주" },
      mid: { days: 90, label: "3개월" },
      long: { days: 365, label: "1년" },
    };
  }
  // 2년 이상
  return {
    short: { days: 30, label: "1개월" },
    mid: { days: 180, label: "6개월" },
    long: { days: 730, label: "2년" },
  };
}

function fmtCardDate(d: Date): string {
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}/${mm}/${dd}`;
}

interface CustomDotProps {
  cx?: number;
  cy?: number;
  /** 데이터가 많은 구간에서 일반 점(원)을 생략해 SVG 노드 폭증을 막는다. 특수 마커는 유지. */
  dense?: boolean;
  payload?: {
    date: string;
    weight: number | null;
    isLowest: boolean;
    isSurge: boolean;
  };
}

function CustomDot({ cx, cy, payload, dense }: CustomDotProps) {
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

  // 밀집 구간: 역대 최저·급증 같은 특수 마커만 남기고 일반 일별 점은 생략.
  if (dense) return null;

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
    const dists = xs.map((x, i) => ({ i, d: Math.abs(x - xi) }));
    dists.sort((a, b) => a.d - b.d);
    const win = dists.slice(0, windowSize);
    const h = win[win.length - 1].d || 1;

    const pts = win.map(({ i, d }) => ({
      x: xs[i],
      y: ys[i],
      w: tricube(d / h),
    }));

    const sumW = pts.reduce((s, p) => s + p.w, 0);
    if (sumW === 0) return null;

    const xBar = pts.reduce((s, p) => s + p.w * p.x, 0) / sumW;
    const xScale = Math.max(...pts.map(p => Math.abs(p.x - xBar))) || 1;

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
  targetEndDate: targetEndDateStr,
  isOngoing,
  lowestWeight,
  lowestWeightDate,
  height,
  gender,
  birthDate,
  activityLevel,
  onActivityLevelChange,
  userName,
  autoShare = false,
}: WeightChartProps) {
  const [period, setPeriod] = useState<Period>("all");
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPortrait, setIsPortrait] = useState(false);
  const [legendPos, setLegendPos] = useState({ x: 0, y: 0 });
  const [infoSheet, setInfoSheet] = useState<"bmi" | "metabolism" | "body" | null>(null);
  const [isSharePreview, setIsSharePreview] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const shareContentRef = useRef<HTMLDivElement>(null);
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

  // 월간 자랑 팝업의 '자랑하러 가기'로 진입(?share=1)하면 공유 시트를 자동으로 연다.
  useEffect(() => {
    if (autoShare) setIsSharePreview(true);
  }, [autoShare]);

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

  const handleShareCapture = async () => {
    if (!shareContentRef.current) return;
    setIsCapturing(true);
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(shareContentRef.current, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
      });

      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], "somalog-progress.png", { type: "image/png" });

      if (typeof navigator !== "undefined" && navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "SomaLog 다이어트 기록",
          text: "나 요즘 SomaLog로 다이어트 기록 중! 📉 체중 그래프·BMI 분석·AI 코치까지 무료야. 같이 써볼래?",
          url: "https://somalog.vercel.app",
        });
      } else {
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = "somalog-progress.png";
        a.click();
      }
    } catch (err) {
      console.error("Share failed", err);
    } finally {
      setIsCapturing(false);
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

  // ── 차트 파생 데이터 (메모이즈) ──────────────────────────────────────────────
  // 전체화면·공유·정보시트 토글 등 무관한 상태 변경마다 LOESS(O(n²))를 다시 돌지
  // 않도록, 비싼 계산은 [logs, period, 목표 관련 props] 가 바뀔 때만 재계산한다.
  const chart = useMemo(() => {
    const sortedLogs = [...logs].reverse();

    // 다이어트 시작일부터 현재까지의 총 기간으로 구간 폭을 결정한다.
    const totalDietDays = Math.max(
      1,
      Math.ceil((Date.now() - new Date(startDate).getTime()) / 86400000)
    );
    const periodConfig = getPeriodConfig(totalDietDays);
    const periodLabels: Record<Period, string> = {
      short: periodConfig.short.label,
      mid: periodConfig.mid.label,
      long: periodConfig.long.label,
      all: "전체",
    };
    const periodDays: Record<Period, number> = {
      short: periodConfig.short.days,
      mid: periodConfig.mid.days,
      long: periodConfig.long.days,
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

    // LOESS 추세 곡선 — 체중.
    // 점이 많으면 평가 지점을 일정 간격(stride)으로 솎아 O(n²) 폭주를 막는다.
    // 추세선은 매끄러운 곡선이라 솎은 지점만 계산하고 사이는 connectNulls 로 잇는다.
    const validPts = chartData
      .map((d, i) => ({ i, y: d.weight as number }))
      .filter((p) => chartData[p.i].weight !== null);

    const LOESS_MAX_EVAL = 150;
    let loessValues: (number | null)[];
    if (validPts.length >= 3) {
      const xs = validPts.map((p) => p.i);
      const ys = validPts.map((p) => p.y);
      const stride = Math.max(1, Math.ceil(chartData.length / LOESS_MAX_EVAL));
      if (stride === 1) {
        loessValues = computeLoess(xs, ys, chartData.map((_, i) => i), 0.8);
      } else {
        const evalIdx: number[] = [];
        for (let i = 0; i < chartData.length; i += stride) evalIdx.push(i);
        const lastIdx = chartData.length - 1;
        if (evalIdx[evalIdx.length - 1] !== lastIdx) evalIdx.push(lastIdx);
        const sampled = computeLoess(xs, ys, evalIdx, 0.8);
        loessValues = chartData.map(() => null);
        evalIdx.forEach((idx, k) => {
          loessValues[idx] = sampled[k];
        });
      }
    } else {
      loessValues = chartData.map(() => null);
    }

    const targetEndDate = new Date(targetEndDateStr + "T00:00:00");
    const totalDays = Math.max(
      1,
      Math.ceil((targetEndDate.getTime() - new Date(startDate).getTime()) / 86400000)
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
    const minW = Math.floor(Math.min(...allWeights));
    const maxW = Math.ceil(Math.max(...allWeights));

    // y축 범위:
    //  - 전체(all): 목표 감량선이 모두 보이도록 넓힌다. (목표 체중선은 굳이 보일 필요 없음)
    //  - 그 외 구간: 체중 그래프 기준으로만 잡는다. 목표선은 잘려도(일부만 보여도) 무방.
    //    (allowDataOverflow=true 로 목표선이 y축을 강제로 늘리지 못하게 한다.)
    const isAllPeriod = period === "all";
    const yDomainMin = isAllPeriod
      ? Math.floor(Math.min(...allWeights, ...goalLineData))
      : minW;
    const yDomainMax = isAllPeriod
      ? Math.ceil(Math.max(...allWeights, ...goalLineData))
      : maxW;

    const allSortedWeights = sortedLogs
      .map((l) => l.weight)
      .filter((w): w is number => w !== null);
    const currentWeight =
      allSortedWeights.length > 0
        ? allSortedWeights[allSortedWeights.length - 1]
        : startWeight;

    const finalChartData = chartData.map((d, i) => ({
      ...d,
      loessTrend: loessValues[i] !== null ? Math.round(loessValues[i]! * 10) / 10 : null,
      goalWeight: goalLineData[i],
    }));

    // 약 6개월(180일) 넘는 일별 점이 한 화면에 들어오면 일반 점은 생략(특수 마커만).
    const denseDots = chartData.length > 180;

    return {
      periodLabels,
      isAllPeriod,
      yDomainMin,
      yDomainMax,
      currentWeight,
      finalChartData,
      denseDots,
    };
  }, [logs, period, lowestWeight, startWeight, targetWeight, startDate, targetEndDateStr]);

  const {
    periodLabels,
    isAllPeriod,
    yDomainMin,
    yDomainMax,
    currentWeight,
    finalChartData,
    denseDots,
  } = chart;

  const targetEndDate = new Date(targetEndDateStr + "T00:00:00");

  const remaining = currentWeight - targetWeight;

  const daysSoFar = Math.ceil(
    (Date.now() - new Date(startDate).getTime()) / 86400000
  );
  const dailyRate = daysSoFar > 0 ? (startWeight - currentWeight) / daysSoFar : 0;
  // 이미 목표 도달/초과(remaining ≤ 0)면 투영하지 않음 — 과거 날짜가 '예상 달성일'로 뜨는 것 방지.
  // 종료된 챕터(과거)는 미래 예상 달성일이 의미 없으므로 진행 중(isOngoing)일 때만 투영.
  const daysToGoal =
    isOngoing && remaining > 0 && dailyRate > 0 ? Math.ceil(remaining / dailyRate) : null;
  const estimatedDate = daysToGoal
    ? new Date(Date.now() + daysToGoal * 86400000)
    : null;

  const daysEarlyVsTarget = estimatedDate
    ? Math.round((targetEndDate.getTime() - estimatedDate.getTime()) / 86400000)
    : null;

  // ── 건강 지표 계산 ──────────────────────────────────────────────────────────
  const age = birthDate ? calcAge(birthDate) : null;
  const bmi = height > 0 && currentWeight > 0 ? calcBMI(currentWeight, height) : null;
  const startBmi = height > 0 && startWeight > 0 ? calcBMI(startWeight, height) : undefined;
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

  // finalChartData / currentWeight / yDomain 등은 위 useMemo(chart)에서 계산됨.

  // ── 공유 모드 계산 ──────────────────────────────────────────────────────────
  const shareYTickFormatter = (v: number) => {
    const delta = Math.round(v - startWeight);
    return delta === 0 ? "0" : String(delta);
  };
  const shareTooltipFormatter = (value: number, name: string) => {
    const labels: Record<string, string> = { weight: "체중", loessTrend: "추세", goalWeight: "목표선" };
    const delta = +(value - startWeight).toFixed(1);
    const deltaStr = delta === 0 ? "0" : delta > 0 ? `+${delta}` : String(delta);
    return [`${deltaStr} kg`, labels[name] ?? name];
  };
  const targetDelta = +(targetWeight - startWeight).toFixed(1);
  const lowestDelta = +(lowestWeight - startWeight).toFixed(1);

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

      {/* 기간 필터 + 자랑 버튼 */}
      <div className={cn(
        "flex-shrink-0 z-20 transition-opacity",
        isFullscreen
          ? "absolute bottom-6 left-6 bg-background/80 p-2.5 rounded-2xl backdrop-blur-md shadow-sm flex gap-1.5"
          : "px-4 mb-3 flex items-center gap-2"
      )}>
        <div className={cn("flex gap-1.5", !isFullscreen && "flex-1")}>
          {PERIOD_ORDER.map((p) => (
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
        {!isFullscreen && (
          <button
            onClick={() => setIsSharePreview(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold bg-gradient-to-r from-pink-500 to-purple-500 text-white shadow-sm whitespace-nowrap min-h-[36px]"
          >
            <Share2 size={11} />
            친구에게 자랑
          </button>
        )}
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
            <YAxis domain={[yDomainMin, yDomainMax]} allowDataOverflow={!isAllPeriod} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={35} unit=" kg" />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
              formatter={(value: number, name: string) => {
                const labels: Record<string, string> = { weight: "체중", loessTrend: "추세", goalWeight: "목표선" };
                return [`${value} kg`, labels[name] ?? name];
              }}
            />
            <ReferenceLine y={targetWeight} stroke="#16a34a" strokeWidth={1.5} />
            <Line
              type="linear"
              dataKey="goalWeight"
              stroke="#86efac"
              strokeWidth={1.5}
              strokeDasharray="8 4"
              dot={false}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="loessTrend"
              stroke="#f97316"
              strokeWidth={2}
              strokeDasharray="6 3"
              dot={false}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="weight"
              stroke="#1e3a5f"
              strokeWidth={2}
              dot={<CustomDot dense={denseDots} />}
              activeDot={{ r: 6 }}
              connectNulls
            />
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
              <p className="text-xs text-muted-foreground">역대 최저 (현재)</p>
              <p className="text-lg font-bold">
                {lowestWeight} kg
                {currentWeight > lowestWeight ? (
                  <span className="text-xs font-normal text-muted-foreground ml-1">
                    ({currentWeight} kg,{" "}
                    <span className="text-amber-500 font-medium">+{(currentWeight - lowestWeight).toFixed(1)} kg</span>
                    )
                  </span>
                ) : (
                  <span className="text-xs font-normal text-emerald-500 ml-1">현재 최저점!</span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">{fmtCardDate(new Date(lowestWeightDate + "T00:00:00"))}</p>
            </div>
            <div className="p-3 bg-secondary rounded-xl">
              {remaining > 0 ? (
                <>
                  <p className="text-xs text-muted-foreground">목표까지</p>
                  <p className="text-lg font-bold">{remaining.toFixed(1)} kg</p>
                  {estimatedDate && (
                    <p className="text-xs text-muted-foreground">
                      예상 {fmtCardDate(estimatedDate)}
                      {daysEarlyVsTarget !== null && daysEarlyVsTarget !== 0 && (
                        <span className={cn("ml-1 font-medium", daysEarlyVsTarget > 0 ? "text-emerald-500" : "text-amber-500")}>
                          ({daysEarlyVsTarget > 0 ? `-${daysEarlyVsTarget}일` : `+${Math.abs(daysEarlyVsTarget)}일`})
                        </span>
                      )}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">목표 달성 🎉</p>
                  <p className="text-lg font-bold">{remaining < 0 ? `−${Math.abs(remaining).toFixed(1)} kg` : "도달"}</p>
                  {remaining < 0 && <p className="text-xs text-muted-foreground">목표보다 아래</p>}
                </>
              )}
            </div>
          </div>

          {/* ── 스마트 바디 분석 (full width) ── */}
          <div className="px-3 py-2.5 bg-secondary rounded-xl">
            <p className="text-xs text-muted-foreground mb-0.5">스마트 바디 분석</p>
            <p className="text-sm font-bold">
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
              <CardTitle onInfo={() => setInfoSheet("bmi")}>BMI (아시아 기준)</CardTitle>
              <p className="text-lg font-bold">{bmi.toFixed(1)} <span className="text-sm font-medium text-muted-foreground">({bmiLv})</span></p>
              <BmiGaugeBar bmi={bmi} startBmi={startBmi} />
              <p className="text-xs text-muted-foreground mt-2">{getBmiAdvice(bmiLv)}</p>
            </div>
          ) : (
            <div className="p-3 bg-secondary rounded-xl">
              <p className="text-xs text-muted-foreground">BMI (아시아 기준)</p>
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

      {/* ── 정보 바텀시트 ── */}
      <InfoSheet open={infoSheet === "bmi"} onClose={() => setInfoSheet(null)} title="BMI (체질량지수)">
        <p>BMI(Body Mass Index)는 체중(kg)을 신장(m)의 제곱으로 나눈 값으로, 비만 여부를 판단하는 지표입니다. 이 앱은 <strong className="text-foreground">WHO 아시아·태평양 기준</strong>을 적용합니다 (국제 기준보다 낮은 컷포인트).</p>
        <div className="p-3 bg-secondary rounded-xl text-sm">
          <p className="font-semibold text-foreground mb-1">계산 공식</p>
          <p>BMI = 체중(kg) ÷ 신장(m)²</p>
          {bmi !== null && (
            <p className="mt-1 text-navy font-medium">
              현재: {currentWeight} ÷ {(height / 100).toFixed(2)}² = <strong>{bmi.toFixed(1)}</strong>
            </p>
          )}
        </div>
        {bmi !== null && <BmiGaugeDetail bmi={bmi} startBmi={startBmi} />}
        <div className="space-y-2">
          {[
            {
              hex: "#60a5fa",
              label: `낮음 (18.5 미만${height > 0 ? `, ${bmiToWeight(18.5, height)}kg 미만` : ""})`,
              desc: "저체중. 균형 잡힌 식단으로 건강 체중을 만들어 보세요.",
            },
            {
              hex: "#34d399",
              label: `정상 (18.5–23${height > 0 ? `, ${bmiToWeight(18.5, height)}–${bmiToWeight(23, height)}kg` : ""})`,
              desc: "정상 체중. 지금처럼 꾸준히 유지하세요!",
            },
            {
              hex: "#facc15",
              label: `과체중 (23–25${height > 0 ? `, ${bmiToWeight(23, height)}–${bmiToWeight(25, height)}kg` : ""})`,
              desc: "과체중. 가벼운 운동과 식단 조절을 권장해요.",
            },
            {
              hex: "#fb923c",
              label: `비만 1단계 (25–30${height > 0 ? `, ${bmiToWeight(25, height)}–${bmiToWeight(30, height)}kg` : ""})`,
              desc: "비만 1단계. 생활 습관 개선과 꾸준한 운동을 시작해 보세요.",
            },
            {
              hex: "#f87171",
              label: `비만 2단계 (30–35${height > 0 ? `, ${bmiToWeight(30, height)}–${bmiToWeight(35, height)}kg` : ""})`,
              desc: "비만 2단계. 전문가 상담과 체계적인 감량 계획을 세우세요.",
            },
            {
              hex: "#b91c1c",
              label: `비만 3단계 (35 이상${height > 0 ? `, ${bmiToWeight(35, height)}kg 이상` : ""})`,
              desc: "고도비만. 의료 전문가의 도움이 필요합니다.",
            },
          ].map(({ hex, label, desc }) => (
            <div key={label} className="flex items-start gap-2">
              <span className="mt-0.5 w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: hex }} />
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

      {/* ── 친구에게 자랑 오버레이 ── */}
      {isSharePreview && (
        <div className="fixed inset-0 z-[110] flex flex-col bg-background">
          {/* 헤더 */}
          <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border flex-shrink-0">
            <h3 className="font-bold text-base">친구에게 자랑하기</h3>
            <button
              onClick={() => setIsSharePreview(false)}
              className="p-1.5 text-muted-foreground hover:bg-secondary rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* 캡처 영역 (스크롤 가능) */}
          <div className="flex-1 overflow-y-auto">
            <div
              ref={shareContentRef}
              className="bg-white p-4 min-h-full"
              style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
            >
              {/* 앱 브랜딩 */}
              <div className="text-center mb-4">
                <p className="text-xl font-black text-[#1e3a5f] tracking-tight">
                  {userName ? `${userName}님 다이어트 ` : "다이어트 "}
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>{daysSoFar}일째</span>
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  SomaLog와 함께{" "}
                  <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#0d9488" }}>
                    {(startWeight - currentWeight) > 0
                      ? `${(startWeight - currentWeight).toFixed(1)} kg`
                      : `${Math.abs(startWeight - currentWeight).toFixed(1)} kg`}
                  </span>
                  {" "}{(startWeight - currentWeight) > 0 ? "줄여가는중" : "함께하는중"}
                </p>
              </div>

              {/* 차트 — y축: 시작 대비 감량량 표시 */}
              <div style={{ height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
                    data={finalChartData}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis
                      domain={[yDomainMin, yDomainMax]}
                      allowDataOverflow={!isAllPeriod}
                      tick={{ fontSize: 9 }}
                      tickLine={false}
                      axisLine={false}
                      width={38}
                      tickFormatter={shareYTickFormatter}
                      unit=" kg"
                    />
                    <Tooltip
                      contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e2e8f0" }}
                      formatter={shareTooltipFormatter}
                    />
                    <ReferenceLine y={targetWeight} stroke="#16a34a" strokeWidth={1.5} />
                    <Line type="linear" dataKey="goalWeight" stroke="#86efac" strokeWidth={1.5} strokeDasharray="8 4" dot={false} connectNulls />
                    <Line type="monotone" dataKey="loessTrend" stroke="#f97316" strokeWidth={2} strokeDasharray="6 3" dot={false} connectNulls />
                    <Line type="monotone" dataKey="weight" stroke="#1e3a5f" strokeWidth={2} dot={<CustomDot dense={denseDots} />} activeDot={{ r: 6 }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* 범례 */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[9px] text-gray-400 mb-4 mt-1 px-1">
                <span className="flex items-center gap-1"><span style={{ width: 16, height: 2, backgroundColor: "#1e3a5f", display: "inline-block" }} /> 일별 체중</span>
                <span className="flex items-center gap-1">
                  <svg width="16" height="4"><line x1="0" y1="2" x2="16" y2="2" stroke="#f97316" strokeWidth="2" strokeDasharray="5 3" /></svg>
                  추세
                </span>
                <span className="flex items-center gap-1">
                  <svg width="16" height="4"><line x1="0" y1="2" x2="16" y2="2" stroke="#86efac" strokeWidth="2" strokeDasharray="5 3" /></svg>
                  목표 감량선
                </span>
              </div>

              {/* 4개 카드 — 시작 기준 상대값 (4번째만 실제값) */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="p-3 rounded-xl" style={{ backgroundColor: "#f1f5f9" }}>
                  <p style={{ fontSize: 10, color: "#64748b" }}>시작</p>
                  <p style={{ fontSize: 18, fontWeight: 700, color: "#1e293b" }}>0 kg</p>
                  <p style={{ fontSize: 10, color: "#94a3b8" }}>{fmtCardDate(new Date(startDate + "T00:00:00"))}</p>
                </div>
                <div className="p-3 rounded-xl" style={{ backgroundColor: "#f1f5f9" }}>
                  <p style={{ fontSize: 10, color: "#64748b" }}>목표 감량</p>
                  <p style={{ fontSize: 18, fontWeight: 700, color: "#1e293b" }}>{targetDelta > 0 ? `+${targetDelta}` : targetDelta} kg</p>
                  <p style={{ fontSize: 10, color: "#94a3b8" }}>{fmtCardDate(targetEndDate)}</p>
                </div>
                <div className="p-3 rounded-xl" style={{ backgroundColor: "#f1f5f9" }}>
                  <p style={{ fontSize: 10, color: "#64748b" }}>최저 감량</p>
                  <p style={{ fontSize: 18, fontWeight: 700, color: lowestDelta < 0 ? "#16a34a" : "#1e293b" }}>{lowestDelta > 0 ? `+${lowestDelta}` : lowestDelta} kg</p>
                  <p style={{ fontSize: 10, color: "#94a3b8" }}>{fmtCardDate(new Date(lowestWeightDate + "T00:00:00"))}</p>
                </div>
                <div className="p-3 rounded-xl" style={{ backgroundColor: "#f1f5f9" }}>
                  {remaining > 0 ? (
                    <>
                      <p style={{ fontSize: 10, color: "#64748b" }}>목표까지</p>
                      <p style={{ fontSize: 18, fontWeight: 700, color: "#1e293b" }}>{remaining.toFixed(1)} kg</p>
                      {estimatedDate && (
                        <p style={{ fontSize: 10, color: "#94a3b8" }}>예상 {fmtCardDate(estimatedDate)}</p>
                      )}
                    </>
                  ) : (
                    <>
                      <p style={{ fontSize: 10, color: "#64748b" }}>목표 달성 🎉</p>
                      <p style={{ fontSize: 18, fontWeight: 700, color: "#1e293b" }}>{remaining < 0 ? `−${Math.abs(remaining).toFixed(1)} kg` : "도달"}</p>
                      {remaining < 0 && <p style={{ fontSize: 10, color: "#94a3b8" }}>목표보다 아래</p>}
                    </>
                  )}
                </div>
              </div>

              {/* BMI 카드 */}
              {bmi !== null && bmiLv !== null && (
                <div className="p-3 rounded-xl" style={{ backgroundColor: "#f1f5f9" }}>
                  <p style={{ fontSize: 10, color: "#64748b", marginBottom: 2 }}>BMI (아시아 기준)</p>
                  <p style={{ fontSize: 18, fontWeight: 700, color: "#1e293b" }}>
                    {bmi.toFixed(1)}{" "}
                    <span style={{ fontSize: 13, fontWeight: 500, color: "#64748b" }}>({bmiLv})</span>
                  </p>
                  {/* 인라인 게이지 — 마커 레이블 + dot + 시작 마커, 6단계, html-to-image 호환 */}
                  {(() => {
                    const MIN = 14, MAX = 40, RANGE = MAX - MIN;
                    const pct = Math.min(100, Math.max(0, ((bmi - MIN) / RANGE) * 100));
                    const sPct = startBmi !== undefined
                      ? Math.min(100, Math.max(0, ((startBmi - MIN) / RANGE) * 100))
                      : null;
                    return (
                      <div style={{ marginTop: 8 }}>
                        {/* 마커 레이블 행 */}
                        <div style={{ position: "relative", height: 12, marginBottom: 2 }}>
                          {sPct !== null && (
                            <span style={{
                              position: "absolute",
                              left: `${sPct}%`,
                              transform: "translateX(-50%)",
                              fontSize: 8,
                              color: "#94a3b8",
                              lineHeight: 1,
                            }}>
                              시작
                            </span>
                          )}
                          <span style={{
                            position: "absolute",
                            left: `${pct}%`,
                            transform: "translateX(-50%)",
                            fontSize: 8,
                            fontWeight: 600,
                            color: "#475569",
                            lineHeight: 1,
                          }}>
                            현재
                          </span>
                        </div>
                        {/* 바 + 마커 */}
                        <div style={{ position: "relative" }}>
                          <div style={{ display: "flex", height: 10, borderRadius: 99, overflow: "hidden" }}>
                            {BMI_SEGMENTS.map((s) => (
                              <div key={s.label} style={{ flex: s.flex, backgroundColor: s.color }} />
                            ))}
                          </div>
                          {sPct !== null && (
                            <div style={{
                              position: "absolute",
                              top: "50%",
                              left: `${sPct}%`,
                              transform: "translate(-50%, -50%)",
                              width: 2,
                              height: 16,
                              backgroundColor: "#475569",
                              borderRadius: 1,
                              opacity: 0.4,
                            }} />
                          )}
                          <div style={{
                            position: "absolute",
                            top: "50%",
                            left: `${pct}%`,
                            transform: "translate(-50%, -50%)",
                            width: 14,
                            height: 14,
                            backgroundColor: "#ffffff",
                            border: "2px solid #334155",
                            borderRadius: "50%",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                          }} />
                        </div>
                        <div style={{ display: "flex", marginTop: 4, fontSize: 8, color: "#94a3b8" }}>
                          {BMI_SEGMENTS.map((s) => (
                            <div key={s.label} style={{ flex: s.flex }}>{s.label}</div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                  <p style={{ fontSize: 10, color: "#64748b", marginTop: 6 }}>{getBmiAdvice(bmiLv)}</p>
                </div>
              )}

              {/* 푸터 */}
              <div style={{ textAlign: "center", marginTop: 12 }}>
                <a
                  href="https://somalog.vercel.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: 9, color: "#94a3b8", textDecoration: "underline" }}
                >
                  somalog.vercel.app
                </a>
              </div>
            </div>
          </div>

          {/* 하단 액션 */}
          <div className="px-4 py-4 border-t border-border flex-shrink-0">
            <button
              onClick={handleShareCapture}
              disabled={isCapturing}
              className="w-full py-3 rounded-2xl font-semibold text-sm text-white bg-gradient-to-r from-pink-500 to-purple-500 shadow-sm disabled:opacity-60 transition-opacity"
            >
              {isCapturing ? "처리 중…" : "저장 / 공유하기"}
            </button>
            <p className="text-center text-xs text-muted-foreground mt-2">
              이미지로 저장하거나 SNS에 바로 공유할 수 있어요
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
