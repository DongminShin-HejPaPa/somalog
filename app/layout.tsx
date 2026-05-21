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
            `,
          }}
        />
      </body>
    </html>
  );
}
