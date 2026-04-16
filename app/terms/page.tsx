import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export const metadata = {
  title: "이용약관 | Soma Log",
  description: "Soma Log 서비스 이용약관",
};

export default function TermsPage() {
  const effectiveDate = "2026년 4월 17일";

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 bg-background border-b border-border z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/settings" className="p-1 -ml-1 rounded-lg hover:bg-secondary transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-base font-bold">이용약관</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 prose prose-sm prose-slate max-w-none">
        <p className="text-xs text-muted-foreground mb-6">시행일: {effectiveDate}</p>

        <section className="mb-6">
          <h2 className="text-sm font-bold mb-2">제1조 (목적)</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            이 약관은 Soma Log(이하 "서비스")가 제공하는 AI 코칭 기반 다이어트 기록 서비스의 이용과 관련하여
            서비스와 이용자 간의 권리·의무 및 책임사항을 규정함을 목적으로 합니다.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-sm font-bold mb-2">제2조 (이용 자격)</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            서비스는 만 14세 이상의 이용자가 사용할 수 있습니다. 만 14세 미만의 아동은 서비스에 가입하거나
            개인정보를 제공할 수 없습니다.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-sm font-bold mb-2">제3조 (계정 생성 및 관리)</h2>
          <ul className="text-sm text-muted-foreground leading-relaxed space-y-1 list-disc list-inside">
            <li>이용자는 유효한 이메일 주소로 가입하고, 이메일 인증을 완료해야 서비스를 이용할 수 있습니다.</li>
            <li>이용자는 계정 정보(비밀번호 등)의 보안에 스스로 책임을 집니다.</li>
            <li>타인의 정보를 도용하여 계정을 생성하는 행위는 금지됩니다.</li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="text-sm font-bold mb-2">제4조 (서비스 이용 제한)</h2>
          <p className="text-sm text-muted-foreground leading-relaxed mb-2">다음 행위는 금지됩니다:</p>
          <ul className="text-sm text-muted-foreground leading-relaxed space-y-1 list-disc list-inside">
            <li>서비스를 상업적 목적으로 무단 이용하는 행위</li>
            <li>서비스의 안정적 운영을 방해하는 행위(무단 크롤링, 과도한 API 호출 등)</li>
            <li>타인의 개인정보를 침해하거나 명예를 훼손하는 행위</li>
            <li>불법적인 목적으로 서비스를 이용하는 행위</li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="text-sm font-bold mb-2">제5조 (서비스 변경 및 중단)</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            서비스는 운영상 필요한 경우 서비스 내용을 변경하거나 중단할 수 있습니다. 중요한 변경이나
            서비스 종료 시 이용자에게 사전 공지를 통해 알립니다.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-sm font-bold mb-2">제6조 (AI 코칭 서비스 면책)</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            서비스가 제공하는 AI 코칭 및 건강 관련 피드백은 <strong>참고 목적의 정보</strong>이며,
            의료적 조언이나 전문 영양상담을 대체하지 않습니다. 건강에 이상이 있는 경우 반드시
            전문 의료기관을 방문하시기 바랍니다. 이용자가 AI 피드백에 따른 결과에 대해 서비스는
            책임을 지지 않습니다.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-sm font-bold mb-2">제7조 (준거법 및 분쟁 해결)</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            이 약관은 대한민국 법률을 준거법으로 하며, 서비스 이용과 관련한 분쟁은 관할 법원에서
            해결합니다.
          </p>
        </section>

        <div className="mt-8 pt-4 border-t border-border">
          <Link href="/privacy" className="text-xs text-navy underline underline-offset-2">
            개인정보처리방침 보기 →
          </Link>
        </div>
      </main>
    </div>
  );
}
