import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Soma Log",
  description: "AI 코치와 함께하는 다이어트 기록 앱",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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
      </body>
    </html>
  );
}
