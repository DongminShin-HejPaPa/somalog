import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 환경 변수가 설정되지 않았습니다."
    );
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** 테스트 유저 생성 (email_confirm: true) */
export async function createTestUser(email: string, password: string) {
  const admin = getAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  return data.user;
}

/** 이메일로 테스트 유저 삭제 */
export async function deleteTestUser(email: string) {
  const admin = getAdminClient();
  const {
    data: { users },
  } = await admin.auth.admin.listUsers();
  const user = users.find((u) => u.email === email);
  if (!user) return;
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) throw error;
}

/** 이메일로 유저 ID 조회 */
export async function getUserIdByEmail(email: string): Promise<string> {
  const admin = getAdminClient();
  const {
    data: { users },
  } = await admin.auth.admin.listUsers();
  const user = users.find((u) => u.email === email);
  if (!user) throw new Error(`유저를 찾을 수 없습니다: ${email}`);
  return user.id;
}

/** 해당 유저의 모든 데이터 삭제 (daily_logs, weekly_logs, settings) */
export async function clearUserData(userId: string) {
  const admin = getAdminClient();
  await Promise.all([
    admin.from("daily_logs").delete().eq("user_id", userId),
    admin.from("weekly_logs").delete().eq("user_id", userId),
    admin.from("settings").delete().eq("user_id", userId),
  ]);
}

/** Settings 씨드 데이터 삽입 */
export async function seedSettings(
  userId: string,
  overrides: Record<string, unknown> = {}
) {
  const admin = getAdminClient();
  const defaults = {
    user_id: userId,
    coach_name: "TestCoach",
    height: 175,
    current_weight: 80,
    gender: "남성",
    diet_start_date: "2024-01-01",
    start_weight: 80,
    target_weight: 70,
    target_months: 12,
    water_goal: 2.5,
    diet_preset: "sustainable",
    routine_weight_time: "아침",
    routine_energy_time: "21:00",
    routine_extra: [],
    intensive_day_on: true,
    intensive_day_criteria: "역대최저",
    coach_style_preset: "balanced",
    coach_style_extra: [],
    default_tab: "input",
    onboarding_complete: true,
    ...overrides,
  };
  const { error } = await admin
    .from("settings")
    .upsert(defaults, { onConflict: "user_id" });
  if (error) throw error;
}

/** DailyLog 씨드 데이터 삽입 */
export async function seedDailyLogs(
  userId: string,
  logs: Array<Record<string, unknown> & { date: string }>
) {
  const admin = getAdminClient();
  const rows = logs.map((l) => ({ user_id: userId, ...l }));
  const { error } = await admin
    .from("daily_logs")
    .upsert(rows, { onConflict: "user_id,date" });
  if (error) throw error;
}
