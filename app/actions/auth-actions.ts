"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // 클라이언트 인메모리 캐시는 SettingsProvider의 useUserCacheLifecycle이 자동 정리.
  // 영구 캐시(localStorage)는 다음 로그인이 같은 사용자라면 보존되어 진입 속도 향상에 기여.
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

  // 영구 캐시는 클라이언트에서 별도 정리 필요 (server action은 localStorage 접근 불가).
  // 호출하는 클라이언트 컴포넌트가 `logStore.clearAllHomeCaches()`를 함께 호출해야 한다.
  redirect("/login");
}
