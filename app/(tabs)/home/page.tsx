import Link from "next/link";
import { DietProgressBanner } from "@/components/home/diet-progress-banner";
import { InputStatusChips } from "@/components/home/input-status-chips";
import { CoachOneLiner } from "@/components/home/coach-one-liner";
import { WeightMiniGraph } from "@/components/home/weight-mini-graph";
import { DailySummary } from "@/components/home/daily-summary";
import { mockDailyLogs, mockSettings } from "@/lib/mock-data";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const today = mockDailyLogs[0];
  const yesterday = mockDailyLogs[1];

  const oneLiner = today.closed
    ? today.oneLiner
    : yesterday?.oneLiner;
  const isYesterday = !today.closed && !!yesterday?.oneLiner;

  return (
    <div className="pb-6">
      <header className="px-4 pt-4 pb-2 flex items-center justify-between">
        <h1 className="text-lg font-bold">Soma Log</h1>
        {user ? (
          <span className="text-xs text-muted-foreground">{user.email}</span>
        ) : (
          <Link
            href="/login"
            className="px-3 py-1.5 rounded-lg border border-navy text-navy text-xs font-semibold hover:bg-navy hover:text-white active:scale-[0.97] transition-all"
          >
            로그인
          </Link>
        )}
      </header>

      <DietProgressBanner
        day={today.day}
        currentWeight={today.weight}
        startWeight={mockSettings.startWeight}
        targetWeight={mockSettings.targetWeight}
        weightChange={today.weightChange}
        isIntensiveDay={today.intensiveDay === true}
      />

      <InputStatusChips log={today} />

      {oneLiner && (
        <CoachOneLiner
          coachName={mockSettings.coachName}
          oneLiner={oneLiner}
          isYesterday={isYesterday}
        />
      )}

      <WeightMiniGraph
        data={mockDailyLogs.slice(0, 14).map((d) => ({
          date: d.date,
          weight: d.weight,
        }))}
      />

      <DailySummary
        todayLog={today}
        recentLogs={mockDailyLogs}
        coachName={mockSettings.coachName}
      />
    </div>
  );
}
