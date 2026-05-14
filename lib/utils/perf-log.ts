/**
 * PWA 첫 진입 성능 계측 헬퍼.
 * NEXT_PUBLIC_PERF_LOG=1 환경에서만 동작. production 빌드에서는 dead code elimination.
 *
 * DevTools 콘솔에서 [somalog-perf] 접두사로 필터링 가능.
 */

const ENABLED = process.env.NEXT_PUBLIC_PERF_LOG === "1";

export function perfLog(label: string, extra?: Record<string, unknown>): void {
  if (!ENABLED) return;
  if (typeof performance === "undefined") return;
  const ts = performance.now().toFixed(1);
  if (extra) {
    // eslint-disable-next-line no-console
    console.log(`[somalog-perf] ${ts}ms ${label}`, extra);
  } else {
    // eslint-disable-next-line no-console
    console.log(`[somalog-perf] ${ts}ms ${label}`);
  }
}

/** 5초 뒤 1회 resource 요약을 출력. _next/static 청크의 출처(memory/disk/sw/network) 추정. */
export function perfDumpResources(): void {
  if (!ENABLED) return;
  if (typeof window === "undefined") return;
  setTimeout(() => {
    try {
      const entries = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
      const summary = entries
        .filter((e) => e.name.includes("/_next/static/") || e.name.endsWith(".js") || e.name.endsWith(".css"))
        .map((e) => {
          let source: "memory" | "disk" | "sw" | "network" = "network";
          if (e.transferSize === 0 && e.decodedBodySize > 0) source = "memory";
          else if (e.transferSize > 0 && e.transferSize < 300) source = "disk";
          const deliveryType = (e as PerformanceResourceTiming & { deliveryType?: string }).deliveryType;
          if (deliveryType === "cache") source = "disk";
          // serviceWorker 출처 추정 (workerStart > 0)
          const workerStart = (e as PerformanceResourceTiming & { workerStart?: number }).workerStart;
          if (workerStart && workerStart > 0) source = "sw";
          return {
            url: e.name.split("/").slice(-2).join("/"),
            duration: Math.round(e.duration),
            transferSize: e.transferSize,
            decodedBodySize: e.decodedBodySize,
            source,
          };
        });
      // eslint-disable-next-line no-console
      console.log(`[somalog-perf] resources (n=${summary.length})`, summary);
    } catch {
      // 무시
    }
  }, 5000);
}
