"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type ResetState = { error?: string };

export async function resetPassword(
  _prev: ResetState,
  formData: FormData
): Promise<ResetState> {
  const password = formData.get("password") as string;
  const passwordConfirm = formData.get("passwordConfirm") as string;

  if (password !== passwordConfirm) {
    return { error: "비밀번호가 일치하지 않습니다." };
  }
  if (password.length < 6) {
    return { error: "비밀번호는 6자 이상이어야 합니다." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) return { error: "비밀번호 변경에 실패했습니다. 링크가 만료됐을 수 있어요." };

  redirect("/login?message=" + encodeURIComponent("비밀번호가 변경되었습니다. 새 비밀번호로 로그인해주세요."));
}
