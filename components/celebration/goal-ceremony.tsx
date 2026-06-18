"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { GoalSnapshot, JourneyReport } from "@/lib/types";
import {
  actionGetJourneyReport,
  actionMarkGoalSeen,
} from "@/app/actions/log-actions";
import { useSettings } from "@/lib/contexts/settings-context";
import { Confetti } from "./confetti";

interface GoalCeremonyProps {
  snapshot: GoalSnapshot;
  onClose: () => void;
}

function useCountUp(target: number, durationMs = 1200, decimals = 0): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / durationMs, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(target * eased * 10 ** decimals) / 10 ** decimals);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs, decimals]);
  return value;
}

function Stars() {
  const data = useMemo(
    () =>
      [
        [6, 12, 0, 0.9],
        [14, 78, 0.6, 0.7],
        [22, 44, 0.2, 1.0],
        [35, 8, 1.0, 0.6],
        [48, 92, 0.4, 1.0],
        [58, 28, 0.8, 0.7],
        [68, 68, 0.3, 0.9],
        [76, 18, 1.2, 0.8],
        [83, 85, 0.7, 0.6],
        [90, 52, 0.1, 1.0],
        [25, 58, 1.3, 0.7],
        [72, 38, 0.5, 0.9],
        [10, 35, 0.9, 0.6],
        [55, 72, 0.4, 0.8],
      ] as const,
    []
  );
  const glyphs = ["✦", "✧", "✸", "✺"];

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none" aria-hidden>
      {data.map(([top, left, delay, opacity], i) => (
        <span
          key={i}
          className="absolute animate-pulse text-yellow-200"
          style={{
            top: `${top}%`,
            left: `${left}%`,
            animationDelay: `${delay}s`,
            opacity,
            fontSize: i % 3 === 0 ? "1.3rem" : i % 3 === 1 ? "0.7rem" : "1rem",
          }}
        >
          {glyphs[i % glyphs.length]}
        </span>
      ))}
    </div>
  );
}

type Step = "celebrate" | "report" | "next";

export default function GoalCeremony({ snapshot, onClose }: GoalCeremonyProps) {
  const router = useRouter();
  const { updateSettings } = useSettings();
  const [step, setStep] = useState<Step>("celebrate");
  const seenRef = useRef(false);

  useEffect(() => {
    if (seenRef.current) return;
    seenRef.current = true;
    try {
      navigator.vibrate?.([0, 60, 40, 120]);
    } catch {
      /* 미지원 기기 무시 */
    }
    actionMarkGoalSeen("goal_reached").catch(() => {});
  }, []);

  return (
    <div data-testid="goal-ceremony" className="fixed inset-0 z-[100] bg-gradient-to-br from-[#0c0920] via-navy to-[#0f1f33] text-white flex flex-col overflow-y-auto">
      {step === "celebrate" && (
        <CelebrateAct snapshot={snapshot} onNext={() => setStep("report")} />
      )}
      {step === "report" && (
        <ReportAct snapshot={snapshot} onNext={() => setStep("next")} />
      )}
      {step === "next" && (
        <NextStepAct
          onMaintain={() => {
            // context 경유로 DB + 클라이언트 상태 + 캐시를 모두 동기화
            // (raw action만 호출하면 설정 탭이 캐시된 옛 mode를 계속 보여줌)
            updateSettings({ mode: "maintaining" });
            onClose();
          }}
          onNewGoal={() => {
            onClose();
            router.push("/settings?newChapter=1");
          }}
          onHallOfFame={() => {
            onClose();
            router.push("/settings/chapters");
          }}
        />
      )}
    </div>
  );
}

