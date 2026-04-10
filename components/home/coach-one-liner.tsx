"use client";

import { useState } from "react";
import { MessageCircle, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface CoachOneLinerProps {
  coachName: string;
  /** dailySummary(긴 총평)를 우선으로, 없으면 oneLiner(짧은 한마디) 사용 */
  dailySummary?: string | null;
  oneLiner?: string | null;
  isYesterday?: boolean;
}

export function CoachOneLiner({
  coachName,
  dailySummary,
  oneLiner,
  isYesterday = false,
}: CoachOneLinerProps) {
  const [expanded, setExpanded] = useState(false);

  const text = dailySummary || oneLiner;
  if (!text) return null;

  // dailySummary가 있을 때만 더보기 기능 활성화
  const canExpand = !!dailySummary;

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
          <span className="text-sm font-semibold">{coachName}의 하루평가</span>
          {isYesterday && (
            <span className="text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
              어제 기준
            </span>
          )}
        </div>
      </div>

      {/* 본문 */}
      <p
        className={cn(
          "text-sm text-foreground leading-relaxed whitespace-pre-line transition-all duration-300",
          canExpand && !expanded && "line-clamp-2"
        )}
      >
        {text}
      </p>

      {/* 더보기 / 접기 버튼 */}
      {canExpand && (
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
