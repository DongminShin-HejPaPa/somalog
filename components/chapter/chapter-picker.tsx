"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, Layers, Flag, Trophy, Footprints } from "lucide-react";
import { cn } from "@/lib/utils";
import { useChapterScope } from "@/lib/contexts/chapter-scope-context";
import type { ChapterScope, ChapterScopeStatus } from "@/lib/types";

function fmt(date: string): string {
  const [y, m, d] = date.split("-");
  return `${y.slice(2)}.${m}.${d}`;
}

function rangeLabel(s: ChapterScope): string {
  if (s.status === "all") return "모든 기록";
  return `${fmt(s.displayStart)} ~ ${s.displayEnd ? fmt(s.displayEnd) : "진행 중"}`;
}

function StatusIcon({ status, className }: { status: ChapterScopeStatus; className?: string }) {
  switch (status) {
    case "all":
      return <Layers className={className} />;
    case "current":
      return <Flag className={className} />;
    case "achieved":
      return <Trophy className={className} />;
    case "attempt":
      return <Footprints className={className} />;
  }
}

export function ChapterPicker() {
  const { scopes, selectedId, selectedScope, setSelectedId } = useChapterScope();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        data-testid="chapter-picker-trigger"
        className={cn(
          "flex items-center gap-1.5 max-w-[60vw] pl-2.5 pr-2 py-1.5 rounded-full text-xs font-semibold transition-colors min-h-[36px]",
          "bg-secondary text-foreground border border-border hover:bg-secondary/70 active:bg-secondary/80"
        )}
      >
        <StatusIcon status={selectedScope.status} className="w-3.5 h-3.5 text-navy flex-shrink-0" />
        <span className="truncate">{selectedScope.label}</span>
        <ChevronDown
          className={cn("w-3.5 h-3.5 text-muted-foreground flex-shrink-0 transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <>
          {/* 배경 클릭 닫기 */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            role="listbox"
            data-testid="chapter-picker-list"
            className="absolute right-0 top-full mt-2 z-50 w-[min(82vw,300px)] max-h-[60vh] overflow-y-auto rounded-2xl border border-border bg-background shadow-xl p-1.5"
          >
            {scopes.map((s) => {
              const active = s.id === selectedId;
              return (
                <button
                  key={s.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  data-testid={`chapter-option-${s.id}`}
                  onClick={() => {
                    setSelectedId(s.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl text-left transition-colors",
                    active ? "bg-navy/8" : "hover:bg-secondary"
                  )}
                >
                  <span
                    className={cn(
                      "flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0",
                      s.status === "achieved"
                        ? "bg-amber-100 text-amber-600"
                        : s.status === "current"
                          ? "bg-navy/10 text-navy"
                          : "bg-secondary text-muted-foreground"
                    )}
                  >
                    <StatusIcon status={s.status} className="w-4 h-4" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold truncate">{s.label}</span>
                    <span className="block text-[11px] text-muted-foreground truncate">
                      {rangeLabel(s)}
                    </span>
                  </span>
                  {active && <Check className="w-4 h-4 text-navy flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
