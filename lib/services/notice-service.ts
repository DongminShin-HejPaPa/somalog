import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/supabase/server";
import type { Notice, NoticeComment } from "@/lib/types";

function rowToNotice(row: Record<string, unknown>): Notice {
  return {
    id: row.id as string,
    title: row.title as string,
    content: row.content as string,
    author: row.author as string,
    publishedAt: row.published_at as string,
    isImportant: (row.is_important as boolean) ?? false,
  };
}

function rowToComment(row: Record<string, unknown>): NoticeComment {
  return {
    id: row.id as string,
    noticeId: row.notice_id as string,
    userId: row.user_id as string,
    name: (row.name as string) ?? "",
    content: row.content as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

/** 공지사항 목록 조회 (최신순) */
export async function getNotices(): Promise<Notice[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notices")
    .select("*")
    .order("published_at", { ascending: false });

  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(rowToNotice);
}

/** 단일 공지사항 조회 */
export async function getNotice(id: string): Promise<Notice | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notices")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return rowToNotice(data as Record<string, unknown>);
}

/**
 * 사용자가 아직 확인하지 않은 중요 공지사항 목록 (최신순)
 * lastSeenAt 이후에 게시된 is_important=true 공지
 */
export async function getUnseenImportantNotices(lastSeenAt: string | null): Promise<Notice[]> {
  const supabase = await createClient();

  let query = supabase
    .from("notices")
    .select("*")
    .eq("is_important", true)
    .order("published_at", { ascending: false }); // 최신 공지 먼저

  if (lastSeenAt) {
    query = query.gt("published_at", lastSeenAt);
  }

  const { data, error } = await query;
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(rowToNotice);
}

/** 공지사항 댓글 목록 조회 (오래된순) */
export async function getNoticeComments(noticeId: string): Promise<NoticeComment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notice_comments")
    .select("*")
    .eq("notice_id", noticeId)
    .order("created_at", { ascending: true });

  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(rowToComment);
}

/** 댓글 작성 */
export async function addNoticeComment(noticeId: string, name: string, content: string): Promise<NoticeComment> {
  const user = await getAuthUser();
  if (!user) throw new Error("Unauthorized");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notice_comments")
    .insert({ notice_id: noticeId, user_id: user.id, name, content })
    .select()
    .single();

  if (error || !data) throw new Error(error?.message ?? "insert failed");
  return rowToComment(data as Record<string, unknown>);
}

/** 댓글 수정 */
export async function updateNoticeComment(commentId: string, content: string): Promise<NoticeComment> {
  const user = await getAuthUser();
  if (!user) throw new Error("Unauthorized");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notice_comments")
    .update({ content })
    .eq("id", commentId)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error || !data) throw new Error(error?.message ?? "update failed");
  return rowToComment(data as Record<string, unknown>);
}

/** 댓글 삭제 */
export async function deleteNoticeComment(commentId: string): Promise<void> {
  const user = await getAuthUser();
  if (!user) throw new Error("Unauthorized");

  const supabase = await createClient();
  const { error } = await supabase
    .from("notice_comments")
    .delete()
    .eq("id", commentId)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);
}

/** 공지 팝업 확인 시각 업데이트 — seenAt: 팝업에 표시된 공지 중 최신 published_at */
export async function markNoticesSeen(seenAt: string): Promise<void> {
  const user = await getAuthUser();
  if (!user) return;

  const supabase = await createClient();
  await supabase
    .from("settings")
    .update({ last_notice_seen_at: seenAt })
    .eq("user_id", user.id);
}
