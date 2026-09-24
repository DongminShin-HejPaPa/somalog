import { NextResponse, type NextRequest } from "next/server";
import { getDailyLog, upsertDailyLog } from "@/lib/services/daily-log-service";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 입력 탭 날짜 로드 전용 읽기 경로.
 *
 * Server Action 이 아니라 Route Handler 인 이유: Next 라우터는 Server Action 을
 * **한 번에 하나씩 직렬로** 처리한다. 앱 진입 직후엔 홈/설정/공지 등이 쏜 액션
 * 6~7개가 큐에 쌓여 있어, 입력 탭의 날짜 로드가 그 뒤에서 수초를 기다렸다.
 * 일반 fetch 는 그 큐를 타지 않아 즉시 병렬로 나간다.
 *
 * body: { date: "YYYY-MM-DD", ensure?: boolean }
 * - ensure=true 이고 로그가 없으면 빈 로그를 만들어 돌려준다 (기존 get → upsert 2왕복을 1왕복으로).
 * - revalidatePath 를 부르지 않는다 — 빈 로그 생성은 서버 컴포넌트가 읽는 값을 바꾸지 않는다.
 */
export async function POST(request: NextRequest) {
  let body: { date?: unknown; ensure?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const date = body.date;
  if (typeof date !== "string" || !DATE_RE.test(date)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  try {
    let log = await getDailyLog(date);
    if (!log && body.ensure === true) {
      log = await upsertDailyLog(date, {});
    }
    return NextResponse.json({ log });
  } catch {
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
