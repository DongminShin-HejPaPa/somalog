/**
 * 앱 진입 탭 라우팅 (홈 vs 입력).
 *
 * 규칙 (사용자 명세):
 * - KST 기준 **당일 첫 접속**이면 → 홈 탭
 * - 오늘 **입력이 완료**(= 오늘 로그 마감)되었으면 → 홈 탭
 * - 그 외 (오늘 이미 접속했는데 아직 마감 안 됨) → 입력 탭
 *
 * ## 속도 제약
 * 이 판정은 **네트워크를 절대 타지 않는다.** 판정 입력값 두 개는 모두
 * localStorage 문자열이고, 실제 분기는 `app/layout.tsx` 의 beforeInteractive
 * 인라인 스크립트가 문서 파싱 시점(= Next 번들 실행 전)에 동기로 수행한다.
 * 그래서 "홈으로 간다" 경로는 현재와 **바이트 단위로 동일한** 코드 경로다.
 *
 * "입력 탭으로 간다" 경로만 문서 교체(`location.replace`)가 한 번 더 발생하는데,
 * `/input` HTML 은 service worker 의 HTML_CACHE 에 미리 데워져 있어(sw.js 의
 * warmHtmlCache) 네트워크 없이 캐시에서 바로 나온다.
 *
 * ## 왜 인라인 스크립트인가
 * - middleware/서버 리다이렉트: SW 가 HTML 을 캐시에서 바로 주므로 콜드 진입에서
 *   서버까지 가지도 않는다. 서버 판정은 동작하지 않거나 네트워크 왕복을 되살린다.
 * - React 안에서 router.replace: RSC 페이로드 fetch(네트워크) 필요 → 느리다.
 * - 인라인 스크립트: localStorage 동기 읽기 2회. 사실상 0ms.
 *
 * ⚠️ 아래 상수/로직을 바꾸면 `app/layout.tsx` 의 인라인 스크립트도 같이 고쳐야 한다.
 *    (인라인 스크립트는 번들을 기다릴 수 없어 불가피하게 ES5 로 중복 작성되어 있고,
 *     이 파일의 `decideEntryRoute` 가 그 로직의 단위 테스트 대상이다.)
 */

/** 마지막으로 "홈 진입"이 기록된 KST 날짜 (YYYY-MM-DD). 인증된 홈 마운트에서만 기록. */
export const ENTRY_DATE_KEY = "somalog_entry_date";

/** 입력 완료(마감)된 KST 날짜 (YYYY-MM-DD). */
export const INPUT_DONE_KEY = "somalog_input_done_date";

/** 진입 판정이 개입하는 경로 — 그 외 경로(입력/기록/그래프/설정 등)는 손대지 않는다. */
export const ENTRY_PATHS = ["/", "/home"] as const;

export interface EntryRouteInput {
  /** 현재 문서 경로 */
  pathname: string;
  /** KST 기준 오늘 (YYYY-MM-DD) */
  today: string;
  /** localStorage 의 ENTRY_DATE_KEY 값 */
  entryDate: string | null;
  /** localStorage 의 INPUT_DONE_KEY 값 */
  inputDoneDate: string | null;
  /** 새로고침(reload) 여부 — 새로고침은 '접속'으로 보지 않는다 */
  isReload?: boolean;
}

/**
 * 진입 시 이동할 경로. `null` 이면 이동하지 않는다(= 현재 문서 그대로 홈).
 */
export function decideEntryRoute(input: EntryRouteInput): "/input" | null {
  const { pathname, today, entryDate, inputDoneDate, isReload } = input;

  // 홈 진입점이 아니면 개입하지 않는다.
  if (!(ENTRY_PATHS as readonly string[]).includes(pathname)) return null;

  // 홈에서 당겨서 새로고침했는데 입력 탭으로 튕기면 고장으로 느껴진다.
  if (isReload) return null;

  // 당일 첫 접속 → 홈.
  // entryDate 는 "인증된 홈 마운트"에서만 기록되므로, 비로그인/최초 설치 상태에서는
  // 항상 여기서 멈춘다(= 로그인 안 한 사용자를 입력 탭으로 보내지 않는다).
  if (entryDate !== today) return null;

  // 오늘 입력 완료(마감) → 홈.
  if (inputDoneDate === today) return null;

  return "/input";
}

/** KST(UTC+9) 기준 오늘 날짜. Intl 초기화 비용 없이 산술로 계산 — 인라인 스크립트와 동일 방식. */
export function kstToday(now: number = Date.now()): string {
  const k = new Date(now + 9 * 60 * 60 * 1000);
  const m = k.getUTCMonth() + 1;
  const d = k.getUTCDate();
  return `${k.getUTCFullYear()}-${m < 10 ? "0" : ""}${m}-${d < 10 ? "0" : ""}${d}`;
}

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * "오늘 홈에 접속했다"를 기록한다. **인증된 상태의 홈 마운트에서만** 호출한다.
 * 다음 콜드 진입부터 이 값이 판정에 쓰인다.
 */
export function markHomeEntry(): void {
  const s = storage();
  if (!s) return;
  try {
    s.setItem(ENTRY_DATE_KEY, kstToday());
  } catch {
    // 용량 초과 / 프라이빗 모드 등 — 판정만 못 할 뿐 앱 동작에는 영향 없음
  }
}

/**
 * 오늘 로그의 마감 여부를 진입 판정용 플래그에 반영한다.
 * `closed === true` → 오늘 날짜 기록, `false` → (오늘로 기록돼 있었다면) 해제.
 */
export function syncInputDone(date: string, closed: boolean): void {
  const s = storage();
  if (!s) return;
  try {
    const today = kstToday();
    if (date !== today) return;
    if (closed) {
      s.setItem(INPUT_DONE_KEY, today);
    } else if (s.getItem(INPUT_DONE_KEY) === today) {
      s.removeItem(INPUT_DONE_KEY);
    }
  } catch {
    // 무시
  }
}

/** 로그아웃 / 사용자 교체 / 계정 삭제 시 진입 판정 상태 초기화. */
export function clearEntryRouteState(): void {
  const s = storage();
  if (!s) return;
  try {
    s.removeItem(ENTRY_DATE_KEY);
    s.removeItem(INPUT_DONE_KEY);
  } catch {
    // 무시
  }
}
