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

  return (
    <div
      data-testid="home-progress-banner"
      className={cn(
        "p-4 rounded-xl mx-4 mt-4",
        isIntensiveDay
          ? "bg-coral-light border border-coral/30"
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

      <p className="text-sm text-muted-foreground mb-3">
        {remaining > 0
          ? `목표까지 ${remaining.toFixed(1)} kg`
          : remaining < 0
            ? `목표 달성! 🎉 목표보다 ${Math.abs(remaining).toFixed(1)}kg 아래`
            : "목표 달성! 🎉"}
      </p>

      <div className="w-full h-2.5 bg-white/60 rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            isIntensiveDay ? "bg-coral" : "bg-navy"
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
