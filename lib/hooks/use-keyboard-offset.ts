import { useState, useEffect } from "react";
import { isIOSWebKit } from "@/lib/utils/platform";

/**
 * 블루투스(하드웨어) 키보드가 연결되면 소프트 키보드는 사라지지만
 * iOS 는 하단에 입력 액세서리 바(^ ˅ 완료)를 남긴다. 이 바 높이는
 * visualViewport 에 반영되지 않는 경우가 있어 최소 여백으로 보정한다.
 */
const ACCESSORY_BAR_HEIGHT = 56;

interface KeyboardOffsetOptions {
  /**
   * 소프트 키보드가 내려가도 액세서리 바만큼 최소 여백을 유지한다.
   * 하단 버튼이 바에 가리면 안 되는 바텀 시트에서만 켠다.
   * (iOS 전용 보정 — 안드로이드는 액세서리 바가 없고, 브라우저에 따라
   *  키보드가 레이아웃 뷰포트를 줄여 offset 이 0 으로 측정되기 때문에
   *  여기서 최소 여백을 잡으면 하단에 빈 공간만 생긴다)
   */
  accessoryBarFloor?: boolean;
}

/** 소프트 키보드를 띄우는 입력 요소인지 */
function isTextEntry(el: Element | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  if (el instanceof HTMLTextAreaElement) return true;
  if (el instanceof HTMLInputElement) {
    return !["range", "checkbox", "radio", "button", "submit", "reset", "file", "color"].includes(el.type);
  }
  return false;
}

/**
 * iOS Safari에서 키보드가 올라올 때 하단 콘텐츠가 가려지지 않도록
 * 키보드 높이(px)를 반환하는 훅.
 *
 * 바텀 시트, 모달 등에서 transform / padding / margin 에 적용한다.
 * 이 훅을 쓰면 새 바텀 시트를 추가할 때도 동일하게 키보드 회피가 보장된다.
 *
 * iOS 는 키보드가 뜨고 내려가는 동안 resize·scroll 을 연달아 쏘기 때문에
 * 측정은 프레임당 한 번으로 묶는다. (블루투스 키보드 전환 시 값이 여러 번
 * 튀면서 시트가 덜컹거리는 것을 막는다)
 */
export function useKeyboardOffset(options?: KeyboardOffsetOptions): number {
  const accessoryBarFloor = options?.accessoryBarFloor ?? false;
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    // 액세서리 바는 iOS 에만 있다 — 다른 환경에서 여백을 잡으면 시트가 떠 보인다.
    const useFloor = accessoryBarFloor && isIOSWebKit();

    let raf = 0;
    let current = -1;

    const measure = () => {
      raf = 0;
      const gap = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      const next =
        useFloor && isTextEntry(document.activeElement)
          ? Math.max(gap, ACCESSORY_BAR_HEIGHT)
          : gap;
      if (next === current) return;
      current = next;
      setOffset(next);
    };

    const schedule = () => {
      if (raf) return;
      raf = requestAnimationFrame(measure);
    };

    measure();
    vv.addEventListener("resize", schedule);
    vv.addEventListener("scroll", schedule);
    // 포커스가 바뀌면 액세서리 바 유무도 바뀌는데, 뷰포트 이벤트는 안 오는 경우가 있다.
    document.addEventListener("focusin", schedule);
    document.addEventListener("focusout", schedule);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      vv.removeEventListener("resize", schedule);
      vv.removeEventListener("scroll", schedule);
      document.removeEventListener("focusin", schedule);
      document.removeEventListener("focusout", schedule);
    };
  }, [accessoryBarFloor]);

  return offset;
}
