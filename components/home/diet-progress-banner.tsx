import { cn } from "@/lib/utils";

interface DietProgressBannerProps {
  date: string;
  day: number;
  /** 첫 기록일부터의 누적 일수 — 이전 챕터가 있을 때만 보조로 표시 */
  cumulativeDay?: number;
  currentWeight: number | null;
  /** 오늘 체중 미입력 시 진행률 계산에 쓸 최근 기록 체중 */
  fallbackWeight?: number | null;
  startWeight: number;
  targetWeight: number;
  isIntensiveDay: boolean;
}

function formatShortDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return `${d.getMonth() + 1}/${d.getDate()}(${days[d.getDay()]})`;
}

export function DietProgressBanner({
  date,
  day,
  cumulativeDay,
  currentWeight,
  fallbackWeight,
  startWeight,
  targetWeight,
  isIntensiveDay,
}: DietProgressBannerProps) {
  const totalToLose = startWeight - targetWeight;
  // 변화/진행률은 항상 현재 챕터의 startWeight 기준으로 live 계산 (저장된 weight_change는
  // 새 챕터 시작 후 이전 startWeight 기준이라 stale → 사용하지 않음)
  const effectiveWeight = currentWeight ?? fallbackWeight ?? null;
  const change =
    effectiveWeight !== null ? Math.round((effectiveWeight - startWeight) * 10) / 10 : null;
  // 오늘 체중 입력 시 보여줄 배지 값 (시작 대비 총 변화)
  const todayChange =
    currentWeight !== null ? Math.round((currentWeight - startWeight) * 10) / 10 : null;
  const actualLost = change !== null ? Math.max(-change, 0) : 0;
  const progress = totalToLose > 0 ? Math.min((actualLost / totalToLose) * 100, 100) : 0;
  const remaining =
    effectiveWeight !== null
      ? Math.round((effectiveWeight - targetWeight) * 10) / 10
      : totalToLose;
  // 게이지 글로우: 총 감량 목표가 GLOW_MIN_TOTAL_KG 이상일 때만 활성화,
  // 활성화 시 임박 임계값은 총 목표의 GLOW_RATIO 비율로 비례 계산 (CSS만, 쿼리 0)
  const GLOW_MIN_TOTAL_KG = 5; // 이 미만 목표는 글로우 없음 (e.g. 3kg, 4kg 목표)
  const GLOW_RATIO = 0.15;     // 20kg → 3kg, 10kg → 1.5kg, 5kg → 0.75kg
  const glowThresholdKg =
    totalToLose >= GLOW_MIN_TOTAL_KG
      ? Math.round(totalToLose * GLOW_RATIO * 10) / 10
      : 0;
  const nearGoal = !isIntensiveDay && glowThresholdKg > 0 && remaining > 0 && remaining <= glowThresholdKg;

  return (
    <div
      data-testid="home-progress-banner"
      className={cn(
        "p-4 rounded-xl mx-4 mt-4",
        isIntensiveDay
          ? "bg-coral-light border border-coral/30"
          : nearGoal
            ? "bg-amber-50 border border-amber-300/70 shadow-[0_0_22px_-2px_rgba(251,191,36,0.5)]"
            : "bg-navy-light/50 border border-navy/10"
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-baseline gap-1.5">
          <span className="text-lg font-bold">{formatShortDate(date)}</span>
          <span className="text-sm font-normal text-muted-foreground">D+{day}</span>
          {cumulativeDay !== undefined && cumulativeDay > day && (
            <span className="text-xs font-normal text-muted-foreground/60">
              · 총 {cumulativeDay}일째
            </span>
          )}
        </div>
        {isIntensiveDay && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-coral text-white text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-white inline-block" />
            Hard Reset Mode
          </span>
        )}
      </div>

      <div className="flex items-baseline gap-2 mb-1">
        <span data-testid="home-weight-display" className="text-2xl font-bold">
          {currentWeight ? `${currentWeight} kg` : "미입력"}
        </span>
        {todayChange !== null && (
          <span
            className={cn(
              "text-sm font-medium",
              todayChange <= 0 ? "text-success" : "text-coral"
            )}
          >
            {todayChange > 0 ? "+" : ""}
            {todayChange.toFixed(1)} kg
          </span>
        )}
      </div>

      <p className={cn("text-sm mb-3", nearGoal ? "text-amber-700 font-semibold" : "text-muted-foreground")}>
        {remaining > 0
          ? nearGoal
            ? `목표까지 ${remaining.toFixed(1)} kg · 마지막 스퍼트예요 🔥`
            : `목표까지 ${remaining.toFixed(1)} kg`
          : remaining < 0
            ? `목표 달성! 🎉 목표보다 ${Math.abs(remaining).toFixed(1)}kg 아래`
            : "목표 달성! 🎉"}
      </p>

      <div className="w-full h-2.5 bg-white/60 rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            isIntensiveDay ? "bg-coral" : nearGoal ? "bg-amber-400" : "bg-navy"
          )}
          style={{ width: `${progress.toFixed(1)}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground mt-1 text-right">
        {progress.toFixed(1)}% 달성
      </p>
    </div>
  );
}
