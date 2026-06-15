import { createOpenAI } from "@ai-sdk/openai";

if (!process.env.OPENROUTER_API_KEY) {
  console.warn(
    "[openrouter] OPENROUTER_API_KEY가 설정되지 않았습니다. AI 코칭이 비활성화됩니다."
  );
}

/** OpenRouter를 AI SDK provider로 연결 */
export const openrouter = createOpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY ?? "missing",
  headers: {
    "HTTP-Referer": "https://somalog.app",
    "X-Title": "SomaLog",
  },
});

/**
 * 기본 모델 — Gemini 2.5 Flash Lite (non-reasoning, in $0.10/M · out $0.40/M)
 * 구 모델 google/gemini-2.0-flash-001 은 OpenRouter에서 endpoint가 제거되어
 * ("No endpoints found") 2026-06-01 이후 전 호출 실패 → 동일 단가의 후속 모델로 교체.
 * 코칭 품질을 더 높이려면 google/gemini-2.5-flash (in $0.30/M · out $2.50/M) 로 상향 가능.
 */
export const MODEL = "google/gemini-2.5-flash-lite";
