"use client";

import { Send } from "lucide-react";

export function FreeTextInput() {
  return (
    <div className="fixed bottom-14 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-white border-t border-border px-4 py-2 z-40">
      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder="자유롭게 입력해보세요 (예: 아침은 샌드위치, 운동 했어)"
          className="flex-1 px-3 py-2.5 text-sm rounded-lg border border-border bg-secondary focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy/40 min-h-[44px]"
        />
        <button className="p-2.5 rounded-lg bg-navy text-white min-w-[44px] min-h-[44px] flex items-center justify-center">
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
