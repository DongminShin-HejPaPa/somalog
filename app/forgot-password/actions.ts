"use server";

import { createClient } from "@/lib/supabase/server";

export type ForgotState = { error?: string; success?: boolean };

export async function requestPasswordReset(
  _prev: ForgotState,
  formData: FormData
): Promise<ForgotState> {
  const email = (formData.get("email") as string)?.trim();
  if (!email) return { error: "이메일을 입력해주세요." };

  const supabase = await createClient();
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_VERCEL_URL
      ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
      : "http://localhost:3000";

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });

  if (error) return { error: "이메일 발송에 실패했습니다. 다시 시도해주세요." };
  return { success: true };
}
