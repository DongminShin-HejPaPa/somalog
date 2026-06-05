# Blueprint: 탭 기반 PWA (Next.js 15 + Supabase + Vercel)

다음 비슷한 앱 시작 시 그대로 따라가도 콜드 진입 1-2초, 탭 이동 0.1초로 출발할 수 있도록 정리한 스펙. somalog 가 5-8초 콜드 진입 → 1-2초까지 줄이는 과정에서 도출된 모든 학습 망라.

---

## 1. 핵심 콘셉트

**탭 기반 PWA. 탭별로 독립적 기능. 데이터는 공유. 가능한 모든 것을 클라이언트 로컬에 캐시. 서버는 인증·갱신 채널.**

세 가지 원칙:
1. **첫 페인트는 100% localStorage 에서 와야 한다** — 서버/네트워크 대기 금지.
2. **메모리(JS singleton) + localStorage 이중 캐시.** 메모리는 SPA 세션 내 빠른 공유, localStorage 는 콜드 reopen 영속.
3. **Service Worker 는 HTML+JS 청크 영속 캐시 전담.** iOS 동작 미세 차이가 큰 영향 → 정확한 패턴 필요.

---

## 2. 기술 스택 (somalog 검증판)

### 런타임 / 패키지 매니저
- **Node.js 24.x** (package.json engines)
- **pnpm 10.x** (lockfile 형식, 워크스페이스 호환)

### 프레임워크 / 언어
- **Next.js 15.3+** (App Router, Server Actions, `after`)
- **React 19.1+** + **react-dom 19.1+**
- **TypeScript 5.8+ (strict)**
- **Tailwind CSS v4** (`@tailwindcss/postcss`) — JIT, 클래스 트리쉐이크

### 백엔드 / 호스팅
- **Supabase**: `@supabase/ssr ^0.9`, `@supabase/supabase-js ^2.100`
- **Vercel** 호스팅 (Edge 런타임 아님, Node 런타임)

### 클라이언트 라이브러리
- `lucide-react` 아이콘 (tree-shake 잘 됨)
- `clsx` + `tailwind-merge` 또는 `class-variance-authority` — 클래스 컴포지션
- `recharts` (필요 시만, **/home 같은 critical path 에 두지 말 것** — 360KB raw)

### AI (선택)
- `ai` + `@ai-sdk/openai` — server action 안에서만 사용 (절대 클라이언트 import 금지)

### 테스트
- **Vitest** + **@vitest/coverage-v8** — 유닛
- **Playwright** — E2E (`storageState` 재사용 패턴)

---

## 3. 프로젝트 구조

```
app/
├── layout.tsx                  # 루트 (서버, await 절대 없음)
├── (tabs)/
│   ├── layout.tsx              # 탭 그룹 공통 (서버, getAuthUser 만 await)
│   ├── home/page.tsx           # 각 탭 페이지 (서버, 자기 페이지에 필요한 것만 await)
│   ├── log/page.tsx
│   ├── graph/page.tsx
│   └── settings/page.tsx
├── actions/                    # Server Actions (모든 클라이언트→서버 통신 통로)
│   ├── log-actions.ts
│   ├── settings-actions.ts
│   └── data-actions.ts
└── (auth)/
    ├── login/page.tsx
    └── register/page.tsx

components/
├── home/
│   ├── home-container.tsx      # "use client", bootCache 패턴
│   └── home-content.tsx        # 빈 데이터 처리 가능해야 함
├── log/log-container.tsx       # bootCache 패턴
├── graph/graph-container.tsx   # bootCache 패턴
├── input/input-container.tsx
├── settings/settings-form.tsx
├── layout/
│   ├── bottom-nav.tsx          # next/link + prefetch=true (서버 컴포넌트 또는 client)
│   └── tabs-providers.tsx      # 클라이언트 wrapper
└── notices/notice-popup.tsx    # useSettings() 로 자체 gating

lib/
├── stores/
│   └── log-store.ts            # 모듈 싱글톤 in-memory + localStorage 영속화
├── contexts/
│   └── settings-context.tsx    # 클라이언트 fallback 경로 필수
├── services/                   # 서버 측 데이터 액세스
│   ├── settings-service.ts
│   └── daily-log-service.ts
├── supabase/
│   ├── server.ts               # createClient + getAuthUser (React cache)
│   ├── client.ts               # createBrowserClient
│   └── admin.ts                # service_role (after() 콜백 등)
└── utils/

public/
├── sw.js                       # Service Worker (정확한 패턴 필요 — 아래 4번)
├── manifest.json               # PWA manifest
└── icons/

docs/
└── BLUEPRINT.md                # 이 파일
```

