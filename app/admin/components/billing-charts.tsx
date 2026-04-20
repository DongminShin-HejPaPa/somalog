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

export interface MonthlyBillingRow {
  month: string;   // YYYY-MM
  label: string;   // "4월"
  costUsd: number;
  calls: number;
  inputTokens: number;
  outputTokens: number;
}

export interface CallTypeRow {
  callType: string;
  calls: number;
  costUsd: number;
}

export interface TopBillingUser {
  userId: string;
  email: string;
  name: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  costKrw: number;
}

interface Props {
  monthlyData: MonthlyBillingRow[];
  callTypeData: CallTypeRow[];
  topUsers: TopBillingUser[];
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

export function BillingCharts({ monthlyData, callTypeData, topUsers }: Props) {
  return (
    <div className="space-y-6">
      {/* 월별 비용 바 차트 */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
        <p className="text-sm font-semibold text-foreground mb-1">월별 AI 비용 추이</p>
        <p className="text-xs text-muted-foreground mb-4">최근 12개월 누적 비용 (원화 환산)</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={monthlyData} barSize={24}>
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
              width={42}
              tickFormatter={(v: number) =>
                v === 0 ? "0" : `₩${(v * EXCHANGE_RATE / 1000).toFixed(0)}k`
              }
            />
            <Tooltip content={<KrwTooltip />} cursor={{ fill: "var(--secondary)" }} />
            <Bar dataKey="costUsd" fill="#f43f5e" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 호출 유형별 + 상위 사용자 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 이번 달 호출 유형별 */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <p className="text-sm font-semibold text-foreground mb-4">이번 달 호출 유형별</p>
          {callTypeData.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">이번 달 데이터 없음</p>
          ) : (
            <div className="space-y-2">
              {callTypeData.map((row) => {
                const totalCalls = callTypeData.reduce((s, r) => s + r.calls, 0);
                const pct = totalCalls > 0 ? Math.round((row.calls / totalCalls) * 100) : 0;
                return (
                  <div key={row.callType} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground">{row.callType}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground">{row.calls.toLocaleString()}회</span>
                        <span className="font-bold text-rose-600 w-16 text-right">
                          ₩{Math.round(row.costUsd * EXCHANGE_RATE).toLocaleString("ko-KR")}
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-1.5">
                      <div
                        className="bg-rose-500 h-1.5 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 이번 달 상위 사용자 */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <p className="text-sm font-semibold text-foreground mb-4">이번 달 상위 사용자 TOP 10</p>
          {topUsers.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">이번 달 데이터 없음</p>
          ) : (
            <div className="space-y-1">
              {topUsers.map((u, i) => (
                <Link
                  key={u.userId}
                  href={`/admin/users/${u.userId}`}
                  className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-secondary/60 transition-colors group"
                >
                  <span className="text-xs font-bold text-muted-foreground w-5 shrink-0 text-right">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{u.name || u.email}</p>
                    {u.name && (
                      <p className="text-[10px] text-muted-foreground truncate">{u.email}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold text-rose-600">
                      ₩{u.costKrw.toLocaleString("ko-KR")}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{u.calls}회</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 월별 상세 테이블 */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-border">
          <p className="text-sm font-semibold text-foreground">월별 상세 내역</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground">월</th>
                <th className="text-right px-4 py-2.5 font-semibold text-muted-foreground">호출 수</th>
                <th className="text-right px-4 py-2.5 font-semibold text-muted-foreground hidden sm:table-cell">입력 토큰</th>
                <th className="text-right px-4 py-2.5 font-semibold text-muted-foreground hidden sm:table-cell">출력 토큰</th>
                <th className="text-right px-4 py-2.5 font-semibold text-muted-foreground">비용 (USD)</th>
                <th className="text-right px-4 py-2.5 font-semibold text-muted-foreground">비용 (KRW)</th>
              </tr>
            </thead>
            <tbody>
              {monthlyData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-muted-foreground">데이터 없음</td>
                </tr>
              ) : (
                [...monthlyData].reverse().map((row) => (
                  <tr key={row.month} className="border-b border-border last:border-0 hover:bg-secondary/20">
                    <td className="px-4 py-2.5 font-medium">{row.month}</td>
                    <td className="px-4 py-2.5 text-right">{row.calls.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground hidden sm:table-cell">
                      {row.inputTokens.toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground hidden sm:table-cell">
                      {row.outputTokens.toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium">${row.costUsd.toFixed(4)}</td>
                    <td className="px-4 py-2.5 text-right font-bold text-rose-600">
                      ₩{Math.round(row.costUsd * EXCHANGE_RATE).toLocaleString("ko-KR")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
