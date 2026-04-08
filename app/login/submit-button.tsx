"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      data-testid="login-submit"
      className="w-full h-11 mt-1 rounded-lg bg-navy text-white text-sm font-semibold hover:bg-navy/90 active:scale-[0.98] transition-all disabled:opacity-70 flex items-center justify-center gap-2"
      onPointerDown={(e) => {
        // iOS Safari에서 키보드가 열려있을 때 버튼을 누르면,
        // blur로 인해 키보드가 닫히면서 화면이 이동해 click 이벤트가 씹히는 현상 방지.
        // pointerDown 시점에 강제로 클릭 이벤트를 유도하거나 폼을 제출합니다.
        if (e.pointerType === "touch") {
          const form = e.currentTarget.closest("form");
          if (form) {
            // 브라우저 기본 동작이 꼬이지 않도록 setTimeout으로 살짝 띄워 제출
            setTimeout(() => {
              if (form.reportValidity()) {
                form.requestSubmit();
              }
            }, 50);
          }
        }
      }}
    >
      {pending ? (
        <>
          <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          로그인 중...
        </>
      ) : (
        "로그인"
      )}
    </button>
  );
}
