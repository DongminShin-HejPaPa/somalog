import { createAdminClient } from "@/lib/supabase/admin";

export default async function AdminDashboardPage() {
  const adminClient = createAdminClient();
  
  // 1. 필요한 모든 데이터를 병렬로 안전하게 조회 (에러 전파 방지를 고려)
  const [
    { count: usersCount },
    { count: logsCount },
    { data: usageData, error: usageError },
    { data: authData, error: authError }
  ] = await Promise.all([
    adminClient.from("user_profiles").select("*", { count: "exact", head: true }),
    adminClient.from("daily_logs").select("*", { count: "exact", head: true }),
    // 추후 데이터가 수만 건 단위로 늘어날 때는 DB에서 RPC(SUM 함수)로 연산되도록 마이그레이션이 필요합니다.
    adminClient.from("ai_usage_logs").select("cost_usd"),
    adminClient.auth.admin.listUsers() // 로그인(auth 기록) 날짜 기반으로 DAU 측정 위함
  ]);

  // 2. 금일 활성 사용자 계산 (KST(한국 기준) 안전 변환)
  let dailyActiveUsers = 0;
  if (!authError && authData?.users) {
    // KST 날짜 문자열(YYYY-MM-DD 형식으로 안전하게 조합, 브라우저/서버 타임존 의존성 탈피)
    const getKSTDateString = (dateObj: Date) => {
      const kst = new Date(dateObj.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
      const yy = kst.getFullYear();
      const mm = String(kst.getMonth() + 1).padStart(2, '0');
      const dd = String(kst.getDate()).padStart(2, '0');
      return `${yy}-${mm}-${dd}`;
    };
    
    const todayKST = getKSTDateString(new Date());
    
    dailyActiveUsers = authData.users.filter((u) => {
      if (!u.last_sign_in_at) return false;
      const signInKST = getKSTDateString(new Date(u.last_sign_in_at));
      return signInKST === todayKST;
    }).length;
  }

  // 3. 총 AI 비용 합산 (달러 환율 계산기 방어 로직)
  // 현재 하드코딩된 대략적 환율 (필요 시 외부 연동 고려 가능)
  const EXCHANGE_RATE = 1380; 
  let totalCostUsd = 0;
  
  if (!usageError && usageData) {
    totalCostUsd = usageData.reduce((sum, row) => {
      const cost = Number(row.cost_usd);
      return sum + (isNaN(cost) ? 0 : cost);
    }, 0);
  }
  
  const totalCostKrw = Math.round(totalCostUsd * EXCHANGE_RATE);
  const formatMoney = (n: number) => new Intl.NumberFormat('ko-KR').format(n);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">대시보드</h1>
          <p className="text-sm text-muted-foreground mt-1">Soma Log 서비스 운영 상황</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 총 사용자 */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm transition-all hover:shadow-md">
          <p className="text-sm font-medium text-muted-foreground mb-1">총 등록 사용자</p>
          <div className="flex items-baseline gap-1">
            <p className="text-3xl font-bold">{usersCount ?? 0}</p>
            <span className="text-sm font-medium text-muted-foreground">명</span>
          </div>
        </div>
        
        {/* 전체 입력 기록 */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm transition-all hover:shadow-md">
          <p className="text-sm font-medium text-muted-foreground mb-1">전체 누적 식단 기록</p>
          <div className="flex items-baseline gap-1">
            <p className="text-3xl font-bold">{logsCount ?? 0}</p>
            <span className="text-sm font-medium text-muted-foreground">건</span>
          </div>
        </div>
        
        {/* 금일 활성 사용자 */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm transition-all hover:shadow-md">
          <p className="text-sm font-medium text-muted-foreground mb-1">금일 활성 사용자</p>
          <div className="flex items-baseline gap-1">
             <p className="text-3xl font-bold text-sky-600">{dailyActiveUsers}</p>
             <span className="text-sm font-bold text-sky-600">명</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">오늘 로그인(KST) 기준</p>
        </div>

        {/* AI 비용 추정 */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm transition-all hover:shadow-md">
          <p className="text-sm font-medium text-muted-foreground mb-1">총 AI 사용 비용</p>
          <div className="flex items-baseline gap-1">
             <p className="text-3xl font-bold text-rose-600">{formatMoney(totalCostKrw)}</p>
             <span className="text-sm font-bold text-rose-600">원</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1 text-right">
             ${totalCostUsd.toFixed(4)} (환율 {EXCHANGE_RATE}원 적용)
          </p>
        </div>
      </div>
      
      {/* 향후 확장 공간 */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm min-h-[300px] flex items-center justify-center">
        <div className="text-center">
            <p className="text-muted-foreground text-sm mb-2">상세 지표 및 차트 영역</p>
            <p className="text-xs text-muted-foreground/60">(사용자 잔존율, 모델별 토큰 사용량 차트 등 추가 예정)</p>
        </div>
      </div>
    </div>
  );
}
