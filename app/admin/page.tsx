import { createClient } from "@/lib/supabase/server";

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  
  // 간단한 통계 데이터 조회 (예시)
  const { count: usersCount } = await supabase
    .from("user_profiles")
    .select("*", { count: "exact", head: true });

  const { count: logsCount } = await supabase
    .from("daily_logs")
    .select("*", { count: "exact", head: true });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">대시보드</h1>
          <p className="text-sm text-muted-foreground mt-1">Soma Log 서비스 현황 요약</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI Cards */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <p className="text-sm font-medium text-muted-foreground mb-1">총 사용자</p>
          <p className="text-3xl font-bold">{usersCount ?? 0} 명</p>
        </div>
        
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <p className="text-sm font-medium text-muted-foreground mb-1">전체 입력된 기록</p>
          <p className="text-3xl font-bold">{logsCount ?? 0} 개</p>
        </div>
        
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm opacity-50">
          <p className="text-sm font-medium text-muted-foreground mb-1">금일 활성 사용자</p>
          <p className="text-3xl font-bold">-</p>
          <p className="text-xs text-muted-foreground mt-1">준비 중</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-5 shadow-sm opacity-50">
          <p className="text-sm font-medium text-muted-foreground mb-1">총 AI 비용 추정</p>
          <p className="text-3xl font-bold">-</p>
          <p className="text-xs text-muted-foreground mt-1">준비 중</p>
        </div>
      </div>
      
      {/* 추가적인 차트나 목록 공간 */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm min-h-[400px] flex items-center justify-center">
        <p className="text-muted-foreground text-sm">상세 지표 및 차트 영역 (준비 중)</p>
      </div>
    </div>
  );
}