// ─── 1막: 발견의 순간 ───
function CelebrateAct({
  snapshot,
  onNext,
}: {
  snapshot: GoalSnapshot;
  onNext: () => void;
}) {
  const totalLoss = Math.max(snapshot.startWeight - snapshot.finalWeight, 0);
  const loss = useCountUp(totalLoss, 1400, 1);
  const days = useCountUp(snapshot.daysElapsed, 1400, 0);
  const recorded = useCountUp(snapshot.recordedDays, 1400, 0);

  return (
    <div className="relative flex-1 flex flex-col items-center justify-center px-6 py-10 text-center">
      <Confetti count={60} />
      <Stars />
      {/* 따뜻한 배경 글로우 */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-yellow-400/10 blur-3xl pointer-events-none" />

      <div className="relative z-10 animate-goal-pop w-full max-w-sm mx-auto">
        {/* 트로피 */}
        <div className="text-6xl mb-3 drop-shadow-lg">🏆</div>

        {/* 달성 체중 — 오늘 실제 측정값 */}
        <div className="mb-1">
          <span className="text-7xl font-black text-yellow-300 drop-shadow-md tabular-nums">
            {snapshot.finalWeight}
          </span>
          <span className="text-3xl font-bold text-yellow-200 ml-1">kg</span>
        </div>
        <p className="text-xs text-white/50 mb-6 tracking-wide">
          목표 {snapshot.targetWeight}kg 달성 🎯
        </p>

        {/* 3가지 메트릭 */}
        <div className="grid grid-cols-3 gap-3 mb-6 w-full">
          <Metric label="총 감량" value={`−${loss.toFixed(1)}`} unit="kg" gold />
          <Metric label="여정" value={`${days}`} unit="일" />
          <Metric label="기록한 날" value={`${recorded}`} unit="일" />
        </div>

        {/* 감성 카드 */}
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 mb-8 text-left border border-white/10">
          <p className="text-base font-bold text-white mb-1">
            {snapshot.coachName}와 함께 해냈어요! 🎉
          </p>
          <p className="text-sm leading-relaxed text-white/85">
            {snapshot.startWeight}kg에서 시작해 {snapshot.daysElapsed}일 동안{" "}
            <strong className="text-yellow-300">
              {Math.round(totalLoss * 10) / 10}kg
            </strong>
            를 빼냈어요.
            <br />
            포기하지 않은 당신이 만든 진짜 결과예요. ✨
          </p>
        </div>

        <button
          onClick={onNext}
          className="w-full py-3.5 rounded-full bg-yellow-400 text-[#0c0920] font-extrabold text-sm shadow-xl hover:bg-yellow-300 active:scale-[0.98] transition-all"
        >
          내 여정 돌아보기 →
        </button>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  unit,
  gold,
}: {
  label: string;
  value: string;
  unit: string;
  gold?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl py-4 px-2 backdrop-blur-sm",
        gold ? "bg-yellow-400/20 ring-1 ring-yellow-400/40" : "bg-white/10"
      )}
    >
      <p
        className={cn(
          "text-2xl font-extrabold leading-none tabular-nums",
          gold ? "text-yellow-300" : "text-white"
        )}
      >
        {value}
        <span className="text-sm font-semibold ml-0.5">{unit}</span>
      </p>
      <p className="text-[11px] text-white/60 mt-1.5">{label}</p>
    </div>
  );
}

