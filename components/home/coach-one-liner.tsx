"use client";

import { useState, useRef, useEffect } from "react";
import { MessageCircle, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface CoachOneLinerProps {
  /** dailySummary(긴 총평)를 우선으로, 없으면 oneLiner(짧은 한마디) 사용 */
  dailySummary?: string | null;
  oneLiner?: string | null;
  badgeText?: string;
}

export function CoachOneLiner({
  dailySummary,
  oneLiner,
  badgeText,
}: CoachOneLinerProps) {
  const [expanded, setExpanded] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);
  const [needsExpand, setNeedsExpand] = useState(false);

  const text = dailySummary || oneLiner;
  const canExpand = !!dailySummary;

  useEffect(() => {
    if (!canExpand || !textRef.current || !text) return;
    const el = textRef.current;
    setNeedsExpand(el.scrollHeight > el.clientHeight);
  }, [canExpand, text]);

  if (!text) return null;

  return (
    <div
      data-testid="home-coach-oneliner"
      className="mx-4 mt-4 p-4 bg-secondary/50 rounded-xl border border-border"
    >
      {/* 헤더 */}
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-full bg-navy flex items-center justify-center flex-shrink-0">
          <MessageCircle className="w-4 h-4 text-white" />
        </div>
        <div className="flex items-center gap-2 flex-1">
          <span className="text-sm font-semibold">Soma의 하루평가</span>
          {badgeText && (
            <span className="text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
              {badgeText}
            </span>
          )}
        </div>
      </div>

      {/* 본문 */}
      <p
        ref={textRef}
        className={cn(
          "text-sm text-foreground leading-relaxed whitespace-pre-line transition-all duration-300",
          canExpand && !expanded && "line-clamp-[8]"
        )}
      >
        {text}
      </p>

      {/* 더보기 / 접기 버튼 — 실제로 잘릴 때만 표시 */}
      {canExpand && needsExpand && (
        <button
          onClick={() => setExpanded((prev) => !prev)}
          className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {expanded ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" />
              접기
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" />
              더보기
            </>
          )}
        </button>
      )}
    </div>
  );
}
