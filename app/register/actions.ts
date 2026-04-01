"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
    return { error: error.message, fields: savedFields };
  }

  redirect(
    "/login?message=" +
      encodeURIComponent("🎉 가입이 완료되었습니다. 로그인해주세요!") +
      "&email=" +
      encodeURIComponent(email)
  );
}
