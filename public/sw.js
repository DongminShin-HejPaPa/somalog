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

// SW 버전 식별자. sw.js 본문이 의미 있게 바뀔 때마다 손으로 bump.
// 클라이언트가 PING 메시지를 보내면 PONG 으로 이 값 반환 → 진단 라인에 표시.
// "옛 SW 가 active 인 채로 느린 건지" vs "새 SW 인데도 캐시 미스인 건지" 분리 진단용.
const SW_VERSION = "2026-01-21-d-deep-diag";

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
  //
  // iOS Safari PWA 콜드 진입에서 `request.mode === "navigate"` 가 항상 세팅되지
  // 않는 WebKit 동작이 있다 (홈 화면 아이콘 탭 직후 첫 요청). 이로 인해 SW 가
  // HTML 을 가로채지 못해 절대 캐시되지 않고 매번 네트워크로 가는 회귀가 있었음.
  // familyTime 의 sw.js 와 동일하게 `destination === "document"` 도 함께 확인해
  // PWA 콜드 진입에서도 HTML 이 SWR 경로로 들어가도록 보강.
  if (event.request.mode === "navigate" || event.request.destination === "document") {
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

// ── PING/PONG: 클라이언트 진단용 SW 상태 응답 ──────────────────
// "캐시가 비어있는지", "잘못된 내용이 들어있는지", "키 매칭이 안 되는지" 등을
// 한 번의 응답으로 판별할 수 있게 cache 내용을 함께 반환.
self.addEventListener("message", (event) => {
  if (!event.data || event.data.type !== "PING") return;
  const port = event.ports && event.ports[0];
  if (!port) return;

  event.waitUntil((async () => {
    const out = { type: "PONG", version: SW_VERSION };
    try {
      out.scope = self.registration && self.registration.scope;
    } catch {}
    // HTML_CACHE 내용: 각 entry 의 URL, status, 본문 크기, content-type
    try {
      const htmlCache = await caches.open(HTML_CACHE);
      const keys = await htmlCache.keys();
      const items = await Promise.all(keys.map(async (req) => {
        const resp = await htmlCache.match(req);
        if (!resp) return { url: req.url, status: "no-resp" };
        let bodyLen = -1;
        let ct = "?";
        try {
          ct = resp.headers.get("content-type") || "?";
          const text = await resp.clone().text();
          bodyLen = text.length;
        } catch {}
        return { url: req.url, status: resp.status, bodyLen, ct };
      }));
      out.htmlCache = items;
    } catch (e) {
      out.htmlCacheErr = String(e);
    }
    // STATIC_CACHE / CACHE_NAME: 키 개수만 (개수 자체가 진단)
    try {
      const sc = await caches.open(STATIC_CACHE);
      const skeys = await sc.keys();
      out.staticCount = skeys.length;
    } catch (e) {
      out.staticErr = String(e);
    }
    try {
      const cc = await caches.open(CACHE_NAME);
      const ckeys = await cc.keys();
      out.shellCount = ckeys.length;
    } catch (e) {
      out.shellErr = String(e);
    }
    // 전체 cache 이름 목록 (혹시 우리가 모르는 orphan 캐시가 있는지)
    try {
      out.allCaches = await caches.keys();
    } catch (e) {
      out.allCachesErr = String(e);
    }
    port.postMessage(out);
  })());
});

async function staleWhileRevalidateHTML(request) {
  const cache = await caches.open(HTML_CACHE);
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