---

## 4. Service Worker (가장 까다로운 부분)

### 절대 원칙

1. **캐시 이름에 절대 버전 안 붙임** (`-v1`, `-v2` 금지). 영구 고정. 변경 시 activate 가 옛 캐시 통째 삭제 → 콜드 진입 흰 화면 회귀.
2. **`navigate || destination === 'document'` 둘 다 체크.** iOS Safari PWA 가 첫 navigation 에서 `mode === navigate` 누락하는 경우 있음.
3. **`cache.put` 은 반드시 `event.waitUntil()` 안.** Fire-and-forget 시 iOS 가 SW 죽여서 put 미완료.
4. **`cache.match` 에 `{ ignoreVary: true, ignoreMethod: true }`.** Next.js force-dynamic 응답은 `vary: rsc, next-router-state-tree, ...` 박혀 매치 실패함.
5. **응답 저장 시 헤더 strip.** vary / cache-control / set-cookie 제거한 클린 Response 로 저장. iOS 가 cache-control: no-store 보고 추가 처리할 가능성 차단.

### sw.js 템플릿

```js
const CACHE_NAME = "app-shell";   // 영구. 절대 rename.
const STATIC_CACHE = "app-static";
const HTML_CACHE = "app-html";

const PRECACHE_URLS = [
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  // 인증 필요 HTML 라우트는 절대 precache 안 함 (addAll 원자성 깨짐)
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(PRECACHE_URLS)));
  self.skipWaiting();
});

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

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  if (!event.request.url.startsWith(self.location.origin)) return;

  // /_next/static/ → Cache First (content-hash 파일명, 영구 불변)
  if (event.request.url.includes("/_next/static/")) {
    event.respondWith(staticCacheFirst(event));
    return;
  }

  // RSC payload / server actions / API: 항상 네트워크
  if (event.request.url.includes("/_next/") || event.request.url.includes("/api/")) return;

  // HTML navigation → SWR
  if (event.request.mode === "navigate" || event.request.destination === "document") {
    event.respondWith(staleWhileRevalidateHTML(event));
    return;
  }

  // 기타 (이미지, 폰트 등) → Network First with cache fallback
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        caches.open(CACHE_NAME).then((c) => c.put(event.request, response.clone()));
        return response;
      })
      .catch(() =>
        caches.match(event.request).then((c) => c ?? new Response("Offline", { status: 503 }))
      )
  );
});

async function staticCacheFirst(event) {
  const request = event.request;
  try {
    const cached = await caches.match(request, { ignoreVary: true, ignoreMethod: true });
    if (cached) return cached;
    const response = await fetch(request);
    if (response && response.ok) {
      event.waitUntil(
        caches.open(STATIC_CACHE).then((c) => c.put(request, response.clone()))
      );
    }
    return response;
  } catch {
    return new Response("fetch error", { status: 502 });
  }
}

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
  const url = new URL(request.url);
  const cacheKey = url.origin + url.pathname;
  const cached =
    (await cache.match(cacheKey, { ignoreVary: true, ignoreMethod: true })) ||
    (await cache.match(request, { ignoreSearch: true, ignoreVary: true, ignoreMethod: true }));

  const networkFetch = fetch(request)
    .then(async (response) => {
      if (response && response.status === 200) {
        try {
          const clean = await makeCleanResponseForCache(response);
          await cache.put(cacheKey, clean);
        } catch {}
      }
      return response;
    })
    .catch(() => null);

  if (cached) {
    event.waitUntil(networkFetch.catch(() => {}));
    return cached;
  }

  const fresh = await networkFetch;
  if (fresh) return fresh;
  return new Response("Offline", { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });
}
```

