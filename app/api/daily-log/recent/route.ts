import { NextResponse, type NextRequest } from "next/server";
import { getRecentDailyLogs, getFirstUnclosedLog } from "@/lib/services/daily-log-service";

export const dynamic = "force-dynamic";

/**
 * 입력 탭 최근 로그 읽기 경로. Server Action 직렬 큐를 피하려고 Route Handler 로 둔다
 * (근거는 app/api/daily-log/route.ts 참고).
 *
 * GET ?count=30[&firstUnclosed=1]
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const count = Math.min(Math.max(Number(params.get("count")) || 30, 1), 60);
  const withFirstUnclosed = params.get("firstUnclosed") === "1";

  try {
    const [logs, firstUnclosed] = await Promise.all([
      getRecentDailyLogs(count),
      withFirstUnclosed ? getFirstUnclosedLog() : Promise.resolve(null),
    ]);
    return NextResponse.json({ logs, firstUnclosed });
  } catch {
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
