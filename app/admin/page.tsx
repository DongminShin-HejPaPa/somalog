import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  const adminClient = createAdminClient();
  
  // 1. 데이터 조회 (병렬 처리를 유지하되, 타입을 더 명시적으로 처리하여 빌드 에러 방지)
  const results = await Promise.all([
    adminClient.from("user_profiles").select("*", { count: "exact", head: true }),
    adminClient.from("daily_logs").select("*", { count: "exact", head: true }),
    adminClient.from("ai_usage_logs").select("cost_usd"),
    adminClient.auth.admin.listUsers()
  ]);

  const usersCount = (results[0] as any).count ?? 0;
  const logsCount = (results[1] as any).count ?? 0;
  
  const usageRes = results[2] as any;
  const usageData = usageRes.data;
  const usageError = usageRes.error;

  const authRes = results[3] as any;
  const authData = authRes.data;
  const authError = authRes.error;

  // 2. 금일 활성 사용자 계산
  let dailyActiveUsers = 0;
  if (!authError && authData && Array.isArray(authData.users)) {
    // 타임존 연산의 복잡도를 낮추기 위해 UTC 기반의 안전한 날짜 추출 방식 사용
    const todayStr = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    dailyActiveUsers = authData.users.filter((u: any) => {
      if (!u.last_sign_in_at) return false;
      // 유저의 마지막 접속 시간을 KST 날짜 문자열로 변환 (YYYY-MM-DD)
      const signInStr = new Date(new Date(u.last_sign_in_at).getTime() + 9 * 60 * 60 * 1000).toISOString().split('T')[0];
      return signInStr === todayStr;
    }).length;
  }

  // 3. 총 AI 비용 합산
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
          <p className="text-[10px] text-muted-foreground mt-1">오늘 로그인(KST) 기준</p>
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