### SW 등록 (절대 useEffect 로 하지 말 것)

`app/layout.tsx` body 안에 inline `<Script>`:

```tsx
<Script
  id="sw-register"
  strategy="afterInteractive"
  dangerouslySetInnerHTML={{
    __html: `
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', function() {
          navigator.serviceWorker.register('/sw.js').catch(function() {});
        });
      }
      if (navigator.storage && typeof navigator.storage.persist === 'function') {
        navigator.storage.persist().catch(function() {});
      }
      // iOS 가 IDB 사용 origin 을 stateful 로 분류해 SW/Cache evict 우선순위 낮춤 (가설).
      // push 가 없는 앱이라도 최소 IDB 1회 쓰기로 시도.
      try {
        var req = indexedDB.open('app_keepalive', 1);
        req.onupgradeneeded = function(e) {
          var db = e.target.result;
          if (!db.objectStoreNames.contains('signals')) db.createObjectStore('signals');
        };
        req.onsuccess = function(e) {
          try {
            var db = e.target.result;
            var tx = db.transaction('signals', 'readwrite');
            tx.objectStore('signals').put(Date.now(), 'lastOpen');
          } catch (_) {}
        };
      } catch (_) {}
    `,
  }}
/>
```

useEffect 안에서 등록하면 하이드레이션 끝나야 register 호출 → SW 업데이트 늦게 활성 → 첫 진입 옛 SW 사용 케이스 발생.

### manifest.json

```json
{
  "name": "App Name",
  "short_name": "App",
  "description": "...",
  "start_url": "/home",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#1e3a5f",
  "orientation": "portrait",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

---

## 5. Caching Architecture (3-tier)

```
┌──────────────────────────────────────────────────────────┐
│ 1. localStorage (영구)                                   │
│    - 키: app_home_v1:{userId}, app_log_v1:{userId}, ... │
│    - SSR 안전, 콜드 reopen 시 첫 페인트 데이터 출처     │
│    - userId 별 격리, schemaVersion 검증, LRU cleanup     │
└──────────────────────────────────────────────────────────┘
            ↕  (자동 영속화: 메모리 setter 가 호출될 때)
┌──────────────────────────────────────────────────────────┐
│ 2. logStore (모듈 싱글톤 in-memory)                      │
│    - SPA 세션 내 탭 간 즉시 공유                         │
│    - 각 setter (setRecentLogs, setAllLogs, setLog 등)   │
│      가 persistXxxCacheIfReady() 자동 호출              │
└──────────────────────────────────────────────────────────┘
            ↕  (백그라운드 fetch 로 갱신)
┌──────────────────────────────────────────────────────────┐
│ 3. Server (Supabase via Server Actions)                  │
│    - 마운트 시 백그라운드 1회 fetch                      │
│    - 실패 시 캐시 그대로 유지 (silent)                   │
└──────────────────────────────────────────────────────────┘
```

### log-store.ts 핵심 패턴

```ts
"use client";
const HOME_CACHE_KEY_PREFIX = "app_home_v1:";
const HOME_CACHE_SCHEMA_VERSION = 1;

class LogStore {
  private currentUserId: string | null = null;
  // ... 메모리 필드

  // setter 들이 매번 자동 영속화 → 컴포넌트가 saveHomeCache 명시 호출 안 해도 됨
  setLog(log) {
    /* 메모리 업데이트 */
    this.persistHomeCacheIfReady();
    this.persistGraphCacheIfReady();
  }

  private persistHomeCacheIfReady() {
    if (!this.currentUserId) return;
    if (!this.recentLogs) return;
    this.saveHomeCache(this.currentUserId, this.recentLogs, this.computeActive());
  }

  saveHomeCache(userId, recentLogs, activeLog) {
    if (typeof window === "undefined") return;
    try {
      const record = { userId, recentLogs, activeLog, cachedAt: Date.now(), schemaVersion: 1 };
      localStorage.setItem(HOME_CACHE_KEY_PREFIX + userId, JSON.stringify(record));
    } catch { /* quota 등 무시 */ }
  }

