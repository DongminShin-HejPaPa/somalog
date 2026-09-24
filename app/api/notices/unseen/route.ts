// Server Action 직렬 큐를 피하기 위한 읽기 경로 — 근거는 lib/api/fetch-json.ts 참고.
import type { NextRequest } from "next/server";
import { actionGetUnseenImportantNotices } from "@/app/actions/notice-actions";
import { respondJson } from "@/lib/api/route-json";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  const lastSeenAt = request.nextUrl.searchParams.get("lastSeenAt");
  return respondJson(() => actionGetUnseenImportantNotices(lastSeenAt));
}
