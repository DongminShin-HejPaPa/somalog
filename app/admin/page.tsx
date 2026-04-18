import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  const adminClient = createAdminClient();
  
  // 오늘 날짜 (KST, YYYY-MM-DD)
  const todayStr = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split('T')[0];

  // 1. 데이터 조회 (병렬)
  const results = await Promise.all([
    adminClient.from("user_profiles").select("*", { count: "exact", head: true }),
    adminClient.from("daily_logs").select("*", { count: "exact", head: true }),
    adminClient.from("ai_usage_logs").select("cost_usd"),
    // 오늘 날짜 기록이 있는 user_id (오늘 기록 작성자)
    adminClient.from("daily_logs").select("user_id").eq("date", todayStr),
    // last_seen_at 기준 오늘 앱 방문자 (탭 레이아웃 진입 시 갱신)
    adminClient.from("user_profiles").select("user_id")
      .gte("last_seen_at", `${todayStr}T00:00:00+09:00`)
      .lt("last_seen_at", `${new Date(new Date(todayStr).getTime() + 86400000).toISOString().split('T')[0]}T00:00:00+09:00`),
  ]);

  const usersCount = (results[0] as any).count ?? 0;
  const logsCount = (results[1] as any).count ?? 0;

  const usageRes = results[2] as any;
  const usageData = usageRes.data;
  const usageError = usageRes.error;

  // 2. 오늘 기록 작성자 (daily_logs.date 기준)
  const todayLogsRes = results[3] as any;
  const dailyLogWriters = new Set(
    (todayLogsRes.data as { user_id: string }[] | null)?.map((r) => r.user_id) ?? []
  ).size;

  // 3. 금일 앱 방문자 (last_seen_at 기준, 탭 레이아웃 진입 시 갱신)
  const todayVisitorsRes = results[4] as any;
  const dailyActiveUsers = (todayVisitorsRes.data as { user_id: string }[] | null)?.length ?? 0;

  // 4. 총 AI 비용 합산
  const EXCHANGE_RATE = 1380; 
  let totalCostUsd = 0;
  
  if (!usageError && Array.isArray(usageData)) {
    totalCostUsd = usageData.reduce((sum: number, row: any) => {
      const cost = Number(row.cost_usd);
      return sum + (isNaN(cost) ? 0 : cost);
    }, 0);
  }
  
  const totalCostKrw = Math.round(totalCostUsd * EXCHANGE_RATE);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">대시보드</h1>
          <p className="text-sm text-muted-foreground mt-1">Soma Log 서비스 운영 상황</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <p className="text-sm font-medium text-muted-foreground mb-1">총 등록 사용자</p>
          <div className="flex items-baseline gap-1">
            <p className="text-3xl font-bold">{usersCount}</p>
            <span className="text-sm font-medium text-muted-foreground">명</span>
          </div>
        </div>
        
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <p className="text-sm font-medium text-muted-foreground mb-1">전체 누적 식단 기록</p>
          <div className="flex items-baseline gap-1">
            <p className="text-3xl font-bold">{logsCount}</p>
            <span className="text-sm font-medium text-muted-foreground">건</span>
          </div>
        </div>
        
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <p className="text-sm font-medium text-muted-foreground mb-1">금일 활성 사용자</p>
          <div className="flex items-baseline gap-1">
             <p className="text-3xl font-bold text-sky-600">{dailyActiveUsers}</p>
             <span className="text-sm font-bold text-sky-600">명</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">오늘 앱 방문(KST) 기준</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">기록 작성자: {dailyLogWriters}명</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <p className="text-sm font-medium text-muted-foreground mb-1">누적 총 AI 사용 비용</p>
          <div className="flex items-baseline gap-1">
             <p className="text-3xl font-bold text-rose-600">{totalCostKrw.toLocaleString('ko-KR')}</p>
             <span className="text-sm font-bold text-rose-600">원</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1 text-right">
             올타임 누적 ${totalCostUsd.toFixed(4)}
          </p>
        </div>
      </div>
      
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm min-h-[300px] flex items-center justify-center text-center">
        <div>
          <p className="text-muted-foreground text-sm mb-1">상세 지표 및 차트 영역</p>
          <p className="text-[10px] text-muted-foreground/50">(준비 중)</p>
        </div>
      </div>
    </div>
  );
}
