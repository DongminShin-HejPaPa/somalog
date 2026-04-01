import { vi } from "vitest";
import {
  mockUser,
  mockWeeklyLog,
  mockWeeklyLogRow,
} from "@/tests/fixtures/mock-data";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));
import { createClient } from "@/lib/supabase/server";

import {
  getWeeklyLog,
  getWeeklyLogs,
  upsertWeeklyLog,
} from "@/lib/services/weekly-log-service";

function buildClient(opts: {
  user?: typeof mockUser | null;
  singleData?: unknown;
  singleError?: unknown;
  listData?: unknown[];
  upsertData?: unknown;
  upsertError?: unknown;
}) {
  const orderMock = vi.fn().mockReturnThis();
  const limitMock = vi.fn().mockResolvedValue({
    data: opts.listData ?? [],
    error: null,
  });
  const upsertSingleMock = vi.fn().mockResolvedValue({
    data: opts.upsertData ?? null,
    error: opts.upsertError ?? null,
  });
  const upsertMock = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({ single: upsertSingleMock }),
  });
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: opts.user !== undefined ? opts.user : mockUser },
      }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: opts.singleData ?? null,
          error: opts.singleError ?? null,
        }),
        order: orderMock,
        limit: limitMock,
      }),
      upsert: upsertMock,
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    }),
  };
}

describe("getWeeklyLog", () => {
  it("TC-1: 유저 없음 → null 반환", async () => {
    const client = buildClient({ user: null });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const result = await getWeeklyLog("2024-01-15");

    expect(result).toBeNull();
  });

  it("TC-2: DB에 없음 → null 반환", async () => {
    const client = buildClient({
      singleData: null,
      singleError: { message: "Not found" },
    });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const result = await getWeeklyLog("2024-01-15");

    expect(result).toBeNull();
  });

  it("TC-3: DB에 있음 → snake_case → camelCase 매핑 정확", async () => {
    const client = buildClient({
      singleData: mockWeeklyLogRow,
      singleError: null,
    });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const result = await getWeeklyLog("2024-01-15");

    expect(result).not.toBeNull();
    expect(result!.weekStart).toBe(mockWeeklyLogRow.week_start);
    expect(result!.weekEnd).toBe(mockWeeklyLogRow.week_end);
    expect(result!.avgWeight).toBe(mockWeeklyLogRow.avg_weight);
    expect(result!.exerciseDays).toBe(mockWeeklyLogRow.exercise_days);
    expect(result!.lateSnackCount).toBe(mockWeeklyLogRow.late_snack_count);
  });
});

describe("getWeeklyLogs", () => {
  it("TC-4: 유저 없음 → [] 반환", async () => {
    const client = buildClient({ user: null });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const result = await getWeeklyLogs(3);

    expect(result).toEqual([]);
  });

  it("TC-5: 정상 → ORDER BY week_start DESC LIMIT count 쿼리 확인", async () => {
    const orderMock = vi.fn().mockReturnThis();
    const limitMock = vi.fn().mockResolvedValue({
      data: [mockWeeklyLogRow],
      error: null,
    });

    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: mockUser },
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          order: orderMock,
          limit: limitMock,
        }),
        upsert: vi.fn(),
        delete: vi.fn(),
      }),
    };

    vi.mocked(createClient).mockResolvedValue(client as never);

    const result = await getWeeklyLogs(3);

    expect(orderMock).toHaveBeenCalledWith("week_start", { ascending: false });
    expect(limitMock).toHaveBeenCalledWith(3);
    expect(result[0].weekStart).toBe(mockWeeklyLogRow.week_start);
  });
});

describe("upsertWeeklyLog", () => {
  it("TC-6: 유저 없음 → Error('Unauthorized') throw", async () => {
    const client = buildClient({ user: null });
    vi.mocked(createClient).mockResolvedValue(client as never);

    await expect(upsertWeeklyLog(mockWeeklyLog)).rejects.toThrow("Unauthorized");
  });

  it("TC-7: 정상 호출 → onConflict: 'user_id,week_start' 확인", async () => {
    const upsertSingleMock = vi.fn().mockResolvedValue({
      data: mockWeeklyLogRow,
      error: null,
    });
    const upsertMock = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({ single: upsertSingleMock }),
    });
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: mockUser },
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
        upsert: upsertMock,
        delete: vi.fn(),
      }),
    };
    vi.mocked(createClient).mockResolvedValue(client as never);

    await upsertWeeklyLog(mockWeeklyLog);

    expect(upsertMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ onConflict: "user_id,week_start" })
    );
  });

  it("TC-8: upsert 실패 → Error throw", async () => {
    const client = buildClient({
      upsertData: null,
      upsertError: { message: "DB error" },
    });
    vi.mocked(createClient).mockResolvedValue(client as never);

    await expect(upsertWeeklyLog(mockWeeklyLog)).rejects.toThrow();
  });
});
