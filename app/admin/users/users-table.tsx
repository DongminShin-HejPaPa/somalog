"use client";

import { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Search,
  ShieldCheck,
  User,
  Ban,
  CheckCircle2,
  KeyRound,
  Copy,
  Check,
} from "lucide-react";
import {
  actionAdminUpdateRole,
  actionAdminToggleActive,
  actionAdminGeneratePasswordResetLink,
} from "@/app/admin/actions/user-admin-actions";
import type { UserRow } from "./page";

type SortKey = "createdAt" | "lastSignInAt" | "logCount";
type SortDir = "asc" | "desc";

function kstDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(new Date(iso).getTime() + 9 * 3600_000).toLocaleDateString(
    "ko-KR",
    { month: "2-digit", day: "2-digit" }
  );
}

// 비밀번호 재설정 링크 복사 버튼 (팝업)
function ResetLinkButton({ email }: { email: string }) {
  const [state, setState] = useState<"idle" | "loading" | "copied" | "error">("idle");
  const [link, setLink] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleClick() {
    setState("loading");
    const result = await actionAdminGeneratePasswordResetLink(email);
    if (result.ok) {
      setLink(result.link);
      await navigator.clipboard.writeText(result.link).catch(() => {});
      setState("copied");
      setTimeout(() => setState("idle"), 3000);
    } else {
      setErrorMsg(result.error);
      setState("error");
      setTimeout(() => setState("idle"), 3000);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={state === "loading"}
      title="비밀번호 재설정 링크 생성 & 복사"
      className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground disabled:opacity-50"
    >
      {state === "copied" ? (
        <Check className="w-4 h-4 text-emerald-500" />
      ) : state === "error" ? (
        <span className="text-[10px] text-rose-500">실패</span>
      ) : (
        <KeyRound className="w-4 h-4" />
      )}
    </button>
  );
}

// 역할 변경 버튼
function RoleButton({ userId, role }: { userId: string; role: "admin" | "user" }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function toggle() {
    startTransition(async () => {
      await actionAdminUpdateRole(userId, role === "admin" ? "user" : "admin");
      router.refresh();
    });
  }

  return (
    <button
      onClick={toggle}
      disabled={isPending}
      title={role === "admin" ? "user로 변경" : "admin으로 변경"}
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold transition-colors",
        role === "admin"
          ? "bg-rose-100 text-rose-700 hover:bg-rose-200"
          : "bg-secondary text-muted-foreground hover:bg-secondary/80",
        isPending && "opacity-50 cursor-not-allowed"
      )}
    >
      {role === "admin" ? (
        <><ShieldCheck className="w-3 h-3" />admin</>
      ) : (
        <><User className="w-3 h-3" />user</>
      )}
    </button>
  );
}

