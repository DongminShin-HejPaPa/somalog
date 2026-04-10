"use client";

import { useState } from "react";
import { Search, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DailyLog, WeeklyLog } from "@/lib/types";
import { actionRegenerateDailySummary } from "@/app/actions/log-actions";
import { useSettings } from "@/lib/contexts/settings-context";

interface LogListProps {
  logs: DailyLog[];
  weeklyLogs: WeeklyLog[];
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  onRefresh?: () => Promise<void>;
}

function getDayOfWeek(dateStr: string) {
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return days[new Date(dateStr).getDay()];
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
  weeklyLogs,
  hasMore,
  isLoadingMore,
  onLoadMore,
  onRefresh,
}: LogListProps) {
  const { settings } = useSettings();
  const [viewMode, setViewMode] = useState<"daily" | "weekly">("daily");
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  const filters = [
    { key: "unclosed", label: "마감안한날" },
    ...(settings.intensiveDayOn ? [{ key: "intensive", label: "Hard Reset Mode" }] : []),
    { key: "exercise", label: "운동한 날" },
    { key: "lateSnack", label: "야식 있는 날" },
  ];

  const filteredLogs = logs.filter((log) => {
    if (searchQuery) {
      const meals = [log.breakfast, log.lunch, log.dinner].filter(Boolean).join(" ");
      if (!meals.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    }
    if (activeFilter === "unclosed") return log.closed === false;
    if (activeFilter === "intensive") return settings.intensiveDayOn && log.intensiveDay === true;
    if (activeFilter === "exercise") return log.exercise === "Y";
    if (activeFilter === "lateSnack") return log.lateSnack === "Y";
    return true;
  });

  return (
    <div data-testid="log-list">
      <div className="px-4 mb-3">
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="식사 내용 검색"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border border-border bg-secondary focus:outline-none focus:ring-2 focus:ring-navy/20 min-h-[44px]"
          />
        </div>

        <div className="flex items-center gap-2 mb-3">
          <div className="flex gap-1 bg-secondary rounded-lg p-0.5">
            <button
              onClick={() => setViewMode("daily")}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                viewMode === "daily" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground"
              )}
            >
              일별
            </button>
            <button
              onClick={() => setViewMode("weekly")}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                viewMode === "weekly" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground"
              )}
            >
              주별
            </button>
          </div>

          <div className="flex gap-1.5 overflow-x-auto">
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => setActiveFilter(activeFilter === f.key ? null : f.key)}
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
      </div>

      {viewMode === "daily" ? (
        <div className="px-4 space-y-2">
          {filteredLogs.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {searchQuery || activeFilter ? "검색 결과가 없어요" : "아직 기록이 없어요. 입력 탭에서 첫 번째 기록을 시작해보세요."}
            </div>
          ) : (
            <>
              {filteredLogs.map((log) => {
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
                        <span>{log.exercise === "Y" ? "운동" : ""}</span>
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
                            <span>{log.exercise ?? ""}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">야식</span>
                            <span>{log.lateSnack ?? ""}</span>
                          </div>
                          {settings.intensiveDayOn && log.intensiveDay && (
                            <div className="col-span-2 flex items-center gap-1.5 mt-1">
                              <span className="w-2 h-2 rounded-full bg-coral inline-block flex-shrink-0" />
                              <span className="text-xs font-semibold text-coral">Hard Reset Mode</span>
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
                            <span>{log.dinner ?? ""}</span>
                          </div>
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

              {hasMore && !searchQuery && !activeFilter && (
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
      ) : (
        <div className="px-4">
          {weeklyLogs.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              아직 주간 기록이 없어요
            </div>
          ) : (
            <div className="space-y-3">
              {weeklyLogs.map((wl) => (
                <div key={wl.weekStart} className="border border-border rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-semibold">
                        {wl.weekStart.slice(5)} ~ {wl.weekEnd.slice(5)}
                      </p>
                      <p className="text-xs text-muted-foreground">주간 요약</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="text-center p-2 bg-secondary rounded-lg">
                      <p className="text-lg font-bold">{wl.avgWeight}</p>
                      <p className="text-xs text-muted-foreground">평균 체중</p>
                    </div>
                    <div className="text-center p-2 bg-secondary rounded-lg">
                      <p className="text-lg font-bold">{wl.exerciseDays}</p>
                      <p className="text-xs text-muted-foreground">운동일수</p>
                    </div>
                    <div className="text-center p-2 bg-secondary rounded-lg">
                      <p className="text-lg font-bold">{wl.lateSnackCount}</p>
                      <p className="text-xs text-muted-foreground">야식횟수</p>
                    </div>
                  </div>
                  <div className="p-3 bg-secondary/50 rounded-lg">
                    <p className="text-xs font-medium text-muted-foreground mb-1">주간 총평</p>
                    <p className="text-sm leading-relaxed">{wl.weeklySummary}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
