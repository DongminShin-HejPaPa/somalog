"use client";

import dynamic from "next/dynamic";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Loader2, Sparkles } from "lucide-react";
import {
  actionAdminCreateNotice,
  actionAdminUpdateNotice,
  actionAdminRewriteWithAI,
} from "@/app/admin/actions/notice-admin-actions";
import type { Notice } from "@/lib/types";

// SSR 비활성화 — @uiw/react-md-editor 는 브라우저 전용
const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false });

// AI 재작성 구분자 (감지 + 삽입에 동일하게 사용)
const HUMAN_LABEL = "기존 내용 (인간 작성)\n";
const AI_SEPARATOR = "\n---\n신규 내용 (AI 작성)\n";

function applyAiRewrite(current: string, aiText: string): string {
  if (current.includes(AI_SEPARATOR)) {
    // 재클릭: 구분자 이후만 교체
    const idx = current.indexOf(AI_SEPARATOR);
    return current.slice(0, idx + AI_SEPARATOR.length) + aiText;
  }
  // 최초: 기존 내용 레이블 + AI 섹션 추가
  return `${HUMAN_LABEL}${current}${AI_SEPARATOR}${aiText}`;
}

interface NoticeFormProps {
  mode: "create" | "edit";
  notice?: Notice;
  adminUserId: string;
}

export function NoticeForm({ mode, notice, adminUserId }: NoticeFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const [title, setTitle] = useState(notice?.title ?? "");
  const [content, setContent] = useState(notice?.content ?? "");
  const [author, setAuthor] = useState(notice?.author ?? "관리자");
  const [isImportant, setIsImportant] = useState(notice?.isImportant ?? false);
  const [publishedAt, setPublishedAt] = useState(
    notice?.publishedAt
      ? notice.publishedAt.slice(0, 16) // "YYYY-MM-DDTHH:mm"
      : new Date().toISOString().slice(0, 16)
  );

  const [saveError, setSaveError] = useState<string | null>(null);

  // AI 재작성 버튼
  async function handleAiRewrite() {
    const draft = content.trim();
    if (!draft) return;

    // AI 섹션이 있으면 원본 부분(구분자 앞)만 초안으로 사용
    const rawDraft = draft.includes(AI_SEPARATOR)
      ? draft.split(AI_SEPARATOR)[0].replace(HUMAN_LABEL, "").trim()
      : draft;

    setIsAiLoading(true);
    setAiError(null);
    const result = await actionAdminRewriteWithAI(rawDraft, adminUserId);
    setIsAiLoading(false);

    if (result.ok) {
      setContent(applyAiRewrite(content, result.text));
    } else {
      setAiError(result.error);
    }
  }

  // 저장
  function handleSave() {
    if (!title.trim() || !content.trim()) return;
    setSaveError(null);

    startTransition(async () => {
      try {
        const data = {
          title: title.trim(),
          content: content.trim(),
          author: author.trim() || "관리자",
          isImportant,
          publishedAt: new Date(publishedAt).toISOString(),
        };

        if (mode === "create") {
          await actionAdminCreateNotice(data);
        } else {
          await actionAdminUpdateNotice(notice!.id, data);
        }
        router.push("/admin/notices");
        router.refresh();
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : "저장 실패");
      }
    });
  }

  return (
    <div className="space-y-5">
      {/* 제목 */}
      <div>
        <label className="block text-sm font-medium mb-1.5">제목</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="공지사항 제목을 입력하세요"
          className="w-full px-3 py-2.5 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-navy/20"
        />
      </div>

      {/* 작성자 */}
      <div>
        <label className="block text-sm font-medium mb-1.5">작성자</label>
        <input
          type="text"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          placeholder="관리자"
          className="w-full px-3 py-2.5 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-navy/20"
        />
      </div>

      {/* 내용 — 마크다운 에디터 */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-sm font-medium">내용</label>
          <button
            type="button"
            onClick={handleAiRewrite}
            disabled={isAiLoading || !content.trim()}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors",
              isAiLoading || !content.trim()
                ? "bg-secondary text-muted-foreground cursor-not-allowed"
                : "bg-violet-100 text-violet-700 hover:bg-violet-200"
            )}
          >
            {isAiLoading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Sparkles className="w-3 h-3" />
            )}
            AI로 재작성
          </button>
        </div>

        {aiError && (
          <p className="text-xs text-rose-600 mb-2">⚠️ {aiError}</p>
        )}

        <div data-color-mode="light">
          <MDEditor
            value={content}
            onChange={(v) => setContent(v ?? "")}
            height={360}
            preview="live"
          />
        </div>

        <p className="text-[10px] text-muted-foreground mt-1.5">
          마크다운 문법을 지원합니다. AI 재작성 버튼을 누르면 현재 내용을 초안으로 AI가 다듬어줍니다.
        </p>
      </div>

      {/* 게시일 */}
      <div>
        <label className="block text-sm font-medium mb-1.5">게시일</label>
        <input
          type="datetime-local"
          value={publishedAt}
          onChange={(e) => setPublishedAt(e.target.value)}
          className="px-3 py-2.5 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-navy/20"
        />
      </div>

      {/* 중요 여부 */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setIsImportant(!isImportant)}
          className={cn(
            "w-11 h-6 rounded-full transition-colors relative",
            isImportant ? "bg-rose-500" : "bg-border"
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform",
              isImportant ? "translate-x-5" : "translate-x-0.5"
            )}
          />
        </button>
        <span className="text-sm font-medium">
          중요 공지
          {isImportant && (
            <span className="ml-2 text-xs text-rose-600 font-semibold">
              (팝업으로 표시됨)
            </span>
          )}
        </span>
      </div>

      {/* 에러 */}
      {saveError && (
        <p className="text-sm text-rose-600">❌ {saveError}</p>
      )}

      {/* 버튼 */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={handleSave}
          disabled={isPending || !title.trim() || !content.trim()}
          className={cn(
            "flex-1 py-3 rounded-xl text-sm font-semibold transition-colors min-h-[48px]",
            isPending || !title.trim() || !content.trim()
              ? "bg-secondary text-muted-foreground cursor-not-allowed"
              : "bg-navy text-white hover:bg-navy/90"
          )}
        >
          {isPending ? "저장 중..." : mode === "create" ? "게시하기" : "수정 완료"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/notices")}
          disabled={isPending}
          className="px-5 py-3 rounded-xl text-sm font-medium border border-border hover:bg-secondary transition-colors"
        >
          취소
        </button>
      </div>
    </div>
  );
}