  loadHomeCache(userId) {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(HOME_CACHE_KEY_PREFIX + userId);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed.userId !== userId) return null;
      if (parsed.schemaVersion !== HOME_CACHE_SCHEMA_VERSION) {
        localStorage.removeItem(HOME_CACHE_KEY_PREFIX + userId);
        return null;
      }
      if (!Array.isArray(parsed.recentLogs)) return null;
      return { recentLogs: parsed.recentLogs, activeLog: parsed.activeLog ?? null };
    } catch {
      return null;
    }
  }
}

export const logStore = new LogStore();
```

### 사용자 전환 (logout / 계정 교체)

- **인메모리만 reset.** localStorage 는 절대 자동 삭제 안 함.
- userId 별 키 격리로 자연 보호. 명시 삭제는 reset/계정삭제 핸들러에서만.

---

## 6. Container 패턴 (familyTime ChatRoom 패턴)

### 핵심 원칙

1. **useState 초기값을 절대 `undefined` 로 두지 않음.** 빈 배열, null, 또는 캐시 데이터로 시작.
2. **useState 초기화 함수 안에서 localStorage 동기 읽기.** useEffect 로 비동기 읽으면 한 번 빈 렌더 후 데이터 채워짐 → 깜빡임.
3. **`isLoading` 스켈레톤 분기 없음.** 빈 상태도 자연스러운 UI 로 그림.
4. **마운트 시 useEffect 에서 fetchFresh 1회 + 결과로 메모리 + UI + 로컬스토리지 동시 갱신.**

### 템플릿

```tsx
"use client";

interface Props {
  userId: string | null;
}

