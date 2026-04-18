"use client";

import dynamic from "next/dynamic";
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

// SSR 비활성화 — @uiw/react-md-editor 는 브라우저 전용
const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false });

// AI 재작성 구분자
const AI_SEPARATOR = "\n---\n신규 내용 (AI 작성)\n";

function applyAiRewrite(current: string, aiText: string): string {
  if (current.includes(AI_SEPARATOR)) {
    // 재클릭: 구분자 이후만 교체
    const idx = current.indexOf(AI_SEPARATOR);
    return current.slice(0, idx + AI_SEPARATOR.length) + aiText;
  }
  // 최초: 기존 내용 + AI 섹션 추가
  return `${current}${AI_SEPARATOR}${aiText}`;
}

/**
 * AI 섹션 텍스트에서 제목과 내용을 파싱.
 * 프롬프트 출력 형식: "공지사항 제목 : ...\n공지사항 내용 :\n..."
 * 파싱 실패 시 전체를 content로 반환.
 */
function parseAiSection(aiSection: string): { title?: string; content: string } {
  const titleMatch = aiSection.match(/공지사항\s*제목\s*:\s*(.+)/);
  const contentMatch = aiSection.match(/공지사항\s*내용\s*:\s*\n([\s\S]+)/);
  if (titleMatch && contentMatch) {
    return { title: titleMatch[1].trim(), content: contentMatch[1].trim() };
  }
  return { content: aiSection.trim() };
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
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  // AI 섹션이 있는 상태 (반영하기/취소 버튼 활성화 조건)
  const [hasAiSection, setHasAiSection] = useState(false);

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

  // ──────────────────────────────────────────────
  // AI 재작성
  // ──────────────────────────────────────────────
  async function handleAiRewrite() {
    const draft = content.trim();
    if (!draft) return;

    // AI 섹션이 이미 있으면 원본 부분만 초안으로 사용
    const rawDraft = draft.includes(AI_SEPARATOR)
      ? draft.split(AI_SEPARATOR)[0].trim()
      : draft;

    setIsAiLoading(true);
    setAiError(null);
    const result = await actionAdminRewriteWithAI(rawDraft, adminUserId);
    setIsAiLoading(false);

    if (result.ok) {
      setContent(applyAiRewrite(content, result.text));
      setHasAiSection(true);
    } else {
      setAiError(result.error);
    }
  }

  // AI 내용 반영: 신규 섹션 파싱 → 제목/내용 교체
  function handleApplyAi() {
    const idx = content.indexOf(AI_SEPARATOR);
    if (idx === -1) return;

    const aiSection = content.slice(idx + AI_SEPARATOR.length);
    const parsed = parseAiSection(aiSection);

    if (parsed.title) setTitle(parsed.title);

    // AI 고지 문구가 빠진 경우(프롬프트 최상단에 배치되어 파싱에서 누락될 수 있음) 강제 삽입
    const DISCLAIMER = "* 이 글은 AI가 자동으로 생성한 것입니다.";
    const finalContent = parsed.content.includes(DISCLAIMER)
      ? parsed.content
      : `${DISCLAIMER}\n\n${parsed.content}`;

    setContent(finalContent);
    setHasAiSection(false);
  }

  // AI 섹션 취소: 원본 내용으로 복원
  function handleCancelAi() {
    const idx = content.indexOf(AI_SEPARATOR);
    if (idx === -1) return;
    setContent(content.slice(0, idx));
    setHasAiSection(false);
  }

  // 에디터에서 직접 AI_SEPARATOR를 지우면 hasAiSection 동기화
  function handleContentChange(v: string) {
    setContent(v);
    if (hasAiSection && !v.includes(AI_SEPARATOR)) {
      setHasAiSection(false);
    }
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
          <div className="flex items-center gap-2">
            {/* 반영하기 / 취소 — AI 섹션이 있을 때만 활성 */}
            <button
              type="button"
              onClick={handleCancelAi}
              disabled={!hasAiSection}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors",
                hasAiSection
                  ? "border border-border text-muted-foreground hover:bg-secondary"
                  : "text-muted-foreground/40 cursor-not-allowed"
              )}
            >
              <X className="w-3 h-3" />
              취소
            </button>
            <button
              type="button"
              onClick={handleApplyAi}
              disabled={!hasAiSection}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors",
                hasAiSection
                  ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                  : "bg-secondary text-muted-foreground/40 cursor-not-allowed"
              )}
            >
              <CheckCheck className="w-3 h-3" />
              반영하기
            </button>
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
        </div>

        {aiError && (
          <p className="text-xs text-rose-600 mb-2">⚠️ {aiError}</p>
        )}

        <div data-color-mode="light">
          <MDEditor
            value={content}
            onChange={(v) => handleContentChange(v ?? "")}
            height={360}
            preview="live"
          />
        </div>

        {hasAiSection && (
          <p className="text-[10px] text-violet-600 mt-1.5">
            ✨ AI가 재작성한 내용이 에디터 하단에 추가됐습니다. 내용을 검토 후 <strong>반영하기</strong>를 눌러 적용하거나, <strong>취소</strong>로 원본을 복원하세요.
          </p>
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
          닫기
        </button>
      </div>
    </div>
  );
}
