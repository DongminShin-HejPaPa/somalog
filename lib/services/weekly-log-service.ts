import { createClient } from "@/lib/supabase/server";
import type { WeeklyLog } from "@/lib/types";
import { mockWeeklyLog } from "@/lib/mock-data-new";

function rowToWeeklyLog(row: Record<string, unknown>): WeeklyLog {
  return {
    weekStart: row.week_start as string,
    weekEnd: row.week_end as string,
    avgWeight: (row.avg_weight as number) ?? 0,
    exerciseDays: (row.exercise_days as number) ?? 0,
    lateSnackCount: (row.late_snack_count as number) ?? 0,
    weeklySummary: (row.weekly_summary as string) ?? "",
  };
}

function weeklyLogToRow(
  log: WeeklyLog,
  userId: string
): Record<string, unknown> {
  return {
    user_id: userId,
    week_start: log.weekStart,
    week_end: log.weekEnd,
    avg_weight: log.avgWeight,
    exercise_days: log.exerciseDays,
    late_snack_count: log.lateSnackCount,
    weekly_summary: log.weeklySummary,
  };
}

export async function getWeeklyLog(
  weekStart: string
): Promise<WeeklyLog | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("weekly_logs")
    .select("*")
    .eq("user_id", user.id)
    .eq("week_start", weekStart)
    .single();

  if (error || !data) return null;

  return rowToWeeklyLog(data as Record<string, unknown>);
}

export async function getWeeklyLogs(count: number): Promise<WeeklyLog[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from("weekly_logs")
    .select("*")
    .eq("user_id", user.id)
    .order("week_start", { ascending: false })
    .limit(count);

  if (error || !data) return [];

  return data.map((row) => rowToWeeklyLog(row as Record<string, unknown>));
}

export async function upsertWeeklyLog(log: WeeklyLog): Promise<WeeklyLog> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Unauthorized");

  const row = weeklyLogToRow(log, user.id);

  const { data, error } = await supabase
    .from("weekly_logs")
    .upsert(row, { onConflict: "user_id,week_start" })
    .select()
    .single();

  if (error || !data) throw new Error(error?.message ?? "upsert failed");

  return rowToWeeklyLog(data as Record<string, unknown>);
}

export async function resetWeeklyLogs(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  await supabase.from("weekly_logs").delete().eq("user_id", user.id);
}

export async function loadMockWeeklyLogs(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const row = weeklyLogToRow(mockWeeklyLog, user.id);

  await supabase
    .from("weekly_logs")
    .upsert(row, { onConflict: "user_id,week_start" });
}