// 활성/비활성 토글 버튼
function ActiveButton({ userId, isActive }: { userId: string; isActive: boolean }) {
  const [confirm, setConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function toggle() {
    startTransition(async () => {
      await actionAdminToggleActive(userId, !isActive);
      setConfirm(false);
      router.refresh();
    });
  }

  if (confirm) {
    return (
      <div className="flex items-center gap-1">
        <button
          onClick={toggle}
          disabled={isPending}
          className={cn(
            "px-2 py-0.5 text-[10px] font-bold rounded-full",
            isActive ? "bg-rose-600 text-white" : "bg-emerald-600 text-white",
            isPending && "opacity-50"
          )}
        >
          {isPending ? "..." : isActive ? "비활성화" : "활성화"}
        </button>
        <button
          onClick={() => setConfirm(false)}
          className="text-[10px] text-muted-foreground"
        >
          취소
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirm(true)}
      title={isActive ? "비활성화" : "활성화"}
      className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
    >
      {isActive ? (
        <Ban className="w-4 h-4 hover:text-rose-500" />
      ) : (
        <CheckCircle2 className="w-4 h-4 hover:text-emerald-500" />
      )}
    </button>
  );
}

// ─── 메인 테이블 ──────────────────────────────────────────────────────────
const PAGE_SIZE = 20;

export function UsersTable({ users }: { users: UserRow[] }) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "user">("all");
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: "createdAt",
    dir: "desc",
  });
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    let list = users;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (u) =>
          u.email.toLowerCase().includes(q) ||
          u.name.toLowerCase().includes(q)
      );
    }
    if (roleFilter !== "all") list = list.filter((u) => u.role === roleFilter);
    if (activeFilter === "active") list = list.filter((u) => u.isActive);
    if (activeFilter === "inactive") list = list.filter((u) => !u.isActive);

    list = [...list].sort((a, b) => {
      const aVal = a[sort.key] ?? "";
      const bVal = b[sort.key] ?? "";
      const cmp = String(aVal).localeCompare(String(bVal));
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [users, search, roleFilter, activeFilter, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function toggleSort(key: SortKey) {
    setPage(1);
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "desc" }
    );
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sort.key !== k) return <ChevronDown className="w-3 h-3 opacity-30" />;
    return sort.dir === "asc" ? (
      <ChevronUp className="w-3 h-3" />
    ) : (
      <ChevronDown className="w-3 h-3" />
    );
  }

  return (
    <div className="space-y-4">
      {/* 필터 바 */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="이름 또는 이메일 검색..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-navy/20"
          />
        </div>
        <div className="flex gap-1.5">
          {(["all", "admin", "user"] as const).map((r) => (
            <button
              key={r}
              onClick={() => { setRoleFilter(r); setPage(1); }}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors",
                roleFilter === r
                  ? "bg-navy text-white"
                  : "bg-secondary text-muted-foreground hover:bg-secondary/80"
              )}
            >
              {r === "all" ? "전체" : r}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          {(["all", "active", "inactive"] as const).map((a) => (
            <button
              key={a}
              onClick={() => { setActiveFilter(a); setPage(1); }}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors",
                activeFilter === a
                  ? "bg-navy text-white"
                  : "bg-secondary text-muted-foreground hover:bg-secondary/80"
              )}
            >
              {a === "all" ? "전체" : a === "active" ? "활성" : "비활성"}
            </button>
          ))}
        </div>
      </div>

      {/* 테이블 */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">이름 / 이메일</th>
                <th className="text-center px-3 py-3 font-semibold text-muted-foreground w-20">역할</th>
                <th className="text-center px-3 py-3 font-semibold text-muted-foreground w-16">상태</th>
                <th
                  className="text-right px-3 py-3 font-semibold text-muted-foreground w-28 cursor-pointer select-none hidden sm:table-cell"
                  onClick={() => toggleSort("createdAt")}
                >
                  <span className="flex items-center justify-end gap-1">가입일 <SortIcon k="createdAt" /></span>
                </th>
                <th
                  className="text-right px-3 py-3 font-semibold text-muted-foreground w-28 cursor-pointer select-none hidden md:table-cell"
                  onClick={() => toggleSort("lastSignInAt")}
                >
                  <span className="flex items-center justify-end gap-1">마지막 방문 <SortIcon k="lastSignInAt" /></span>
                </th>
                <th
                  className="text-right px-3 py-3 font-semibold text-muted-foreground w-20 cursor-pointer select-none hidden md:table-cell"
                  onClick={() => toggleSort("logCount")}
                >
                  <span className="flex items-center justify-end gap-1">로그 <SortIcon k="logCount" /></span>
                </th>
                <th className="w-28 px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-muted-foreground text-sm">
                    결과 없음
                  </td>
                </tr>
              ) : (
                paged.map((u) => (
                  <tr
                    key={u.id}
                    className={cn(
                      "border-b border-border last:border-0 transition-colors",
                      !u.isActive && "bg-secondary/30",
                      u.isActive && "hover:bg-secondary/20"
                    )}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium truncate max-w-[180px]">{u.name || "—"}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[180px]">{u.email}</p>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <RoleButton userId={u.id} role={u.role} />
                    </td>
                    <td className="px-3 py-3 text-center">
                      {u.isActive ? (
                        <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" title="활성" />
                      ) : (
                        <span className="inline-block w-2 h-2 rounded-full bg-rose-400" title="비활성" />
                      )}
                    </td>
                    <td className="px-3 py-3 text-right text-xs text-muted-foreground hidden sm:table-cell">
                      {kstDate(u.createdAt)}
                    </td>
                    <td className="px-3 py-3 text-right text-xs text-muted-foreground hidden md:table-cell">
                      {kstDate(u.lastSeenAt ?? u.lastSignInAt)}
                    </td>
                    <td className="px-3 py-3 text-right text-xs font-medium hidden md:table-cell">
                      {u.logCount.toLocaleString()}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-0.5">
                        <ResetLinkButton email={u.email} />
                        <ActiveButton userId={u.id} isActive={u.isActive} />
                        <Link
                          href={`/admin/users/${u.id}`}
                          className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                          title="상세 보기"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground text-xs">
            {filtered.length}명 중 {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)}
          </span>
          <div className="flex gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-lg text-xs border border-border disabled:opacity-40 hover:bg-secondary transition-colors"
            >
              이전
            </button>
            <span className="px-3 py-1.5 text-xs text-muted-foreground">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 rounded-lg text-xs border border-border disabled:opacity-40 hover:bg-secondary transition-colors"
            >
              다음
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
