"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import type { DailyLogUpdate } from "@/lib/types";

interface FreeTextInputProps {
  onSave: (update: DailyLogUpdate) => void;
}

function parseText(text: string): DailyLogUpdate {
  const result: DailyLogUpdate = {};

  const weight = text.match(/체중\s*([\d.]+)/);
  if (weight) result.weight = Math.round(parseFloat(weight[1]) * 10) / 10;

  const water = text.match(/수분\s*([\d.]+)/);
  if (water) result.water = parseFloat(water[1]);

  if (/운동\s*(했|함|Y)/i.test(text)) result.exercise = "Y";
  else if (/운동\s*(안\s*했|안\s*함|N)/i.test(text)) result.exercise = "N";

  if (/야식\s*(먹음|Y)/i.test(text)) result.lateSnack = "Y";
  else if (/야식\s*(안\s*먹음|N)/i.test(text)) result.lateSnack = "N";

  const energy = text.match(/체력\s*(여유|보통|피곤)/);
  if (energy) result.energy = energy[1] as "여유" | "보통" | "피곤";

  const breakfast = text.match(/아침(?:은)?\s*(.+?)(?:[,，\n]|$)/);
  if (breakfast) result.breakfast = breakfast[1].trim();

  const lunch = text.match(/점심(?:은)?\s*(.+?)(?:[,，\n]|$)/);
  if (lunch) result.lunch = lunch[1].trim();

  const dinner = text.match(/저녁(?:은)?\s*(.+?)(?:[,，\n]|$)/);
  if (dinner) result.dinner = dinner[1].trim();

  return result;
}

export function FreeTextInput({ onSave }: FreeTextInputProps) {
  const [text, setText] = useState("");

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const update = parseText(trimmed);
    if (Object.keys(update).length > 0) {
      onSave(update);
    }
    setText("");
  };

  return (
    <div className="fixed bottom-14 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-white border-t border-border px-4 py-2 z-40">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="자유롭게 입력해보세요 (예: 아침은 샌드위치, 운동 했어)"
          className="flex-1 px-3 py-2.5 text-sm rounded-lg border border-border bg-secondary focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy/40 min-h-[44px]"
        />
        <button
          onClick={handleSubmit}
          className="p-2.5 rounded-lg bg-navy text-white min-w-[44px] min-h-[44px] flex items-center justify-center"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
