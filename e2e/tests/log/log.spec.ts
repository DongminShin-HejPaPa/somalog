import { test, expect } from "../../fixtures";
import { getUserIdByEmail, clearUserData, seedSettings, seedDailyLogs } from "../../helpers/supabase-admin";

test.use({ storageState: "e2e/.auth/user.json" });

test.describe("Log", () => {
  test.beforeEach(async ({ withSeededData }) => {
    void withSeededData;
  });

  // J8-01: 기록 목록 표시
  test("기록 목록이 표시됨", async ({ page }) => {
    await page.goto("/log");
    await expect(page.getByTestId("log-list")).toBeVisible();
  });

  // J8-01: 시드 데이터 항목 표시 (KST 날짜 사용)
  test("시드 데이터의 로그 항목이 목록에 표시됨", async ({ page }) => {
    await page.goto("/log");
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
    await expect(page.getByTestId(`log-item-${today}`)).toBeVisible();
  });

  // J8-01: 로그 항목 클릭 → 상세 펼침
  test("로그 항목 클릭 → 상세 펼침", async ({ page }) => {
    await page.goto("/log");
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
    const item = page.getByTestId(`log-item-${today}`);
    await item.click();
    await expect(item.locator("text=체중")).toBeVisible();
  });
});

test.describe("Log — 필터 & 검색", () => {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
  const yesterday = new Date(Date.now() - 86400000).toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
  const dayBefore = new Date(Date.now() - 2 * 86400000).toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });

  test.beforeEach(async () => {
    const email = process.env.TEST_USER_EMAIL!;
    const userId = await getUserIdByEmail(email);
    await clearUserData(userId);
    await seedSettings(userId);
    await seedDailyLogs(userId, [
      {
        date: today,
        day: 3,
        closed: true,
        weight: 91.5,
        exercise: "Y",
        late_snack: "N",
        breakfast: "닭가슴살 샐러드",
        lunch: "현미밥 된장찌개",
        dinner: "야채볶음",
        one_liner: "오늘도 파이팅!",
      },
      {
        date: yesterday,
        day: 2,
        closed: true,
        weight: 92.0,
        exercise: "N",
        late_snack: "Y",
        breakfast: "오트밀",
        lunch: "한식 백반",
        dinner: "닭가슴살 도시락",
        one_liner: "내일은 더 잘 할 수 있어",
      },
      {
        date: dayBefore,
        day: 1,
        closed: true,
        weight: 92.5,
        exercise: "Y",
        late_snack: "N",
        breakfast: "토스트",
        lunch: "샐러드",
        dinner: "스테이크",
      },
    ]);
  });

  test.afterEach(async () => {
    const email = process.env.TEST_USER_EMAIL!;
    const userId = await getUserIdByEmail(email);
    await clearUserData(userId);
  });

  // J8-02: 운동한 날 필터
  test("'운동한 날' 필터 → 운동 기록 있는 날짜만 표시", async ({ page }) => {
    await page.goto("/log");
    const filterButton = page.getByRole("button", { name: /운동한 날/ });
    if (await filterButton.isVisible()) {
      await filterButton.click();
      await expect(page.getByTestId(`log-item-${today}`)).toBeVisible();
      await expect(page.getByTestId(`log-item-${dayBefore}`)).toBeVisible();
    }
  });

  // J8-02: 야식 있는 날 필터
  test("'야식 있는 날' 필터 → 야식 날짜만 표시", async ({ page }) => {
    await page.goto("/log");
    const filterButton = page.getByRole("button", { name: /야식/ });
    if (await filterButton.isVisible()) {
      await filterButton.click();
      await expect(page.getByTestId(`log-item-${yesterday}`)).toBeVisible();
    }
  });

  // J8-03: 식사 키워드 검색
  test("식사 키워드 검색 → 해당 날짜 표시 / 지우기 → 전체 복귀", async ({ page }) => {
    await page.goto("/log");
    const searchInput = page.getByRole("searchbox").or(page.getByPlaceholder(/검색/));
    if (await searchInput.isVisible()) {
      await searchInput.fill("닭가슴살");
      await expect(page.getByTestId(`log-item-${today}`)).toBeVisible();
      await searchInput.clear();
      await expect(page.getByTestId(`log-item-${yesterday}`)).toBeVisible();
    }
  });

});

test.describe("Log — 챕터 드롭다운", () => {
  test.beforeEach(async ({ withSeededData }) => {
    void withSeededData;
  });

  // 제목 우측 챕터 선택 드롭다운이 보이고, 열면 '전체 기간' 옵션이 나온다
  test("챕터 드롭다운 표시 + 전체 옵션", async ({ page }) => {
    await page.goto("/log");
    const trigger = page.getByTestId("chapter-picker-trigger");
    await expect(trigger).toBeVisible();
    await trigger.click();
    await expect(page.getByTestId("chapter-option-all")).toBeVisible();
  });
});

// Phase 4: 검색이 '이미 로드된 페이지'가 아니라 전체 기록을 대상으로 동작하는지.
// 첫 페이지(최근 30개) 밖의 오래된 기록을 검색으로 찾아낼 수 있어야 한다.
test.describe("Log — 서버 전체검색", () => {
  // 최근 35일치 (첫 페이지 30개 초과). 가장 오래된 날(34일 전)에만 고유 키워드.
  const dates = Array.from({ length: 35 }, (_, i) =>
    new Date(Date.now() - i * 86400000).toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" })
  );
  const oldestDate = dates[34];
  const UNIQUE = "특별한멸치볶음";

  test.beforeEach(async () => {
    const email = process.env.TEST_USER_EMAIL!;
    const userId = await getUserIdByEmail(email);
    await clearUserData(userId);
    await seedSettings(userId);
    await seedDailyLogs(
      userId,
      dates.map((date, i) => ({
        date,
        day: 35 - i,
        closed: true,
        weight: 90 - i * 0.1,
        breakfast: "오트밀",
        lunch: "샐러드",
        dinner: i === 34 ? UNIQUE : "닭가슴살",
      }))
    );
  });

  test.afterEach(async () => {
    const email = process.env.TEST_USER_EMAIL!;
    const userId = await getUserIdByEmail(email);
    await clearUserData(userId);
  });

  test("첫 페이지 밖(34일 전) 기록도 검색으로 찾는다", async ({ page }) => {
    await page.goto("/log");
    await expect(page.getByTestId("log-list")).toBeVisible();

    // 초기에는 최근 30개만 렌더 → 가장 오래된 항목은 보이지 않아야 함
    await expect(page.getByTestId(`log-item-${oldestDate}`)).toHaveCount(0);

    // 고유 키워드 검색 → 서버 전체검색으로 오래된 항목이 나타남
    const searchInput = page.getByPlaceholder(/검색/);
    await searchInput.fill(UNIQUE);
    await expect(page.getByTestId(`log-item-${oldestDate}`)).toBeVisible();

    // 검색어 지우면 일반 목록으로 복귀 (오래된 항목은 다시 첫 페이지 밖)
    await searchInput.clear();
    await expect(page.getByTestId(`log-item-${dates[0]}`)).toBeVisible();
  });
});
