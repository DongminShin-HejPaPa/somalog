"use server";

import { createClient } from "@/lib/supabase/server";

export type AccountInfoState = {
  error?: string;
  success?: boolean;
};

export async function updateAccountInfo(
  _prev: AccountInfoState,
  formData: FormData
): Promise<AccountInfoState> {
  const name = (formData.get("name") as string)?.trim();
  const password = (formData.get("password") as string) ?? "";
  const passwordConfirm = (formData.get("passwordConfirm") as string) ?? "";

  // ── 유효성 검사 ───────────────────────────────
  if (!name) return { error: "이름을 입력해주세요." };

  if (password) {
    if (password.length < 6)
      return { error: "비밀번호는 6자 이상이어야 합니다." };
    if (password !== passwordConfirm)
      return { error: "비밀번호가 일치하지 않습니다." };
  }

  const supabase = await createClient();

  // ── updateUser 호출 (이름·비밀번호) ──────────
  type UpdatePayload = Parameters<typeof supabase.auth.updateUser>[0];
  const payload: UpdatePayload = { data: { full_name: name } };
  if (password) payload.password = password;

  const { error: updateError } = await supabase.auth.updateUser(payload);

  if (updateError) {
    const msg = updateError.message.toLowerCase();
    if (msg.includes("password")) return { error: "비밀번호 변경에 실패했습니다." };
    return { error: "정보 변경에 실패했습니다. 다시 시도해주세요." };
  }

  return { success: true };
}
