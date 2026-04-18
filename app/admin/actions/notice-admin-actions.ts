"use server";

import { requireAdmin } from "@/lib/auth/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateText } from "ai";
import { openrouter, MODEL } from "@/lib/ai/openrouter";
import { NOTICE_WRITING_GUIDELINE_PROMPT } from "@/lib/ai/prompts";
import { logAiUsage } from "@/lib/ai/usage-logger";
import { revalidatePath } from "next/cache";

// ---------------------------------------------------------------------------
// 공지사항 CRUD
// ---------------------------------------------------------------------------

export async function actionAdminCreateNotice(data: {
  title: string;
  content: string;
  author: string;
  isImportant: boolean;
  publishedAt: string; // ISO string
}) {
  await requireAdmin();
  const client = createAdminClient();
  const { error } = await client.from("notices").insert({
    title: data.title,
    content: data.content,
    author: data.author,
    is_important: data.isImportant,
    published_at: data.publishedAt,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/notices");
}

export async function actionAdminUpdateNotice(
  id: string,
  data: {
    title: string;
    content: string;
    author: string;
    isImportant: boolean;
    publishedAt: string;
  }
) {
  await requireAdmin();
  const client = createAdminClient();
  const { error } = await client
    .from("notices")
    .update({
      title: data.title,
      content: data.content,
      author: data.author,
      is_important: data.isImportant,
      published_at: data.publishedAt,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/notices");
  revalidatePath(`/admin/notices/${id}/edit`);
}

export async function actionAdminDeleteNotice(id: string) {
  await requireAdmin();
  const client = createAdminClient();
  const { error } = await client.from("notices").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/notices");
}

// ---------------------------------------------------------------------------
// 댓글 삭제 (관리자)
// ---------------------------------------------------------------------------

export async function actionAdminDeleteComment(commentId: string) {
  await requireAdmin();
  const client = createAdminClient();
  const { error } = await client
    .from("notice_comments")
    .delete()
    .eq("id", commentId);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// AI 공지 재작성
// ---------------------------------------------------------------------------

export async function actionAdminRewriteWithAI(
  draft: string,
  adminUserId: string
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  await requireAdmin();

  if (!process.env.OPENROUTER_API_KEY) {
    return { ok: false, error: "OPENROUTER_API_KEY가 설정되지 않았습니다." };
  }

  const prompt = NOTICE_WRITING_GUIDELINE_PROMPT.replace("{{input_text}}", draft);

  try {
    const start = Date.now();
    const { text, usage } = await generateText({
      model: openrouter(MODEL),
      prompt,
      maxOutputTokens: 800,
      temperature: 0.5,
    });

    logAiUsage({
      userId: adminUserId,
      callType: "notice_rewrite",
      model: MODEL,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      latencyMs: Date.now() - start,
      success: true,
    });

    return { ok: true, text };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    logAiUsage({
      userId: adminUserId,
      callType: "notice_rewrite",
      model: MODEL,
      success: false,
      errorMessage: msg,
    });
    return { ok: false, error: msg };
  }
}
