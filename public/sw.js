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
const SW_VERSION = "2026-01-21-g-wait-until";

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

// static chunk cache 적중/미스 카운터. iOS 가 청크를 실제로 캐시에서 서빙하는지
// vs 매번 네트워크로 가는지 진단. PING 응답에 포함.
let staticHitCount = 0;
let staticMissCount = 0;
const STATIC_RECENT = []; // 마지막 N개 청크 처리 기록
const STATIC_RECENT_MAX = 10;
function logStaticServe(url, type) {
  if (type === "hit") staticHitCount++;
  else if (type === "miss") staticMissCount++;
  try {
    const path = new URL(url).pathname.split("/").slice(-2).join("/");
    STATIC_RECENT.push({ path, type, ts: Date.now() });
    if (STATIC_RECENT.length > STATIC_RECENT_MAX) STATIC_RECENT.shift();
  } catch {}
}

// ── Fetch: Network First (네트워크 실패 시 캐시 fallback) ─
self.addEventListener("fetch", (event) => {
  // POST / non-GET 요청은 bypass
  if (event.request.method !== "GET") return;
  // chrome-extension 등 외부 스킴 bypass
  if (!event.request.url.startsWith(self.location.origin)) return;

  // _next/static/ 청크: content-hash 파일명 → 불변. Cache First.
  // async/await + event.waitUntil(cache.put(...)) 패턴으로 변경. 이유:
  // 이전엔 cache.put 이 fire-and-forget 이라 iOS 가 respondWith resolve 직후
  // SW 를 죽이면 put 이 완료되지 않아 청크가 캐시에 들어가지 않았음. 그래서
  // 매 진입마다 같은 청크를 네트워크로 다시 받는 회귀 가능. waitUntil 로
  // iOS 에 "put 끝날 때까지 살려둬" 신호.
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
    if (cached) {
      logStaticServe(request.url, "hit");
      return cached;
    }
    logStaticServe(request.url, "miss");
    const response = await fetch(request);
    if (response && response.ok) {
      // waitUntil 로 cache.put 이 끝날 때까지 SW 살려둠. 이전엔 fire-and-forget
      // 이라 put 미완료 상태로 SW 가 죽으면 청크가 캐시 안 들어감.
      event.waitUntil(
        caches.open(STATIC_CACHE).then((cache) => cache.put(request, response.clone()))
      );
    }
    return response;
  } catch (e) {
    // 네트워크 실패 또는 기타 에러 시 빈 응답으로 fallback (브라우저가 알아서 에러 처리)
    return new Response("Static fetch error", { status: 502 });
  }
}

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
    // 추가: vary / cache-control / set-cookie 유무 / date — vary 매칭 거부 가설 검증용
    try {
      const htmlCache = await caches.open(HTML_CACHE);
      const keys = await htmlCache.keys();
      const items = await Promise.all(keys.map(async (req) => {
        const resp = await htmlCache.match(req);
        if (!resp) return { url: req.url, status: "no-resp" };
        let bodyLen = -1;
        let ct = "?";
        let vary = "";
        let cc = "";
        let hasSetCookie = false;
        let date = "";
        try {
          ct = resp.headers.get("content-type") || "?";
          vary = resp.headers.get("vary") || "";
          cc = resp.headers.get("cache-control") || "";
          hasSetCookie = !!resp.headers.get("set-cookie");
          date = resp.headers.get("date") || "";
          const text = await resp.clone().text();
          bodyLen = text.length;
        } catch {}
        return { url: req.url, status: resp.status, bodyLen, ct, vary, cc, hasSetCookie, date };
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
    // SERVE_LOG: SW 가 HTML 요청을 어떻게 처리했는지 시간순.
    // "SW 가 정말 캐시 서빙했는지 vs iOS 가 SW 우회했는지" 결정적 판별.
    out.serveLog = SERVE_LOG.slice(-5).map((e) => ({
      type: e.type,
      url: (() => { try { return new URL(e.url).pathname; } catch { return e.url; } })(),
      detail: e.detail,
      agoMs: Date.now() - e.ts,
    }));
    // 정적 청크 hit/miss 카운터 — JS 청크가 캐시에서 서빙됐는지 vs 네트워크 가는지.
    // 느린 케이스에 staticMiss 가 크면 청크 캐시가 진짜로 적중 안 함을 확정.
    out.staticHit = staticHitCount;
    out.staticMiss = staticMissCount;
    out.staticRecent = STATIC_RECENT.slice();
    port.postMessage(out);
  })());
});

// SW 가 HTML 요청을 어떻게 처리했는지 기록. PING 응답으로 끌어와 진단.
// "SW 가 캐시 서빙했는지 vs iOS 가 SW 우회했는지" 확정용.
const SERVE_LOG = []; // { ts, url, type, detail } 가 시간순으로 append. 마지막 N개만 유지.
const SERVE_LOG_MAX = 20;
function logServe(url, type, detail) {
  try {
    SERVE_LOG.push({ ts: Date.now(), url, type, detail: detail || "" });
    if (SERVE_LOG.length > SERVE_LOG_MAX) SERVE_LOG.shift();
  } catch {}
}

// Vercel/Next.js force-dynamic 응답에 박힌 vary / cache-control / set-cookie 가
// iOS Safari 의 Cache API match 또는 후속 응답 사용에 영향을 줄 가능성. 헤더를
// strip 한 클린 응답으로 저장해 그 변수 제거.
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
  // 캐시 저장 시 헤더 strip 까지 같이 적용하므로 사실상 vary 없어야 하나 방어적으로 둠.
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
          logServe(cacheKey, "cached", `status=${response.status}`);
        } catch (e) {
          logServe(cacheKey, "cache-put-err", String(e));
        }
      }
      return response;
    })
    .catch((e) => {
      logServe(cacheKey, "network-err", String(e));
      return null;
    });

  // 캐시가 있으면 즉시 반환 + 백그라운드 갱신 (다음 cold start 가 빨라짐).
  // event.waitUntil 로 백그라운드 fetch + cache.put 이 완료될 때까지 iOS 가 SW 살려둠.
  // 이전엔 networkFetch 가 fire-and-forget 이라 iOS 가 SW 죽여서 cache.put 미완료 →
  // 다음 진입에 stale 한 채로 머무는 가능성. waitUntil 로 차단.
  if (cached) {
    logServe(cacheKey, "served-from-cache", `bodyType=${cached.headers.get("content-type")}`);
    event.waitUntil(networkFetch.catch(() => {}));
    return cached;
  }

  // 첫 방문(캐시 없음): 네트워크 대기
  logServe(cacheKey, "served-from-network", "cache-miss");
  const fresh = await networkFetch;
  if (fresh) return fresh;
  logServe(cacheKey, "served-offline-fallback", "no-network");
  return new Response("오프라인 상태입니다.", {
    status: 503,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
