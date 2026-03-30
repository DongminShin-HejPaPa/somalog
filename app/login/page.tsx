import Link from "next/link";
import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string; email?: string }>;
}) {
  const { error, message, email } = await searchParams;

  return (
    <div className="min-h-dvh flex flex-col">
      {/* 상단 헤더 */}
      <header className="px-4 pt-10 pb-6 text-center">
        <h1 className="text-2xl font-bold text-navy tracking-tight">Soma Log</h1>
        <p className="text-sm text-muted-foreground mt-1">AI 코치와 함께하는 다이어트 기록</p>
      </header>

      {/* 폼 영역 */}
      <main className="flex-1 px-4 pt-2">
        <div className="bg-white rounded-xl border border-border p-5 shadow-sm">
          <h2 className="text-base font-semibold text-foreground mb-4">로그인</h2>

          {error && (
            <div className="mb-3 p-3 rounded-lg bg-coral-light border border-coral/30 text-sm text-coral">
              {error}
            </div>
          )}

          {message && (
            <div className="mb-3 p-3 rounded-lg bg-success-light border border-success/30 text-sm text-success">
              {message}
            </div>
          )}

          <form action={login} className="flex flex-col gap-3">
            {/* 이메일 */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">이메일</label>
              <input
                name="email"
                type="email"
                required
                placeholder="email@example.com"
                defaultValue={email ?? ""}
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
                placeholder="비밀번호를 입력하세요"
                className="w-full h-11 px-3 rounded-lg border border-border bg-white text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-navy/30 focus:border-navy transition-colors"
              />
            </div>

            {/* 비밀번호 찾기 */}
            <div className="flex justify-end">
              <button type="button" className="text-xs text-muted-foreground hover:text-navy transition-colors">
                비밀번호를 잊으셨나요?
              </button>
            </div>

            {/* 로그인 버튼 */}
            <button
              type="submit"
              className="w-full h-11 mt-1 rounded-lg bg-navy text-white text-sm font-semibold hover:bg-navy/90 active:scale-[0.98] transition-all"
            >
              로그인
            </button>
          </form>
        </div>
      </main>

      {/* 회원가입 안내 */}
      <footer className="px-4 py-6 text-center">
        <p className="text-sm text-muted-foreground">
          아직 계정이 없으신가요?{" "}
          <Link href="/register" className="text-navy font-semibold hover:underline">
            회원가입
          </Link>
        </p>
      </footer>
    </div>
  );
}
