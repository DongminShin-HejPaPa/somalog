import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Soma Log",
  description: "AI 코치와 함께하는 다이어트 기록 앱",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Soma Log",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#1e3a5f",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="bg-[#f8fafc] min-h-dvh">
        {/*
          진입 탭 라우팅 (홈 vs 입력). 규칙·근거는 lib/utils/entry-route.ts 참고.
          - KST 당일 첫 접속이거나 오늘 입력이 완료됐으면 → 홈 (아무것도 안 함)
          - 그 외에는 → /input

          **next/script 를 쓰지 않고 raw <script> 를 body 최상단에 둔다.**
          next/script 의 beforeInteractive 는 인라인 코드를 self.__next_s 큐에 넣어
          Next 런타임(main-app 청크)이 로드된 뒤에야 실행한다 — 프레임워크 번들을
          다 받고 나서 리다이렉트하면 이 기능의 존재 이유(속도)가 사라진다.
          raw 인라인 스크립트는 HTML 파싱 시점에 동기 실행돼, body 콘텐츠·RSC 플라이트
          스트림·하이드레이션 그 무엇보다 먼저 판정이 끝난다.

          판정 비용은 localStorage 읽기 2회 — 네트워크 0회, Intl 0회.
          "홈으로 간다" 경로는 조기 return 이라 기존 진입 속도와 완전히 동일하고,
          "입력으로 간다" 경로만 location.replace 로 문서를 바꾸는데 그 /input HTML 은
          sw.js 의 warmHtmlCache 가 미리 캐시에 채워둬 네트워크 없이 즉시 나온다.

          ⚠️ 로직 변경 시 lib/utils/entry-route.ts 의 decideEntryRoute 도 같이 고칠 것.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
            (function () {
              try {
                var p = location.pathname;
                if (p !== '/' && p !== '/home') return;

                /* 새로고침은 '접속'이 아니다 — 홈에서 당겨서 새로고침 시 입력 탭으로 튕기지 않도록. */
                var isReload = false;
                try {
                  var e = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
                  isReload = e ? e.type === 'reload'
                    : !!(performance.navigation && performance.navigation.type === 1);
                } catch (_) {}
                if (isReload) return;

                /* KST(UTC+9) 오늘 — Intl 초기화 비용을 피하려고 산술로 계산 */
                var k = new Date(Date.now() + 32400000);
                var mo = k.getUTCMonth() + 1, dy = k.getUTCDate();
                var today = k.getUTCFullYear() + '-' + (mo < 10 ? '0' : '') + mo + '-' + (dy < 10 ? '0' : '') + dy;

                /* entry date 는 '인증된 홈 마운트'에서만 기록된다 → 값이 오늘이 아니면 당일 첫 접속 */
                if (localStorage.getItem('somalog_entry_date') !== today) return;
                if (localStorage.getItem('somalog_input_done_date') === today) return;

                location.replace('/input');
              } catch (_) {}
            })();
          `,
          }}
        />
        <div className="mx-auto max-w-[480px] min-h-dvh bg-white relative shadow-sm">
          {children}
        </div>
        {/*
          SW 등록 + 영속 스토리지 요청을 inline script 로 처리 (familyTime sw-register 동일 패턴).
          이전엔 React useEffect 안에서 등록했는데, 그 경우 하이드레이션 끝나야 SW 가
          업데이트 감지·활성화돼 새 SW 로의 전환이 늦었음. inline + window.load 로 옮겨
          페이지 로드 직후 즉시 동작.
          storage.persist() 는 familyTime 이 push/IDB 로 암묵적으로 받는 iOS persistence
          를 우리는 표준 API 로 명시 요청. PWA-installed 사이트는 iOS Safari 16+ 에서
          프롬프트 없이 승인되는 것이 일반적.
        */}
        <Script
          id="sw-register"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js')
                    .then(function(reg) { console.log('[SW] 등록 완료:', reg.scope); })
                    .catch(function(err) { console.warn('[SW] 등록 실패:', err); });
                });
              }
              if (navigator.storage && typeof navigator.storage.persist === 'function') {
                navigator.storage.persist().then(function(granted) {
                  console.log('[storage] persist:', granted);
                }).catch(function() {});
              }
              /* IDB keep-alive 시그널 — 가설: iOS 가 IDB 사용 origin 을 stateful
                 한 앱으로 분류해 SW/Cache evict 우선순위에서 후순위로 둘 가능성.
                 familyTime 은 push state/messages 로 IDB 를 무겁게 쓰지만 우리는
                 push 가 없어 같은 시그널 없음. 최소 IDB 쓰기 한 번이라도 우대
                 받는지 시험. 효과 보장 안 됨. 실패 시 silent. */
              try {
                var req = indexedDB.open('somalog_keepalive', 1);
                req.onupgradeneeded = function(e) {
                  var db = e.target.result;
                  if (!db.objectStoreNames.contains('signals')) {
                    db.createObjectStore('signals');
                  }
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
      </body>
    </html>
  );
}
