"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function toKoreanError(msg: string): string {
  if (msg.includes("User already registered") || msg.includes("already been registered"))
    return "이미 가입된 이메일입니다.";
  if (msg.includes("Password should be at least 6"))
    return "비밀번호는 6자 이상이어야 합니다.";
  if (msg.includes("invalid format") || msg.includes("invalid email") || msg.includes("Unable to validate email"))
    return "유효하지 않은 이메일 형식입니다.";
  if (msg.includes("Email rate limit") || msg.includes("rate limit"))
    return "이메일 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.";
  if (msg.includes("signup disabled") || msg.includes("Signups not allowed"))
    return "현재 회원가입이 비활성화되어 있습니다.";
  if (msg.includes("Network") || msg.includes("Failed to fetch"))
    return "네트워크 오류가 발생했습니다. 다시 시도해주세요.";
  return "오류가 발생했습니다. 다시 시도해주세요.";
}

export type RegisterState = {
  error: string | null;
  fields?: {
    name: string;
    email: string;
    agreeTerms: boolean;
    agreePrivacy: boolean;
    agreeMarketing: boolean;
  };
};

export async function signup(
  prevState: RegisterState,
  formData: FormData
): Promise<RegisterState> {
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const passwordConfirm = formData.get("passwordConfirm") as string;
  const agreeTerms = formData.get("agreeTerms") === "on";
  const agreePrivacy = formData.get("agreePrivacy") === "on";
  const agreeMarketing = formData.get("agreeMarketing") === "on";

  const savedFields = { name, email, agreeTerms, agreePrivacy, agreeMarketing };

  if (!agreeTerms || !agreePrivacy) {
    return { error: "이용약관 및 개인정보 처리방침에 동의해주세요.", fields: savedFields };
  }

  if (password !== passwordConfirm) {
    return { error: "비밀번호가 일치하지 않습니다.", fields: savedFields };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: name } },
  });

  if (error) {
    return { error: toKoreanError(error.message), fields: savedFields };
  }

  redirect(
    "/login?message=" +
      encodeURIComponent("🎉 가입이 완료되었습니다. 로그인해주세요!") +
      "&email=" +
      encodeURIComponent(email)
  );
}
