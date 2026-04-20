import { generateText } from "ai";
import { openrouter, MODEL } from "./openrouter";
import type { DailyLog, Settings } from "@/lib/types";
import { generateDailySummary } from "@/lib/utils/templates";
import { logAiUsage, AiCallType } from "./usage-logger";
import { getAuthUser } from "@/lib/supabase/server";
import {
  COACH_STYLE_MAP,
  COACH_HARD_RESET_SECTION,
  COACH_SYSTEM_PROMPT,
  COACH_DAILY_SUMMARY_PROMPT,
  COACH_ONE_LINER_PROMPT,
  fillPrompt,
} from "./prompts";

// ──────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────

/**
 * Soma의 피드백 (입력 탭)
 * 체중 입력 시 즉시 피드백 생성
 */
export async function generateAiFeedback(
  log: DailyLog,
  prevWeight: number | null,
  settings: Settings,
  changedField: string | null
): Promise<string> {
  if (!process.env.OPENROUTER_API_KEY) {
    return fallbackFeedback(log, prevWeight, settings.waterGoal);
  }

  const fieldLine = changedField ? `\n방금 입력한 항목: ${changedField}` : "";
  const focusInstruction = changedField
    ? `"${changedField}"을/를 중심으로 나머지 오늘 맥락과 연결해 코칭 한 마디(2~3문장).`
    : `오늘 입력 내용을 중심으로 코칭 한 마디(2~3문장).`;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const { text, usage } = await generateText({
      model: openrouter(MODEL),
      system: buildSystemPrompt(settings, log.intensiveDay ?? false),
      prompt: `오늘 입력 데이터:\n${buildContext(log, prevWeight, settings)}${fieldLine}\n\n${focusInstruction} 단순 수치 나열 금지. Hard Reset Mode는 맥락 정보 단서일 뿐야.`,
      maxOutputTokens: 150,
      temperature: 0.7,
      abortSignal: controller.signal,
    });
    clearTimeout(timeoutId);

    getAuthUser().then(user => {
      if (user) {
        logAiUsage({
          userId: user.id,
          callType: "feedback",
          model: MODEL,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          success: true,
        });
      }
    }).catch(e => console.error("Logging async auth error:", e));

    return text.trim();
  } catch (err) {
    console.error("[coach-service] generateAiFeedback 실패:", err);
    getAuthUser().then(user => {
      if (user) {
        logAiUsage({
          userId: user.id,
          callType: "feedback",
          model: MODEL,
          success: false,
          errorMessage: err instanceof Error ? err.message : String(err),
        });
      }
    }).catch(e => console.error("Logging async auth error:", e));
    return fallbackFeedback(log, prevWeight, settings.waterGoal);
  }
}

/**
 * 코치의 총평 (기록 탭)
 * 마감 / 총평 재생성 시 일일 총평 생성 (AI, 코치 스타일 반영)
 */
export async function generateAiDailySummary(
  log: DailyLog,
  settings: Settings,
  prevWeight: number | null
): Promise<string> {
  if (!process.env.OPENROUTER_API_KEY) {
    return generateDailySummary(log, settings.waterGoal);
  }
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const { text, usage } = await generateText({
      model: openrouter(MODEL),
      system: buildSystemPrompt(settings, log.intensiveDay ?? false),
      prompt: fillPrompt(COACH_DAILY_SUMMARY_PROMPT, {
        context: buildContext(log, prevWeight, settings),
      }),
      maxOutputTokens: 250,
      temperature: 0.7,
      abortSignal: controller.signal,
    });
    clearTimeout(timeoutId);

    getAuthUser().then(user => {
      if (user) {
        logAiUsage({
          userId: user.id,
          callType: "daily_summary",
          model: MODEL,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          success: true,
        });
      }
    }).catch(e => console.error("Logging async auth error:", e));

    return text.trim();
  } catch (err) {
    console.error("[coach-service] generateAiDailySummary 실패:", err);
    getAuthUser().then(user => {
      if (user) {
        logAiUsage({
          userId: user.id,
          callType: "daily_summary",
          model: MODEL,
          success: false,
          errorMessage: err instanceof Error ? err.message : String(err),
        });
      }
    }).catch(e => console.error("Logging async auth error:", e));
    return generateDailySummary(log, settings.waterGoal);
  }
}

/**
 * Soma의 한마디 (홈 탭)
 * 마감 시 홈 탭 "Soma의 한마디" 한줄 요약 생성
 */
