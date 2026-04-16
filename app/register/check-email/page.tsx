import Link from "next/link";
import { Mail } from "lucide-react";

export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm text-center space-y-6">
        {/* 아이콘 */}
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full bg-navy/10 flex items-center justify-center">
            <Mail className="w-10 h-10 text-navy" />
          </div>
        </div>

        {/* 제목 */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">이메일을 확인해주세요</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {email ? (
              <>
                <span className="font-medium text-foreground">{email}</span>
                <br />
                으로 인증 메일을 발송했습니다.
              </>
            ) : (
              "가입하신 이메일로 인증 메일을 발송했습니다."
            )}
          </p>
        </div>

        {/* 안내 */}
        <div className="bg-secondary rounded-2xl p-5 text-left space-y-3">
          <div className="flex items-start gap-3">
            <span className="text-lg mt-0.5">1</span>
            <p className="text-sm text-muted-foreground">
              받은 메일함(또는 스팸함)에서{" "}
              <span className="font-medium text-foreground">Soma Log</span> 인증 메일을 확인하세요.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-lg mt-0.5">2</span>
            <p className="text-sm text-muted-foreground">
              메일 내 <span className="font-medium text-foreground">인증 링크</span>를 클릭하면
              가입이 완료됩니다.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-lg mt-0.5">3</span>
            <p className="text-sm text-muted-foreground">인증 후 로그인 페이지에서 로그인하세요.</p>
          </div>
        </div>

        {/* 버튼 */}
        <div className="space-y-3 pt-2">
          <Link
            href="/login"
            className="block w-full py-3.5 rounded-2xl bg-navy text-white text-sm font-semibold min-h-[48px] hover:bg-navy/90 transition-colors"
          >
            로그인 페이지로 이동
          </Link>
          <p className="text-xs text-muted-foreground">
            메일이 오지 않았나요?{" "}
            <Link href="/register" className="text-navy font-medium underline underline-offset-2">
              다시 가입하기
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
