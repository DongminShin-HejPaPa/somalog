const CACHE_NAME = "somalog-v3";
// _next/static/ 청크는 content-hash 파일명이라 불변(immutable).
// 파일명이 곧 버전이므로 캐시를 비울 필요가 없고 activate cleanup에서 보존한다.
const STATIC_CACHE = "somalog-static-v1";

// 앱 셸: 오프라인에서도 보여줄 핵심 정적 파일들
const PRECACHE_URLS = [
  "/",
  "/home",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
];

// ── Install: 핵심 파일 프리캐시 ──────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// ── Activate: 이전 버전 캐시 정리 ─────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME && k !== STATIC_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: Network First (네트워크 실패 시 캐시 fallback) ─
self.addEventListener("fetch", (event) => {
  // POST / non-GET 요청은 bypass
  if (event.request.method !== "GET") return;
  // chrome-extension 등 외부 스킴 bypass
  if (!event.request.url.startsWith(self.location.origin)) return;

  // _next/static/ 청크: content-hash 파일명 → 불변. Cache First.
  // (디스크에서 즉시 로드 → cold start 흰 화면 제거. 파일명이 바뀌면 자연히 새로 받음)
  if (event.request.url.includes("/_next/static/")) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // RSC payload / server actions / next-image / API: 항상 네트워크
  if (event.request.url.includes("/_next/") || event.request.url.includes("/api/")) return;

  // 페이지(HTML) 네비게이션 → Stale-While-Revalidate.
  // 캐시된 셸을 즉시 반환해 cold start 흰 화면(서버 Supabase 체인 대기)을 제거하고,
  // 백그라운드로 최신 HTML 을 받아 캐시만 갱신한다. 최신 데이터는 클라이언트
  // (localStorage 캐시 + HomeContainer 패치)가 채운다.
  // 강제 reload / postMessage 없음 — 활성 세션을 절대 끊지 않는다.
  if (event.request.mode === "navigate") {
    event.respondWith(staleWhileRevalidateHTML(event.request));
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // 성공 응답은 캐시에 저장
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() => {
        // 네트워크 실패 → 캐시에서 반환
        return caches.match(event.request).then(
          (cached) => cached ?? new Response("오프라인 상태입니다.", { status: 503 })
        );
      })
  );
});

async function staleWhileRevalidateHTML(request) {
  const cache = await caches.open(CACHE_NAME);
  // 쿼리스트링으로 인한 캐시 미스/비대를 막기 위해 pathname 으로 정규화
  const url = new URL(request.url);
  const cacheKey = url.origin + url.pathname;
  const cached =
    (await cache.match(cacheKey)) ||
    (await cache.match(request, { ignoreSearch: true }));

  const networkFetch = fetch(request)
    .then((response) => {
      if (response && response.status === 200) {
        cache.put(cacheKey, response.clone()).catch(() => {});
      }
      return response;
    })
    .catch(() => null);

  // 캐시가 있으면 즉시 반환 + 백그라운드 갱신 (다음 cold start 가 빨라짐)
  if (cached) {
    networkFetch.catch(() => {});
    return cached;
  }

  // 첫 방문(캐시 없음): 네트워크 대기
  const fresh = await networkFetch;
  if (fresh) return fresh;
  return new Response("오프라인 상태입니다.", {
    status: 503,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
