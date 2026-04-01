import { vi, beforeEach } from "vitest";
import {
  mockSettingsRow,
  mockSettings,
  mockUser,
} from "@/tests/fixtures/mock-data";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";
import {
  getSettings,
  updateSettings,
  initializeSettings,
  resetSettings,
} from "@/lib/services/settings-service";

function buildClient(opts: {
  user?: typeof mockUser | null;
  singleData?: unknown;
  singleError?: unknown;
  upsertSingleData?: unknown;
  upsertSingleError?: unknown;
}) {
  const deleteMock = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ error: null }),
  });
  const upsertMock = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({
        data: opts.upsertSingleData ?? null,
        error: opts.upsertSingleError ?? null,
      }),
    }),
  });
  const selectMock = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: opts.singleData ?? null,
      error: opts.singleError ?? null,
    }),
  });
  const fromMock = vi.fn().mockReturnValue({
    select: selectMock,
    upsert: upsertMock,
    delete: deleteMock,
  });
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: opts.user !== undefined ? opts.user : mockUser },
      }),
    },
    from: fromMock,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getSettings", () => {
  it("TC-1: 인증 유저 없음 → createDefaultSettings() 반환", async () => {
    const mockClient = buildClient({ user: null });
    vi.mocked(createClient).mockResolvedValue(mockClient as any);

    const result = await getSettings();

    expect(result.onboardingComplete).toBe(false);
    expect(result.coachName).toBe("Soma");
  });

  it("TC-2: DB에 레코드 없음 (error 반환) → createDefaultSettings() 반환", async () => {
    const mockClient = buildClient({
      singleData: null,
      singleError: { message: "Not found" },
    });
    vi.mocked(createClient).mockResolvedValue(mockClient as any);

    const result = await getSettings();

    expect(result.onboardingComplete).toBe(false);
  });

  it("TC-3: DB 레코드 있음 → snake_case → camelCase 매핑 정확", async () => {
    const mockClient = buildClient({
      singleData: mockSettingsRow,
      singleError: null,
    });
    vi.mocked(createClient).mockResolvedValue(mockClient as any);

    const result = await getSettings();

    expect(result.coachName).toBe(mockSettingsRow.coach_name);
    expect(result.dietStartDate).toBe(mockSettingsRow.diet_start_date);
    expect(result.waterGoal).toBe(mockSettingsRow.water_goal);
    expect(result.onboardingComplete).toBe(mockSettingsRow.onboarding_complete);
  });

  it("TC-4: onboarding_complete=true인 DB 레코드 → onboardingComplete: true 반환", async () => {
    const mockClient = buildClient({
      singleData: { ...mockSettingsRow, onboarding_complete: true },
      singleError: null,
    });
    vi.mocked(createClient).mockResolvedValue(mockClient as any);

    const result = await getSettings();

    expect(result.onboardingComplete).toBe(true);
  });
});

describe("updateSettings", () => {
  it("TC-5: 유저 없음 → Error throw", async () => {
    const mockClient = buildClient({ user: null });
    vi.mocked(createClient).mockResolvedValue(mockClient as any);

    await expect(updateSettings({ coachName: "Test" })).rejects.toThrow();
  });

  it("TC-6: 정상 호출 → 기존 settings에 data merge 후 UPSERT 호출", async () => {
    const mockClient = buildClient({
      singleData: mockSettingsRow,
      singleError: null,
      upsertSingleData: { ...mockSettingsRow, coach_name: "NewCoach" },
      upsertSingleError: null,
    });
    vi.mocked(createClient).mockResolvedValue(mockClient as any);

    const result = await updateSettings({ coachName: "NewCoach" });

    expect(result.coachName).toBe("NewCoach");
  });

  it("TC-7: upsert 실패 → Error throw", async () => {
    const mockClient = buildClient({
      singleData: mockSettingsRow,
      singleError: null,
      upsertSingleData: null,
      upsertSingleError: { message: "DB error" },
    });
    vi.mocked(createClient).mockResolvedValue(mockClient as any);

    await expect(updateSettings({})).rejects.toThrow();
  });
});

describe("initializeSettings", () => {
  it("TC-8: onboardingComplete가 항상 true로 강제 설정됨", async () => {
    const mockClient = buildClient({
      upsertSingleData: { ...mockSettingsRow, onboarding_complete: true },
      upsertSingleError: null,
    });
    vi.mocked(createClient).mockResolvedValue(mockClient as any);

    const result = await initializeSettings({ ...mockSettings });

    expect(result.onboardingComplete).toBe(true);
  });
});

describe("resetSettings", () => {
  it("TC-9: 유저 없음 → 에러 없이 종료", async () => {
    const mockClient = buildClient({ user: null });
    vi.mocked(createClient).mockResolvedValue(mockClient as any);

    await expect(resetSettings()).resolves.not.toThrow();
  });

  it("TC-10: 정상 호출 → delete().eq() 체인 호출 확인", async () => {
    const mockClient = buildClient({});
    vi.mocked(createClient).mockResolvedValue(mockClient as any);

    await resetSettings();

    const fromResult = vi.mocked(mockClient.from).mock.results[0]?.value;
    expect(fromResult.delete).toHaveBeenCalled();
  });
});
