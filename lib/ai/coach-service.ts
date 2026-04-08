import { generateText } from "ai";
import { openrouter, MODEL } from "./openrouter";
import type { DailyLog, Settings } from "@/lib/types";
import { generateDailySummary } from "@/lib/utils/templates";

// ──────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────

/**
 * 체중 입력 시 즉시 피드백 생성
 * daily-log-service의 generateFeedback() 을 대체
 */
export async function generateAiFeedback(
  log: DailyLog,
  prevWeight: number | null,
  settings: Settings
): Promise<string> {
  if (!process.env.OPENROUTER_API_KEY) {
    return fallbackFeedback(log, prevWeight, settings.waterGoal);
  }

  try {
    const abort = AbortSignal.timeout(5_000); // 5초 초과 시 fallback (Vercel 10s 제한 대응)
    const { text } = await generateText({
      model: openrouter(MODEL),
      system: buildSystemPrompt(settings),
      prompt: `오늘 입력 데이터:\n${buildContext(log, prevWeight, settings)}\n\n짧고 직접적인 코칭 한 마디(2~3문장)를 해줘.`,
      maxOutputTokens: 150,
      temperature: 0.7,
      abortSignal: abort,
    });
    return text.trim();
  } catch (err) {
    console.error("[coach-service] generateAiFeedback 실패:", err);
    return fallbackFeedback(log, prevWeight, settings.waterGoal);
  }
}

/**
 * 마감 / 총평 재생성 시 일일 총평 생성 (AI, 코치 스타일 반영)
 */
export async function generateAiDailySummary(
  log: DailyLog,
  settings: Settings
): Promise<string> {
  if (!process.env.OPENROUTER_API_KEY) {
    return generateDailySummary(log, settings.waterGoal);
  }

  try {
    const abort = AbortSignal.timeout(10_000);
    const { text } = await generateText({
      model: openrouter(MODEL),
      system: buildSystemPrompt(settings),
      prompt: `오늘 하루 기록:\n${buildContext(log, null, settings)}\n\n이 데이터를 바탕으로 3~4문장으로 오늘을 총평해줘. 수치 포함, 잘한 점·아쉬운 점·내일을 위한 한 마디를 담아.`,
      maxOutputTokens: 200,
      temperature: 0.7,
      abortSignal: abort,
    });
    return text.trim();
  } catch (err) {
    console.error("[coach-service] generateAiDailySummary 실패:", err);
    return generateDailySummary(log, settings.waterGoal);
  }
}

/**
 * 마감 시 홈 탭 "코치 한마디" 한줄 요약 생성
 * daily-log-service의 generateOneLiner() 을 대체
 */
export async function generateAiOneLiner(
  log: DailyLog,
  settings: Settings
): Promise<string> {
  if (!process.env.OPENROUTER_API_KEY) {
    return fallbackOneLiner(log);
  }

  try {
    const abort = AbortSignal.timeout(5_000); // 5초 초과 시 fallback (Vercel 10s 제한 대응)
    const { text } = await generateText({
      model: openrouter(MODEL),
      system: buildSystemPrompt(settings),
      prompt: `오늘 하루 요약:\n${buildContext(log, null, settings)}\n\n20자 이내로 오늘을 한 줄 총평해줘. 문장 부호 제외, 핵심만.`,
      maxOutputTokens: 60,
      temperature: 0.8,
      abortSignal: abort,
    });
    return text.trim();
  } catch (err) {
    console.error("[coach-service] generateAiOneLiner 실패:", err);
    return fallbackOneLiner(log);
  }
}

// ──────────────────────────────────────────────
// 내부 헬퍼
// ──────────────────────────────────────────────

export function buildSystemPrompt(settings: Settings): string {
  const styleMap: Record<string, string> = {
    strong: "팩트 위주로 강하고 직접적으로",
    balanced: "팩트와 격려를 균형 있게",
    empathy: "부드럽고 공감적으로",
    data: "감정 없이 수치와 트렌드 중심으로",
  };

  return `너는 다이어트 코치 "${settings.coachName}"야.
스타일: ${styleMap[settings.coachStylePreset] ?? "균형 있게"}.
배경지식: 데이터에 'Hard Reset Mode'가 있다면, 이는 체중이 최저치 대비 일정치 이상 증가하여 너(코치)가 강제로 발동시킨 긴급 감량 체제야. 사용자가 자발적으로 켠 게 아니므로 각오를 칭찬하지 말고, "다시 최저 몸무게로 돌아갈 때까지 정신 바짝 차리자"는 뉘앙스로 강하게 몰아붙이거나 이끌어줘.
규칙: 한국어로만, 존댓말 금지, 2~3문장 이내, 수치 언급 시 kg/L 단위 포함.`;
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
    parts.push(`체중 ${log.weight}kg (어제 대비 ${sign}${diff}kg).`);
  } else if (log.weight !== null) {
    parts.push(`체중 ${log.weight}kg.`);
  }
  if (log.water !== null) {
    const remaining = Math.round((waterGoal - log.water) * 10) / 10;
    if (remaining > 0) {
      parts.push(`수분 ${remaining}L 남았어.`);
    } else {
      parts.push(`수분 목표 달성!`);
    }
  }
  parts.push(log.intensiveDay ? "오늘 식단 관리가 핵심이야." : "이 흐름 유지해.");
  return parts.join(" ");
}

function fallbackOneLiner(log: DailyLog): string {
  if (log.intensiveDay && log.exercise === "Y" && log.lateSnack === "N") {
    return "집중 관리일에 운동까지 — 오늘 잘 버텼어.";
  }
  if (log.exercise === "Y" && log.lateSnack === "N") {
    return "운동하고 야식 안 먹은 하루 — 착실한 관리야.";
  }
  if (log.exercise === "N" && log.lateSnack === "Y") {
    return "운동도 야식도 아쉬운 하루 — 내일 반드시 만회해.";
  }
  return "오늘 하루 수고했어 — 내일도 이 흐름 이어가자.";
}
