import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  DashboardCharts,
  type WeeklyActiveData,
  type MonthlyBillingData,
  type TopAiUser,
} from "@/app/admin/components/dashboard-charts";

export const dynamic = "force-dynamic";

const EXCHANGE_RATE = 1380;

// KST 오늘 날짜 문자열 YYYY-MM-DD
function kstToday() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split("T")[0];
}

// YYYY-MM-DD → KST 하루 범위 ISO strings
function kstDayRange(dateStr: string) {
  return {
    from: `${dateStr}T00:00:00+09:00`,
    to: `${dateStr}T23:59:59+09:00`,
  };
}

export default async function AdminDashboardPage() {
  const adminClient = createAdminClient();

  const todayStr = kstToday();
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const sevenDaysAgo = new Date(Date.now() - 6 * 24 * 3600_000).toISOString();
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString();

  const todayRange = kstDayRange(todayStr);

  // 병렬 데이터 fetch
  const [
    usersCountRes,
    logsCountRes,
    todayActiveRes,
    todayLogWritersRes,
    weeklyActiveRes,
    aiLastSixMonthsRes,
    aiThisMonthRes,
  ] = await Promise.all([
    adminClient.from("user_profiles").select("*", { count: "exact", head: true }),
    adminClient.from("daily_logs").select("*", { count: "exact", head: true }),
    // 오늘 방문자 (last_seen_at 기준)
    adminClient
      .from("user_profiles")
      .select("user_id")
      .gte("last_seen_at", todayRange.from)
      .lte("last_seen_at", todayRange.to),
    // 오늘 기록 작성자 (daily_logs.date 기준)
    adminClient.from("daily_logs").select("user_id").eq("date", todayStr),
    // 최근 7일 방문자 (per-day 집계용)
    adminClient
      .from("user_profiles")
      .select("last_seen_at")
      .gte("last_seen_at", sevenDaysAgo),
    // 최근 6개월 AI 비용
    adminClient
      .from("ai_usage_logs")
      .select("cost_usd, created_at")
      .gte("created_at", sixMonthsAgo),
    // 이번 달 AI 사용 (상위 사용자 + 호출 수)
    adminClient
      .from("ai_usage_logs")
      .select("user_id, cost_usd")
      .gte("created_at", thisMonthStart),
  ]);

  // ── 기본 지표 ─────────────────────────────────────────────────────────
  const usersCount = (usersCountRes as any).count ?? 0;
  const logsCount = (logsCountRes as any).count ?? 0;

  const dailyActiveUsers =
    ((todayActiveRes as any).data as { user_id: string }[] | null)?.length ?? 0;

  const dailyLogWriters = new Set(
    ((todayLogWritersRes as any).data as { user_id: string }[] | null)?.map(
      (r) => r.user_id
    ) ?? []
  ).size;

  // ── 최근 7일 일별 활성 사용자 ──────────────────────────────────────────
  const weeklyRaw = ((weeklyActiveRes as any).data as { last_seen_at: string }[] | null) ?? [];
  const dayActiveMap: Record<string, number> = {};
  for (const r of weeklyRaw) {
    const kstDate = new Date(new Date(r.last_seen_at).getTime() + 9 * 3600_000)
      .toISOString()
      .split("T")[0];
    dayActiveMap[kstDate] = (dayActiveMap[kstDate] ?? 0) + 1;
  }
  const weeklyActive: WeeklyActiveData[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() + 9 * 3600_000 - (6 - i) * 86400_000);
    const date = d.toISOString().split("T")[0];
    const label = `${d.getMonth() + 1}/${d.getDate()}`;
    return { date, label, count: dayActiveMap[date] ?? 0 };
  });

  // ── 월별 AI 비용 (최근 6개월) ─────────────────────────────────────────
  type BillingRaw = { cost_usd: number | null; created_at: string };
  const aiSixMonthsRaw = ((aiLastSixMonthsRes as any).data as BillingRaw[] | null) ?? [];
  const monthlyCostMap: Record<string, number> = {};
  for (const r of aiSixMonthsRaw) {
    const month = r.created_at.substring(0, 7);
    monthlyCostMap[month] = (monthlyCostMap[month] ?? 0) + Number(r.cost_usd ?? 0);
  }
  const monthlyBilling: MonthlyBillingData[] = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = `${d.getMonth() + 1}월`;
    const costUsd = monthlyCostMap[month] ?? 0;
    return { month, label, costUsd, costKrw: Math.round(costUsd * EXCHANGE_RATE) };
  });

  // ── 누적 AI 비용 (6개월치 합산 — 대시보드 카드용) ─────────────────────
  // 전체 누적을 위해 별도로 가져오지 않고, 6개월치로 표시 (billing 페이지에 전체 있음)
  const totalCostUsd = aiSixMonthsRaw.reduce(
    (sum, r) => sum + Number(r.cost_usd ?? 0),
    0
  );

  // ── 이번 달 상위 AI 사용자 ────────────────────────────────────────────
  type AiUsageRaw = { user_id: string; cost_usd: number | null };
  const aiThisMonthRaw = ((aiThisMonthRes as any).data as AiUsageRaw[] | null) ?? [];

  const thisMonthCalls = aiThisMonthRaw.length;

  const userCostMap: Record<string, number> = {};
  for (const r of aiThisMonthRaw) {
    userCostMap[r.user_id] = (userCostMap[r.user_id] ?? 0) + Number(r.cost_usd ?? 0);
  }
  const top5UserIds = Object.entries(userCostMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([userId, cost]) => ({ userId, cost }));

  const topAiUsers: TopAiUser[] = await Promise.all(
    top5UserIds.map(async ({ userId, cost }) => {
      const authRes = await adminClient.auth.admin.getUserById(userId);
      const u = authRes.data?.user;
      return {
        userId,
        email: u?.email ?? userId.substring(0, 8) + "...",
        name: (u?.user_metadata?.full_name as string) ?? "",
        costUsd: cost,
        costKrw: Math.round(cost * EXCHANGE_RATE),
      };
    })
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">대시보드</h1>
        <p className="text-sm text-muted-foreground mt-1">Soma Log 서비스 운영 상황</p>
      </div>

      {/* 주요 지표 카드 — 1행 (3개) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link
          href="/admin/users"
          className="bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-md hover:border-navy/30 transition-all cursor-pointer group"
        >
          <p className="text-sm font-medium text-muted-foreground mb-1 group-hover:text-foreground transition-colors">
            총 등록 사용자
          </p>
          <div className="flex items-baseline gap-1">
            <p className="text-3xl font-bold">{usersCount}</p>
            <span className="text-sm font-medium text-muted-foreground">명</span>
          </div>
          <p className="text-[10px] text-muted-foreground/60 mt-1.5">유저 탭에서 상세 관리 →</p>
        </Link>

        <Link
          href="/admin/users"
          className="bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-md hover:border-navy/30 transition-all cursor-pointer group"
        >
          <p className="text-sm font-medium text-muted-foreground mb-1 group-hover:text-foreground transition-colors">
            전체 누적 식단 기록
          </p>
          <div className="flex items-baseline gap-1">
            <p className="text-3xl font-bold">{logsCount}</p>
            <span className="text-sm font-medium text-muted-foreground">건</span>
          </div>
          <p className="text-[10px] text-muted-foreground/60 mt-1.5">유저별 로그 조회 →</p>
        </Link>

        <Link
          href="/admin/billing"
          className="bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-md hover:border-rose-300/50 transition-all cursor-pointer group"
        >
          <p className="text-sm font-medium text-muted-foreground mb-1 group-hover:text-foreground transition-colors">
            최근 6개월 AI 비용
          </p>
          <div className="flex items-baseline gap-1">
            <p className="text-3xl font-bold text-rose-600">
              {Math.round(totalCostUsd * EXCHANGE_RATE).toLocaleString("ko-KR")}
            </p>
            <span className="text-sm font-bold text-rose-600">원</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1 text-right">
            ${totalCostUsd.toFixed(4)} · 비용 탭에서 상세 →
          </p>
        </Link>
      </div>

      {/* 금일 지표 카드 — 2행 (2개) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/admin/users"
          className="bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-md hover:border-sky-300/50 transition-all cursor-pointer group"
        >
          <p className="text-sm font-medium text-muted-foreground mb-1 group-hover:text-foreground transition-colors">
            금일 활성 사용자
          </p>
          <div className="flex items-baseline gap-1">
            <p className="text-3xl font-bold text-sky-600">{dailyActiveUsers}</p>
            <span className="text-sm font-bold text-sky-600">명</span>
          </div>
          <p className="text-[10px] text-muted-foreground/60 mt-1.5">오늘 앱 방문 기준</p>
        </Link>

        <Link
          href="/admin/users"
          className="bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-md hover:border-emerald-300/50 transition-all cursor-pointer group"
        >
          <p className="text-sm font-medium text-muted-foreground mb-1 group-hover:text-foreground transition-colors">
            금일 기록 작성자
          </p>
          <div className="flex items-baseline gap-1">
            <p className="text-3xl font-bold text-emerald-600">{dailyLogWriters}</p>
            <span className="text-sm font-bold text-emerald-600">명</span>
          </div>
          <p className="text-[10px] text-muted-foreground/60 mt-1.5">오늘 식단 기록 생성 기준</p>
        </Link>
      </div>

      {/* 상세 지표 및 차트 */}
      <DashboardCharts
        weeklyActive={weeklyActive}
        monthlyBilling={monthlyBilling}
        topAiUsers={topAiUsers}
        thisMonthCalls={thisMonthCalls}
      />
    </div>
  );
}
