import { generateText } from "ai";
import { openrouter, MODEL } from "./openrouter";
import type { DailyLog, Settings } from "@/lib/types";
import { generateDailySummary } from "@/lib/utils/templates";
import { logAiUsage, AiCallType } from "./usage-logger";
import { getAuthUser } from "@/lib/supabase/server";
import {
  COACH_STYLE_MAP,
  COACH_HARD_RESET_SECTION,
  COACH_ROUTINE_SECTION,
  COACH_SYSTEM_PROMPT,
  COACH_FEEDBACK_PROMPT,
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
  changedField: string | null,
  recentLogs: DailyLog[] = []
): Promise<string> {
  if (!process.env.OPENROUTER_API_KEY) {
    return fallbackFeedback(log, prevWeight, settings.waterGoal);
  }

  const fieldLine = changedField ? `\n방금 입력한 항목: ${changedField}` : "";
  const focusInstruction = changedField
    ? `"${changedField}"을/를 중심으로 코칭 한 마디(2~3문장). 단, [사용자 루틴] 규칙에 위배되는 인과 연결은 절대 하지 마라.`
    : `오늘 입력 내용을 중심으로 코칭 한 마디(2~3문장). 단, [사용자 루틴] 규칙에 위배되는 인과 연결은 절대 하지 마라.`;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const { text, usage } = await generateText({
      model: openrouter(MODEL),
      system: buildSystemPrompt(settings, log.intensiveDay ?? false),
      prompt: fillPrompt(COACH_FEEDBACK_PROMPT, {
        today_context: buildContext(log, prevWeight, settings),
        field_line: fieldLine,
        recent_section: buildRecentSection(recentLogs, log.date),
        focus_instruction: focusInstruction,
      }),
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
    coach_style: COACH_STYLE_MAP[settings.coachStylePreset] ?? "오늘 행동 중심으로",
    style_extra: buildStyleExtra(settings.coachStyleExtra),
    routine_section: buildRoutineSection(settings),
    hard_reset_section: intensiveDay ? COACH_HARD_RESET_SECTION : "",
  });
}

/** settings.coachStyleExtra(사용자 추가 스타일 지시) → 시스템 프롬프트 조각 */
function buildStyleExtra(extra: string[] | undefined): string {
  const items = (extra ?? []).map((s) => s.trim()).filter(Boolean);
  if (items.length === 0) return "";
  return ` 사용자가 추가한 스타일 지시(반드시 반영): ${items.join(" / ")}.`;
}

/** settings.routineWeightTime / routineExtra → 루틴 섹션 (체중 측정 시점 + 추가 규칙) */
function buildRoutineSection(settings: Settings): string {
  const weightTime = settings.routineWeightTime?.trim() || "아침 기상 직후";
  const extraLines = (settings.routineExtra ?? [])
    .map((r) => r.trim())
    .filter(Boolean)
    .map((r) => `- ${r}`)
    .join("\n");
  return fillPrompt(COACH_ROUTINE_SECTION, {
    routine_weight_time: weightTime,
    routine_extra_lines: extraLines,
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
    const v = log.exercise === "Y" ? "함" : (log.exercise === "N" || log.exercise === "SKIP") ? "안 함" : log.exercise;
    lines.push(`운동: ${v}`);
  }
  if (log.breakfast) lines.push(`아침: ${log.breakfast}`);
  if (log.lunch) lines.push(`점심: ${log.lunch}`);
  if (log.dinner) {
    const alcoholTag = log.dinnerAlcohol ? " (술 포함)" : "";
    lines.push(`저녁: ${log.dinner}${alcoholTag}`);
  }
  if (log.lateSnack) {
    const v = log.lateSnack === "Y" ? "먹음" : (log.lateSnack === "N" || log.lateSnack === "SKIP") ? "안 먹음" : log.lateSnack;
    const alcoholTag = log.lateSnackAlcohol ? " (술 포함)" : "";
    lines.push(`야식: ${v}${alcoholTag}`);
  }
  if (log.customFieldValue != null && settings.customField) {
    lines.push(`${settings.customField.name}: ${log.customFieldValue}`);
  }
  if (log.intensiveDay) lines.push(`오늘은 Hard Reset Mode`);

  return lines.join("\n");
}

/**
 * 최근 1주 기록을 피드백 맥락으로 요약한다.
 * recentLogs: 날짜 내림차순(가까운 날부터), refDate(=오늘) 이전 날들.
 * 측정 시점 기반 인과 분석에 쓰이도록 어제→과거 순으로 각 날을 한 줄씩 압축.
 */
function buildRecentSection(recentLogs: DailyLog[], refDate: string): string {
  const lines = recentLogs
    .slice(0, 7)
    .map((l) => {
      const parts: string[] = [];
      if (l.weight !== null) parts.push(`체중 ${l.weight}kg`);
      if (l.breakfast) parts.push(`아침 ${mealText(l.breakfast)}`);
      if (l.lunch) parts.push(`점심 ${mealText(l.lunch)}`);
      if (l.dinner) {
        const alcohol = l.dinnerAlcohol ? "+술" : "";
        parts.push(`저녁 ${mealText(l.dinner)}${alcohol}`);
      }
      if (l.lateSnack) {
        const v = l.lateSnack === "Y" ? "O" : (l.lateSnack === "N" || l.lateSnack === "SKIP") ? "X" : l.lateSnack;
        const alcohol = l.lateSnackAlcohol ? "+술" : "";
        parts.push(`야식 ${v}${alcohol}`);
      }
      if (l.exercise) {
        const v = l.exercise === "Y" ? "O" : (l.exercise === "N" || l.exercise === "SKIP") ? "X" : l.exercise;
        parts.push(`운동 ${v}`);
      }
      if (l.water !== null) parts.push(`수분 ${l.water}L`);
      if (parts.length === 0) return null;
      return `- ${relativeDayLabel(l.date, refDate)}: ${parts.join(" · ")}`;
    })
    .filter((v): v is string => v !== null);

  if (lines.length === 0) return "";
  return `[최근 기록 (가까운 날부터)]\n${lines.join("\n")}`;
}

function mealText(v: string): string {
  return v === "SKIP" ? "안 먹음" : v;
}

function relativeDayLabel(date: string, refDate: string): string {
  const diff = Math.round(
    (new Date(refDate + "T00:00:00").getTime() -
      new Date(date + "T00:00:00").getTime()) /
      86_400_000
  );
  const [, m, d] = date.split("-");
  const md = `${parseInt(m)}/${parseInt(d)}`;
  return diff === 1 ? `어제(${md})` : `${diff}일 전(${md})`;
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
