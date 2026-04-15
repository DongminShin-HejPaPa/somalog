"use server";

import type { Notice, NoticeComment } from "@/lib/types";
import {
  getNotices,
  getNotice,
  getUnseenImportantNotices,
  getNoticeComments,
  addNoticeComment,
  updateNoticeComment,
  deleteNoticeComment,
  markNoticesSeen,
} from "@/lib/services/notice-service";

export async function actionGetNotices(): Promise<Notice[]> {
  return getNotices();
}

export async function actionGetNotice(id: string): Promise<Notice | null> {
  return getNotice(id);
}

export async function actionGetUnseenImportantNotices(
  lastSeenAt: string | null
): Promise<Notice[]> {
  return getUnseenImportantNotices(lastSeenAt);
}

export async function actionGetNoticeComments(
  noticeId: string
): Promise<NoticeComment[]> {
  return getNoticeComments(noticeId);
}

export async function actionAddNoticeComment(
  noticeId: string,
  name: string,
  content: string
): Promise<NoticeComment> {
  return addNoticeComment(noticeId, name, content);
}

export async function actionUpdateNoticeComment(
  commentId: string,
  content: string
): Promise<NoticeComment> {
  return updateNoticeComment(commentId, content);
}

export async function actionDeleteNoticeComment(
  commentId: string
): Promise<void> {
  return deleteNoticeComment(commentId);
}

export async function actionMarkNoticesSeen(): Promise<void> {
  return markNoticesSeen();
}
