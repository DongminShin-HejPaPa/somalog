"use server";

import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

// ─── 역할 변경 ────────────────────────────────────────────────────────────
export async function actionAdminUpdateRole(
  userId: string,
  role: "admin" | "user"
) {
  await requireAdmin();
  const client = createAdminClient();
  const { error } = await client
    .from("user_profiles")
    .update({ role })
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
}

// ─── 활성/비활성 전환 ─────────────────────────────────────────────────────
// 비활성화: is_active=false + Supabase auth ban → 현재 세션 즉시 무효화
// 활성화  : is_active=true  + ban 해제
export async function actionAdminToggleActive(
  userId: string,
  activate: boolean
) {
  await requireAdmin();
  const client = createAdminClient();

  // 1. user_profiles 업데이트
  const { error: profileError } = await client
    .from("user_profiles")
    .update({ is_active: activate })
    .eq("user_id", userId);
  if (profileError) throw new Error(profileError.message);

  // 2. Supabase auth ban/unban → 현재 세션 즉시 무효화 (ban_duration: '876600h' ≒ 100년)
  const { error: authError } = await client.auth.admin.updateUserById(userId, {
    ban_duration: activate ? "none" : "876600h",
  });
  if (authError) throw new Error(authError.message);

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
}

// ─── 비밀번호 재설정 링크 생성 ────────────────────────────────────────────
// 자동 이메일 발송 대신 링크를 반환 → 관리자가 직접 공유
export async function actionAdminGeneratePasswordResetLink(
  email: string
): Promise<{ ok: true; link: string } | { ok: false; error: string }> {
  await requireAdmin();
  const client = createAdminClient();
  const { data, error } = await client.auth.admin.generateLink({
    type: "recovery",
    email,
  });
  if (error || !data.properties?.action_link) {
    return { ok: false, error: error?.message ?? "링크 생성 실패" };
  }
  return { ok: true, link: data.properties.action_link };
}

// ─── 관리자 메모 저장 ─────────────────────────────────────────────────────
export async function actionAdminUpdateMemo(userId: string, memo: string) {
  await requireAdmin();
  const client = createAdminClient();
  const { error } = await client
    .from("user_profiles")
    .update({ memo })
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/users/${userId}`);
}
