"use client";

import { useMemo } from "react";

/**
 * 외부 라이브러리 없는 경량 CSS 컨페티.
 * 40개 조각을 랜덤 위치/지연/색으로 떨어뜨린다. 번들 영향 0(순수 CSS+인라인 스타일).
 */
const COLORS = ["#fbbf24", "#ff6b6b", "#34d399", "#60a5fa", "#f472b6", "#a78bfa", "#fb923c", "#2dd4bf"];

export function Confetti({ count = 40 }: { count?: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 2.5,
        duration: 2.5 + Math.random() * 2,
        color: COLORS[i % COLORS.length],
        size: 6 + Math.random() * 6,
        rotate: Math.random() * 360,
      })),
    [count]
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {pieces.map((p) => (
        <span
          key={p.id}
          className="absolute top-[-5%] block animate-confetti-fall"
          style={{
            left: `${p.left}%`,
            width: `${p.size}px`,
            height: `${p.size * 0.4}px`,
            backgroundColor: p.color,
            transform: `rotate(${p.rotate}deg)`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            borderRadius: "1px",
          }}
        />
      ))}
    </div>
  );
}
