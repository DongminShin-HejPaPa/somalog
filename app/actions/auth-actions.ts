"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logStore } from "@/lib/stores/log-store";

export async function logout() {
  const supabase = await createClient();
  // 로그아웃 전 캐시 초기화 — 다른 계정으로 재로그인 시 이전 사용자 데이터 노출 방지
  logStore.clear();
  await supabase.auth.signOut();
  redirect("/login");
}

/** 현재 로그인한 사용자의 계정을 완전히 삭제합니다 (복구 불가) */
export async function deleteAccount(): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  // service_role 클라이언트가 없으므로 RPC를 통해 삭제
  // Supabase auth.users 삭제 → ON DELETE CASCADE로 모든 테이블 데이터 자동 삭제
  const { error } = await supabase.rpc("delete_user");
  if (error) {
    console.error("계정 삭제 오류:", error);
    return { error: "계정 삭제 중 오류가 발생했습니다. 다시 시도해주세요." };
  }

  logStore.clear();
  redirect("/login");
}
