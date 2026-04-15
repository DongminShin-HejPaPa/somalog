"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, X, Megaphone } from "lucide-react";
import { actionGetUnseenImportantNotices, actionMarkNoticesSeen } from "@/app/actions/notice-actions";
import type { Notice } from "@/lib/types";

interface NoticePopupProps {
  lastNoticeSeenAt: string | null;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

export function NoticePopup({ lastNoticeSeenAt }: NoticePopupProps) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [index, setIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    actionGetUnseenImportantNotices(lastNoticeSeenAt).then((data) => {
      setNotices(data);
    });
  }, [lastNoticeSeenAt]);

  const handleClose = async () => {
    setDismissed(true);
    // 팝업에 표시된 공지 중 가장 최신 published_at을 저장 (NOW() 대신)
    // → 팝업 확인 후 새로 올라온 공지는 다음 새로고침 때 다시 표시됨
    if (notices.length > 0) {
      const maxPublishedAt = notices.reduce(
        (max, n) => (n.publishedAt > max ? n.publishedAt : max),
        notices[0].publishedAt
      );
      actionMarkNoticesSeen(maxPublishedAt).catch(() => {});
    }
  };

  if (dismissed || notices.length === 0) return null;

  const notice = notices[index];
  const total = notices.length;

  return (
    /* 반투명 오버레이 */
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-navy/5">
          <div className="flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-navy" />
            <span className="text-sm font-semibold text-navy">공지사항</span>
          </div>
          <button
            onClick={handleClose}
            className="p-1 rounded-lg hover:bg-secondary active:bg-secondary/80 transition-colors"
            aria-label="닫기"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* 본문 */}
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center gap-2 mb-1">
            {notice.isImportant && (
              <span className="inline-flex text-[10px] font-semibold bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded shrink-0">
                중요
              </span>
            )}
            <h2 className="text-sm font-bold leading-snug line-clamp-2">{notice.title}</h2>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground mb-3">
            <span>{notice.author}</span>
            <span>·</span>
            <span>{formatDate(notice.publishedAt)}</span>
          </div>
          <p className="text-sm leading-relaxed text-foreground line-clamp-5 whitespace-pre-wrap">
            {notice.content}
          </p>
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border">
          {/* 페이지 내비게이션 */}
          {total > 1 ? (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
                disabled={index === 0}
                className="p-1 rounded-lg hover:bg-secondary disabled:opacity-30 transition-colors"
                aria-label="이전 공지"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-muted-foreground px-1">
                {index + 1} / {total}
              </span>
              <button
                onClick={() => setIndex((i) => Math.min(total - 1, i + 1))}
                disabled={index === total - 1}
                className="p-1 rounded-lg hover:bg-secondary disabled:opacity-30 transition-colors"
                aria-label="다음 공지"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <Link
              href={`/settings/notices/${notice.id}`}
              onClick={handleClose}
              className="text-xs text-navy font-medium hover:underline"
            >
              자세히 보기
            </Link>
            <button
              onClick={handleClose}
              className="px-3 py-1.5 rounded-lg bg-navy text-white text-xs font-medium hover:bg-navy/90 active:scale-[0.97] transition-all"
            >
              확인
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
