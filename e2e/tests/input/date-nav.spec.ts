import { test, expect } from "../../fixtures";
import { InputPage } from "../../pages/input.page";
import { getUserIdByEmail, clearUserData, seedSettings, seedDailyLogs } from "../../helpers/supabase-admin";

test.use({ storageState: "e2e/.auth/user.json" });

test.describe("Input: 날짜 네비게이션", () => {
  let inputPage: InputPage;
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

  test.beforeEach(async ({ page }) => {
    // 오늘 + 어제 로그 모두 시드 (이전 날짜 이동이 작동하도록)
    const email = process.env.TEST_USER_EMAIL!;
    const userId = await getUserIdByEmail(email);
    await clearUserData(userId);
    await seedSettings(userId);
    await seedDailyLogs(userId, [
      { date: today, day: 2, closed: false },
      { date: yesterday, day: 1, closed: false },
    ]);

    inputPage = new InputPage(page);
    await inputPage.goto();
  });

  test.afterEach(async () => {
    const email = process.env.TEST_USER_EMAIL!;
    const userId = await getUserIdByEmail(email);
    await clearUserData(userId);
  });

  test("이전 날짜 버튼 클릭 → 날짜 변경됨", async ({ page }) => {
    // 페이지는 가장 오래된 미완료 로그(어제)에서 시작
    // next 클릭으로 오늘로 이동한 뒤 오늘 날짜 텍스트를 기록
    // 이후 prev 클릭 → 어제로 이동되는지 확인
    // (어제 → 그저께는 로그가 없어 DateHeader가 사라지는 문제 방지)
    // next 버튼 클릭 전 현재 날짜 기록
    const atYesterday = await inputPage.dateDisplay.textContent();
    await inputPage.dateNext.click();
    // 오늘로 날짜가 바뀔 때까지 대기 (표시 형식: "4/1 수요일D+822")
    await expect(inputPage.dateDisplay).not.toHaveText(atYesterday!, { timeout: 10_000 });
    const atToday = await inputPage.dateDisplay.textContent();

    await inputPage.datePrev.click();
    // prev 클릭 후 날짜가 다른 텍스트로 바뀔 때까지 대기
    await expect(inputPage.dateDisplay).not.toHaveText(atToday!, { timeout: 10_000 });
  });

  test("오늘 날짜에서 다음 날짜 버튼은 이동 불가", async ({ page }) => {
    // InputContainer는 미완료 로그 중 가장 오래된 날짜부터 시작
    // yesterday가 가장 오래된 미완료 로그이므로 어제 날짜 표시됨
    // 오늘 날짜로 이동 후 next 클릭이 무시되는지 확인
    // 오늘 날짜로 이동
    await inputPage.dateNext.click();
    await page.waitForTimeout(500);
    const atToday = await inputPage.dateDisplay.textContent();
    // 오늘에서 next는 아무 변화 없음
    await inputPage.dateNext.click();
    await page.waitForTimeout(1000);
    const afterNext = await inputPage.dateDisplay.textContent();
    expect(atToday).toBe(afterNext);
  });

  test("날짜 변경 후 해당 날짜 로그 로드", async ({ page }) => {
    const before = await inputPage.dateDisplay.textContent();
    // 다음 날짜로 이동 (어제 → 오늘)
    await inputPage.dateNext.click();
    // 날짜가 변경될 때까지 대기
    await expect(inputPage.dateDisplay).not.toHaveText(before ?? "", { timeout: 10_000 });
    // 체중 칩이 표시됨
    await expect(inputPage.chip("weight")).toBeVisible();
  });
});
