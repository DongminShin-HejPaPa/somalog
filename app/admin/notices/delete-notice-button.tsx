"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { actionAdminDeleteNotice } from "@/app/admin/actions/notice-admin-actions";

export function DeleteNoticeButton({ id, title }: { id: string; title: string }) {
  const [confirm, setConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleDelete() {
    startTransition(async () => {
      await actionAdminDeleteNotice(id);
      router.refresh();
    });
  }

  if (confirm) {
    return (
      <div className="flex items-center gap-1">
        <button
          onClick={handleDelete}
          disabled={isPending}
          className="px-2 py-1 text-xs bg-rose-600 text-white rounded-lg font-semibold disabled:opacity-50"
        >
          {isPending ? "..." : "삭제"}
        </button>
        <button
          onClick={() => setConfirm(false)}
          disabled={isPending}
          className="px-2 py-1 text-xs border border-border rounded-lg"
        >
          취소
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirm(true)}
      className="p-1.5 rounded-lg hover:bg-rose-50 transition-colors text-muted-foreground hover:text-rose-600"
      title={`"${title}" 삭제`}
    >
      <Trash2 className="w-4 h-4" />
    </button>
  );
}
