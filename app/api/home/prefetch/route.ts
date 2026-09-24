// Server Action 직렬 큐를 피하기 위한 읽기 경로 — 근거는 lib/api/fetch-json.ts 참고.
import type { NextRequest } from "next/server";
import { actionGetPrefetchData } from "@/app/actions/log-actions";
import { respondJson } from "@/lib/api/route-json";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  return respondJson(() =>
    actionGetPrefetchData(p.get("records") === "1", p.get("graph") === "1")
  );
}
