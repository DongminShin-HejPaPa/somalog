"use server";

import { generateObject } from "ai";
import { jsonSchema } from "ai";
import { openrouter, MODEL } from "@/lib/ai/openrouter";
import type { DailyLogUpdate } from "@/lib/types";

/**
 * 자유 텍스트를 LLM으로 파싱해 DailyLogUpdate 반환.
 * - 오타·구어체·이모티콘 모두 처리
 * - currentWeight가 있으면 "어제보다 0.4 늘었고" 같은 상대적 표현도 해석 가능
 */
export async function actionParseFreText(
  text: string,
  todayWeight: number | null,
  prevWeight: number | null
): Promise<DailyLogUpdate> {
  if (!process.env.OPENROUTER_API_KEY) {
    return {};
  }

  const todayRef = todayWeight != null ? `${todayWeight}kg` : null;
  const prevRef = prevWeight != null ? `${prevWeight}kg` : null;
  const currentRef = todayRef ?? prevRef; // 오늘값 없으면 어제값으로 fallback

  const weightContext = [
    todayWeight != null ? `오늘 이미 기록된 체중: ${todayWeight}kg` : "오늘 체중 미기록",
    prevWeight != null ? `어제(직전) 체중: ${prevWeight}kg` : null,
    `"어제보다", "전날보다" 등 → 어제 체중(${prevRef ?? "정보 없음"}) 기준으로 계산`,
    `"지금보다", "현재보다", "오늘보다" 등 → ${currentRef ? `${currentRef} 기준으로 계산` : "기준 체중 정보 없음, null 반환"}`,
  ].filter(Boolean).join("\n");

  try {
    const { object } = await generateObject({
      model: openrouter(MODEL),
      schema: jsonSchema<{
        weight: number | null;
        water: number | null;
        exercise: "Y" | "N" | null;
        breakfast: string | null;
        lunch: string | null;
        dinner: string | null;
        lateSnack: "Y" | "N" | null;
      }>({
        type: "object",
        properties: {
          weight: {
            type: ["number", "null"],
            description: "체중(kg). 언급 없으면 null. 상대 표현은 system 지시의 기준 체중으로 계산해 절댓값으로 반환.",
          },
          water: {
            type: ["number", "null"],
            description: "수분 섭취량(L). 언급 없으면 null.",
          },
          exercise: {
            type: ["string", "null"],
            enum: ["Y", "N", null],
            description: "운동 여부. 했으면 Y, 안 했으면 N, 언급 없으면 null.",
          },
          breakfast: {
            type: ["string", "null"],
            description: "아침 식사 내용 문자열. 언급 없으면 null.",
          },
          lunch: {
            type: ["string", "null"],
            description: "점심 식사 내용 문자열. 언급 없으면 null.",
          },
          dinner: {
            type: ["string", "null"],
            description: "저녁 식사 내용 문자열. 언급 없으면 null.",
          },
          lateSnack: {
            type: ["string", "null"],
            enum: ["Y", "N", null],
            description: "야식 여부. 먹었으면 Y, 안 먹었으면 N, 언급 없으면 null. 'ㅇㅇ'·'응'·긍정 이모티콘은 Y로 해석.",
          },
        },
        required: ["weight", "water", "exercise", "breakfast", "lunch", "dinner", "lateSnack"],
      }),
      system: `너는 한국어 다이어트 앱의 입력 파싱 도우미야.
사용자가 자유롭게 입력한 텍스트에서 다이어트 일지 필드를 추출한다.
규칙:
- 오타(예: 체ㅈ → 체중), 구어체(예: 안함 → 운동 안 함), 이모티콘(예: ㅠㅠ, ㅇㅇ)을 모두 올바르게 해석한다.
- 명확히 언급되지 않은 필드는 반드시 null로 둔다. 추측하지 않는다.
- 아침/점심/저녁 내용은 원문 그대로(간략 요약 없이) 보존한다.
- ${weightContext}`,
      prompt: text,
      maxRetries: 1,
    });

    // null 값은 결과에서 제외해 DailyLogUpdate 형태로 정리
    const update: DailyLogUpdate = {};
    if (object.weight != null) update.weight = Math.round(object.weight * 10) / 10;
    if (object.water != null) update.water = object.water;
    if (object.exercise != null) update.exercise = object.exercise;
    if (object.breakfast != null) update.breakfast = object.breakfast;
    if (object.lunch != null) update.lunch = object.lunch;
    if (object.dinner != null) update.dinner = object.dinner;
    if (object.lateSnack != null) update.lateSnack = object.lateSnack;
    return update;
  } catch (err) {
    console.error("[parse-actions] actionParseFreText 실패:", err);
    return {};
  }
}
