import { createClient } from "@/lib/supabase/server";
import type { DietChapter, Settings, StartNewChapterInput } from "@/lib/types";
import { getSettings, updateSettings } from "./settings-service";
import { deleteGoalAchievement } from "./achievement-service";
import { formatDate } from "@/lib/utils/date-utils";

function mapChapter(row: Record<string, unknown>): DietChapter {
  return {
    id: row.id as string,
    startDate: row.start_date as string,
    startWeight: Number(row.start_weight),
    targetWeight: Number(row.target_weight),
    endDate: row.end_date as string,
    endWeight: row.end_weight !== null ? Number(row.end_weight) : null,
    achieved: (row.achieved as boolean) ?? false,
    createdAt: row.created_at as string,
  };
}

/** 종료된 챕터 목록 — 최신순 (명예의 전당에서 사용) */
export async function getChapters(): Promise<DietChapter[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("diet_chapters")
    .select("*")
    .eq("user_id", user.id)
    .order("end_date", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapChapter);
}

/**
 * 새 챕터 시작 (새 목표 / 새출발).
 * 1. 현재(직전) 챕터를 diet_chapters 에 아카이브 — 기록(daily_logs)은 건드리지 않음
 * 2. goal_reached 달성 기록 초기화 → 새 목표를 첫 달성으로 처리
 * 3. settings 를 새 챕터로 갱신 (시작일=오늘, 시작체중=현재체중, 목표=입력값, 감량 모드)
 */
export async function startNewChapter(
  input: StartNewChapterInput
): Promise<Settings> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const current = await getSettings();
  const today = formatDate(new Date());

  // 직전 챕터의 목표 달성 여부 = 종료 시점 체중이 직전 목표 이하인가
  const achieved =
    current.targetWeight > 0 && input.startWeight <= current.targetWeight;

  // 1. 직전 챕터 아카이브
  const { error: insertError } = await supabase.from("diet_chapters").insert({
    user_id: user.id,
    start_date: current.dietStartDate,
    start_weight: current.startWeight,
    target_weight: current.targetWeight,
    end_date: today,
    end_weight: input.startWeight,
    achieved,
  });
  if (insertError) throw insertError;

  // 2. 달성 기록 초기화 (새 목표를 첫 달성으로)
  await deleteGoalAchievement().catch(() => {});

  // 3. settings 를 새 챕터로 갱신 (시작일·시작체중·목표·프리셋·기간 모두 새로 설정)
  return updateSettings({
    dietStartDate: today,
    startWeight: input.startWeight,
    targetWeight: input.targetWeight,
    dietPreset: input.dietPreset,
    targetMonths: input.targetMonths,
    mode: "losing",
  });
}
