import { getAuthUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 접속한 사용자가 admin인지 확인하고, admin이 아니면 에러를 던집니다.
 * 안전한 검증을 위해 DB(user_profiles)의 role 필드를 직접 조회합니다.
 * @returns {Promise<string>} admin 사용자의 userId를 반환
 */
export async function requireAdmin(): Promise<string> {
  // 1. 현재 접속된 유효한 사용자 확인
  const user = await getAuthUser();
  if (!user) {
    throw new Error('Unauthorized');
  }

  // 2. Admin 클라이언트를 통해 RLS를 우회하여 최상위 권한으로 user_profiles 조회
  //    (본인 조회 RLS가 있지만, 안전을 위해 Service Role 사용)
  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from('user_profiles')
    .select('role, is_active')
    .eq('user_id', user.id)
    .single();

  if (error || !data) {
    throw new Error('Forbidden: Profile not found');
  }

  if (data.is_active === false) {
    throw new Error('Forbidden: Account is inactive');
  }

  if (data.role !== 'admin') {
    throw new Error('Forbidden: Requires admin role');
  }

  return user.id;
}
