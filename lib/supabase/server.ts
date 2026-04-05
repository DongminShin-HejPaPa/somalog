import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll이 Server Component에서 호출될 수 있음.
            // middleware에서 세션을 갱신하므로 무시해도 안전합니다.
          }
        },
      },
    }
  );
}

/**
 * 동일 요청 내에서 getUser() 중복 호출 방지 (React cache = 요청 단위 메모이제이션).
 * getUser()는 서버에서 JWT를 검증하고 만료 시 refresh_token으로 갱신하므로
 * getSession()으로 대체하면 토큰 만료 시점에 null을 반환해 설정이 초기화되는 버그가 생김.
 */
export const getAuthUser = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
});