export function HomeContainer({ userId }: Props) {
  // bootCache: 동기 localStorage 읽기. SSR 안전.
  const [bootCache] = useState<{ recentLogs: Item[]; activeLog: Item | null } | null>(() => {
    if (typeof window === "undefined" || !userId) return null;
    try {
      return logStore.loadHomeCache(userId);
    } catch {
      return null;
    }
  });
  const [activeLog, setActiveLog] = useState<Item | null>(bootCache?.activeLog ?? null);
  const [recentLogs, setRecentLogs] = useState<Item[]>(bootCache?.recentLogs ?? []);

  useEffect(() => {
    // 회귀 방지: bootCache 적중 시 logStore (메모리) 도 즉시 채움
    // → 다른 탭이 같은 데이터를 logStore.getXxx() 로 읽을 때 빈 캐시 미스 방지
    if (bootCache) {
      logStore.setRecentLogs(bootCache.recentLogs);
      if (bootCache.activeLog) logStore.setLog(bootCache.activeLog);
    }

    // 백그라운드 fresh fetch (실패 시 silent — 캐시 데이터 유지)
    actionGetInitialData()
      .then((data) => {
        const newActive = data.firstUnclosed ?? data.todayLog ?? null;
        setRecentLogs(data.recentLogs);
        setActiveLog(newActive);
        logStore.setRecentLogs(data.recentLogs); // ← 이게 자동으로 localStorage 도 영속화
        if (data.todayLog) logStore.setLog(data.todayLog);
      })
      .catch(() => {});

    // 다른 탭용 데이터 즉시 프리페치 (setTimeout 사용 금지)
    actionGetPrefetchData()
      .then((res) => {
        logStore.setWeeklyLogs(res.w);
        logStore.setAllLogs(res.all);
        // ... 자동으로 각 캐시 localStorage 에도 저장됨
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <HomeContent todayLog={activeLog} recentLogs={recentLogs} />;
}
```

### Empty State 문구

빈 상태도 "로딩 중" 느낌이 들도록. "당신의 건강 상태를 이해 중입니다" 같은 친근한 메시지. "데이터가 없습니다" 같이 단정적인 표현 금지 (실제로는 cache 가 로드 중인 케이스가 다수).

---

## 7. 탭 페이지 / 레이아웃 / 네비게이션

### 루트 layout (app/layout.tsx)

- **`async` 안 됨. await 안 함.** SSR HTML 응답 늦추면 콜드 진입 직격탄.
- inline SW 등록 script + storage.persist() + IDB keep-alive 만.

### 공통 그룹 layout (app/(tabs)/layout.tsx)

- `getAuthUser()` 만 await (React cache 라 빠름, userId 필요)
- **getSettings 같은 추가 Supabase 쿼리 절대 await 하지 말 것** (캐시 미스 시 respEnd +500ms)
- `last_seen_at` 같은 활성 사용자 추적은 `import { after } from "next/server"` 로 응답 후 비동기 처리

```tsx
import { after } from "next/server";

export default async function TabsLayout({ children }) {
  let userId: string | null = null;
  try {
    const user = await getAuthUser();
    userId = user?.id ?? null;
    if (userId) {
      after(async () => {
        const adminClient = createAdminClient();
        await adminClient
          .from("user_profiles")
          .update({ last_seen_at: new Date().toISOString() })
          .eq("user_id", userId);
      });
    }
  } catch {}
  return (
    <TabsProviders initialSettings={null} userId={userId}>
      <div className="pb-20">{children}<BottomNav /></div>
    </TabsProviders>
  );
}
```

### 각 탭 페이지

자기 페이지에 필요한 것만 server-side await. `userId` 는 prop 으로 컨테이너에 전달.

### BottomNav

`next/link` + `prefetch={true}` 사용. 클라이언트 컴포넌트로 두고 `usePathname` 으로 활성 탭 표시.

> **참고:** familyTime 은 server 컴포넌트 + 순수 `<a href>` 사용함. 이건 풀-페이지 reload 모델로 전환되어 메모리 싱글톤이 매번 리셋되는 사이드이펙트가 큼. SPA 모델 (`<Link>`) + 메모리 + localStorage 이중 캐시가 일반적 사용에 더 적합.

### loading.tsx 처리

- **Container 가 bootCache 패턴으로 빈 상태도 자연스럽게 그리면 loading.tsx 불필요.**
- 두면 라우트 전환 시 스켈레톤 무조건 1회 노출 → 시각 깜빡임. 두지 말 것.

---

## 8. Server / Client 컴포넌트 분리 규칙

- **server 기본**, `"use client"` 는 인터랙션·상태·effect 가 필요한 경우만.
- **`actions/` 아래의 server action 이 유일한 클라이언트→서버 통로.** services 직접 호출 금지.
- **DB 컬럼 snake_case ↔ TS camelCase 변환은 service 의 mapper 함수.**
- **서버 actions 에서 AI SDK (`ai`, `@ai-sdk/openai`) import 가능, 클라이언트에서는 절대 import 금지** (1MB+ 청크 leak).

---

## 9. SettingsProvider (글로벌 설정 컨텍스트) 패턴

- `initialSettings` prop 받지만 **null 도 허용.** 클라이언트 fallback 경로 필수.
- 자체 fallback: localStorage 동기 읽기 → server action 갱신.
- 다른 컴포넌트 (예: NoticePopup) 는 prop 의존 말고 `useSettings()` 안에서 `isLoaded + onboardingComplete` 검사 후 작동.

```tsx
const [settings, setSettings] = useState<Settings>(() => initialSettings ?? DEFAULT_SETTINGS);
const [isLoaded, setIsLoaded] = useState(initialSettings != null);

useEffect(() => {
  if (initialSettings != null) {
    if (initialSettings.onboardingComplete) writeCachedSettings(initialSettings, uid);
    return;
  }
  const cached = readCachedSettings(uid);
  if (cached) { setSettings(cached); setIsLoaded(true); }
  actionGetSettings().then((loaded) => {
    if (loaded.onboardingComplete) { setSettings(loaded); writeCachedSettings(loaded, uid); }
  }).finally(() => setIsLoaded(true));
}, []);
```

---

## 10. Supabase 세팅

### 클라이언트 분리

```
lib/supabase/
├── server.ts    # createClient() — cookies 컨텍스트, React cache 로 getAuthUser 래핑
├── client.ts    # createBrowserClient — 거의 안 씀 (모든 데이터는 server action)
└── admin.ts     # service_role — after() 콜백 등 응답 후 컨텍스트에서만
```

### server.ts 예시

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );
}

// React cache → 한 request 안에서 여러 번 호출돼도 1회만 실제 실행
export const getAuthUser = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
});
```

### RLS 정책 원칙

- 모든 테이블에 `user_id` 컬럼 + `auth.uid() = user_id` 정책.
- service_role 은 admin 서버 작업 (`after` 콜백 등) 에만.

### Auth 흐름

- Server Actions 안에서만 auth 변경 (signup, signin, signout).
- 클라이언트 측에서 직접 supabase auth 호출 거의 안 함.
- 미들웨어 (`middleware.ts`) 로 인증 라우트 보호.

---

## 11. Vercel 세팅

### 환경 변수

```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...  (NEXT_PUBLIC 안 붙임 — 서버 전용)
NEXT_PUBLIC_BUILD_TIME=$VERCEL_GIT_COMMIT_DATE  (헤더 표시용)
NEXT_PUBLIC_COMMIT_SHA=$VERCEL_GIT_COMMIT_SHA   (헤더 표시용)
```

### Project Settings

- **Framework Preset**: Next.js
- **Node.js Version**: 22.x 또는 24.x
- **Build Command**: `pnpm build` (기본값)
- **Install Command**: `pnpm install --frozen-lockfile`
- **Functions Region**: 사용자 가까운 곳 (한국이면 `hnd1` Tokyo). Supabase 리전과 일치시키면 latency 최소.
- **Streaming / SSR**: 기본값 사용 (force-dynamic 페이지는 명시).

### `vercel.json` (선택)

```json
{
  "headers": [
    {
      "source": "/sw.js",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=0, must-revalidate" },
        { "key": "Service-Worker-Allowed", "value": "/" }
      ]
    },
    {
      "source": "/manifest.json",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=3600" }]
    }
  ]
}
```

---

## 12. 빌드 / 번들 주의사항

### Critical Path 에 절대 두지 말 것

- **recharts** — 360KB raw. 차트가 필요하면 hand-rolled SVG 또는 lighter lib.
- **@uiw/react-md-editor** — parse5 등 1MB+. dynamic import + ssr:false + 별도 라우트.
- **html-to-image** — dynamic import 함수 호출 시점에만.
- **AI SDK (`ai`, `@ai-sdk/*`)** — server action 안에서만 사용. 클라이언트 import 검색으로 leak 확인.

### dynamic import 패턴

```tsx
const HeavyChart = dynamic(() => import("./heavy-chart"), {
  ssr: false,
  loading: () => <div className="h-[300px] bg-secondary rounded-xl" />, // CLS 방지
});
```

### 번들 확인

```bash
pnpm build  # 출력에 First Load JS 표시 — 페이지별 추적
ls -lah .next/static/chunks  # 큰 청크 식별
```

목표: home 페이지 First Load JS < 130KB (gzip).

---

## 13. 안티패턴 (somalog 회귀에서 학습)

| 안티패턴 | 결과 | 해법 |
|---|---|---|
| SW 캐시 이름에 버전 (`-v3`) | 배포마다 옛 캐시 통째 삭제 → 콜드 흰화면 | 영구 이름 |
| `cache.put(req, response.clone())` 만 호출 | iOS 가 SW 죽여서 미완료 | `event.waitUntil(cache.put(...))` |
| `request.mode === "navigate"` 만 체크 | iOS PWA 첫 진입 누락 | `\|\| destination === "document"` 추가 |
| `cache.match(req)` 기본 | Next.js force-dynamic 의 `vary` 헤더로 매치 거부 | `{ ignoreVary: true, ignoreMethod: true }` |
| `response.clone()` 그대로 put | `cache-control: no-store` 가 iOS 후속 처리에 영향 | `makeCleanResponseForCache` 로 헤더 strip |
| SW 등록을 React useEffect 안에서 | 하이드레이션 끝나야 register → SW 업데이트 늦음 | layout body 안 inline `<Script>` + `window.load` |
| `(tabs)/layout` 에서 `await getSettings()` | 캐시 미스 시 respEnd +500ms | 클라이언트 fallback 으로 이전 |
| 컨테이너 `useState<T[]>(undefined)` + `isLoading` 분기 | 매 라우트 진입 시 스켈레톤 1회 | `useState<T[]>([])`, 빈 상태도 정상 UI |
| `dynamic(..., { ssr: false, loading: <... animate-pulse /> })` 의 placeholder 크기가 실 콘텐츠와 다름 | CLS (레이아웃 이동) | placeholder 정확한 px 맞춤 |
| `setTimeout(prefetch, 2000)` | 진입 직후 다른 탭으로 이동 시 캐시 미스 | 마운트 즉시 fire |
| log/graph 같은 탭 데이터 메모리만 캐시 | 콜드 reopen 시 빈 상태 | 모든 탭 데이터 localStorage 영속화 |
| `cache.put` 시점에 home 캐시만 갱신 | input 저장 후 cold reopen 시 home stale | 모든 setter (`setLog`, `setRecentLogs`) 가 모든 관련 캐시 자동 영속화 |
| 클라이언트에서 직접 service 호출 | RLS 우회 가능성 + Supabase 클라이언트 번들 leak | server action 만 사용 |
| AI SDK 를 클라이언트 컴포넌트에서 import | 1MB+ 청크 leak | server action 안에서만 |
| `loading.tsx` 만들어 둠 | 라우트 전환 시 스켈레톤 노출 | 컨테이너 bootCache 패턴이면 불필요 |
| recharts 를 `/home` critical path | 콜드 진입 +360KB | hand-rolled SVG 또는 lighter |

---

## 14. PWA 최적화 체크리스트 (앱 launch 전)

- [ ] sw.js 가 위 템플릿 그대로 (이름 영구, navigate||document, waitUntil, ignoreVary, headers strip)
- [ ] SW 등록이 layout body inline `<Script strategy="afterInteractive">` 안
- [ ] `navigator.storage.persist()` 호출됨
- [ ] IDB keep-alive 한 줄 쓰기 있음
- [ ] manifest.json: `start_url`, `display: standalone`, icons (any maskable)
- [ ] viewport meta: `width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no` (`viewportFit: 'cover'` 는 신중 — safe-area 처리 필요)
- [ ] 모든 컨테이너 가 bootCache 패턴 (localStorage 동기 읽기)
- [ ] logStore singleton 의 setter 가 자동 영속화 호출
- [ ] 루트/공통 layout 에 await 최소화
- [ ] critical path (home) 에 무거운 라이브러리 없음
- [ ] loading.tsx 안 만들었거나 비어 있음
- [ ] BottomNav `<Link prefetch={true}>`
- [ ] 클라이언트에서 AI SDK / supabase-js 직접 import 없음 (grep 으로 확인)

---

## 15. 테스트 구성

### Vitest (유닛)

```
tests/
├── setup.ts
├── fixtures/mock-data.ts  # createMockSupabaseClient 등
└── unit/
    ├── utils/             # date, format, compute
    └── services/          # mock Supabase 체이닝 패턴
```

Supabase mock: 메서드 체이닝은 `vi.fn().mockReturnThis()`, 터미널은 `mockResolvedValue()`.

### Playwright (E2E)

```
e2e/
├── auth.setup.ts          # 로그인 → storageState 저장
├── global-setup.ts        # Admin 으로 테스트 유저 생성
├── helpers/
│   ├── supabase-admin.ts  # createTestUser, seedDailyLogs
│   └── test-ids.ts        # data-testid 상수
├── fixtures/              # auth + seeded 3-tier
├── pages/                 # POM
└── tests/<area>/*.spec.ts
```

3개 프로젝트: `setup`, `unauthenticated`, `authenticated`. authenticated 는 storageState 재사용.

---

## 16. 결과 (somalog 검증)

- 콜드 진입: 5-8초 → 1-2초
- 탭 이동: 0.1초 유지 (SPA `<Link>` + 메모리 + localStorage 이중 캐시)
- 입력 후 cold reopen 시 즉시 반영 (자동 영속화)
- 다음 배포 시에도 회귀 없음 (영구 캐시 이름)

이 BP 따라 다음 앱 시작 시 위 결과로 출발 가능.
