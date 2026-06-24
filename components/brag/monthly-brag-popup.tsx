"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Share2, PartyPopper, TrendingDown } from "lucide-react";
import { useSettings } from "@/lib/contexts/settings-context";
import { logStore } from "@/lib/stores/log-store";
import { formatDate } from "@/lib/utils/date-utils";
import { completedBragMilestones } from "@/lib/utils/brag-schedule";

const STORAGE_PREFIX = "somalog_brag_v1:";
function storageKey(userId: string | null) {
  return STORAGE_PREFIX + (userId ?? "anon");
}

interface BragState {
  startDate: string; // 어느 챕터(시작일) 기준으로 저장된 값인지
  milestone: number; // 마지막으로 확인/닫은 마일스톤
}

function readState(userId: string | null): BragState {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (raw) return JSON.parse(raw) as BragState;
  } catch {
    // 무시
  }
  return { startDate: "", milestone: 0 };
}

function writeState(userId: string | null, state: BragState) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(state));
  } catch {
    // 용량 초과 등 무시
  }
}

/**
 * 한 달에 한 번, 현 챕터 시작일의 "한달 째 되는 날"부터 자랑 권유 팝업을 띄운다.
 * - 닫기: 이번 달 마일스톤을 닫음으로 기록 → 다음 달 마일스톤에서 다시 등장
 * - 자랑하러 가기: 동일하게 기록 후 그래프 탭으로 이동(자동으로 공유 시트 열림)
 * NoticePopup 과 동일하게 항상 마운트되며 내부에서 gating 한다.
 */
export function MonthlyBragPopup({ userId }: { userId: string | null }) {
  const { settings, isLoaded } = useSettings();
  const router = useRouter();
  const [milestone, setMilestone] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  const startDate = settings.dietStartDate;

  useEffect(() => {
    if (!isLoaded || !settings.onboardingComplete || !startDate) return;
    const today = formatDate(new Date());
    const reached = completedBragMilestones(startDate, today);
    if (reached < 1) return;

    const stored = readState(userId);
    const lastSeen = stored.startDate === startDate ? stored.milestone : 0;
    if (reached > lastSeen) {
      setMilestone(reached);
      setDismissed(false);
    }
  }, [isLoaded, settings.onboardingComplete, startDate, userId]);

  // 감량 성과(시작 체중 - 최근 체중). 데이터 없으면 표시 생략.
  const lostKg = useMemo(() => {
    const all = logStore.getAllLogs();
    if (!all || all.length === 0 || !settings.startWeight) return null;
    let latest: { date: string; weight: number } | null = null;
    for (const p of all) {
      if (p.weight == null) continue;
      if (!latest || p.date > latest.date) latest = { date: p.date, weight: p.weight };
    }
    if (!latest) return null;
    const diff = Math.round((settings.startWeight - latest.weight) * 10) / 10;
    return diff > 0 ? diff : null;
  }, [settings.startWeight, milestone]);

  if (dismissed || milestone < 1) return null;

  const persist = () => writeState(userId, { startDate, milestone });

  const handleClose = () => {
    persist();
    setDismissed(true);
  };

  const handleBrag = () => {
    persist();
    setDismissed(true);
    router.push("/graph?share=1");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl">
        {/* 화려한 그라데이션 헤더 */}
        <div className="relative bg-gradient-to-br from-pink-500 via-fuchsia-500 to-purple-600 px-6 pt-7 pb-8 text-center text-white">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
            <PartyPopper className="h-7 w-7" />
          </div>
          <p className="text-sm font-medium text-white/90">다이어트 {milestone}개월 차 🎉</p>
          <h2 className="mt-1 text-xl font-extrabold leading-snug">
            여기까지 온 거,
            <br />
            친구에게 자랑해볼까요?
          </h2>

          {lostKg != null && (
            <div className="mx-auto mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-4 py-1.5 backdrop-blur-sm">
              <TrendingDown className="h-4 w-4" />
              <span className="text-sm font-bold">지금까지 −{lostKg}kg</span>
            </div>
          )}
        </div>

        {/* 본문 카피 */}
        <div className="px-6 pt-5 pb-3 text-center">
          <p className="text-sm leading-relaxed text-muted-foreground">
            매일의 기록이 쌓여 멋진 그래프가 됐어요.
            <br />
            한 달의 노력을 친구들에게 보여주고
            <br />
            응원받으며 다음 달도 힘차게 달려봐요!
          </p>
        </div>

        {/* 버튼 두 개 */}
        <div className="flex flex-col gap-2 px-6 pb-6 pt-3">
          <button
            onClick={handleBrag}
            data-testid="brag-go"
            className="flex items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r from-pink-500 to-purple-500 py-3.5 text-sm font-bold text-white shadow-md transition-all active:scale-[0.98]"
          >
            <Share2 className="h-4 w-4" />
            자랑하러 가기
            <Sparkles className="h-4 w-4" />
          </button>
          <button
            onClick={handleClose}
            data-testid="brag-close"
            className="rounded-2xl py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary active:bg-secondary/80"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
