import { vi, beforeEach } from "vitest";
import {
  mockSettingsRow,
  mockSettings,
  mockUser,
} from "@/tests/fixtures/mock-data";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
  getAuthUser: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
}));

import { revalidateTag } from "next/cache";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import {
  getSettings,
  updateSettings,
  updateInputPresets,
  initializeSettings,
  resetSettings,
} from "@/lib/services/settings-service";

function buildClient(opts: {
  user?: typeof mockUser | null;
  singleData?: unknown;
  singleError?: unknown;
  upsertSingleData?: unknown;
  upsertSingleError?: unknown;
  /** update().eq().select().maybeSingle() 결과 — null 이면 "설정 행 없음" */
  updateMaybeSingleData?: unknown;
  updateError?: unknown;
}) {
  const resolvedUser = opts.user !== undefined ? opts.user : mockUser;
  vi.mocked(getAuthUser).mockResolvedValue(resolvedUser as any);

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
  const updateMock = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data:
            opts.updateMaybeSingleData !== undefined
              ? opts.updateMaybeSingleData
              : { user_id: "test-user" },
          error: opts.updateError ?? null,
        }),
      }),
    }),
  });
  const fromMock = vi.fn().mockReturnValue({
    select: selectMock,
    upsert: upsertMock,
    update: updateMock,
    delete: deleteMock,
  });
  return {
    from: fromMock,
    updateMock,
    upsertMock,
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

    await expect(updateSettings({ targetWeight: 70 })).rejects.toThrow();
  });

  it("TC-6: 정상 호출 → 기존 settings에 data merge 후 UPSERT 호출", async () => {
    const mockClient = buildClient({
      singleData: mockSettingsRow,
      singleError: null,
      upsertSingleData: { ...mockSettingsRow, target_weight: 65 },
      upsertSingleError: null,
    });
    vi.mocked(createClient).mockResolvedValue(mockClient as any);

    const result = await updateSettings({ targetWeight: 65 });

    expect(result.targetWeight).toBe(65);
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

describe("updateInputPresets", () => {
  const presets = {
    exercise: ["헬스 1시간"],
    breakfast: [],
    lunch: [],
    dinner: [],
    lateSnack: [],
  };

  it("TC-11: 유저 없음 → Error throw", async () => {
    const mockClient = buildClient({ user: null });
    vi.mocked(createClient).mockResolvedValue(mockClient as any);

    await expect(updateInputPresets(presets)).rejects.toThrow();
  });

  it("TC-12: 정상 호출 → input_presets 컬럼만 UPDATE (전체 upsert 아님)", async () => {
    const mockClient = buildClient({});
    vi.mocked(createClient).mockResolvedValue(mockClient as any);

    const result = await updateInputPresets(presets);

    expect(mockClient.updateMock).toHaveBeenCalledWith({
      input_presets: presets,
    });
    expect(mockClient.upsertMock).not.toHaveBeenCalled();
    expect(result.exercise).toEqual(["헬스 1시간"]);
  });

  it("TC-13: 탭 전환 prefetch 보존 — revalidate 하지 않는다", async () => {
    const mockClient = buildClient({});
    vi.mocked(createClient).mockResolvedValue(mockClient as any);

    await updateInputPresets(presets);

    expect(vi.mocked(revalidateTag)).not.toHaveBeenCalled();
  });

  it("TC-14: 저장 전 정규화 — 공백/중복/개수 초과 제거", async () => {
    const mockClient = buildClient({});
    vi.mocked(createClient).mockResolvedValue(mockClient as any);

    const result = await updateInputPresets({
      ...presets,
      lunch: ["  샐러드  ", "샐러드", "", "닭가슴살"],
    });

    expect(result.lunch).toEqual(["샐러드", "닭가슴살"]);
  });

  it("TC-15: 설정 행 없음 → 전체 upsert 로 폴백해 행을 만든다", async () => {
    const mockClient = buildClient({
      updateMaybeSingleData: null,
      singleData: mockSettingsRow,
      upsertSingleData: mockSettingsRow,
    });
    vi.mocked(createClient).mockResolvedValue(mockClient as any);

    await updateInputPresets(presets);

    expect(mockClient.upsertMock).toHaveBeenCalled();
  });

  it("TC-16: UPDATE 에러 → Error throw", async () => {
    const mockClient = buildClient({ updateError: { message: "DB error" } });
    vi.mocked(createClient).mockResolvedValue(mockClient as any);

    await expect(updateInputPresets(presets)).rejects.toThrow("DB error");
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
