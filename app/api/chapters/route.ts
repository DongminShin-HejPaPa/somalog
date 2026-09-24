// Server Action 직렬 큐를 피하기 위한 읽기 경로 — 근거는 lib/api/fetch-json.ts 참고.
import { actionGetChapterScopes } from "@/app/actions/chapter-actions";
import { respondJson } from "@/lib/api/route-json";

export const dynamic = "force-dynamic";

export function GET() {
  return respondJson(() => actionGetChapterScopes());
}
