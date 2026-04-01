import { cn } from "@/lib/utils";

interface DietProgressBannerProps {
  day: number;
  currentWeight: number | null;
  startWeight: number;
  targetWeight: number;
  weightChange: number | null;
  isIntensiveDay: boolean;
}

export function DietProgressBanner({
  day,
  currentWeight,
  startWeight,
  targetWeight,
  weightChange,
  isIntensiveDay,
}: DietProgressBannerProps) {
  const totalToLose = startWeight - targetWeight;
  // weightChange = currentWeight - startWeight (음수면 감량, 양수면 증가)
  // 체중이 늘었을 때는 0으로 처리 (진행 없음)
  const actualLost = weightChange !== null ? Math.max(-weightChange, 0) : 0;
  const progress = totalToLose > 0 ? Math.min((actualLost / totalToLose) * 100, 100) : 0;
  const remaining = currentWeight ? currentWeight - targetWeight : startWeight - targetWeight;

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
        <span className="text-lg font-bold text-navy">D+{day}</span>
        {isIntensiveDay && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-coral text-white text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-white inline-block" />
            Hard Reset
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
