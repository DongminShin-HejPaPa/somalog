// Server Action 직렬 큐를 피하기 위한 읽기 경로 — 근거는 lib/api/fetch-json.ts 참고.
// 쓰기지만 revalidatePath 없이 도는 백그라운드 정리라 Server Action 일 이유가 없다.
import { actionAutoCloseOldLogs } from "@/app/actions/log-actions";
import { respondJson } from "@/lib/api/route-json";

export const dynamic = "force-dynamic";

export function POST() {
  return respondJson(() => actionAutoCloseOldLogs());
}
