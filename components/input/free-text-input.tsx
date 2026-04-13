"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Loader2 } from "lucide-react";

interface FreeTextInputProps {
  onSubmit: (text: string) => void;
  isSaving?: boolean;
  isClosed?: boolean;
}

export function FreeTextInput({ onSubmit, isSaving, isClosed }: FreeTextInputProps) {
  const [text, setText] = useState("");
  const [bottomOffset, setBottomOffset] = useState(56); // bottom-14 = 56px (nav bar height)
  const inputRef = useRef<HTMLInputElement>(null);

  // iOS 키보드가 열리면 visualViewport 크기가 줄어든다.
  // window.innerHeight - visualViewport.height ≈ 키보드 높이
  // 이 값을 bottom offset으로 사용해 입력창을 키보드 바로 위로 올린다.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const updatePosition = () => {
      const keyboardHeight = window.innerHeight - vv.height;
      setBottomOffset(keyboardHeight > 100 ? keyboardHeight + 8 : 56);
    };

    vv.addEventListener("resize", updatePosition);
    return () => vv.removeEventListener("resize", updatePosition);
  }, []);

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed || isSaving || isClosed) return;
    onSubmit(trimmed);
    setText("");
    inputRef.current?.focus();
  };

  const disabled = isSaving || isClosed;

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-white border-t border-border px-4 py-2 z-40"
      style={{ bottom: `${bottomOffset}px` }}
    >
      {isSaving && (
        <div className="flex items-center gap-1.5 text-xs text-navy mb-1.5 px-1">
          <Loader2 className="w-3 h-3 animate-spin" />
          텍스트 분석 중...
        </div>
      )}
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder={isClosed ? "마감된 날짜입니다" : "자유롭게 입력해보세요 (예: 아침은 샌드위치, 운동 했어)"}
          data-testid="free-text-input"
          disabled={disabled}
          className="flex-1 px-3 py-2.5 text-sm rounded-lg border border-border bg-secondary focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy/40 min-h-[44px] disabled:opacity-60"
        />
        <button
          onClick={handleSubmit}
          data-testid="free-text-submit"
          disabled={disabled}
          className="p-2.5 rounded-lg bg-navy text-white min-w-[44px] min-h-[44px] flex items-center justify-center disabled:opacity-60"
        >
          {isSaving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );
}
