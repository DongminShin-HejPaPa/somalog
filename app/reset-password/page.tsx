"use client";

import { useActionState } from "react";
import { resetPassword, type ResetState } from "./actions";

const initial: ResetState = {};

export default function ResetPasswordPage() {
  const [state, formAction, isPending] = useActionState(resetPassword, initial);

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="px-4 pt-10 pb-6 text-center">
        <h1 className="text-2xl font-bold text-navy tracking-tight">Soma Log</h1>
        <p className="text-sm text-muted-foreground mt-1">AI 코치와 함께하는 다이어트 기록</p>
      </header>

      <main className="flex-1 px-4 pt-2 pb-6">
        <div className="bg-white rounded-xl border border-border p-5 shadow-sm">
          <h2 className="text-base font-semibold text-foreground mb-1">새 비밀번호 설정</h2>
          <p className="text-xs text-muted-foreground mb-4">
            새로 사용할 비밀번호를 입력해주세요.
          </p>

          {state.error && (
            <div className="mb-3 p-3 rounded-lg bg-coral-light border border-coral/30 text-sm text-coral">
              {state.error}
            </div>
          )}

          <form action={formAction} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">새 비밀번호</label>
              <input
                name="password"
                type="password"
                required
                placeholder="6자 이상 입력하세요"
                className="w-full h-11 px-3 rounded-lg border border-border bg-white text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">비밀번호 확인</label>
              <input
                name="passwordConfirm"
                type="password"
                required
                placeholder="비밀번호를 다시 입력하세요"
                className="w-full h-11 px-3 rounded-lg border border-border bg-white text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={isPending}
              className="w-full h-11 mt-1 rounded-lg bg-navy text-white text-sm font-semibold hover:bg-navy/90 active:scale-[0.98] disabled:opacity-60 transition-all"
            >
              {isPending ? "변경 중..." : "비밀번호 변경"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
