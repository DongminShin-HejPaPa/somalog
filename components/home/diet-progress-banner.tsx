import { cn } from "@/lib/utils";

interface DietProgressBannerProps {
  date: string;
  day: number;
  currentWeight: number | null;
  startWeight: number;
  targetWeight: number;
  weightChange: number | null;
  fallbackWeightChange?: number | null;
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
  currentWeight,
  startWeight,
  targetWeight,
  weightChange,
  fallbackWeightChange,
  isIntensiveDay,
}: DietProgressBannerProps) {
  const totalToLose = startWeight - targetWeight;
  // 오늘 체중 미입력 시 최근 기록의 weightChange로 진행률 계산
  const effectiveWeightChange = weightChange ?? fallbackWeightChange ?? null;
  const actualLost = effectiveWeightChange !== null ? Math.max(-effectiveWeightChange, 0) : 0;
  const progress = totalToLose > 0 ? Math.min((actualLost / totalToLose) * 100, 100) : 0;
  // 남은 kg: 오늘 체중 있으면 직접 계산, 없으면 fallback weightChange로 추정
  const remaining =
    currentWeight !== null
      ? currentWeight - targetWeight
      : effectiveWeightChange !== null
        ? startWeight + effectiveWeightChange - targetWeight
        : startWeight - targetWeight;

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
        {weightChange !== null && (
          <span
            className={cn(
              "text-sm font-medium",
              weightChange < 0 ? "text-success" : "text-coral"
            )}
          >
            {weightChange > 0 ? "+" : ""}
            {weightChange.toFixed(1)} kg
          </span>
        )}
      </div>

      <p className="text-sm text-muted-foreground mb-3">
        목표까지 {remaining.toFixed(1)} kg
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
