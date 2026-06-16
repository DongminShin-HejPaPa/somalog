import { Suspense } from "react";
import Link from "next/link";
import { ChevronLeft, Trophy, Footprints } from "lucide-react";
import { getChapters } from "@/lib/services/chapter-service";
import { getSettings } from "@/lib/services/settings-service";
import { getDayNumber, formatDate } from "@/lib/utils/date-utils";
import type { DietChapter } from "@/lib/types";

function fmt(date: string): string {
  const [y, m, d] = date.split("-");
  return `${y}.${m}.${d}`;
}

/** 두 날짜(YYYY-MM-DD) 사이 일수, 끝 포함 */
function spanDays(start: string, end: string): number {
  const ms =
    new Date(end + "T00:00:00").getTime() - new Date(start + "T00:00:00").getTime();
  return Math.max(1, Math.round(ms / 86_400_000) + 1);
}

function loss(a: number, b: number): number {
  return Math.round((a - b) * 10) / 10;
}

async function ChaptersView() {
  const [chapters, settings] = await Promise.all([getChapters(), getSettings()]);
  const trophies = chapters.filter((c) => c.achieved);
  const attempts = chapters.filter((c) => !c.achieved);

  const today = formatDate(new Date());
  const currentDays = settings.dietStartDate
    ? Math.max(getDayNumber(today, settings.dietStartDate), 1)
    : 0;

  return (
    <div className="px-4 space-y-6 mt-2">
      {/* 현재 진행 중인 챕터 */}
      {settings.onboardingComplete && settings.dietStartDate && (
        <section>
          <SectionHeader label="진행 중인 챕터" />
          <div className="rounded-2xl border border-navy/15 bg-navy/5 p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-bold text-navy">D+{currentDays}</span>
              <span className="text-xs text-muted-foreground">
                {fmt(settings.dietStartDate)} ~ 진행 중
              </span>
            </div>
            <p className="text-sm">
              <b>{settings.startWeight}kg</b> → 목표 <b>{settings.targetWeight}kg</b>
              <span className="text-muted-foreground ml-1">
                ({loss(settings.startWeight, settings.targetWeight)}kg 감량 목표)
              </span>
            </p>
          </div>
        </section>
      )}

      {/* 명예의 전당 — 달성한 챕터만 */}
      <section>
        <SectionHeader label="🏆 명예의 전당" sub={`달성 ${trophies.length}회`} />
        {trophies.length > 0 ? (
          <ul className="space-y-3">
            {trophies.map((c) => (
              <ChapterCard key={c.id} chapter={c} achieved />
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={<Trophy className="w-8 h-8" />}
            text="아직 달성한 챕터가 없어요. 첫 목표를 이뤄 명예의 전당을 채워보세요!"
          />
        )}
      </section>

      {/* 지난 도전 기록 — 미달성 챕터 */}
      {attempts.length > 0 && (
        <section>
          <SectionHeader label="🗂️ 지난 도전 기록" sub={`${attempts.length}개`} />
          <ul className="space-y-3">
            {attempts.map((c) => (
              <ChapterCard key={c.id} chapter={c} achieved={false} />
            ))}
          </ul>
          <p className="text-xs text-muted-foreground mt-2 px-1">
            목표엔 닿지 못했어도, 기록한 날들은 그대로 당신의 여정이에요.
          </p>
        </section>
      )}
    </div>
  );
}

function ChapterCard({
  chapter,
  achieved,
}: {
  chapter: DietChapter;
  achieved: boolean;
}) {
  const days = spanDays(chapter.startDate, chapter.endDate);
  const dropped =
    chapter.endWeight !== null ? loss(chapter.startWeight, chapter.endWeight) : null;

  return (
    <li
      className={
        achieved
          ? "rounded-2xl border border-amber-300/60 bg-amber-50 p-4"
          : "rounded-2xl border border-border bg-secondary/40 p-4"
      }
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="inline-flex items-center gap-1.5 text-sm font-bold">
          {achieved ? (
            <>
              <Trophy className="w-4 h-4 text-amber-500" />
              <span className="text-amber-700">목표 달성</span>
            </>
          ) : (
            <>
              <Footprints className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">지난 도전</span>
            </>
          )}
        </span>
        <span className="text-xs text-muted-foreground">{days}일의 여정</span>
      </div>

      <p className="text-base font-bold">
        {chapter.startWeight}kg →{" "}
        {chapter.endWeight !== null ? `${chapter.endWeight}kg` : "—"}
        {dropped !== null && dropped > 0 && (
          <span
            className={
              achieved
                ? "text-sm font-bold text-emerald-600 ml-1.5"
                : "text-sm font-semibold text-emerald-600/80 ml-1.5"
            }
          >
            −{dropped}kg
          </span>
        )}
      </p>
      <p className="text-xs text-muted-foreground mt-0.5">
        목표 {chapter.targetWeight}kg · {fmt(chapter.startDate)} ~ {fmt(chapter.endDate)}
      </p>
    </li>
  );
}

function SectionHeader({ label, sub }: { label: string; sub?: string }) {
  return (
    <div className="flex items-baseline justify-between mb-2.5">
      <h2 className="text-sm font-bold">{label}</h2>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </div>
  );
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground rounded-2xl border border-dashed border-border">
      <div className="opacity-30 mb-2">{icon}</div>
      <p className="text-xs leading-relaxed max-w-[220px]">{text}</p>
    </div>
  );
}

export default function ChaptersPage() {
  return (
    <div className="pb-10">
      <header className="px-4 pt-4 pb-2 flex items-center gap-2">
        <Link
          href="/settings"
          className="p-1 -ml-1 rounded-lg hover:bg-secondary active:bg-secondary/80 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-lg font-bold">명예의 전당</h1>
      </header>
      <Suspense
        fallback={
          <div className="px-4 space-y-3 mt-2 animate-pulse">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 bg-secondary rounded-2xl" />
            ))}
          </div>
        }
      >
        <ChaptersView />
      </Suspense>
    </div>
  );
}
