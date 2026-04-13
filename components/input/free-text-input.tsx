"use client";

import { useState, useRef } from "react";
import { Send, Loader2 } from "lucide-react";
import { useKeyboardOffset } from "@/lib/hooks/use-keyboard-offset";

interface FreeTextInputProps {
  onSubmit: (text: string) => void;
  isSaving?: boolean;
  isClosed?: boolean;
}

export function FreeTextInput({ onSubmit, isSaving, isClosed }: FreeTextInputProps) {
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const keyboardOffset = useKeyboardOffset();

  // 키보드가 닫혀 있으면 bottom-14(56px, 내비게이션 바 위)
  // 키보드가 열리면 키보드 높이 + 8px 여백으로 올림
  const bottomOffset = keyboardOffset > 0 ? keyboardOffset + 8 : 56;

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
