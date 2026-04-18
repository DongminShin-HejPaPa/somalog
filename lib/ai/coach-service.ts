import { generateText } from "ai";
import { openrouter, MODEL } from "./openrouter";
import type { DailyLog, Settings } from "@/lib/types";
import { generateDailySummary } from "@/lib/utils/templates";
import { logAiUsage, AiCallType } from "./usage-logger";
import { getAuthUser } from "@/lib/supabase/server";

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
      prompt: `오늘 하루 기록:\n${buildContext(log, prevWeight, settings)}\n\n오늘의 행동과 패턴을 분석하고, 전문가 노력으로 3~4문장 총평해.\n- 단순 데이터 나열 절대 금지\n- 잘한 점과 아쉬운 점을 행동 맥락에서 평가\n- 최근 선택들이 체중과 건강에 어떤 영향을 줄 것인지 짜임새 있게\n- 내일을 위한 한 마디 코치로 마무리\n- Hard Reset Mode가 있다면 하나의 맥락으로만 사용.`,
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
      prompt: `오늘 하루 요약:\n${buildContext(log, null, settings)}\n\n20자 이내로 오늘을 한 줄 총평해. 문장 부호 제외, 핵심만.`,
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
  const styleMap: Record<string, string> = {
    strong: "오늘 행동에 대해 직접적으로 평가하고, 아쉬운 점은 동기와 함께 감추지 않고 직백하게",
    balanced: "오늘 행동의 패턴과 그 의미를 짚어줌. 좋은 행동은 그 성과를 인정하고, 아쉬운 행동에는 '왜' 이유를 파악해 전략적 조언을 내놓음. 단순한 수치 나열이 아닌, 행동의 의미와 덧붙여지는 영향을 짜임 있게",
    empathy: "사용자의 수고를 먼저 인정하고, 감정에 공감하면서 듣는 것이 생산적임을 라이트하게",
    data: "체중 추세와 행동 패턴을 데이터 관점에서 분석. 감정어 최소화, 추세와 취약점 융심 업무적 톤으로",
  };

  const hardResetSection = intensiveDay
    ? `\n[Hard Reset Mode 배경]
- Hard Reset Mode는 코치인 네가 강제 발동하는 굴지 모드야. 사용자가 켠 게 아님. 체중이 역대 최저 대비 설정치 이상 높아졌을 때 발동.
- Hard Reset Mode 일 때는 식단과 운동에 가장 주목하되, 여전히 "올곧 역대 최저로 돌아가는 것"이 한 파트 맥락일 뿐, Hard Reset Mode만이 전담 바직하면 안 됨.
- 'Hard Reset Mode라니 각오가 대단한데?' 같은 문장 무조건 안 됨. 사용자가 스스로 탠 것이 아니니까.`
    : "";

  return `너는 다이어트 코치 "${settings.coachName}"야.
가장 중요한 것: 소의 효과는 "오늘 사용자가 한 행동"을 가장 먼저 짚는 것이야. 나머지 데이터는 모두 행동을 평가하는 재료야.
코치 스타일: ${styleMap[settings.coachStylePreset] ?? "오늘 행동 중심으로"}.${hardResetSection}

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
