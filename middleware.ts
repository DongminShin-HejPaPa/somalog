import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/auth",
];

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const isPublicPath = PUBLIC_PATHS.some((p) =>
    request.nextUrl.pathname.startsWith(p)
  );

  // ── 1단계: 쿠키에서 세션 읽기 (네트워크 호출 없음) ──────────────
  const { data: { session } } = await supabase.auth.getSession();

  // 60초 버퍼: 만료 직전도 갱신 처리
  const BUFFER_MS = 60_000;
  const tokenExpired =
    !session?.access_token ||
    (session.expires_at != null &&
      session.expires_at * 1000 < Date.now() + BUFFER_MS);

  let user = tokenExpired ? null : (session?.user ?? null);

  // ── 2단계: 토큰 만료 시에만 서버 검증 + 갱신 (네트워크 호출) ─────
  if (tokenExpired) {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  }

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
