"use client";

import { useState, useEffect, useTransition } from "react";
import { createBrowserClient } from "@supabase/ssr";
import {
  actionGetNoticeComments,
  actionAddNoticeComment,
  actionDeleteNoticeComment,
} from "@/app/actions/notice-actions";
import type { NoticeComment } from "@/lib/types";
import { Trash2 } from "lucide-react";

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function NoticeDetailClient({ noticeId }: { noticeId: string }) {
  const [comments, setComments] = useState<NoticeComment[]>([]);
  const [name, setName] = useState("");
  const [newComment, setNewComment] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!
    );
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null);
    });

    actionGetNoticeComments(noticeId).then(setComments);
  }, [noticeId]);

  const handleSubmit = () => {
    const trimmedName = name.trim();
    const trimmedContent = newComment.trim();
    if (!trimmedName || !trimmedContent || isPending) return;

    startTransition(async () => {
      const comment = await actionAddNoticeComment(noticeId, trimmedName, trimmedContent);
      setComments((prev) => [...prev, comment]);
      setNewComment("");
      // 이름은 유지 (다음 댓글에도 동일한 이름 사용)
    });
  };

  const handleDelete = (commentId: string) => {
    startTransition(async () => {
      await actionDeleteNoticeComment(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    });
  };

  return (
    <section className="px-4 py-4">
      <h3 className="text-sm font-semibold mb-3">
        댓글 {comments.length > 0 ? `(${comments.length})` : ""}
      </h3>

      {/* 댓글 목록 */}
      {comments.length === 0 ? (
        <p className="text-xs text-muted-foreground mb-4">첫 번째 댓글을 남겨보세요!</p>
      ) : (
        <ul className="space-y-3 mb-4">
          {comments.map((c) => (
            <li key={c.id} className="bg-secondary/60 rounded-xl px-3 py-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <span className="text-xs font-semibold text-navy">{c.name || "익명"}</span>
                  <p className="text-sm leading-relaxed mt-0.5">{c.content}</p>
                </div>
                {userId === c.userId && (
                  <button
                    onClick={() => handleDelete(c.id)}
                    disabled={isPending}
                    className="shrink-0 p-1 text-muted-foreground hover:text-rose-500 transition-colors"
                    aria-label="댓글 삭제"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                {formatDateTime(c.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      )}

      {/* 댓글 입력 */}
      {userId ? (
        <div className="space-y-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="이름"
            className="w-full text-sm px-3 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-navy/20"
          />
          <div className="flex gap-2 items-end">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder="댓글을 입력하세요..."
              rows={2}
              className="flex-1 text-sm px-3 py-2 border border-border rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-navy/20"
            />
            <button
              onClick={handleSubmit}
              disabled={!name.trim() || !newComment.trim() || isPending}
              className="px-4 py-2 rounded-xl bg-navy text-white text-sm font-medium disabled:opacity-40 transition-opacity shrink-0"
            >
              등록
            </button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">댓글을 작성하려면 로그인이 필요합니다.</p>
      )}
    </section>
  );
}
