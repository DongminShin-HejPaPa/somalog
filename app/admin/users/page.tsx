import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { UsersTable } from "./users-table";

export const dynamic = "force-dynamic";

export interface UserRow {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  lastSignInAt: string | null;
  lastSeenAt: string | null;
  role: "admin" | "user";
  isActive: boolean;
  logCount: number;
}

export default async function AdminUsersPage() {
  await requireAdmin();
  const client = createAdminClient();

  // 병렬 fetch
  const [authRes, profilesRes, logCountsRes] = await Promise.all([
    client.auth.admin.listUsers({ perPage: 1000 }),
    client.from("user_profiles").select("user_id, role, is_active, last_seen_at"),
    client.from("daily_logs").select("user_id"),
  ]);

  // 로그 수: user_id → count in-memory
  const logCountMap: Record<string, number> = {};
  for (const row of (logCountsRes.data ?? []) as { user_id: string }[]) {
    logCountMap[row.user_id] = (logCountMap[row.user_id] ?? 0) + 1;
  }

  // 프로필 맵
  const profileMap: Record<string, { role: "admin" | "user"; is_active: boolean; last_seen_at: string | null }> = {};
  for (const p of (profilesRes.data ?? []) as any[]) {
    profileMap[p.user_id] = {
      role: p.role ?? "user",
      is_active: p.is_active ?? true,
      last_seen_at: p.last_seen_at ?? null,
    };
  }

  const users: UserRow[] = (authRes.data?.users ?? []).map((u) => ({
    id: u.id,
    email: u.email ?? "",
    name: (u.user_metadata?.full_name as string) ?? "",
    createdAt: u.created_at,
    lastSignInAt: u.last_sign_in_at ?? null,
    lastSeenAt: profileMap[u.id]?.last_seen_at ?? null,
    role: profileMap[u.id]?.role ?? "user",
    isActive: profileMap[u.id]?.is_active ?? true,
    logCount: logCountMap[u.id] ?? 0,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">유저 관리</h1>
        <p className="text-sm text-muted-foreground mt-1">
          총 {users.length}명
        </p>
      </div>
      <UsersTable users={users} />
    </div>
  );
}
