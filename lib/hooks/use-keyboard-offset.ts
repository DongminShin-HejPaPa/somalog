import { useState, useEffect, useMemo } from "react";
import { isIOSWebKit } from "@/lib/utils/platform";

/**
 * 블루투스(하드웨어) 키보드가 붙으면 소프트 키보드 대신 하단에 입력 액세서리
 * 바(^ ˅ 완료)가 남는다. 이 바 높이만큼은 시트가 열리는 순간부터 미리 비워 둔다.
 *
 * "포커스가 들어온 뒤에 비우면" 이미 늦다 — iOS 는 포커스 시점의 입력창 좌표에
 * 커서를 고정해 두고 레이아웃이 움직여도 따라오지 않기 때문에, 포커스 이후에
 * 시트가 올라가면 커서만 원래 자리에 남는다. 그래서 실측값보다 넉넉하게 잡아
 * 포커스 전후로 레이아웃이 아예 바뀌지 않게 한다.
 */
const BAR_RESERVE = 88;

/**
 * 이 이상 벌어지면 소프트 키보드로 본다.
 * 액세서리 바는 후보줄이 붙어도 ~120px 안쪽이고, 소프트 키보드는 세로 290px 이상
 * (가로에서도 160px 이상)이라 그 사이에서 자른다.
 */
const SOFT_KEYBOARD_MIN = 140;

const INSET_STORAGE_KEY = "somalog:hwKeyboardInset";

/** 한 번 실측한 하드웨어 키보드 바 높이 — 다음 열림부터는 정확한 값으로 비운다. */
function readLearnedInset(): number {
  try {
    const raw = window.localStorage.getItem(INSET_STORAGE_KEY);
    if (!raw) return 0;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 && n < SOFT_KEYBOARD_MIN ? n : 0;
  } catch {
    return 0;
  }
}

function writeLearnedInset(value: number): void {
  try {
    window.localStorage.setItem(INSET_STORAGE_KEY, String(value));
  } catch {
    /* 프라이빗 모드 등 — 무시 */
  }
}

interface KeyboardOffsetOptions {
  /**
   * 텍스트 입력이 있는 바텀 시트에서 켠다. 시트가 열려 있는 동안 액세서리 바
   * 높이만큼 하단 여백을 항상 유지해, 포커스가 들어올 때 레이아웃이 움직이지
   * 않게 한다. (iOS 전용 — 안드로이드는 액세서리 바가 없고, 브라우저에 따라
   * 키보드가 레이아웃 뷰포트를 줄여 offset 이 0 으로 측정되므로 빈 공간만 생긴다)
   */
  accessoryBarFloor?: boolean;
}

/**
 * iOS Safari에서 키보드가 올라올 때 하단 콘텐츠가 가려지지 않도록
 * 키보드 높이(px)를 반환하는 훅.
 *
 * 바텀 시트, 모달 등에서 padding / margin 에 적용한다.
 * 이 훅을 쓰면 새 바텀 시트를 추가할 때도 동일하게 키보드 회피가 보장된다.
 *
 * iOS 는 키보드가 뜨고 내려가는 동안 resize·scroll 을 연달아 쏘기 때문에
 * 측정은 프레임당 한 번으로 묶는다.
 */
export function useKeyboardOffset(options?: KeyboardOffsetOptions): number {
  const accessoryBarFloor = options?.accessoryBarFloor ?? false;
  const [measured, setMeasured] = useState(0);

  // 예약 높이는 렌더 중에 동기로 결정한다. 측정(effect)까지 기다리면 시트가
  // 이미 포커스를 받은 뒤에 올라가고, 그 순간 커서가 원래 자리에 남는다.
  // 시트가 열리는 렌더(accessoryBarFloor: false → true)에서 학습값까지 반영한다.
  const reserve = useMemo(
    () =>
      accessoryBarFloor && typeof window !== "undefined" && isIOSWebKit()
        ? Math.max(BAR_RESERVE, readLearnedInset())
        : 0,
    [accessoryBarFloor]
  );

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const ios = isIOSWebKit();

    let raf = 0;
    let current = -1;

    const measure = () => {
      raf = 0;
      const gap = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));

      // 하드웨어 키보드 바 높이를 실측해 기억한다 (다음 열림의 예약 높이).
      if (ios && gap > 0 && gap < SOFT_KEYBOARD_MIN && gap > readLearnedInset()) {
        writeLearnedInset(gap);
      }

      if (gap === current) return;
      current = gap;
      setMeasured(gap);
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
  }, []);

  // 액세서리 바는 iOS 에만 있다 — 다른 환경에서 여백을 잡으면 시트가 떠 보인다.
  if (reserve === 0) return measured;

  // 하드웨어 키보드 영역(소프트 키보드가 아닌 구간)에서는 실측값을 쓰지 않고
  // 예약값으로 고정한다. 기종·입력기에 따라 바 높이가 달라도 포커스 전후로
  // 레이아웃이 절대 움직이지 않게 하는 것이 목적이다.
  // (실측값이 예약값보다 크면 그만큼 시트 아래쪽이 바에 가려지지만, 그 값은
  //  localStorage 에 학습해 다음 열림부터 정확히 비운다 — 움직임 0 을 우선한다)
  if (measured < SOFT_KEYBOARD_MIN) return reserve;
  return Math.max(measured, reserve);
}
