vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));
vi.mock("@/lib/services/settings-service", () => ({
  getSettings: vi.fn(),
}));
vi.mock("@/lib/services/weekly-log-service", () => ({
  upsertWeeklyLog: vi.fn().mockResolvedValue(undefined),
}));

import { vi, beforeEach } from "vitest";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/services/settings-service";
import { upsertWeeklyLog } from "@/lib/services/weekly-log-service";
import {
  mockDailyLogRow,
  mockDailyLog,
  mockSettings,
  mockUser,
  MOCK_USER_ID,
} from "@/tests/fixtures/mock-data";
import {
  getDailyLog,
  getRecentDailyLogs,
  upsertDailyLog,
  closeDailyLog,
} from "@/lib/services/daily-log-service";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSettings).mockResolvedValue(mockSettings);
  vi.mocked(upsertWeeklyLog).mockResolvedValue({
    weekStart: "2024-01-15",
    weekEnd: "2024-01-21",
    avgWeight: 80,
    exerciseDays: 3,
    lateSnackCount: 1,
    weeklySummary: "",
  });
});

// ---------------------------------------------------------------------------
// getDailyLog
// ---------------------------------------------------------------------------

describe("getDailyLog", () => {
  it("TC-1: 유저 없음 → null", async () => {
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
      from: vi.fn(),
    };
    vi.mocked(createClient).mockResolvedValue(client as any);

    const result = await getDailyLog("2024-01-15");

    expect(result).toBeNull();
  });

  it("TC-2: DB에 없음 → null", async () => {
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          single: vi
            .fn()
            .mockResolvedValue({ data: null, error: { message: "Not found" } }),
        }),
      }),
    };
    vi.mocked(createClient).mockResolvedValue(client as any);

    const result = await getDailyLog("2024-01-15");

    expect(result).toBeNull();
  });

  it("TC-3: DB에 있음 → snake_case → camelCase 매핑", async () => {
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          single: vi
            .fn()
            .mockResolvedValue({ data: mockDailyLogRow, error: null }),
        }),
      }),
    };
    vi.mocked(createClient).mockResolvedValue(client as any);

    const result = await getDailyLog("2024-01-15");

    expect(result).not.toBeNull();
    expect(result!.avgWeight3d).toBe(mockDailyLogRow.avg_weight_3d);
    expect(result!.weightChange).toBe(mockDailyLogRow.weight_change);
    expect(result!.lateSnack).toBe(mockDailyLogRow.late_snack);
    expect(result!.intensiveDay).toBe(mockDailyLogRow.intensive_day);
  });
});

// ---------------------------------------------------------------------------
// getRecentDailyLogs
// ---------------------------------------------------------------------------

describe("getRecentDailyLogs", () => {
  it("TC-4: 유저 없음 → []", async () => {
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
      from: vi.fn(),
    };
    vi.mocked(createClient).mockResolvedValue(client as any);

    const result = await getRecentDailyLogs(5);

    expect(result).toEqual([]);
  });

  it("TC-5: 정상 → 배열 반환", async () => {
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockImplementation((cols: string) => {
          if (cols === "*") {
            return {
              eq: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [mockDailyLogRow], error: null }),
              }),
            };
          }
          // "weight" — 최저 체중 쿼리
          return {
            eq: vi.fn().mockReturnThis(),
            not: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          };
        }),
      }),
    };
    vi.mocked(createClient).mockResolvedValue(client as any);

    const result = await getRecentDailyLogs(5);

    expect(result).toHaveLength(1);
    expect(result[0].date).toBe("2024-01-15");
  });
});

// ---------------------------------------------------------------------------
// upsertDailyLog
// ---------------------------------------------------------------------------

