"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { ShieldCheck, User, Ban, CheckCircle2, KeyRound, Copy, Check, Save } from "lucide-react";
import {
  actionAdminUpdateRole,
  actionAdminToggleActive,
  actionAdminGeneratePasswordResetLink,
  actionAdminUpdateMemo,
} from "@/app/admin/actions/user-admin-actions";

interface Props {
  userId: string;
  email: string;
  currentRole: "admin" | "user";
  isActive: boolean;
  memo: string;
}

export function UserDetailActions({ userId, email, currentRole, isActive, memo }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // 역할 변경
  const [roleConfirm, setRoleConfirm] = useState(false);

  // 비활성화
  const [activeConfirm, setActiveConfirm] = useState(false);

  // 비밀번호 재설정 링크
  const [resetLink, setResetLink] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // 메모
  const [memoText, setMemoText] = useState(memo);
  const [memoSaved, setMemoSaved] = useState(false);

  function handleRoleChange() {
    startTransition(async () => {
      await actionAdminUpdateRole(userId, currentRole === "admin" ? "user" : "admin");
      setRoleConfirm(false);
      router.refresh();
    });
  }

  function handleToggleActive() {
    startTransition(async () => {
      await actionAdminToggleActive(userId, !isActive);
      setActiveConfirm(false);
      router.refresh();
    });
  }

  async function handleGenerateResetLink() {
    setResetLoading(true);
    const result = await actionAdminGeneratePasswordResetLink(email);
    setResetLoading(false);
    if (result.ok) setResetLink(result.link);
  }

  async function handleCopyLink() {
    if (!resetLink) return;
    await navigator.clipboard.writeText(resetLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleSaveMemo() {
    startTransition(async () => {
      await actionAdminUpdateMemo(userId, memoText);
      setMemoSaved(true);
      setTimeout(() => setMemoSaved(false), 2000);
    });
  }

  return (
    <div className="space-y-4">
      {/* 액션 카드 */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">관리 액션</h2>
        <div className="space-y-3">

          {/* 역할 변경 */}
          <div className="flex items-center justify-between py-2 border-b border-border">
            <div>
              <p className="text-sm font-medium">역할 변경</p>
              <p className="text-xs text-muted-foreground">현재: <span className="font-semibold">{currentRole}</span></p>
            </div>
            {roleConfirm ? (
              <div className="flex gap-2">
                <button
                  onClick={handleRoleChange}
                  disabled={isPending}
                  className="px-3 py-1.5 text-xs bg-navy text-white rounded-lg font-semibold disabled:opacity-50"
                >
                  {isPending ? "변경 중..." : `${currentRole === "admin" ? "user" : "admin"}으로 변경`}
                </button>
                <button onClick={() => setRoleConfirm(false)} className="px-3 py-1.5 text-xs border border-border rounded-lg">취소</button>
              </div>
            ) : (
              <button
                onClick={() => setRoleConfirm(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-secondary transition-colors"
              >
                {currentRole === "admin" ? <User className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                {currentRole === "admin" ? "user로 변경" : "admin으로 변경"}
              </button>
            )}
          </div>

          {/* 비활성화 / 활성화 */}
          <div className="flex items-center justify-between py-2 border-b border-border">
            <div>
              <p className="text-sm font-medium">계정 {isActive ? "비활성화" : "활성화"}</p>
              <p className="text-xs text-muted-foreground">
                {isActive ? "즉시 세션 차단 + 로그인 불가" : "차단 해제"}
              </p>
            </div>
            {activeConfirm ? (
              <div className="flex gap-2">
                <button
                  onClick={handleToggleActive}
                  disabled={isPending}
                  className={cn(
                    "px-3 py-1.5 text-xs rounded-lg font-semibold disabled:opacity-50",
                    isActive ? "bg-rose-600 text-white" : "bg-emerald-600 text-white"
                  )}
                >
                  {isPending ? "처리 중..." : isActive ? "비활성화 확인" : "활성화 확인"}
                </button>
                <button onClick={() => setActiveConfirm(false)} className="px-3 py-1.5 text-xs border border-border rounded-lg">취소</button>
              </div>
            ) : (
              <button
                onClick={() => setActiveConfirm(true)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs border rounded-lg transition-colors",
                  isActive
                    ? "border-rose-200 text-rose-600 hover:bg-rose-50"
                    : "border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                )}
              >
                {isActive ? <Ban className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                {isActive ? "비활성화" : "활성화"}
              </button>
            )}
          </div>

          {/* 비밀번호 재설정 링크 */}
          <div className="py-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">비밀번호 재설정</p>
                <p className="text-xs text-muted-foreground">1회용 링크 생성 → 클립보드 복사</p>
              </div>
              <button
                onClick={handleGenerateResetLink}
                disabled={resetLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-secondary transition-colors disabled:opacity-50"
              >
                <KeyRound className="w-3.5 h-3.5" />
                {resetLoading ? "생성 중..." : "링크 생성"}
              </button>
            </div>
            {resetLink && (
              <div className="mt-3 p-3 bg-secondary/30 rounded-xl">
                <div className="flex items-center gap-2">
                  <p className="text-xs text-muted-foreground font-mono truncate flex-1">{resetLink}</p>
                  <button
                    onClick={handleCopyLink}
                    className="shrink-0 p-1.5 rounded-lg hover:bg-secondary transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <p className="text-[10px] text-amber-600 mt-1.5">⚠️ 이 링크는 1회용입니다. 사용자에게 직접 전달하세요.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 관리자 메모 */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">관리자 메모</h2>
        <p className="text-[10px] text-muted-foreground mb-2">사용자에게 비노출</p>
        <textarea
          value={memoText}
          onChange={(e) => setMemoText(e.target.value)}
          rows={4}
          placeholder="이 사용자에 대한 메모를 남기세요..."
          className="w-full px-3 py-2.5 text-sm border border-border rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-navy/20"
        />
        <div className="flex justify-end mt-2">
          <button
            onClick={handleSaveMemo}
            disabled={isPending || memoSaved}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-colors",
              memoSaved
                ? "bg-emerald-100 text-emerald-700"
                : "bg-navy text-white hover:bg-navy/90 disabled:opacity-50"
            )}
          >
            <Save className="w-3.5 h-3.5" />
            {memoSaved ? "저장됨" : isPending ? "저장 중..." : "메모 저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
