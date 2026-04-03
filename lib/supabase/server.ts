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
 * getSession()은 쿠키에서 읽기만 하므로 네트워크 호출 없음.
 * 보안: middleware가 이미 getUser()로 JWT를 서버에서 검증하므로 서버 컴포넌트에서는 getSession() 사용 가능.
 */
export const getAuthUser = cache(async () => {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user ?? null;
});
