vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));
vi.mock("@/lib/services/settings-service", () => ({
  getSettings: vi.fn(),
  updateSettings: vi.fn(),
}));
vi.mock("@/lib/services/achievement-service", () => ({
  deleteGoalAchievement: vi.fn(),
}));

import { vi, beforeEach, describe, it, expect } from "vitest";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/services/settings-service";
import { getChapterScopes } from "@/lib/services/chapter-service";
import { mockSettings, mockUser } from "@/tests/fixtures/mock-data";

const chapterRow = {
  id: "c1",
  start_date: "2023-06-01",
  start_weight: 90,
  target_weight: 80,
  end_date: "2023-12-31",
  end_weight: 81,
  achieved: true,
  created_at: "2023-12-31T00:00:00Z",
};

function clientWithChapters(rows: unknown[]) {
  const chain: any = {
    eq: vi.fn(() => chain),
    order: vi.fn().mockResolvedValue({ data: rows, error: null }),
  };
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }) },
    from: vi.fn(() => ({ select: vi.fn(() => chain) })),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // dietStartDate 2024-01-01, startWeight 85, targetWeight 70, targetMonths 12, mode losing
  vi.mocked(getSettings).mockResolvedValue(mockSettings);
});

describe("getChapterScopes", () => {
  it("전체 → 진행중 → 종료챕터 순으로, 값이 올바르게 매핑된다", async () => {
    vi.mocked(createClient).mockResolvedValue(clientWithChapters([chapterRow]) as any);

    const scopes = await getChapterScopes();

    expect(scopes.map((s) => s.id)).toEqual(["all", "current", "c1"]);

    const all = scopes[0];
    expect(all.status).toBe("all");
    expect(all.rangeStart).toBeNull();
    expect(all.rangeEnd).toBeNull();
    expect(all.startWeight).toBe(85);
    expect(all.targetWeight).toBe(70);
    // 표시 시작일 = 최초 챕터 시작(2023-06-01) < dietStartDate(2024-01-01)
    expect(all.displayStart).toBe("2023-06-01");

    const current = scopes[1];
    expect(current.status).toBe("current");
    expect(current.label).toBe("진행 중인 챕터");
    expect(current.rangeStart).toBe("2024-01-01");
    expect(current.rangeEnd).toBeNull();
    expect(current.isOngoing).toBe(true);
    expect(current.targetEndDate).toBe("2025-01-01"); // +12개월

    const ended = scopes[2];
    expect(ended.status).toBe("achieved");
    expect(ended.rangeStart).toBe("2023-06-01");
    expect(ended.rangeEnd).toBe("2023-12-31");
    expect(ended.startWeight).toBe(90);
    expect(ended.targetWeight).toBe(80);
    expect(ended.targetEndDate).toBe("2023-12-31");
    expect(ended.isOngoing).toBe(false);
  });

  it("종료 챕터가 없으면 전체 + 진행중 2개만", async () => {
    vi.mocked(createClient).mockResolvedValue(clientWithChapters([]) as any);

    const scopes = await getChapterScopes();

    expect(scopes.map((s) => s.id)).toEqual(["all", "current"]);
  });

  it("유지 모드면 진행중 라벨이 '유지 중인 챕터'", async () => {
    vi.mocked(getSettings).mockResolvedValue({ ...mockSettings, mode: "maintaining" });
    vi.mocked(createClient).mockResolvedValue(clientWithChapters([]) as any);

    const scopes = await getChapterScopes();
    expect(scopes[1].label).toBe("유지 중인 챕터");
  });
});