describe("upsertDailyLog", () => {
  it("TC-6: 유저 없음 → Error('Unauthorized') throw", async () => {
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
      from: vi.fn(),
    };
    vi.mocked(createClient).mockResolvedValue(client as any);

    await expect(
      upsertDailyLog("2024-01-15", { breakfast: "오트밀" })
    ).rejects.toThrow("Unauthorized");
  });

  it("TC-7: 신규 로그 + weight 없음 → upsert 1회 호출", async () => {
    const upsertSingle = vi
      .fn()
      .mockResolvedValue({
        data: { ...mockDailyLogRow, breakfast: "오트밀" },
        error: null,
      });
    const getSingle = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: "Not found" } });

    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          single: getSingle,
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
        }),
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({ single: upsertSingle }),
        }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
    };
    vi.mocked(createClient).mockResolvedValue(client as any);

    const result = await upsertDailyLog("2024-01-15", { breakfast: "오트밀" });

    expect(upsertSingle).toHaveBeenCalledTimes(1);
    expect(result.date).toBe("2024-01-15");
  });

  it("TC-8: 신규 로그 + weight 있음 → weightChange, day 계산값 포함", async () => {
    const upsertedRow = {
      ...mockDailyLogRow,
      weight: 80,
      weight_change: -5,
      avg_weight_3d: 80,
      intensive_day: false,
    };
    const getSingle = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: { message: "Not found" } })
      .mockResolvedValueOnce({ data: upsertedRow, error: null });

    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          single: getSingle,
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
        }),
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({ single: getSingle }),
        }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
    };
    vi.mocked(createClient).mockResolvedValue(client as any);

    const result = await upsertDailyLog("2024-01-15", { weight: 80 });

    expect(result.weight).toBe(80);
    expect(result.weightChange).toBe(-5);
    expect(result.day).toBeDefined();
  });

  it("TC-9: intensiveDayOn=false → intensiveDay가 null", async () => {
    vi.mocked(getSettings).mockResolvedValue({
      ...mockSettings,
      intensiveDayOn: false,
    });

    const upsertedRow = {
      ...mockDailyLogRow,
      weight: 80,
      intensive_day: null,
    };
    const getSingle = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: { message: "Not found" } })
      .mockResolvedValueOnce({ data: upsertedRow, error: null });

    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          single: getSingle,
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
        }),
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({ single: getSingle }),
        }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
    };
    vi.mocked(createClient).mockResolvedValue(client as any);

    const result = await upsertDailyLog("2024-01-15", { weight: 80 });

    expect(result.intensiveDay).toBeNull();
  });

  it("TC-10: 기존 로그 수정 → existing 데이터와 merge", async () => {
    const upsertSingle = vi
      .fn()
      .mockResolvedValue({
        data: { ...mockDailyLogRow, breakfast: "새로운 아침" },
        error: null,
      });
    const getSingle = vi
      .fn()
      .mockResolvedValue({ data: mockDailyLogRow, error: null });

    const upsertFn = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({ single: upsertSingle }),
    });

    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          single: getSingle,
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
        }),
        upsert: upsertFn,
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
    };
    vi.mocked(createClient).mockResolvedValue(client as any);

    await upsertDailyLog("2024-01-15", { breakfast: "새로운 아침" });

    expect(upsertFn.mock.calls[0][0]).toMatchObject({
      exercise: "Y",
      breakfast: "새로운 아침",
    });
  });

  it("TC-11: upsert 실패 → Error throw", async () => {
    const getSingle = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: "Not found" } });

    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          single: getSingle,
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
        }),
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi
              .fn()
              .mockResolvedValue({
                data: null,
                error: { message: "DB error" },
              }),
          }),
        }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
    };
    vi.mocked(createClient).mockResolvedValue(client as any);

    await expect(
      upsertDailyLog("2024-01-15", { breakfast: "오트밀" })
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// closeDailyLog
// ---------------------------------------------------------------------------

describe("closeDailyLog", () => {
  it("TC-12: 유저 없음 → null", async () => {
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
      from: vi.fn(),
    };
    vi.mocked(createClient).mockResolvedValue(client as any);

    const result = await closeDailyLog("2024-01-15");

    expect(result).toBeNull();
  });

  it("TC-13: 로그 없음 → null", async () => {
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          single: vi
            .fn()
            .mockResolvedValue({ data: null, error: { message: "Not found" } }),
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
        }),
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi
              .fn()
              .mockResolvedValue({ data: null, error: { message: "Not found" } }),
          }),
        }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
    };
    vi.mocked(createClient).mockResolvedValue(client as any);

    const result = await closeDailyLog("2024-01-15");

    expect(result).toBeNull();
  });

  it("TC-14: 평일(화요일 '2024-01-16') 마감 → upsertWeeklyLog 미호출", async () => {
    const closedRow = { ...mockDailyLogRow, date: "2024-01-16", closed: true };
    const getSingle = vi
      .fn()
      .mockResolvedValueOnce({
        data: { ...mockDailyLogRow, date: "2024-01-16" },
        error: null,
      })
      .mockResolvedValueOnce({ data: closedRow, error: null });

    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          single: getSingle,
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
        }),
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({ single: getSingle }),
        }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
    };
    vi.mocked(createClient).mockResolvedValue(client as any);

    const result = await closeDailyLog("2024-01-16");

    expect(vi.mocked(upsertWeeklyLog)).not.toHaveBeenCalled();
    expect(result!.closed).toBe(true);
  });

  it("TC-15: 일요일('2024-01-21') 마감 → upsertWeeklyLog 1회 호출", async () => {
    const sundayRow = { ...mockDailyLogRow, date: "2024-01-21" };
    const closedSundayRow = { ...sundayRow, closed: true };

    const getSingle = vi
      .fn()
      .mockResolvedValueOnce({ data: sundayRow, error: null })
      .mockResolvedValueOnce({ data: closedSundayRow, error: null });

    const weeklyQueryMock = vi
      .fn()
      .mockResolvedValue({ data: [sundayRow], error: null });

    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          single: getSingle,
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
          gte: vi.fn().mockReturnThis(),
          lte: weeklyQueryMock,
        }),
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({ single: getSingle }),
        }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
    };
    vi.mocked(createClient).mockResolvedValue(client as any);

    await closeDailyLog("2024-01-21");

    expect(vi.mocked(upsertWeeklyLog)).toHaveBeenCalledTimes(1);
  });
});
