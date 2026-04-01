"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function toKoreanError(message: string): string {
  if (message.includes("Invalid login credentials") || message.includes("invalid_credentials")) {
    return "이메일 또는 비밀번호가 올바르지 않습니다.";
  }
  if (message.includes("Email not confirmed")) {
    return "이메일 인증이 완료되지 않았습니다. 가입 시 받은 인증 메일을 확인해주세요.";
  }
  if (message.includes("Too many requests") || message.includes("rate limit")) {
    return "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.";
  }
  if (message.includes("User not found") || message.includes("user_not_found")) {
    return "등록되지 않은 이메일입니다.";
  }
  if (message.includes("Password should be at least")) {
    return "비밀번호는 6자 이상이어야 합니다.";
  }
  return "로그인 중 오류가 발생했습니다. 다시 시도해주세요.";
}

export async function login(formData: FormData) {
  const supabase = await createClient();

  const data = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  const { error } = await supabase.auth.signInWithPassword(data);

  if (error) {
    const params = new URLSearchParams({
      error: toKoreanError(error.message),
      email: data.email,
    });
    redirect("/login?" + params.toString());
  }

  // 온보딩 완료 여부 확인 → 미완료 시 온보딩으로 이동
  const { data: settingsRow } = await supabase
    .from("settings")
    .select("onboarding_complete")
    .single();

  revalidatePath("/", "layout");

  if (!settingsRow?.onboarding_complete) {
    redirect("/onboarding");
  }

  redirect("/home");
}
