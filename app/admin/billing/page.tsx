import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  BillingCharts,
  type MonthlyBillingRow,
  type CallTypeRow,
  type TopBillingUser,
} from "@/app/admin/components/billing-charts";

export const dynamic = "force-dynamic";

const EXCHANGE_RATE = 1380;

export default async function AdminBillingPage() {
  await requireAdmin();
  const client = createAdminClient();

  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1).toISOString();

  // 병렬 데이터 fetch
  const [allTimeRes, thisMonthRes] = await Promise.all([
    // 최근 12개월 데이터 (월별 집계용)
    client
      .from("ai_usage_logs")
      .select("user_id, call_type, input_tokens, output_tokens, cost_usd, created_at")
      .gte("created_at", twelveMonthsAgo),
    // 이번 달 데이터
    client
      .from("ai_usage_logs")
      .select("user_id, call_type, input_tokens, output_tokens, cost_usd, created_at")
      .gte("created_at", thisMonthStart),
  ]);

  type LogRow = {
    user_id: string;
    call_type: string;
    input_tokens: number | null;
    output_tokens: number | null;
    cost_usd: number | null;
    created_at: string;
  };

  const allLogs = (allTimeRes.data ?? []) as LogRow[];
  const thisMonthLogs = (thisMonthRes.data ?? []) as LogRow[];

  // ── 전체 누적 집계 ──────────────────────────────────────────────
  const totalAllTime = allLogs.reduce(
    (acc, r) => ({
      calls: acc.calls + 1,
      inputTokens: acc.inputTokens + (r.input_tokens ?? 0),
      outputTokens: acc.outputTokens + (r.output_tokens ?? 0),
      costUsd: acc.costUsd + Number(r.cost_usd ?? 0),
    }),
    { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 }
  );

  // ── 이번 달 집계 ────────────────────────────────────────────────
  const totalThisMonth = thisMonthLogs.reduce(
    (acc, r) => ({
      calls: acc.calls + 1,
      inputTokens: acc.inputTokens + (r.input_tokens ?? 0),
      outputTokens: acc.outputTokens + (r.output_tokens ?? 0),
      costUsd: acc.costUsd + Number(r.cost_usd ?? 0),
    }),
    { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 }
  );

  // ── 월별 데이터 집계 (최근 12개월) ─────────────────────────────
  const monthlyMap: Record<string, { calls: number; inputTokens: number; outputTokens: number; costUsd: number }> = {};
  for (const r of allLogs) {
    const month = r.created_at.substring(0, 7); // YYYY-MM
    if (!monthlyMap[month]) {
      monthlyMap[month] = { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 };
    }
    monthlyMap[month].calls += 1;
    monthlyMap[month].inputTokens += r.input_tokens ?? 0;
    monthlyMap[month].outputTokens += r.output_tokens ?? 0;
    monthlyMap[month].costUsd += Number(r.cost_usd ?? 0);
  }

  const monthlyData: MonthlyBillingRow[] = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = `${d.getMonth() + 1}월`;
    const data = monthlyMap[month] ?? { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 };
    return { month, label, ...data };
  });

  // ── 이번 달 호출 유형별 ────────────────────────────────────────
  const callTypeMap: Record<string, { calls: number; costUsd: number }> = {};
  for (const r of thisMonthLogs) {
    const ct = r.call_type || "unknown";
    if (!callTypeMap[ct]) callTypeMap[ct] = { calls: 0, costUsd: 0 };
    callTypeMap[ct].calls += 1;
    callTypeMap[ct].costUsd += Number(r.cost_usd ?? 0);
  }
  const callTypeData: CallTypeRow[] = Object.entries(callTypeMap)
    .map(([callType, v]) => ({ callType, ...v }))
    .sort((a, b) => b.costUsd - a.costUsd);

  // ── 이번 달 상위 사용자 ────────────────────────────────────────
  const userMap: Record<string, { calls: number; inputTokens: number; outputTokens: number; costUsd: number }> = {};
  for (const r of thisMonthLogs) {
    if (!userMap[r.user_id]) {
      userMap[r.user_id] = { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 };
    }
    userMap[r.user_id].calls += 1;
    userMap[r.user_id].inputTokens += r.input_tokens ?? 0;
    userMap[r.user_id].outputTokens += r.output_tokens ?? 0;
    userMap[r.user_id].costUsd += Number(r.cost_usd ?? 0);
  }

  const top10UserIds = Object.entries(userMap)
    .sort(([, a], [, b]) => b.costUsd - a.costUsd)
    .slice(0, 10)
    .map(([userId, data]) => ({ userId, ...data }));

  // 상위 10명 auth 정보 조회
  const top10UsersWithInfo: TopBillingUser[] = await Promise.all(
    top10UserIds.map(async ({ userId, calls, inputTokens, outputTokens, costUsd }) => {
      const authRes = await client.auth.admin.getUserById(userId);
      const u = authRes.data?.user;
      return {
        userId,
        email: u?.email ?? userId.substring(0, 8) + "...",
        name: (u?.user_metadata?.full_name as string) ?? "",
        calls,
        inputTokens,
        outputTokens,
        costUsd,
        costKrw: Math.round(costUsd * EXCHANGE_RATE),
      };
    })
  );

  const thisMonthLabel = `${now.getFullYear()}년 ${now.getMonth() + 1}월`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">API 비용 관리</h1>
        <p className="text-sm text-muted-foreground mt-1">AI 사용량 및 비용 현황</p>
      </div>

      {/* 요약 카드 4개 */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <p className="text-xs font-medium text-muted-foreground mb-1">전체 누적 비용</p>
          <div className="flex items-baseline gap-1">
            <p className="text-2xl font-bold text-rose-600">
              {Math.round(totalAllTime.costUsd * EXCHANGE_RATE).toLocaleString("ko-KR")}
            </p>
            <span className="text-sm font-bold text-rose-600">원</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">${totalAllTime.costUsd.toFixed(4)}</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <p className="text-xs font-medium text-muted-foreground mb-1">{thisMonthLabel} 비용</p>
          <div className="flex items-baseline gap-1">
            <p className="text-2xl font-bold text-orange-600">
              {Math.round(totalThisMonth.costUsd * EXCHANGE_RATE).toLocaleString("ko-KR")}
            </p>
            <span className="text-sm font-bold text-orange-600">원</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">${totalThisMonth.costUsd.toFixed(4)}</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <p className="text-xs font-medium text-muted-foreground mb-1">{thisMonthLabel} 호출 수</p>
          <div className="flex items-baseline gap-1">
            <p className="text-2xl font-bold">{totalThisMonth.calls.toLocaleString()}</p>
            <span className="text-sm font-medium text-muted-foreground">회</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            누적 {totalAllTime.calls.toLocaleString()}회
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <p className="text-xs font-medium text-muted-foreground mb-1">{thisMonthLabel} 토큰</p>
          <div className="flex items-baseline gap-1">
            <p className="text-2xl font-bold">
              {((totalThisMonth.inputTokens + totalThisMonth.outputTokens) / 1000).toFixed(1)}
            </p>
            <span className="text-sm font-medium text-muted-foreground">k</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            입력 {(totalThisMonth.inputTokens / 1000).toFixed(1)}k · 출력 {(totalThisMonth.outputTokens / 1000).toFixed(1)}k
          </p>
        </div>
      </div>

      {/* 차트 및 상세 */}
      <BillingCharts
        monthlyData={monthlyData}
        callTypeData={callTypeData}
        topUsers={top10UsersWithInfo}
      />
    </div>
  );
}
