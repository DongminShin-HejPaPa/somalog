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

/** 기본 모델 — Gemini 2.0 Flash (non-reasoning, $0.10/M tokens) */
export const MODEL = "google/gemini-2.0-flash-001";
