// 캐시 이름에는 절대 버전을 붙이지 않는다 — 영구 고정 (familyTime 검증 구조 이식).
// HTML SWR 캐시를 별도의 영구 캐시(HTML_CACHE)로 분리하는 것이 핵심:
// 과거엔 HTML 을 버전 박힌 CACHE_NAME 에 저장해, 배포로 버전이 바뀌면
// activate 가 0.1초 즉시표시의 원천인 warm HTML 캐시를 통째로 삭제 →
// 다음 진입이 콜드 네트워크 HTML 을 끝까지 기다리는 2초 흰화면이 됐다.
// 코드/HTML 변경은 SWR(stale 즉시 + 백그라운드 갱신)로 다음 부팅에
// 자연 전파되므로 버전 bump 는 불필요하며 오히려 해롭다.
const CACHE_NAME = "somalog-shell";
// _next/static/ 청크는 content-hash 파일명이라 불변(immutable).
const STATIC_CACHE = "somalog-static";
// HTML 네비게이션 SWR 전용 영구 캐시. 절대 rename 하지 않는다.
const HTML_CACHE = "somalog-html";

// 앱 셸: 오프라인에서도 보여줄 핵심 정적 파일들.
// 인증이 필요한 HTML 라우트(/, /home)는 프리캐시하지 않는다 —
// install 시 addAll 은 원자적이라 인증 리다이렉트/실패가 전체 프리캐시를
// 깨뜨리고, 로그인 HTML 이 잘못 캐시될 수 있다. HTML 은 SWR 가 채운다.
const PRECACHE_URLS = [
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
          .filter((k) => k !== CACHE_NAME && k !== STATIC_CACHE && k !== HTML_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch ─────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  // POST / non-GET 요청은 bypass
  if (event.request.method !== "GET") return;
  // chrome-extension 등 외부 스킴 bypass
  if (!event.request.url.startsWith(self.location.origin)) return;

  // _next/static/ 청크: content-hash 파일명 → 불변. Cache First.
  // async/await + event.waitUntil(cache.put(...)) 패턴.
  // 이유: cache.put 이 fire-and-forget 이면 iOS 가 respondWith resolve 직후 SW 를
  // 죽일 때 put 이 완료되지 않아 청크가 캐시에 안 들어감 → 매 진입마다 같은
  // 청크를 네트워크로 다시 받는 회귀.
  if (event.request.url.includes("/_next/static/")) {
    event.respondWith(staticCacheFirst(event));
    return;
  }

  // RSC payload / server actions / next-image / API: 항상 네트워크
  if (event.request.url.includes("/_next/") || event.request.url.includes("/api/")) return;

  // 페이지(HTML) 네비게이션 → Stale-While-Revalidate.
  // 캐시된 셸을 즉시 반환해 cold start 흰 화면(서버 Supabase 체인 대기)을 제거하고,
  // 백그라운드로 최신 HTML 을 받아 캐시만 갱신한다. 최신 데이터는 클라이언트
  // (localStorage 캐시 + HomeContainer 패치)가 채운다.
  // 강제 reload / postMessage 없음 — 활성 세션을 절대 끊지 않는다.
  //
  // iOS Safari PWA 콜드 진입에서 `request.mode === "navigate"` 가 항상 세팅되지
  // 않는 WebKit 동작이 있다 (홈 화면 아이콘 탭 직후 첫 요청). 이로 인해 SW 가
  // HTML 을 가로채지 못해 절대 캐시되지 않고 매번 네트워크로 가는 회귀가 있었음.
  // familyTime 의 sw.js 와 동일하게 `destination === "document"` 도 함께 확인해
  // PWA 콜드 진입에서도 HTML 이 SWR 경로로 들어가도록 보강.
  if (event.request.mode === "navigate" || event.request.destination === "document") {
    event.respondWith(staleWhileRevalidateHTML(event));
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

async function staticCacheFirst(event) {
  const request = event.request;
  try {
    // ignoreVary/ignoreMethod 추가: Vercel/CDN 이 청크에 vary 박을 가능성 방어.
    const cached = await caches.match(request, { ignoreVary: true, ignoreMethod: true });
    if (cached) return cached;
    const response = await fetch(request);
    if (response && response.ok) {
      // waitUntil 로 cache.put 이 끝날 때까지 SW 살려둠.
      event.waitUntil(
        caches.open(STATIC_CACHE).then((cache) => cache.put(request, response.clone()))
      );
    }
    return response;
  } catch {
    return new Response("Static fetch error", { status: 502 });
  }
}

// Vercel/Next.js force-dynamic 응답에 박힌 vary / cache-control / set-cookie 가
// iOS Safari 의 Cache API match 또는 후속 응답 사용에 영향을 줘 캐시 미스를
// 일으키는 게 확정됨 (vary="rsc,next-router-..." 였음). 헤더를 strip 한 클린
// 응답으로 저장해 그 변수 제거.
async function makeCleanResponseForCache(response) {
  try {
    const body = await response.clone().blob();
    const ct = response.headers.get("content-type") || "text/html; charset=utf-8";
    return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers: { "content-type": ct },
    });
  } catch {
    return response.clone();
  }
}

async function staleWhileRevalidateHTML(event) {
  const request = event.request;
  const cache = await caches.open(HTML_CACHE);
  // 쿼리스트링으로 인한 캐시 미스/비대를 막기 위해 pathname 으로 정규화
  const url = new URL(request.url);
  const cacheKey = url.origin + url.pathname;
  // ignoreVary + ignoreMethod: 응답 헤더의 vary 와 method 모두 무시하고 URL 로만 매치.
  // 저장 시 헤더 strip 까지 같이 적용하므로 사실상 vary 없어야 하나 방어적으로 둠.
  const cached =
    (await cache.match(cacheKey, { ignoreVary: true, ignoreMethod: true })) ||
    (await cache.match(request, { ignoreSearch: true, ignoreVary: true, ignoreMethod: true }));

  const networkFetch = fetch(request)
    .then(async (response) => {
      if (response && response.status === 200) {
        // 헤더 strip 한 클린 응답을 저장 (vary, cache-control, set-cookie 제거)
        try {
          const clean = await makeCleanResponseForCache(response);
          await cache.put(cacheKey, clean);
        } catch {
          // 무시
        }
      }
      return response;
    })
    .catch(() => null);

  // 캐시가 있으면 즉시 반환 + 백그라운드 갱신.
  // event.waitUntil 로 백그라운드 fetch + cache.put 이 완료될 때까지 iOS 가 SW 살려둠.
  if (cached) {
    event.waitUntil(networkFetch.catch(() => {}));
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
