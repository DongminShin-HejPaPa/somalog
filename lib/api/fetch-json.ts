"use client";

/**
 * Server Action 직렬 큐 밖에서 서버 데이터를 가져오는 공용 fetch.
 *
 * Next 라우터는 Server Action 을 **한 번에 하나씩** 처리한다. 앱 시작 시 읽기를
 * 전부 액션으로 쏘면 큐가 쌓여, 뒤에 선 요청(탭 이동 후 날짜 로드, 첫 저장 등)이
 * 앞 요청이 다 끝날 때까지 기다린다. 또 큐에서 처리 중인 액션이 있을 때 탭을
 * 옮기면 라우터가 그 결과를 버리고 이동이 끝난 뒤 현재 페이지 전체를 한 번 더
 * 새로 받는다(needsRefresh). 읽기는 Route Handler + 이 함수로 보내 두 문제를 없앤다.
 *
 * Route Handler 가 실패하면(비로그인 리다이렉트로 HTML 이 오는 경우 포함) fallback
 * (보통 기존 Server Action)으로 넘어간다 — 느려질 수는 있어도 깨지지는 않는다.
 */
export async function fetchJson<T>(
  input: string,
  fallback: () => Promise<T>,
  init?: RequestInit
): Promise<T> {
  try {
    const res = await fetch(input, {
      ...init,
      cache: "no-store",
      credentials: "same-origin",
    });
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || res.redirected || !type.includes("application/json")) {
      throw new Error(`fetchJson ${res.status}`);
    }
    return (await res.json()) as T;
  } catch {
    return fallback();
  }
}

/** JSON body POST 용 init */
export function jsonPost(body: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}
