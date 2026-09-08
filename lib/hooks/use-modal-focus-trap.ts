import { useEffect, type RefObject } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/**
 * 모달 뒤쪽 컨텐츠를 전부 inert 로 만들고, 원복 함수를 돌려준다.
 * 조상 체인을 타고 올라가며 "모달을 품지 않은 형제"만 잠그기 때문에
 * 포털 없이도 문서 전체가 포커스·터치 대상에서 빠진다.
 */
function inertOutside(node: HTMLElement): () => void {
  const locked: HTMLElement[] = [];
  let current: HTMLElement = node;

  while (current !== document.body && current.parentElement) {
    for (const sibling of Array.from(current.parentElement.children)) {
      if (sibling === current) continue;
      if (!(sibling instanceof HTMLElement)) continue;
      if (sibling.hasAttribute("inert")) continue;
      sibling.setAttribute("inert", "");
      locked.push(sibling);
    }
    current = current.parentElement;
  }

  return () => locked.forEach((el) => el.removeAttribute("inert"));
}

/**
 * 모달 안에 키보드 포커스를 가둔다.
 *
 * 블루투스 키보드를 연결하면 iOS 는 하단에 이전/다음 필드 이동(^ ˅) 액세서리
 * 바를 띄우는데, 이 이동은 **문서 전체의 폼 요소**를 훑기 때문에 모달 밖(뒤
 * 페이지)의 입력창으로 포커스가 튀어버린다. 그러면 iOS 가 그 요소를 보이려고
 * 화면을 스크롤해서 시트까지 밀려 내려간다.
 *
 * - 뒤 컨텐츠 inert : 액세서리 바·Tab 이동 대상에서 제외
 * - focusin 되돌리기 : inert 를 무시하는 경우까지 대비한 2차 방어
 * - Tab / Shift+Tab : 모달 안에서 순환
 */
export function useModalFocusTrap(
  ref: RefObject<HTMLElement | null>,
  active: boolean
): void {
  useEffect(() => {
    if (!active) return;
    const root = ref.current;
    if (!root) return;

    const focusables = () =>
      Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => el.getClientRects().length > 0
      );

    let lastInside: HTMLElement | null = null;

    const onFocusIn = (e: FocusEvent) => {
      const target = e.target;
      if (target instanceof HTMLElement && root.contains(target)) {
        lastInside = target;
        return;
      }
      const fallback =
        lastInside && root.contains(lastInside) ? lastInside : focusables()[0];
      fallback?.focus();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement as HTMLElement | null;
      const inside = current != null && root.contains(current);

      if (e.shiftKey && (!inside || current === first)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (!inside || current === last)) {
        e.preventDefault();
        first.focus();
      }
    };

    const restoreInert = inertOutside(root);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("keydown", onKeyDown, true);

    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("keydown", onKeyDown, true);
      restoreInert();
    };
  }, [ref, active]);
}
