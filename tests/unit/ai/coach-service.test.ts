import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mockDailyLog, mockSettings } from "../../fixtures/mock-data";

// ──────────────────────────────────────────────
// ai 패키지 mock (OpenRouter 실제 호출 차단)
// ──────────────────────────────────────────────
vi.mock("ai", () => ({
  generateText: vi.fn(),
}));

vi.mock("@/lib/ai/openrouter", () => ({
  openrouter: vi.fn((model: string) => model),
  MODEL: "test-model",
}));

import { generateText } from "ai";
import {
  generateAiFeedback,
  generateAiOneLiner,
  buildSystemPrompt,
  buildContext,
} from "@/lib/ai/coach-service";

const mockGenerateText = vi.mocked(generateText);

// ──────────────────────────────────────────────
// 테스트
// ──────────────────────────────────────────────

describe("buildSystemPrompt()", () => {
  it("코치 이름이 시스템 프롬프트에 포함된다", () => {
    const result = buildSystemPrompt({ ...mockSettings, coachName: "소마" });
    expect(result).toContain("소마");
  });

  it.each([
    ["strong", "직접적으로"],
    ["balanced", "행동의 패턴"],
    ["empathy", "공감"],
    ["data", "데이터"],
  ] as const)("coachStylePreset '%s' → 스타일 설명 포함", (preset, keyword) => {
    const result = buildSystemPrompt({ ...mockSettings, coachStylePreset: preset });
    expect(result).toContain(keyword);
  });
});

describe("buildContext()", () => {
  it("체중 + 전날 비교가 포함된다", () => {
    const result = buildContext(
      { ...mockDailyLog, weight: 80.0 },
      80.5,
      mockSettings
    );
    expect(result).toContain("80kg");
    expect(result).toContain("-0.5kg");
  });

  it("수분 목표 대비 현재 섭취량이 포함된다", () => {
    const result = buildContext(
      { ...mockDailyLog, water: 1.5 },
      null,
      { ...mockSettings, waterGoal: 2.5 }
    );
    expect(result).toContain("1.5/2.5L");
  });

  it("운동 Y → '함' 표시", () => {
    const result = buildContext({ ...mockDailyLog, exercise: "Y" }, null, mockSettings);
    expect(result).toContain("운동: 함");
  });

  it("야식 N → '안 먹음' 표시", () => {
    const result = buildContext({ ...mockDailyLog, lateSnack: "N" }, null, mockSettings);
    expect(result).toContain("야식: 안 먹음");
  });

  it("Intensive Day면 컨텍스트에 포함된다", () => {
    const result = buildContext(
      { ...mockDailyLog, intensiveDay: true },
      null,
      mockSettings
    );
    expect(result).toContain("Hard Reset Mode");
  });

  it("null 값 항목은 컨텍스트에 포함되지 않는다", () => {
    const result = buildContext(
      { ...mockDailyLog, water: null, exercise: null, breakfast: null },
      null,
      mockSettings
    );
    expect(result).not.toContain("수분:");
    expect(result).not.toContain("운동:");
    expect(result).not.toContain("아침:");
  });
});

describe("generateAiFeedback()", () => {
  const originalEnv = process.env.OPENROUTER_API_KEY;

  beforeEach(() => {
    process.env.OPENROUTER_API_KEY = "test-key";
    mockGenerateText.mockReset();
  });

  afterEach(() => {
    process.env.OPENROUTER_API_KEY = originalEnv;
  });

  it("AI 응답 텍스트를 반환한다", async () => {
    mockGenerateText.mockResolvedValue({ text: "오늘 체중 잘 유지했어." } as never);

    const result = await generateAiFeedback(mockDailyLog, 80.5, mockSettings);

    expect(result).toBe("오늘 체중 잘 유지했어.");
    expect(mockGenerateText).toHaveBeenCalledOnce();
  });

  it("generateText에 system 프롬프트와 context가 전달된다", async () => {
    mockGenerateText.mockResolvedValue({ text: "좋아." } as never);

    await generateAiFeedback(
      { ...mockDailyLog, weight: 79.5 },
      80.0,
      { ...mockSettings, coachName: "테스트코치" }
    );

    const call = mockGenerateText.mock.calls[0][0];
    expect(call.system).toContain("테스트코치");
    expect(call.prompt).toContain("79.5kg");
  });

  it("API 호출 실패 시 fallback 텍스트를 반환한다", async () => {
    mockGenerateText.mockRejectedValue(new Error("network error"));

    const result = await generateAiFeedback(
      { ...mockDailyLog, weight: 80.0 },
      80.5,
      mockSettings
    );

    expect(result).toBeTruthy();
    expect(typeof result).toBe("string");
    // fallback은 체중 정보를 포함한다
    expect(result).toContain("80kg");
  });

  it("API 키 없으면 AI 호출 없이 fallback을 반환한다", async () => {
    process.env.OPENROUTER_API_KEY = "";

    const result = await generateAiFeedback(mockDailyLog, null, mockSettings);

    expect(mockGenerateText).not.toHaveBeenCalled();
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("generateAiOneLiner()", () => {
  const originalEnv = process.env.OPENROUTER_API_KEY;

  beforeEach(() => {
    process.env.OPENROUTER_API_KEY = "test-key";
    mockGenerateText.mockReset();
  });

  afterEach(() => {
    process.env.OPENROUTER_API_KEY = originalEnv;
  });

  it("AI 응답 텍스트를 반환한다", async () => {
    mockGenerateText.mockResolvedValue({ text: "착실한 하루였어." } as never);

    const result = await generateAiOneLiner(mockDailyLog, mockSettings);

    expect(result).toBe("착실한 하루였어.");
    expect(mockGenerateText).toHaveBeenCalledOnce();
  });

  it("API 호출 실패 시 fallback 텍스트를 반환한다", async () => {
    mockGenerateText.mockRejectedValue(new Error("timeout"));

    const result = await generateAiOneLiner(mockDailyLog, mockSettings);

    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("API 키 없으면 AI 호출 없이 fallback을 반환한다", async () => {
    process.env.OPENROUTER_API_KEY = "";

    const result = await generateAiOneLiner(mockDailyLog, mockSettings);

    expect(mockGenerateText).not.toHaveBeenCalled();
    expect(typeof result).toBe("string");
  });
});
