import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { NoticeForm } from "@/components/admin/notice-form";
import { ChevronLeft } from "lucide-react";
import { CommentManager } from "./comment-manager";
import type { Notice, NoticeComment } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminNoticesEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const adminUserId = await requireAdmin();
  const { id } = await params;
  const client = createAdminClient();

  const [noticeRes, commentsRes] = await Promise.all([
    client.from("notices").select("*").eq("id", id).single(),
    client
      .from("notice_comments")
      .select("*")
      .eq("notice_id", id)
      .order("created_at", { ascending: true }),
  ]);

  if (noticeRes.error || !noticeRes.data) notFound();

  const row = noticeRes.data as Record<string, unknown>;
  const notice: Notice = {
    id: row.id as string,
    title: row.title as string,
    content: row.content as string,
    author: row.author as string,
    publishedAt: row.published_at as string,
    isImportant: (row.is_important as boolean) ?? false,
  };

  const comments: NoticeComment[] = (
    (commentsRes.data as Record<string, unknown>[]) ?? []
  ).map((c) => ({
    id: c.id as string,
    noticeId: c.notice_id as string,
    userId: c.user_id as string,
    name: (c.name as string) ?? "",
    content: c.content as string,
    createdAt: c.created_at as string,
    updatedAt: c.updated_at as string,
  }));

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/notices"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          공지사항 목록
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">공지사항 수정</h1>
      </div>

      <div className={`grid gap-6 items-start ${comments.length > 0 ? "xl:grid-cols-[1fr_360px]" : ""}`}>
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <NoticeForm mode="edit" notice={notice} adminUserId={adminUserId} />
        </div>

        {/* 댓글 관리 — xl 이상에서 우측 사이드 패널 */}
        {comments.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
            <h2 className="text-base font-semibold mb-4">
              댓글 관리
              <span className="ml-2 text-sm text-muted-foreground font-normal">
                {comments.length}개
              </span>
            </h2>
            <CommentManager comments={comments} />
          </div>
        )}
      </div>
    </div>
  );
}
