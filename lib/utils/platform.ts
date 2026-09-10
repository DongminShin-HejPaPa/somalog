/**
 * iOS(WebKit) 전용 우회가 필요한 환경인지 판별한다.
 *
 * 캐럿 좌표 재동기화, 하드웨어 키보드 액세서리 바 여백 확보 같은 처리는
 * iOS WebKit 의 동작을 보정하기 위한 것이다. 안드로이드(Chrome)에서는
 * - 커서를 콘텐츠와 같이 그리므로 재동기화가 필요 없고,
 * - blur() 는 소프트 키보드를 닫아버리는데 focus() 로는 (사용자 제스처 없이)
 *   다시 열 수 없어 오히려 입력이 끊긴다.
 * 그래서 이 판별로 iOS 에서만 켠다.
 */
export function isIOSWebKit(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return true;
  // iPadOS 13+ 는 UA 가 Macintosh 로 보고된다 — 멀티터치 지원으로 구분한다.
  return /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
}
