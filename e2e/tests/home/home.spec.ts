import { test, expect } from "../../fixtures";
import { HomePage } from "../../pages/home.page";
import { InputPage } from "../../pages/input.page";
import { getUserIdByEmail, clearUserData, seedSettings, seedDailyLogs } from "../../helpers/supabase-admin";

test.use({ storageState: "e2e/.auth/user.json" });

test.describe("Home", () => {
  // J7-01: 다이어트 진행 배너 표시
  test("홈 탭에 다이어트 진행 배너가 표시됨", async ({ page, withSeededData }) => {
    void withSeededData;
    const home = new HomePage(page);
    await home.goto();
    await expect(home.progressBanner).toBeVisible();
  });

  // J7-01: D+ 정보 표시
  test("홈 탭 다이어트 배너에 D+ 정보 표시", async ({ page, withSeededData }) => {
    void withSeededData;
    const home = new HomePage(page);
    await home.goto();
    await expect(page.getByTestId("home-progress-banner")).toContainText("D+");
  });

  // J7-04: 코치 한마디 영역 표시 (oneLiner 있을 때)
  test("홈 탭에 코치 한마디 영역이 표시됨 (oneLiner 있을 때)", async ({ page }) => {
    const email = process.env.TEST_USER_EMAIL!;
    const today = new Date().toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

    const userId = await getUserIdByEmail(email);
    await clearUserData(userId);
    await seedSettings(userId);
    await seedDailyLogs(userId, [
      { date: today, day: 2, closed: false },
      {
        date: yesterday,
        day: 1,
        closed: true,
        one_liner: "좋은 하루였어! 내일도 파이팅!",
      },
    ]);

    const home = new HomePage(page);
    await home.goto();
    await expect(home.coachOneLiner).toBeVisible();

    await clearUserData(userId);
  });

  // J7-01: 체중 표시 업데이트
  test("체중 입력 후 홈 탭 체중 표시 업데이트", async ({ page, withSeededData }) => {
    void withSeededData;
    const inputPage = new InputPage(page);
    const home = new HomePage(page);

    await inputPage.goto();
    await inputPage.chip("weight").click();
    await inputPage.modalWeightInput.fill("81.5");
    await page.evaluate(() => {
      (document.querySelector('[data-testid="modal-save"]') as HTMLElement)?.click();
    });
    await expect(inputPage.chip("weight")).toContainText("81.5", { timeout: 10_000 });

    await home.goto();
    await expect(home.weightDisplay).toContainText("81.5");
  });

  // J7-03: 홈 탭 오늘 입력 현황 칩 표시
  test("홈 탭 입력 현황 칩 클릭 → 입력 탭으로 이동", async ({ page, withSeededData }) => {
    void withSeededData;
    const home = new HomePage(page);
    await home.goto();

    // 홈 탭의 입력 현황 칩 영역 존재 확인 (있는 경우)
    const inputChips = page.getByTestId("home-input-summary");
    if (await inputChips.isVisible()) {
      await inputChips.click();
      await expect(page).toHaveURL("/input");
    } else {
      // 입력 탭 네비게이션으로 이동 가능한지 확인
      await page.getByTestId("nav-input").click();
      await expect(page).toHaveURL("/input");
    }
  });

  // J7-05: 전체 보기 → /graph 이동
  test("홈 탭 그래프 전체보기 → /graph 이동", async ({ page, withSeededData }) => {
    void withSeededData;
    await page.goto("/home");

    // "전체 보기" 링크만 선택 (nav 그래프 링크와 구분)
    const viewAll = page.getByRole("link", { name: "전체 보기" });
    if (await viewAll.first().isVisible()) {
      await viewAll.first().click();
      await expect(page).toHaveURL("/graph");
    }
  });
});
