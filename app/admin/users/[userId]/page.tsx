import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { ChevronLeft } from "lucide-react";
import { UserDetailActions } from "./user-detail-actions";

export const dynamic = "force-dynamic";

function kst(iso: string | null, opts?: Intl.DateTimeFormatOptions) {
  if (!iso) return "—";
  return new Date(new Date(iso).getTime() + 9 * 3600_000).toLocaleString(
    "ko-KR",
    opts ?? { year: "numeric", month: "2-digit", day: "2-digit" }
  );
}

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  await requireAdmin();
  const { userId } = await params;
  const client = createAdminClient();

  // 병렬 fetch
  const thisMonthStart = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1
  ).toISOString();

  const [authRes, profileRes, settingsRes, aiUsageRes, logsRes] =
    await Promise.all([
      client.auth.admin.getUserById(userId),
      client.from("user_profiles").select("*").eq("user_id", userId).single(),
      client.from("settings").select("*").eq("user_id", userId).single(),
      client
        .from("ai_usage_logs")
        .select("call_type, input_tokens, output_tokens, cost_usd, created_at")
        .eq("user_id", userId)
        .gte("created_at", thisMonthStart),
      client
        .from("daily_logs")
        .select("date, weight, closed")
        .eq("user_id", userId)
        .order("date", { ascending: false })
        .limit(60), // 최근 60일 (통계 + 최근 7일 목록)
    ]);

  if (authRes.error || !authRes.data.user) notFound();

  const user = authRes.data.user;
  const profile = profileRes.data as Record<string, unknown> | null;
  const settings = settingsRes.data as Record<string, unknown> | null;
  const aiLogs = (aiUsageRes.data ?? []) as {
    call_type: string;
    input_tokens: number | null;
    output_tokens: number | null;
    cost_usd: number | null;
  }[];
  const logs = (logsRes.data ?? []) as {
    date: string;
    weight: number | null;
    closed: boolean;
  }[];

  // AI 사용량 집계
  const aiSummary = aiLogs.reduce(
    (acc, r) => ({
      calls: acc.calls + 1,
      inputTokens: acc.inputTokens + (r.input_tokens ?? 0),
      outputTokens: acc.outputTokens + (r.output_tokens ?? 0),
      costUsd: acc.costUsd + Number(r.cost_usd ?? 0),
    }),
    { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 }
  );

  // 로그 통계
  const totalLogs = logs.length; // 최대 60일치
  const closedLogs = logs.filter((l) => l.closed).length;
  const closeRate = totalLogs > 0 ? Math.round((closedLogs / totalLogs) * 100) : 0;
  const recentLogs = logs.slice(0, 7);

  // 최근 30일 체중 데이터 (차트용, 날짜 오름차순)
  const weightData = logs
    .slice(0, 30)
    .reverse()
    .filter((l) => l.weight !== null)
    .map((l) => ({ date: l.date, weight: l.weight as number }));

  const name = (user.user_metadata?.full_name as string) || "—";
  const isActive = (profile?.is_active as boolean) ?? true;
  const role = (profile?.role as "admin" | "user") ?? "user";
  const memo = (profile?.memo as string) ?? "";

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link
          href="/admin/users"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          유저 목록
        </Link>
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{name}</h1>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                role === "admin"
                  ? "bg-rose-100 text-rose-700"
                  : "bg-secondary text-muted-foreground"
              }`}
            >
              {role}
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                isActive
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-rose-100 text-rose-700"
              }`}
            >
              {isActive ? "활성" : "비활성"}
            </span>
          </div>
        </div>
      </div>

      {/* 기본 정보 */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">기본 정보</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><p className="text-muted-foreground text-xs mb-0.5">가입일</p><p className="font-medium">{kst(user.created_at)}</p></div>
          <div><p className="text-muted-foreground text-xs mb-0.5">마지막 로그인</p><p className="font-medium">{kst(user.last_sign_in_at ?? null)}</p></div>
          <div><p className="text-muted-foreground text-xs mb-0.5">마지막 방문</p><p className="font-medium">{kst(profile?.last_seen_at as string | null)}</p></div>
          <div><p className="text-muted-foreground text-xs mb-0.5">이메일 인증</p><p className="font-medium">{user.email_confirmed_at ? "완료" : "미완료"}</p></div>
        </div>
      </div>

      {/* 설정 요약 */}
      {settings && (
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">다이어트 설정</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            <div><p className="text-muted-foreground text-xs mb-0.5">코치 이름</p><p className="font-medium">{(settings.coach_name as string) || "—"}</p></div>
            <div><p className="text-muted-foreground text-xs mb-0.5">시작일</p><p className="font-medium">{(settings.diet_start_date as string) || "—"}</p></div>
            <div><p className="text-muted-foreground text-xs mb-0.5">시작 체중</p><p className="font-medium">{settings.start_weight ? `${settings.start_weight}kg` : "—"}</p></div>
            <div><p className="text-muted-foreground text-xs mb-0.5">목표 체중</p><p className="font-medium">{settings.target_weight ? `${settings.target_weight}kg` : "—"}</p></div>
            <div><p className="text-muted-foreground text-xs mb-0.5">현재 체중</p><p className="font-medium">{settings.current_weight ? `${settings.current_weight}kg` : "—"}</p></div>
            <div><p className="text-muted-foreground text-xs mb-0.5">목표 기간</p><p className="font-medium">{settings.target_months ? `${settings.target_months}개월` : "—"}</p></div>
          </div>
        </div>
      )}

      {/* 로그 통계 + 최근 7일 */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">로그 통계 (최근 60일)</h2>
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="text-center p-3 bg-secondary/30 rounded-xl">
            <p className="text-2xl font-bold">{totalLogs}</p>
            <p className="text-xs text-muted-foreground mt-0.5">총 로그</p>
          </div>
          <div className="text-center p-3 bg-secondary/30 rounded-xl">
            <p className="text-2xl font-bold">{closedLogs}</p>
            <p className="text-xs text-muted-foreground mt-0.5">마감 로그</p>
          </div>
          <div className="text-center p-3 bg-secondary/30 rounded-xl">
            <p className="text-2xl font-bold">{closeRate}%</p>
            <p className="text-xs text-muted-foreground mt-0.5">마감률</p>
          </div>
        </div>

        {recentLogs.length > 0 && (
          <>
            <p className="text-xs font-semibold text-muted-foreground mb-2">최근 7일</p>
            <div className="space-y-1.5">
              {recentLogs.map((l) => (
                <div
                  key={l.date}
                  className="flex items-center justify-between text-xs px-3 py-1.5 rounded-lg bg-secondary/20"
                >
                  <span className="text-muted-foreground">{l.date}</span>
                  <span className="font-medium">{l.weight ? `${l.weight}kg` : "—"}</span>
                  <span className={l.closed ? "text-emerald-600 font-semibold" : "text-muted-foreground/60"}>
                    {l.closed ? "마감" : "미마감"}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* AI 사용량 (이번 달) */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">AI 사용량 (이번 달)</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="text-center p-3 bg-secondary/30 rounded-xl">
            <p className="text-2xl font-bold">{aiSummary.calls}</p>
            <p className="text-xs text-muted-foreground mt-0.5">총 호출</p>
          </div>
          <div className="text-center p-3 bg-secondary/30 rounded-xl">
            <p className="text-lg font-bold">{aiSummary.inputTokens.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-0.5">입력 토큰</p>
          </div>
          <div className="text-center p-3 bg-secondary/30 rounded-xl">
            <p className="text-lg font-bold">{aiSummary.outputTokens.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-0.5">출력 토큰</p>
          </div>
          <div className="text-center p-3 bg-secondary/30 rounded-xl">
            <p className="text-lg font-bold text-rose-600">${aiSummary.costUsd.toFixed(4)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">예상 비용</p>
          </div>
        </div>
      </div>

      {/* 액션 (역할변경, 비활성화, 비밀번호재설정, 메모) */}
      <UserDetailActions
        userId={userId}
        email={user.email ?? ""}
        currentRole={role}
        isActive={isActive}
        memo={memo}
      />
    </div>
  );
}