// ─── 2막: 여정 회고 리포트 ───
function ReportAct({
  snapshot,
  onNext,
}: {
  snapshot: GoalSnapshot;
  onNext: () => void;
}) {
  const [report, setReport] = useState<JourneyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSharing, setIsSharing] = useState(false);
  const [savedToast, setSavedToast] = useState<string | null>(null);
  const shareCard1Ref = useRef<HTMLDivElement>(null);
  const shareCard2Ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    actionGetJourneyReport()
      .then((r) => setReport(r))
      .finally(() => setLoading(false));
  }, []);

  const handleShare = async () => {
    if (!shareCard1Ref.current || !shareCard2Ref.current) return;
    setIsSharing(true);
    try {
      const { toPng } = await import("html-to-image");
      const [dataUrl1, dataUrl2] = await Promise.all([
        toPng(shareCard1Ref.current, { quality: 1, pixelRatio: 2 }),
        toPng(shareCard2Ref.current, { quality: 1, pixelRatio: 2 }),
      ]);
      const [blob1, blob2] = await Promise.all([
        fetch(dataUrl1).then((r) => r.blob()),
        fetch(dataUrl2).then((r) => r.blob()),
      ]);
      const file1 = new File([blob1], "somalog-달성.png", { type: "image/png" });
      const file2 = new File([blob2], "somalog-여정.png", { type: "image/png" });
      const totalLoss = Math.round((snapshot.startWeight - snapshot.finalWeight) * 10) / 10;

      if (
        typeof navigator !== "undefined" &&
        navigator.share &&
        navigator.canShare?.({ files: [file1, file2] })
      ) {
        await navigator.share({
          files: [file1, file2],
          title: "목표 달성! 🏆",
          text: `${snapshot.coachName}와 함께 ${totalLoss}kg 감량 달성! SomaLog로 같이 도전해볼래?`,
          url: "https://somalog.vercel.app",
        });
        setSavedToast("공유 완료! 🎉 사진첩에 저장했다면 거기서 확인할 수 있어요");
        setTimeout(() => setSavedToast(null), 4000);
      } else {
        [dataUrl1, dataUrl2].forEach((url, i) => {
          const a = document.createElement("a");
          a.href = url;
          a.download = i === 0 ? "somalog-달성.png" : "somalog-여정.png";
          a.click();
        });
        setSavedToast("이미지 2장이 저장됐어요 📸 사진첩(갤러리)에서 확인할 수 있어요");
        setTimeout(() => setSavedToast(null), 4000);
      }
    } catch (err) {
      console.error("Share failed", err);
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col px-6 py-12">
      {/* 오프스크린 공유 카드 — html-to-image 캡처용 */}
      <div aria-hidden style={{ position: "fixed", left: "-9999px", top: 0, pointerEvents: "none" }}>
        <CelebrationShareCard snapshot={snapshot} cardRef={shareCard1Ref} />
        {report && <JourneyShareCard snapshot={snapshot} report={report} cardRef={shareCard2Ref} />}
      </div>

      <div className="max-w-sm mx-auto w-full">
        <p className="text-sm font-semibold text-white/70 mb-1">SomaLog Wrapped</p>
        <h2 className="text-2xl font-extrabold mb-8">나의 다이어트 여정</h2>

        {loading ? (
          <div className="py-16 text-center text-white/60 text-sm">
            여정을 불러오는 중...
          </div>
        ) : report ? (
          <div className="space-y-3">
            <BigStat
              label="시작 → 달성"
              value={`${report.startWeight}kg → ${report.finalWeight}kg`}
              highlight={`−${report.totalLoss}kg`}
            />
            <div className="grid grid-cols-2 gap-3">
              <SmallStat
                label="🏃 운동한 날"
                value={`${report.exerciseDays}일`}
                sub={`${report.exerciseRate}%`}
              />
              <SmallStat
                label="💧 수분 목표 달성"
                value={`${report.waterGoalDays}일`}
                sub={`${report.waterGoalRate}%`}
              />
              <SmallStat
                label="🌙 야식 먹은 날"
                value={`${report.lateSnackDays}일`}
                sub={`${report.lateSnackRate}%`}
              />
              <SmallStat
                label="🍺 술 마신 날"
                value={`${report.alcoholDays}일`}
                sub={`${report.alcoholRate}%`}
              />
              <SmallStat
                label="🍽️ 세 끼 모두 먹은 날"
                value={`${report.allMealsDays}일`}
                sub={`${report.allMealsRate}%`}
              />
              <SmallStat label="📅 기록한 날" value={`${report.recordedDays}일`} />
              <SmallStat
                label="📉 일 평균 감량"
                value={`${report.dailyAvgLoss.toFixed(2)}kg`}
                sub="/일"
              />
              <SmallStat
                label="📉 주 평균 감량"
                value={`${report.weeklyAvgLoss.toFixed(2)}kg`}
                sub="/주"
              />
            </div>
          </div>
        ) : (
          <div className="py-16 text-center text-white/60 text-sm">
            {snapshot.startWeight}kg → {snapshot.finalWeight}kg,{" "}
            {snapshot.daysElapsed}일의 여정
          </div>
        )}

        <div className="mt-10 space-y-3">
          <button
            onClick={onNext}
            className="w-full py-3 rounded-full bg-white text-navy font-bold text-sm shadow-lg hover:bg-white/90 active:scale-[0.98] transition-all"
          >
            나의 다음 선택 →
          </button>
          {report && (
            <button
              onClick={handleShare}
              disabled={isSharing}
              className="w-full py-3 rounded-full bg-white/10 text-white font-semibold text-sm hover:bg-white/15 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSharing ? "이미지 만드는 중..." : "📸 친구에게 자랑하기"}
            </button>
          )}
        </div>
      </div>

      {savedToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[110] px-4 w-full max-w-sm">
          <div className="bg-white/95 text-navy text-sm font-semibold rounded-2xl px-4 py-3 shadow-xl text-center animate-goal-pop">
            {savedToast}
          </div>
        </div>
      )}
    </div>
  );
}

