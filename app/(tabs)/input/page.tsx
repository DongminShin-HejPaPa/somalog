import { DateHeader } from "@/components/input/date-header";
import { InputChipList } from "@/components/input/input-chip-list";
import { FeedbackArea } from "@/components/input/feedback-area";
import { FreeTextInput } from "@/components/input/free-text-input";
import { mockDailyLogs, mockSettings } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export default function InputPage() {
  const today = mockDailyLogs[0];
  const isIntensiveDay = today.intensiveDay === true;

  return (
    <div className="pb-20">
      <DateHeader
        date={today.date}
        day={today.day}
        isClosed={today.closed}
        pendingDays={0}
      />

      {isIntensiveDay && (
        <div className="mx-4 mt-2 px-3 py-2 bg-coral-light border border-coral/30 rounded-lg flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-coral inline-block" />
          <span className="text-xs font-semibold text-coral">Intensive Day</span>
          <span className="text-xs text-coral/80">
            — 역대 최저(88.5kg)보다 높은 상태
          </span>
        </div>
      )}

      <InputChipList log={today} waterGoal={mockSettings.waterGoal} />

      <FeedbackArea
        feedback={today.feedback}
        coachName={mockSettings.coachName}
      />

      <div className="px-4 mt-4">
        <button
          className={cn(
            "w-full py-3 rounded-xl font-semibold text-sm min-h-[48px] transition-colors",
            today.closed
              ? "bg-secondary text-muted-foreground"
              : "bg-navy text-white hover:bg-navy/90"
          )}
        >
          {today.closed ? "마감 완료" : "마감하기"}
        </button>
      </div>

      <FreeTextInput />
    </div>
  );
}
