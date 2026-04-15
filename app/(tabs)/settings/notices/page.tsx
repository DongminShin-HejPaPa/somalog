import { Suspense } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Megaphone } from "lucide-react";
import { getNotices } from "@/lib/services/notice-service";
import type { Notice } from "@/lib/types";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

async function NoticeList() {
  const notices = await getNotices();

  if (notices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Megaphone className="w-10 h-10 mb-3 opacity-30" />
        <p className="text-sm">공지사항이 없습니다</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {notices.map((notice: Notice) => (
        <li key={notice.id}>
          <Link
            href={`/settings/notices/${notice.id}`}
            className="flex items-start justify-between px-4 py-4 hover:bg-secondary/50 active:bg-secondary transition-colors gap-3"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                {notice.isImportant && (
                  <span className="inline-flex items-center text-[10px] font-semibold bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded shrink-0">
                    중요
                  </span>
                )}
                <span className="text-sm font-medium truncate">{notice.title}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span>{notice.author}</span>
                <span>·</span>
                <span>{formatDate(notice.publishedAt)}</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function NoticesPage() {
  return (
    <div className="pb-6">
      <header className="px-4 pt-4 pb-2 flex items-center gap-2">
        <Link
          href="/settings"
          className="p-1 -ml-1 rounded-lg hover:bg-secondary active:bg-secondary/80 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-lg font-bold">공지사항</h1>
      </header>
      <Suspense
        fallback={
          <div className="px-4 space-y-3 mt-2 animate-pulse">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-14 bg-secondary rounded-xl" />
            ))}
          </div>
        }
      >
        <NoticeList />
      </Suspense>
    </div>
  );
}
