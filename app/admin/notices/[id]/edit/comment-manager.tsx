"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { actionAdminDeleteComment } from "@/app/admin/actions/notice-admin-actions";
import type { NoticeComment } from "@/lib/types";

export function CommentManager({ comments }: { comments: NoticeComment[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  function handleDelete(commentId: string) {
    setDeletingId(commentId);
    startTransition(async () => {
      await actionAdminDeleteComment(commentId);
      setDeletingId(null);
      setConfirmId(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {comments.map((c) => (
        <div
          key={c.id}
          className="flex items-start gap-3 p-3 rounded-xl border border-border bg-secondary/20"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xs font-semibold">{c.name || "익명"}</span>
              <span className="text-[10px] text-muted-foreground">
                {new Date(c.createdAt).toLocaleString("ko-KR", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <p className="text-sm text-foreground">{c.content}</p>
          </div>

          <div className="shrink-0">
            {confirmId === c.id ? (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleDelete(c.id)}
                  disabled={isPending && deletingId === c.id}
                  className="px-2 py-1 text-xs bg-rose-600 text-white rounded-lg font-semibold disabled:opacity-50"
                >
                  {isPending && deletingId === c.id ? "..." : "삭제"}
                </button>
                <button
                  onClick={() => setConfirmId(null)}
                  className="px-2 py-1 text-xs border border-border rounded-lg"
                >
                  취소
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmId(c.id)}
                className="p-1.5 rounded-lg hover:bg-rose-50 transition-colors text-muted-foreground hover:text-rose-600"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
