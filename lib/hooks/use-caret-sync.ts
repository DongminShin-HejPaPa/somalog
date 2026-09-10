import { useEffect, useRef, type RefObject } from "react";

/** setSelectionRange 를 지원하는 입력 타입 (number·range 등은 예외를 던진다) */
const SELECTABLE_TYPES = new Set(["text", "search", "url", "tel", "password", ""]);

/** 소프트 키보드가 올라와 있다고 볼 최소 높이 — 이보다 작으면 하드웨어 키보드 */
const SOFT_KEYBOARD_MIN = 120;

function focusedField(
  root: HTMLElement | null
): HTMLInputElement | HTMLTextAreaElement | null {
  const el = document.activeElement;
  if (!root || !(el instanceof HTMLElement) || !root.contains(el)) return null;
  if (el instanceof HTMLTextAreaElement) return el;
  if (el instanceof HTMLInputElement && SELECTABLE_TYPES.has(el.type)) return el;
  return null;
}

function softKeyboardUp(): boolean {
  const vv = window.visualViewport;
  if (!vv) return false;
  return window.innerHeight - vv.height - vv.offsetTop > SOFT_KEYBOARD_MIN;
}

/**
 * iOS(WebKit)는 커서와 선택 영역을 웹 콘텐츠가 아니라 UIKit 레이어에 따로 그린다.
 * 그 좌표는 "선택이 바뀌었다"는 신호를 받을 때만 갱신되기 때문에, 포커스된 입력창이
 * 스크립트/레이아웃 때문에 움직이면 커서만 원래 자리에 남는다.
 * (시트를 키보드 위로 올릴 때, 칩이 늘어나 입력창이 위로 밀릴 때 등)
 *
 * 그래서 입력창이 실제로 움직였는지 감시하다가, 움직임이 멎으면 선택 영역을 다시
 * 지정해 좌표를 강제로 재계산시킨다. 한글 조합 중에는 조합이 깨지므로 건너뛰고
 * 조합이 끝난 뒤에 처리한다.
 */
export function useCaretSync(ref: RefObject<HTMLElement | null>, settleMs = 280): void {
  const baselineTop = useRef<number | null>(null);
  const composing = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // blur/focus 재동기화가 스스로를 다시 부르는 일이 없도록 최소 간격을 둔다.
  const lastRefocus = useRef(0);

  const schedule = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      const el = focusedField(ref.current);
      if (!el) {
        baselineTop.current = null;
        return;
      }
      // 한글 조합 중에 선택을 건드리면 조합이 깨진다 — 끝날 때까지 미룬다.
      if (composing.current) {
        schedule();
        return;
      }

      const top = el.getBoundingClientRect().top;
      // 기준점이 없다 = 방금 포커스가 들어왔다. 시트 등장 애니메이션 도중에 잡힌
      // 좌표가 그대로 굳는 경우가 있어 이때도 한 번 맞춰준다.
      const isFirstCheck = baselineTop.current === null;
      if (!isFirstCheck && Math.abs(top - baselineTop.current!) < 1) return;
      baselineTop.current = top;

      const start = el.selectionStart ?? el.value.length;
      const end = el.selectionEnd ?? start;
      const direction = el.selectionDirection ?? "none";

      // 하드웨어 키보드일 때는 blur/focus 가 화면에 아무 흔적을 남기지 않는다
      // (소프트 키보드가 없으니 열고 닫는 애니메이션이 없다) — 가장 확실한 재동기화.
      const now = Date.now();
      if (!softKeyboardUp() && now - lastRefocus.current > 1000) {
        lastRefocus.current = now;
        el.blur();
        el.focus({ preventScroll: true });
      }
      try {
        // 같은 값으로 다시 지정하면 무시될 수 있어 한 번 흔들었다가 되돌린다.
        el.setSelectionRange(0, 0);
        el.setSelectionRange(start, end, direction);
      } catch {
        /* 선택을 지원하지 않는 입력 — 무시 */
      }
    }, settleMs);
  };

  const scheduleRef = useRef(schedule);
  scheduleRef.current = schedule;

  // 렌더마다 확인 — 칩 추가/삭제, 글자 수에 따른 줄바꿈처럼 레이아웃이 바뀌는 경우까지 잡는다.
  // (타이머만 걸어두므로 useLayoutEffect 가 아니어도 되고, SSR 경고도 피한다)
  useEffect(() => {
    scheduleRef.current();
  });

  useEffect(() => {
    const trigger = () => scheduleRef.current();
    const onCompositionStart = () => {
      composing.current = true;
    };
    const onCompositionEnd = () => {
      composing.current = false;
      trigger();
    };
    const onFocusIn = () => {
      baselineTop.current = null; // 새 입력창 — 기준점 다시 잡기
      trigger();
    };

    const vv = window.visualViewport;
    document.addEventListener("compositionstart", onCompositionStart, true);
    document.addEventListener("compositionend", onCompositionEnd, true);
    document.addEventListener("focusin", onFocusIn, true);
    vv?.addEventListener("resize", trigger);
    vv?.addEventListener("scroll", trigger);
    window.addEventListener("orientationchange", trigger);

    return () => {
      document.removeEventListener("compositionstart", onCompositionStart, true);
      document.removeEventListener("compositionend", onCompositionEnd, true);
      document.removeEventListener("focusin", onFocusIn, true);
      vv?.removeEventListener("resize", trigger);
      vv?.removeEventListener("scroll", trigger);
      window.removeEventListener("orientationchange", trigger);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
}
