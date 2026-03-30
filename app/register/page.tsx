"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { signup, type RegisterState } from "./actions";

export default function RegisterPage() {
  const [state, setState] = useState<RegisterState>({ error: null });
  const [isPending, startTransition] = useTransition();

  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [agreeMarketing, setAgreeMarketing] = useState(false);
  const agreeAll = agreeTerms && agreePrivacy && agreeMarketing;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    // controlled 체크박스는 formData에 자동으로 포함되지 않으므로 수동으로 추가
    if (agreeTerms) formData.set("agreeTerms", "on");
    if (agreePrivacy) formData.set("agreePrivacy", "on");
    if (agreeMarketing) formData.set("agreeMarketing", "on");

    startTransition(async () => {
      const result = await signup(state, formData);
      setState(result);
    });
  }

  return (
    <div className="min-h-dvh flex flex-col">
      {/* 상단 헤더 */}
      <header className="px-4 pt-10 pb-6 text-center">
        <h1 className="text-2xl font-bold text-navy tracking-tight">Soma Log</h1>
        <p className="text-sm text-muted-foreground mt-1">AI 코치와 함께하는 다이어트 기록</p>
      </header>

      {/* 폼 영역 */}
      <main className="flex-1 px-4 pt-2 pb-6">
        <div className="bg-white rounded-xl border border-border p-5 shadow-sm">
          <h2 className="text-base font-semibold text-foreground mb-4">회원가입</h2>

          {state.error && (
            <div className="mb-3 p-3 rounded-lg bg-coral-light border border-coral/30 text-sm text-coral">
              {state.error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            {/* 이름 */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">이름</label>
              <input
                name="name"
                type="text"
                required
                placeholder="홍길동"
                defaultValue={state.fields?.name ?? ""}
                key={`name-${state.fields?.name}`}
                className="w-full h-11 px-3 rounded-lg border border-border bg-white text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy transition-colors"
              />
            </div>

            {/* 이메일 */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">이메일</label>
              <input
                name="email"
                type="email"
                required
                placeholder="email@example.com"
                defaultValue={state.fields?.email ?? ""}
                key={`email-${state.fields?.email}`}
                className="w-full h-11 px-3 rounded-lg border border-border bg-white text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy transition-colors"
              />
            </div>

            {/* 비밀번호 */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">비밀번호</label>
              <input
                name="password"
                type="password"
                required
                placeholder="6자 이상 입력하세요"
                className="w-full h-11 px-3 rounded-lg border border-border bg-white text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy transition-colors"
              />
            </div>

            {/* 비밀번호 확인 */}
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

            {/* 약관 동의 */}
            <div className="flex flex-col gap-2 mt-1 p-3 bg-secondary rounded-lg">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-border accent-navy"
                  checked={agreeAll}
                  onChange={(e) => {
                    setAgreeTerms(e.target.checked);
                    setAgreePrivacy(e.target.checked);
                    setAgreeMarketing(e.target.checked);
                  }}
                />
                <span className="text-xs text-foreground font-medium">전체 동의</span>
              </label>
              <div className="h-px bg-border" />
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-border accent-navy"
                    checked={agreeTerms}
                    onChange={(e) => setAgreeTerms(e.target.checked)}
                  />
                  <span className="text-xs text-muted-foreground">
                    <span className="text-coral font-medium">[필수]</span> 이용약관 동의
                  </span>
                </div>
                <button type="button" className="text-xs text-muted-foreground underline">보기</button>
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-border accent-navy"
                    checked={agreePrivacy}
                    onChange={(e) => setAgreePrivacy(e.target.checked)}
                  />
                  <span className="text-xs text-muted-foreground">
                    <span className="text-coral font-medium">[필수]</span> 개인정보 처리방침 동의
                  </span>
                </div>
                <button type="button" className="text-xs text-muted-foreground underline">보기</button>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-border accent-navy"
                  checked={agreeMarketing}
                  onChange={(e) => setAgreeMarketing(e.target.checked)}
                />
                <span className="text-xs text-muted-foreground">
                  <span className="text-muted-foreground font-medium">[선택]</span> 마케팅 수신 동의
                </span>
              </label>
            </div>

            {/* 회원가입 버튼 */}
            <button
              type="submit"
              disabled={isPending}
              className="w-full h-11 mt-1 rounded-lg bg-navy text-white text-sm font-semibold hover:bg-navy/90 active:scale-[0.98] disabled:opacity-60 transition-all"
            >
              {isPending ? "처리 중..." : "회원가입"}
            </button>
          </form>
        </div>
      </main>

      {/* 로그인 안내 */}
      <footer className="px-4 py-6 text-center border-t border-border">
        <p className="text-sm text-muted-foreground">
          이미 계정이 있으신가요?{" "}
          <Link href="/login" className="text-navy font-semibold hover:underline">
            로그인
          </Link>
        </p>
      </footer>
    </div>
  );
}
