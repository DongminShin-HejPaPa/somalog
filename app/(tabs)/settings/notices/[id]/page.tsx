import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getNotice } from "@/lib/services/notice-service";
import { NoticeDetailClient } from "@/components/notices/notice-detail-client";
import { MarkdownContent } from "@/components/notices/markdown-content";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

export default async function NoticeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const notice = await getNotice(id);

  if (!notice) {
    notFound();
  }

  return (
    <div className="pb-6">
      <header className="px-4 pt-4 pb-2 flex items-center gap-2">
        <Link
          href="/settings/notices"
          className="p-1 -ml-1 rounded-lg hover:bg-secondary active:bg-secondary/80 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-lg font-bold">공지사항</h1>
      </header>

      {/* 본문 */}
      <article className="px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2 mb-1">
          {notice.isImportant && (
            <span className="inline-flex text-[10px] font-semibold bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded">
              중요
            </span>
          )}
          <h2 className="text-base font-bold leading-snug">{notice.title}</h2>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-4">
          <span>{notice.author}</span>
          <span>·</span>
          <span>{formatDate(notice.publishedAt)}</span>
        </div>
        <MarkdownContent source={notice.content} />
      </article>

      {/* 댓글 영역 (클라이언트 컴포넌트) */}
      <Suspense fallback={<div className="px-4 py-4 text-sm text-muted-foreground">댓글 불러오는 중...</div>}>
        <NoticeDetailClient noticeId={id} />
      </Suspense>
    </div>
  );
}
