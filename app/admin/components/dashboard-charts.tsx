"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import Link from "next/link";

export interface WeeklyActiveData {
  date: string;   // YYYY-MM-DD
  label: string;  // "4/14" etc
  count: number;
}

export interface MonthlyBillingData {
  month: string;  // YYYY-MM
  label: string;  // "4월" etc
  costUsd: number;
  costKrw: number;
}

export interface TopAiUser {
  userId: string;
  email: string;
  name: string;
  costUsd: number;
  costKrw: number;
}

interface Props {
  weeklyActive: WeeklyActiveData[];
  monthlyBilling: MonthlyBillingData[];
  topAiUsers: TopAiUser[];
  thisMonthCalls: number;
}

const EXCHANGE_RATE = 1380;

function KrwTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const val = payload[0].value as number;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 text-xs shadow-md">
      <p className="font-semibold mb-0.5">{label}</p>
      <p className="text-rose-600 font-bold">
        ₩{Math.round(val * EXCHANGE_RATE).toLocaleString("ko-KR")}
      </p>
      <p className="text-muted-foreground">${val.toFixed(4)}</p>
    </div>
  );
}

function ActiveTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const val = payload[0].value as number;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 text-xs shadow-md">
      <p className="font-semibold mb-0.5">{label}</p>
      <p className="text-sky-600 font-bold">{val}명</p>
    </div>
  );
}

export function DashboardCharts({
  weeklyActive,
  monthlyBilling,
  topAiUsers,
  thisMonthCalls,
}: Props) {
  const maxActive = Math.max(...weeklyActive.map((d) => d.count), 1);

  return (
    <div className="space-y-4">
      {/* 최근 7일 일별 활성 사용자 */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-semibold text-foreground">최근 7일 일별 활성 사용자</p>
            <p className="text-xs text-muted-foreground mt-0.5">오늘 기준 7일 방문자 추이</p>
          </div>
          <Link
            href="/admin/users"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
          >
            유저 목록 →
          </Link>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={weeklyActive} barSize={28}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
              domain={[0, Math.max(maxActive + 1, 5)]}
              width={24}
            />
            <Tooltip content={<ActiveTooltip />} cursor={{ fill: "var(--secondary)" }} />
            <Bar dataKey="count" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 하단 2열 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 월별 AI 비용 추이 */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-semibold text-foreground">월별 AI 비용</p>
              <p className="text-xs text-muted-foreground mt-0.5">최근 6개월 (원화 환산)</p>
            </div>
            <Link
              href="/admin/billing"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
            >
              상세 →
            </Link>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={monthlyBilling} barSize={22}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                width={36}
                tickFormatter={(v: number) =>
                  v === 0 ? "0" : `₩${(v * EXCHANGE_RATE / 1000).toFixed(0)}k`
                }
              />
              <Tooltip content={<KrwTooltip />} cursor={{ fill: "var(--secondary)" }} />
              <Bar dataKey="costUsd" fill="#f43f5e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 이번 달 상위 AI 사용자 */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-semibold text-foreground">이번 달 AI 비용 TOP 5</p>
              <p className="text-xs text-muted-foreground mt-0.5">총 {thisMonthCalls.toLocaleString()}회 호출</p>
            </div>
            <Link
              href="/admin/billing"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
            >
              전체 →
            </Link>
          </div>
          {topAiUsers.length === 0 ? (
            <p className="text-xs text-muted-foreground py-8 text-center">이번 달 AI 사용 없음</p>
          ) : (
            <div className="space-y-2">
              {topAiUsers.map((u, i) => (
                <Link
                  key={u.userId}
                  href={`/admin/users/${u.userId}`}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-secondary/60 transition-colors group"
                >
                  <span className="text-xs font-bold text-muted-foreground w-4 shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate group-hover:text-foreground">
                      {u.name || u.email}
                    </p>
                    {u.name && (
                      <p className="text-[10px] text-muted-foreground truncate">{u.email}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold text-rose-600">
                      ₩{u.costKrw.toLocaleString("ko-KR")}
                    </p>
                    <p className="text-[10px] text-muted-foreground">${u.costUsd.toFixed(4)}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
