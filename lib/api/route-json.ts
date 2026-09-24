import { NextResponse } from "next/server";

/**
 * Route Handler 공용 응답 래퍼. 실패는 500 JSON — 클라이언트(fetchJson)가 받아서
 * 기존 Server Action 경로로 폴백한다.
 */
export async function respondJson<T>(fn: () => Promise<T>): Promise<NextResponse> {
  try {
    return NextResponse.json(await fn());
  } catch {
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
