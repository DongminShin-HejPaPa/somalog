"use client";

import { useState, type ReactNode } from "react";
import { Search, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DailyLog } from "@/lib/types";
import { actionRegenerateDailySummary } from "@/app/actions/log-actions";
import { useSettings } from "@/lib/contexts/settings-context";

interface LogListProps {
  logs: DailyLog[];
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  onRefresh?: () => Promise<void>;
  // 검색/필터는 서버 위임 — 상태는 부모(LogContainer)가 소유한다.
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  activeFilter: string | null;
  onActiveFilterChange: (f: string | null) => void;
  isSearching?: boolean;
  // 운동/야식/술 필터 활성 시 일별 로그 위에 표시할 누적평균 미니차트.
  metricChart?: ReactNode;
}

// 운동/야식/술 — 미니차트가 붙는 필터들.
const FILTERS = [
  { key: "unclosed", label: "마감안한날" },
  { key: "exercise", label: "운동한 날" },
  { key: "lateSnack", label: "야식먹은날" },
  { key: "alcohol", label: "술마신날" },
];

function getDayOfWeek(dateStr: string) {
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return days[new Date(dateStr).getDay()];
}

function fmtExercise(v: string | null): string {
  if (!v) return "";
  if (v === "Y") return "했음";
  if (v === "N" || v === "SKIP") return "안 했음";
  return v;
}

function fmtLateSnack(v: string | null): string {
  if (!v) return "";
  if (v === "Y") return "먹음";
  if (v === "N" || v === "SKIP") return "안 먹음";
  return v;
}

function didExercise(v: string | null) {
  return v !== null && v !== "N" && v !== "SKIP";
}

function RegenerateButton({ date, onRefresh }: { date: string; onRefresh?: () => Promise<void> }) {
  const [isLoading, setIsLoading] = useState(false);
  const handleClick = async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      await actionRegenerateDailySummary(date);
      if (onRefresh) {
        await onRefresh();
      }
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className="mt-2 text-xs text-navy font-medium underline disabled:opacity-50"
    >
      {isLoading ? "재생성 중..." : "총평 재생성"}
    </button>
  );
}

export function LogList({
  logs,
  hasMore,
  isLoadingMore,
  onLoadMore,
  onRefresh,
  searchQuery,
  onSearchQueryChange,
  activeFilter,
  onActiveFilterChange,
  isSearching,
  metricChart,
}: LogListProps) {
  const { settings } = useSettings();
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  // 검색/필터는 서버에서 이미 적용된 결과가 내려온다 — 클라이언트 재필터링 없음.
  const isSearchMode = searchQuery.trim().length > 0 || activeFilter !== null;

  const hasAlcohol = (log: DailyLog) => log.dinnerAlcohol === true || log.lateSnackAlcohol === true;

  return (
    <div data-testid="log-list">
      <div className="px-4 mb-3">
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="식사 내용 검색"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border border-border bg-secondary focus:outline-none focus:ring-2 focus:ring-navy/20 min-h-[44px]"
          />
        </div>

        <div className="flex gap-1.5 overflow-x-auto">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => onActiveFilterChange(activeFilter === f.key ? null : f.key)}
              className={cn(
                "px-2.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors",
                activeFilter === f.key
                  ? "bg-navy text-white"
                  : "bg-secondary text-muted-foreground border border-border"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* 운동/야식/술 필터 시 일별 로그 바로 위에 누적평균 추세 */}
      {metricChart && <div className="px-4 mb-2">{metricChart}</div>}

      <div className="px-4 space-y-2">
        {logs.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            {isSearching
              ? "불러오는 중..."
              : isSearchMode
                ? "조건에 맞는 기록이 없어요"
                : "아직 기록이 없어요. 입력 탭에서 첫 번째 기록을 시작해보세요."}
          </div>
        ) : (
          <>
            {logs.map((log) => {
              const isExpanded = expandedDate === log.date;
              return (
                <div
                  key={log.date}
                  data-testid={`log-item-${log.date}`}
                  className="border border-border rounded-xl overflow-hidden"
                >
                  <button
                    onClick={() => setExpandedDate(isExpanded ? null : log.date)}
                    className="w-full flex items-center justify-between px-4 py-3 min-h-[52px] text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-sm">
                        <span className="font-semibold">
                          {log.date.slice(5)} {getDayOfWeek(log.date)}
                        </span>
                        <span className="text-muted-foreground ml-1.5 text-xs">
                          D+{log.day}
                        </span>
                      </div>
                      {!log.closed && (
                        <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{log.weight ? `${log.weight}kg` : ""}</span>
                      <span>{didExercise(log.exercise) ? "운동" : ""}</span>
                      {hasAlcohol(log) && <span>🍺</span>}
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-border px-4 py-3 bg-secondary/30">
                      <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm mb-3">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">체중</span>
                          <span>{log.weight ?? ""} kg</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">3일 평균</span>
                          <span>{log.avgWeight3d ?? ""} kg</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">수분</span>
                          <span>{log.water ? `${log.water}L` : ""}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">운동</span>
                          <span>{fmtExercise(log.exercise)}</span>
                        </div>
                        {hasAlcohol(log) && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">술</span>
                            <span>Y</span>
                          </div>
                        )}
                      </div>

                      <div className="space-y-1 text-sm mb-3">
                        <div className="flex gap-2">
                          <span className="text-muted-foreground w-8 flex-shrink-0">아침</span>
                          <span>{log.breakfast ?? ""}</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-muted-foreground w-8 flex-shrink-0">점심</span>
                          <span>{log.lunch ?? ""}</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-muted-foreground w-8 flex-shrink-0">저녁</span>
                          <span>
                            {log.dinner ?? ""}
                            {log.dinnerAlcohol ? " 🍺" : ""}
                          </span>
                        </div>
                        {log.lateSnack && (
                          <div className="flex gap-2">
                            <span className="text-muted-foreground w-8 flex-shrink-0">야식</span>
                            <span>
                              {fmtLateSnack(log.lateSnack)}
                              {log.lateSnackAlcohol ? " 🍺" : ""}
                            </span>
                          </div>
                        )}
                        {settings.customField && log.customFieldValue != null && (
                          <div className="flex gap-2">
                            <span className="text-muted-foreground flex-shrink-0" style={{ width: "2rem" }}>
                              {settings.customField.name.slice(0, 2)}
                            </span>
                            <span>{log.customFieldValue}</span>
                          </div>
                        )}
                      </div>

                      {log.closed && log.dailySummary && (
                        <div className="mt-2">
                          <p className="text-xs font-medium text-navy mb-1">{settings.coachName}의 하루평가</p>
                          <p className="text-sm leading-relaxed text-muted-foreground">
                            {log.dailySummary}
                          </p>
                        </div>
                      )}

                      {log.closed && (
                        <RegenerateButton date={log.date} onRefresh={onRefresh} />
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {hasMore && (
              <button
                onClick={onLoadMore}
                disabled={isLoadingMore}
                className="w-full py-3 text-sm text-navy font-medium border border-border rounded-xl bg-secondary hover:bg-secondary/80 transition-colors disabled:opacity-50"
              >
                {isLoadingMore ? "불러오는 중..." : "이전 기록 더 보기"}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