function BigStat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight: string;
}) {
  return (
    <div className="bg-white/10 rounded-2xl p-4 flex items-center justify-between">
      <div>
        <p className="text-[11px] text-white/60 mb-1">{label}</p>
        <p className="text-base font-bold">{value}</p>
      </div>
      <p className="text-2xl font-extrabold text-emerald-300">{highlight}</p>
    </div>
  );
}

function SmallStat({
  label,
  value,
  sub,
  wide,
}: {
  label: string;
  value: string;
  sub?: string;
  wide?: boolean;
}) {
  return (
    <div className={cn("bg-white/10 rounded-2xl p-3", wide && "col-span-2")}>
      <p className="text-[11px] text-white/60 mb-1">{label}</p>
      <p className="text-lg font-extrabold leading-none">
        {value}
        {sub && (
          <span className="text-xs font-semibold text-white/70 ml-1">{sub}</span>
        )}
      </p>
    </div>
  );
}

// ─── 3막: 그 다음 설계 ───
function NextStepAct({
  onMaintain,
  onNewGoal,
  onHallOfFame,
}: {
  onMaintain: () => void;
  onNewGoal: () => void;
  onHallOfFame: () => void;
}) {
  const [busy, setBusy] = useState(false);

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="max-w-sm w-full">
        <h2 className="text-2xl font-extrabold mb-2">이제, 그 다음은?</h2>
        <p className="text-sm text-white/70 mb-10">
          목표를 이뤘으니 새로운 방향을 골라보세요.
        </p>

        <div className="space-y-3">
          <NextButton
            emoji="⚖️"
            title="유지 모드로 전환"
            desc="더 빼지 않고 지금 체중을 지켜요"
            onClick={async () => {
              if (busy) return;
              setBusy(true);
              await onMaintain();
            }}
            disabled={busy}
          />
          <NextButton
            emoji="🎯"
            title="새 목표 설정하기"
            desc="더 낮은 목표 체중에 도전해요"
            onClick={onNewGoal}
            disabled={busy}
          />
        </div>

        <button
          onClick={onHallOfFame}
          disabled={busy}
          className="mt-5 text-sm text-yellow-300/90 hover:text-yellow-200 font-semibold transition-colors disabled:opacity-50"
        >
          🏆 명예의 전당 보기
        </button>

        <p className="text-xs text-white/45 mt-4 leading-relaxed">
          유지 모드에서는 목표 체중에 다시 도달해도 축하가 다시 뜨지 않아요.
          언제든 설정에서 다시 바꿀 수 있어요.
        </p>
      </div>
    </div>
  );
}

function NextButton({
  emoji,
  title,
  desc,
  onClick,
  disabled,
}: {
  emoji: string;
  title: string;
  desc: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full text-left rounded-2xl p-4 bg-white/10 hover:bg-white/15 active:scale-[0.98] transition-all flex items-start gap-3 disabled:opacity-50"
      )}
    >
      <span className="text-2xl leading-none">{emoji}</span>
      <span>
        <span className="block font-bold text-sm">{title}</span>
        <span className="block text-xs text-white/60 mt-0.5">{desc}</span>
      </span>
    </button>
  );
}

// ─── 오프스크린 공유 카드 (html-to-image 캡처용) ───
// Tailwind 미사용 — 인라인 스타일로 캡처 안정성 확보

const SHARE_BG = "linear-gradient(135deg, #0c0920 0%, #0d1b4a 55%, #0f1f33 100%)";
const SHARE_YELLOW = "#fbbf24";
const SHARE_W = 375;

