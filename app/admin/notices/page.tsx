import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { Pencil, Plus, Trash2, MessageSquare } from "lucide-react";
import { actionAdminDeleteNotice } from "@/app/admin/actions/notice-admin-actions";
import { DeleteNoticeButton } from "./delete-notice-button";

export const dynamic = "force-dynamic";

export default async function AdminNoticesPage() {
  await requireAdmin();
  const client = createAdminClient();

  // 공지사항 목록 + 댓글 수
  const { data: notices } = await client
    .from("notices")
    .select("id, title, is_important, published_at, author")
    .order("published_at", { ascending: false });

  // 댓글 수 (공지별)
  const { data: commentCounts } = await client
    .from("notice_comments")
    .select("notice_id");

  const countMap: Record<string, number> = {};
  for (const c of commentCounts ?? []) {
    countMap[c.notice_id] = (countMap[c.notice_id] ?? 0) + 1;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">공지사항 관리</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {notices?.length ?? 0}개의 공지사항
          </p>
        </div>
        <Link
          href="/admin/notices/new"
          className="flex items-center gap-2 px-4 py-2.5 bg-navy text-white rounded-xl text-sm font-semibold hover:bg-navy/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          새 공지사항
        </Link>
      </div>

      {!notices?.length ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground text-sm">
          공지사항이 없습니다.
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">제목</th>
                <th className="text-center px-3 py-3 font-semibold text-muted-foreground w-16">중요</th>
                <th className="text-right px-3 py-3 font-semibold text-muted-foreground w-24 hidden sm:table-cell">게시일</th>
                <th className="text-center px-3 py-3 font-semibold text-muted-foreground w-16 hidden sm:table-cell">댓글</th>
                <th className="w-24 px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {notices.map((n) => (
                <tr key={n.id} className="border-b border-border last:border-0 hover:bg-secondary/20 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-medium line-clamp-1">{n.title}</span>
                    <span className="text-xs text-muted-foreground ml-2">{n.author}</span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    {n.is_important ? (
                      <span className="inline-block px-1.5 py-0.5 bg-rose-100 text-rose-600 text-[10px] font-bold rounded">중요</span>
                    ) : (
                      <span className="text-muted-foreground/40">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right text-muted-foreground hidden sm:table-cell">
                    {new Date(n.published_at).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                  </td>
                  <td className="px-3 py-3 hidden sm:table-cell">
                    <div className="flex items-center justify-center gap-1 text-muted-foreground">
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span className="text-xs">{countMap[n.id] ?? 0}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/admin/notices/${n.id}/edit`}
                        className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                        title="수정"
                      >
                        <Pencil className="w-4 h-4" />
                      </Link>
                      <DeleteNoticeButton id={n.id} title={n.title} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
