"use server";

import { revalidatePath } from "next/cache";
import { startNewChapter, getChapters, getChapterScopes } from "@/lib/services/chapter-service";
import type { DietChapter, Settings, StartNewChapterInput, ChapterScope } from "@/lib/types";

export async function actionGetChapterScopes(): Promise<ChapterScope[]> {
  try {
    return await getChapterScopes();
  } catch {
    return [];
  }
}

export async function actionStartNewChapter(
  input: StartNewChapterInput
): Promise<Settings | null> {
  try {
    const result = await startNewChapter(input);
    revalidatePath("/home");
    revalidatePath("/graph");
    revalidatePath("/settings");
    revalidatePath("/input");
    return result;
  } catch (e) {
    console.error("[chapter-actions] startNewChapter 실패:", e);
    return null;
  }
}

export async function actionGetChapters(): Promise<DietChapter[]> {
  try {
    return await getChapters();
  } catch {
    return [];
  }
}