export async function generateAiOneLiner(
  log: DailyLog,
  settings: Settings
): Promise<string> {
  if (!process.env.OPENROUTER_API_KEY) {
    return fallbackOneLiner(log);
  }
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const { text, usage } = await generateText({
      model: openrouter(MODEL),
      system: buildSystemPrompt(settings, log.intensiveDay ?? false),
      prompt: fillPrompt(COACH_ONE_LINER_PROMPT, {
        context: buildContext(log, null, settings),
      }),
      maxOutputTokens: 60,
      temperature: 0.8,
      abortSignal: controller.signal,
    });
    clearTimeout(timeoutId);

    getAuthUser().then(user => {
      if (user) {
        logAiUsage({
          userId: user.id,
          callType: "one_liner",
          model: MODEL,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          success: true,
        });
      }
    }).catch(e => console.error("Logging async auth error:", e));

    return text.trim();
  } catch (err) {
    console.error("[coach-service] generateAiOneLiner 실패:", err);
    getAuthUser().then(user => {
      if (user) {
        logAiUsage({
          userId: user.id,
          callType: "one_liner",
          model: MODEL,
          success: false,
          errorMessage: err instanceof Error ? err.message : String(err),
        });
      }
    }).catch(e => console.error("Logging async auth error:", e));
    return fallbackOneLiner(log);
  }
}

// ──────────────────────────────────────────────
// 내부 헬퍼
// ──────────────────────────────────────────────

export function buildSystemPrompt(settings: Settings, intensiveDay?: boolean): string {
  return fillPrompt(COACH_SYSTEM_PROMPT, {
    coach_name: settings.coachName,
    coach_style: COACH_STYLE_MAP[settings.coachStylePreset] ?? "오늘 행동 중심으로",
    hard_reset_section: intensiveDay ? COACH_HARD_RESET_SECTION : "",
  });
}

export function buildContext(
  log: DailyLog,
  prevWeight: number | null,
  settings: Settings
): string {
  const lines: string[] = [];

  if (log.weight !== null) {
    const diff =
      prevWeight !== null
        ? ` (전날 대비 ${log.weight - prevWeight > 0 ? "+" : ""}${(log.weight - prevWeight).toFixed(1)}kg)`
        : "";
    lines.push(`체중: ${log.weight}kg${diff}`);
  }
  if (log.water !== null) {
    lines.push(`수분: ${log.water}/${settings.waterGoal}L`);
  }
  if (log.exercise) {
    lines.push(`운동: ${log.exercise === "Y" ? "함" : "안 함"}`);
  }
  if (log.breakfast) lines.push(`아침: ${log.breakfast}`);
  if (log.lunch) lines.push(`점심: ${log.lunch}`);
  if (log.dinner) lines.push(`저녁: ${log.dinner}`);
  if (log.lateSnack) {
    lines.push(`야식: ${log.lateSnack === "Y" ? "먹음" : "안 먹음"}`);
  }
  if (log.customFieldValue != null && settings.customField) {
    lines.push(`${settings.customField.name}: ${log.customFieldValue}`);
  }
  if (log.intensiveDay) lines.push(`오늘은 Hard Reset Mode`);

  return lines.join("\n");
}

/** API 키 없거나 오류 시 규칙 기반 fallback */
function fallbackFeedback(
  log: DailyLog,
  prevWeight: number | null,
  waterGoal: number
): string {
  const parts: string[] = [];
  if (log.weight !== null && prevWeight !== null) {
    const diff = Math.round((log.weight - prevWeight) * 10) / 10;
    const sign = diff > 0 ? "+" : "";
    if (diff < 0) {
      parts.push(`체중 ${log.weight}kg, 전날 대비 ${sign}${diff}kg. 좋은 흐름이야.`);
    } else if (diff > 0) {
      parts.push(`체중 ${log.weight}kg, 전날 대비 ${sign}${diff}kg. 등락은 자연스러워.`);
    } else {
      parts.push(`체중 ${log.weight}kg, 전날과 동일.`);
    }
  } else if (log.weight !== null) {
    parts.push(`체중 ${log.weight}kg 기록 완료.`);
  }
  if (log.water !== null) {
    const remaining = Math.round((waterGoal - log.water) * 10) / 10;
    if (remaining > 0) {
      parts.push(`수분 ${remaining}L 남았어.`);
    } else {
      parts.push(`수분 목표 달성!`);
    }
  }
  if (log.exercise === "Y") parts.push("오늘 운동까지 했어 👍");
  if (!log.intensiveDay) parts.push("이 흐름 유지해.");
  else parts.push("오늘은 Hard Reset Mode — 식단 신경 쓰자.");
  return parts.join(" ");
}

function fallbackOneLiner(log: DailyLog): string {
  if (log.intensiveDay && log.exercise === "Y" && log.lateSnack === "N") {
    return "Hard Reset Mode 상황에 맞게 운동까지! — 오늘 잘 버텼어.";
  }
  if (log.exercise === "Y" && log.lateSnack === "N") {
    return "운동하고 야식 안 먹은 하루 — 착실한 관리야.";
  }
  if (log.exercise === "N" && log.lateSnack === "Y") {
    return "운동도 야식도 아쉬운 하루 — 내일 반드시 만회해.";
  }
  return "오늘 하루 수고했어 — 내일도 이 흐름 이어가자.";
}
