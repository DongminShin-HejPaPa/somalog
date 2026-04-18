import { createClient } from "@supabase/supabase-js";

/**
 * ⚠️ [경고] ⚠️
 * 이 클라이언트는 RLS(Row Level Security)를 전부 우회하는 service_role 키를 사용합니다.
 * 절대로 클라이언트 사이드 코드(React Components, 브라우저 환경)에서 임포트하거나 사용해서는 안 됩니다.
 * 오직 Server Actions, Route Handlers, Server Components 내부의 관리자 전용 로직에서만 사용해야 합니다.
 */
export function createAdminClient() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_URL');
  }
  // 절대 NEXT_PUBLIC_ 이 붙어서는 안 되는 서버 전용 비밀키입니다.
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing env.SUPABASE_SERVICE_ROLE_KEY for admin client');
  }

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
