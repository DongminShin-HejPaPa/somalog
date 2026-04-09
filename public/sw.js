const CACHE_NAME = "somalog-v1";

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
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
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
  // Next.js API / Server Actions bypass (항상 네트워크)
  if (event.request.url.includes("/_next/") || event.request.url.includes("/api/")) return;

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
