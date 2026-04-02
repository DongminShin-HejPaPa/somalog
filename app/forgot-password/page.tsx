"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset, type ForgotState } from "./actions";

const initial: ForgotState = {};

export default function ForgotPasswordPage() {
  const [state, formAction, isPending] = useActionState(requestPasswordReset, initial);

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="px-4 pt-10 pb-6 text-center">
        <h1 className="text-2xl font-bold text-navy tracking-tight">Soma Log</h1>
        <p className="text-sm text-muted-foreground mt-1">AI 코치와 함께하는 다이어트 기록</p>
      </header>

      <main className="flex-1 px-4 pt-2 pb-6">
        <div className="bg-white rounded-xl border border-border p-5 shadow-sm">
          <h2 className="text-base font-semibold text-foreground mb-1">비밀번호 찾기</h2>
          <p className="text-xs text-muted-foreground mb-4">
            가입하신 이메일 주소를 입력하시면 비밀번호 재설정 링크를 보내드려요.
          </p>

          {state.error && (
            <div className="mb-3 p-3 rounded-lg bg-coral-light border border-coral/30 text-sm text-coral">
              {state.error}
            </div>
          )}

          {state.success ? (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-success-light border border-success/30 text-sm text-success">
                재설정 링크를 이메일로 발송했어요. 메일함을 확인해주세요.
              </div>
              <Link
                href="/login"
                className="block w-full h-11 rounded-lg border border-border text-sm text-foreground font-medium flex items-center justify-center"
              >
                로그인으로 돌아가기
              </Link>
            </div>
          ) : (
            <form action={formAction} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">이메일</label>
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="email@example.com"
                  className="w-full h-11 px-3 rounded-lg border border-border bg-white text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy transition-colors"
                />
              </div>
              <button
                type="submit"
                disabled={isPending}
                className="w-full h-11 mt-1 rounded-lg bg-navy text-white text-sm font-semibold hover:bg-navy/90 active:scale-[0.98] disabled:opacity-60 transition-all"
              >
                {isPending ? "발송 중..." : "재설정 링크 발송"}
              </button>
            </form>
          )}
        </div>
      </main>

      <footer className="px-4 py-6 text-center border-t border-border">
        <Link href="/login" className="text-sm text-navy font-semibold hover:underline">
          로그인으로 돌아가기
        </Link>
      </footer>
    </div>
  );
}