function CelebrationShareCard({
  snapshot,
  cardRef,
}: {
  snapshot: GoalSnapshot;
  cardRef: React.RefObject<HTMLDivElement | null>;
}) {
  const totalLoss = Math.round((snapshot.startWeight - snapshot.finalWeight) * 10) / 10;
  const cell = (label: string, value: string, unit: string, gold?: boolean) => (
    <div key={label} style={{ flex: 1, background: "rgba(255,255,255,0.1)", borderRadius: 16, padding: "16px 8px", textAlign: "center" }}>
      <p style={{ fontSize: 22, fontWeight: 900, color: gold ? SHARE_YELLOW : "#fff", margin: 0, lineHeight: 1 }}>
        {value}<span style={{ fontSize: 12, marginLeft: 2 }}>{unit}</span>
      </p>
      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", margin: "6px 0 0" }}>{label}</p>
    </div>
  );
  return (
    <div ref={cardRef} style={{ width: SHARE_W, height: 620, background: SHARE_BG, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 28px", textAlign: "center", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", boxSizing: "border-box" }}>
      <div style={{ fontSize: 68, marginBottom: 12, lineHeight: 1 }}>🏆</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
        <span style={{ fontSize: 72, fontWeight: 900, color: SHARE_YELLOW, lineHeight: 1 }}>{snapshot.finalWeight}</span>
        <span style={{ fontSize: 28, fontWeight: 700, color: "#fde68a" }}>kg</span>
      </div>
      <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", marginBottom: 28, letterSpacing: "0.5px" }}>
        목표 {snapshot.targetWeight}kg 달성 🎯
      </p>
      <div style={{ display: "flex", gap: 10, marginBottom: 24, width: "100%" }}>
        {cell("총 감량", `−${totalLoss}`, "kg", true)}
        {cell("여정", `${snapshot.daysElapsed}`, "일")}
        {cell("기록한 날", `${snapshot.recordedDays}`, "일")}
      </div>
      <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 16, padding: "14px 18px", marginBottom: 28, width: "100%", boxSizing: "border-box", textAlign: "left" }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: "#fff", margin: "0 0 4px" }}>{snapshot.coachName}와 함께 해냈어요! 🎉</p>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", lineHeight: 1.6, margin: 0 }}>
          {snapshot.startWeight}kg에서 시작해 {snapshot.daysElapsed}일 동안 <strong style={{ color: SHARE_YELLOW }}>{totalLoss}kg</strong>를 빼냈어요.
        </p>
      </div>
      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", fontWeight: 600, letterSpacing: "2px", margin: 0 }}>SOMALOG</p>
    </div>
  );
}

function JourneyShareCard({
  snapshot,
  report,
  cardRef,
}: {
  snapshot: GoalSnapshot;
  report: JourneyReport;
  cardRef: React.RefObject<HTMLDivElement | null>;
}) {
  const stats = [
    { label: "🏃 운동한 날", value: `${report.exerciseDays}일`, sub: `${report.exerciseRate}%` },
    { label: "💧 수분 달성", value: `${report.waterGoalDays}일`, sub: `${report.waterGoalRate}%` },
    { label: "🌙 야식 먹은 날", value: `${report.lateSnackDays}일`, sub: `${report.lateSnackRate}%` },
    { label: "🍺 술 마신 날", value: `${report.alcoholDays}일`, sub: `${report.alcoholRate}%` },
    { label: "🍽️ 세 끼 모두 먹은 날", value: `${report.allMealsDays}일`, sub: `${report.allMealsRate}%` },
    { label: "📅 기록한 날", value: `${report.recordedDays}일` },
    { label: "📉 일 평균 감량", value: `${report.dailyAvgLoss.toFixed(2)}kg`, sub: "/일" },
    { label: "📉 주 평균 감량", value: `${report.weeklyAvgLoss.toFixed(2)}kg`, sub: "/주" },
  ];
  return (
    <div ref={cardRef} style={{ width: SHARE_W, height: 620, background: SHARE_BG, display: "flex", flexDirection: "column", padding: "32px 24px", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", boxSizing: "border-box", color: "#fff" }}>
      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", fontWeight: 600, margin: "0 0 4px", letterSpacing: "0.5px" }}>SomaLog Wrapped</p>
      <h2 style={{ fontSize: 22, fontWeight: 900, margin: "0 0 18px" }}>나의 다이어트 여정</h2>
      <div style={{ background: "rgba(255,255,255,0.1)", borderRadius: 16, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", margin: "0 0 3px" }}>시작 → 달성</p>
          <p style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{report.startWeight}kg → {report.finalWeight}kg</p>
        </div>
        <p style={{ fontSize: 30, fontWeight: 900, color: "#6ee7b7", margin: 0 }}>−{report.totalLoss}kg</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, flex: 1 }}>
        {stats.map((s) => (
          <div key={s.label} style={{ background: "rgba(255,255,255,0.08)", borderRadius: 14, padding: 12 }}>
            <p style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", margin: "0 0 4px" }}>{s.label}</p>
            <p style={{ fontSize: 20, fontWeight: 900, margin: 0, lineHeight: 1 }}>
              {s.value}
              {s.sub && <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginLeft: 3 }}>{s.sub}</span>}
            </p>
          </div>
        ))}
      </div>
      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", fontWeight: 600, letterSpacing: "2px", margin: "16px 0 0", textAlign: "center" }}>SOMALOG</p>
    </div>
  );
}
