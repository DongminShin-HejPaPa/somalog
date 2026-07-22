"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Loader2, Sparkles, CheckCheck, X } from "lucide-react";
import {
  actionAdminCreateNotice,
  actionAdminUpdateNotice,
  actionAdminRewriteWithAI,
} from "@/app/admin/actions/notice-admin-actions";
import type { Notice } from "@/lib/types";

/**
 * AI 출력(## 공지사항 제목 : ... / ## 공지사항 내용 : ...)에서 제목·내용 파싱.
 * 형식이 맞지 않으면 전체를 내용으로 사용한다.
 */
function parseAiSection(aiText: string): { title?: string; content: string } {
  const titleMatch = aiText.match(/공지사항\s*제목\s*:\s*(.+)/);
  const contentMatch = aiText.match(/공지사항\s*내용\s*:\s*\n([\s\S]+)/);
  if (titleMatch && contentMatch) {
    return { title: titleMatch[1].trim(), content: contentMatch[1].trim() };
  }
  return { content: aiText.trim() };
}

// UTC ISO string → KST "YYYY-MM-DDTHH:mm" (datetime-local 표시용)
function utcToKstLocal(utcStr: string): string {
  const kst = new Date(new Date(utcStr).getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 16);
}

// datetime-local 값(KST 기준) → UTC ISO string (DB 저장용)
function kstLocalToUtc(kstLocal: string): string {
  return new Date(`${kstLocal}:00+09:00`).toISOString();
}

interface NoticeFormProps {
  mode: "create" | "edit";
  notice?: Notice;
  adminUserId: string;
}

export function NoticeForm({ mode, notice, adminUserId }: NoticeFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [title, setTitle] = useState(notice?.title ?? "");
  const [content, setContent] = useState(notice?.content ?? "");
  const [author, setAuthor] = useState(notice?.author ?? "관리자");
  const [isImportant, setIsImportant] = useState(notice?.isImportant ?? false);
  const [publishedAt, setPublishedAt] = useState(
    notice?.publishedAt
      ? utcToKstLocal(notice.publishedAt)
      : utcToKstLocal(new Date().toISOString())
  );

  const [saveError, setSaveError] = useState<string | null>(null);

  // AI 재작성
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);

  // ──────────────────────────────────────────────
  // AI 재작성 — 초안을 재작성해 아래 제안 박스에 표시 (에디터를 건드리지 않음)
  // ──────────────────────────────────────────────
  async function handleAiRewrite() {
    const draft = content.trim();
    if (!draft || aiLoading) return;
    setAiLoading(true);
    setAiError(null);
    setAiSuggestion(null);
    const result = await actionAdminRewriteWithAI(draft, adminUserId);
    setAiLoading(false);
    if (result.ok) setAiSuggestion(result.text);
    else setAiError(result.error);
  }

  // 반영하기 — 제안에서 제목·내용을 파싱해 입력란에 채운다.
  function handleApplyAi() {
    if (!aiSuggestion) return;
    const parsed = parseAiSection(aiSuggestion);
    if (parsed.title) setTitle(parsed.title);
    setContent(parsed.content);
    setAiSuggestion(null);
    setAiError(null);
  }

  // ──────────────────────────────────────────────
  // 저장
  // ──────────────────────────────────────────────
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
          publishedAt: kstLocalToUtc(publishedAt), // KST → UTC 변환
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

  const field =
    "w-full px-3 py-2.5 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-navy/20";

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
          className={field}
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
          className={field}
        />
      </div>

      {/* 내용 — 플레인 텍스트 에디터 + AI 재작성 */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-sm font-medium">내용</label>
          <button
            type="button"
            onClick={handleAiRewrite}
            disabled={aiLoading || !content.trim()}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors",
              aiLoading || !content.trim()
                ? "bg-secondary text-muted-foreground cursor-not-allowed"
                : "bg-violet-100 text-violet-700 hover:bg-violet-200"
            )}
          >
            {aiLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            {aiLoading ? "재작성 중..." : "AI로 재작성"}
          </button>
        </div>

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={16}
          placeholder="공지사항 내용을 입력하세요. (마크다운 사용 가능)"
          className={cn(field, "resize-y leading-relaxed font-mono")}
        />

        {aiError && <p className="text-xs text-rose-600 mt-1.5">⚠️ {aiError}</p>}

        {/* AI 재작성 제안 미리보기 → 반영/취소 */}
        {aiSuggestion && (
          <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50/60 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-violet-200 bg-violet-100/60">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-violet-700">
                <Sparkles className="w-3.5 h-3.5" />
                AI 재작성 제안
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setAiSuggestion(null)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-muted-foreground border border-border bg-white hover:bg-secondary transition-colors"
                >
                  <X className="w-3 h-3" />
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleApplyAi}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-white bg-violet-600 hover:bg-violet-700 transition-colors"
                >
                  <CheckCheck className="w-3 h-3" />
                  반영하기
                </button>
              </div>
            </div>
            <pre className="px-3 py-2.5 text-xs leading-relaxed text-foreground whitespace-pre-wrap break-words font-sans max-h-72 overflow-y-auto">
              {aiSuggestion}
            </pre>
            <p className="px-3 pb-2 text-[10px] text-violet-600">
              ✨ 제목·내용을 검토 후 <strong>반영하기</strong>를 누르면 위 입력란에 채워집니다.
            </p>
          </div>
        )}
      </div>

      {/* 게시일 (KST 기준 표시/입력) */}
      <div>
        <label className="block text-sm font-medium mb-1.5">
          게시일
          <span className="ml-1.5 text-xs text-muted-foreground font-normal">KST 기준</span>
        </label>
        <input
          type="datetime-local"
          value={publishedAt}
          onChange={(e) => setPublishedAt(e.target.value)}
          className="px-3 py-2.5 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-navy/20"
        />
      </div>

      {/* 중요 여부 — inline-flex 토글 */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={isImportant}
          onClick={() => setIsImportant(!isImportant)}
          className={cn(
            "inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors",
            isImportant ? "bg-rose-500" : "bg-gray-300"
          )}
        >
          <span
            className={cn(
              "pointer-events-none h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200",
              isImportant ? "translate-x-5" : "translate-x-0"
            )}
          />
        </button>
        <span className="text-sm font-medium">
          중요 공지
          {isImportant && (
            <span className="ml-2 text-xs text-rose-600 font-semibold">(팝업으로 표시됨)</span>
          )}
        </span>
      </div>

      {/* 에러 */}
      {saveError && <p className="text-sm text-rose-600">❌ {saveError}</p>}

      {/* 버튼 */}
      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={() => router.push("/admin/notices")}
          disabled={isPending}
          className="px-6 py-3 rounded-xl text-sm font-medium border border-border hover:bg-secondary transition-colors"
        >
          닫기
        </button>
        <button
          onClick={handleSave}
          disabled={isPending || !title.trim() || !content.trim()}
          className={cn(
            "px-10 py-3 rounded-xl text-sm font-semibold transition-colors min-h-[48px]",
            isPending || !title.trim() || !content.trim()
              ? "bg-secondary text-muted-foreground cursor-not-allowed"
              : "bg-navy text-white hover:bg-navy/90"
          )}
        >
          {isPending ? "저장 중..." : mode === "create" ? "게시하기" : "수정 완료"}
        </button>
      </div>
    </div>
  );
}
