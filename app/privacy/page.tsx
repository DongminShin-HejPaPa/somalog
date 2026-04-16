import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export const metadata = {
  title: "개인정보처리방침 | Soma Log",
  description: "Soma Log 개인정보처리방침",
};

export default function PrivacyPage() {
  const effectiveDate = "2026년 4월 17일";

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 bg-background border-b border-border z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/settings" className="p-1 -ml-1 rounded-lg hover:bg-secondary transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-base font-bold">개인정보처리방침</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <p className="text-xs text-muted-foreground mb-6">시행일: {effectiveDate}</p>
        <p className="text-sm text-muted-foreground leading-relaxed mb-6">
          Soma Log(이하 "서비스")는 「개인정보 보호법」 제30조에 따라 이용자의 개인정보를 보호하고
          이와 관련한 고충을 신속하게 처리하기 위하여 다음과 같이 개인정보처리방침을 수립·공개합니다.
        </p>

        <section className="mb-6">
          <h2 className="text-sm font-bold mb-3">제1조 (수집하는 개인정보 항목)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border border-border rounded-lg overflow-hidden">
              <thead className="bg-secondary">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold border-b border-border">항목</th>
                  <th className="text-left px-3 py-2 font-semibold border-b border-border">수집 방법</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr className="border-b border-border">
                  <td className="px-3 py-2">이메일 주소, 성명(닉네임)</td>
                  <td className="px-3 py-2">회원 가입 시</td>
                </tr>
                <tr>
                  <td className="px-3 py-2">체중, 식단 기록, 운동 기록, 수분 섭취량 등 건강 데이터</td>
                  <td className="px-3 py-2">서비스 이용 중 직접 입력</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="mb-6">
          <h2 className="text-sm font-bold mb-2">제2조 (개인정보의 수집·이용 목적)</h2>
          <ul className="text-sm text-muted-foreground leading-relaxed space-y-1 list-disc list-inside">
            <li>서비스 제공 및 계정 관리</li>
            <li>AI 코치 기능 제공 (입력된 건강 데이터 기반 맞춤 피드백 생성)</li>
            <li>서비스 개선 및 기술 개발</li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="text-sm font-bold mb-2">제3조 (개인정보의 보유 및 이용 기간)</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            이용자가 회원 탈퇴를 요청하거나 서비스가 제공 목적을 달성한 경우 지체 없이 파기합니다.
            단, 관련 법령에 따라 보존이 필요한 경우 해당 기간 동안 보관합니다.
          </p>
        </section>

        <section className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <h2 className="text-sm font-bold mb-2 text-amber-800">제4조 (개인정보의 제3자 제공)</h2>
          <p className="text-sm text-amber-700 leading-relaxed">
            서비스는 이용자가 입력한 건강 데이터(체중, 식단, 운동 기록 등)를{" "}
            <strong>AI 분석 목적으로 외부 AI 서비스 제공자에게 전송</strong>합니다.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-xs border border-amber-200 rounded-lg overflow-hidden">
              <thead className="bg-amber-100">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold border-b border-amber-200">수탁자</th>
                  <th className="text-left px-3 py-2 font-semibold border-b border-amber-200">위탁 업무</th>
                  <th className="text-left px-3 py-2 font-semibold border-b border-amber-200">보유·이용 기간</th>
                </tr>
              </thead>
              <tbody className="text-amber-800">
                <tr className="border-b border-amber-200">
                  <td className="px-3 py-2">OpenRouter (AI 중계 서비스)</td>
                  <td className="px-3 py-2">AI 피드백 생성 (건강 데이터 분석)</td>
                  <td className="px-3 py-2">분석 후 즉시 삭제</td>
                </tr>
                <tr className="border-b border-amber-200">
                  <td className="px-3 py-2">Supabase Inc.</td>
                  <td className="px-3 py-2">데이터베이스 및 인증 서비스</td>
                  <td className="px-3 py-2">탈퇴 시까지</td>
                </tr>
                <tr>
                  <td className="px-3 py-2">Vercel Inc.</td>
                  <td className="px-3 py-2">서버 호스팅</td>
                  <td className="px-3 py-2">탈퇴 시까지</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="mb-6">
          <h2 className="text-sm font-bold mb-2">제5조 (이용자의 권리·의무)</h2>
          <p className="text-sm text-muted-foreground leading-relaxed mb-2">
            이용자는 언제든지 다음 권리를 행사할 수 있습니다:
          </p>
          <ul className="text-sm text-muted-foreground leading-relaxed space-y-1 list-disc list-inside">
            <li>개인정보 열람 요구</li>
            <li>오류 등이 있을 경우 정정 요구</li>
            <li>삭제 요구 (서비스 내 계정 탈퇴 기능 이용)</li>
            <li>처리 정지 요구</li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="text-sm font-bold mb-2">제6조 (개인정보보호 담당자)</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            개인정보 처리에 관한 업무를 총괄하고 관련 불만 처리 및 피해 구제를 위하여 아래와 같이
            개인정보 보호책임자를 지정하고 있습니다.
          </p>
          <div className="mt-3 p-3 bg-secondary rounded-lg text-sm text-muted-foreground">
            <p>개인정보 보호책임자: 서비스 운영자</p>
            <p>
              문의:{" "}
              <a href="mailto:privacy@somalog.app" className="text-navy underline underline-offset-2">
                privacy@somalog.app
              </a>
            </p>
          </div>
        </section>

        <section className="mb-6">
          <h2 className="text-sm font-bold mb-2">제7조 (개인정보처리방침의 변경)</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            이 개인정보처리방침은 {effectiveDate}부터 적용됩니다. 방침이 변경되는 경우 서비스 내
            공지사항을 통해 사전 고지합니다.
          </p>
        </section>

        <div className="mt-8 pt-4 border-t border-border">
          <Link href="/terms" className="text-xs text-navy underline underline-offset-2">
            이용약관 보기 →
          </Link>
        </div>
      </main>
    </div>
  );
}
