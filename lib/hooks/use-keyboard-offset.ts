import { useState, useEffect } from "react";

/**
 * iOS Safari에서 키보드가 올라올 때 하단 콘텐츠가 가려지지 않도록
 * 키보드 높이(px)를 반환하는 훅.
 *
 * 바텀 시트, 모달 등에서 paddingBottom / marginBottom 에 적용한다.
 * 이 훅을 쓰면 새 바텀 시트를 추가할 때도 동일하게 키보드 회피가 보장된다.
 */
export function useKeyboardOffset(): number {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () =>
      setOffset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));

    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      setOffset(0);
    };
  }, []);

  return offset;
}
