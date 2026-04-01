import { test, expect } from "../../fixtures";
import { HomePage } from "../../pages/home.page";
import { InputPage } from "../../pages/input.page";
import { getUserIdByEmail, clearUserData, seedSettings, seedDailyLogs } from "../../helpers/supabase-admin";

test.use({ storageState: "e2e/.auth/user.json" });

test.describe("Home", () => {
  test("홈 탭에 다이어트 진행 배너가 표시됨", async ({ page, withSeededData }) => {
    void withSeededData;
    const home = new HomePage(page);
    await home.goto();
    await expect(home.progressBanner).toBeVisible();
  });

  test("홈 탭 다이어트 배너에 D+ 정보 표시", async ({ page, withSeededData }) => {
    void withSeededData;
    const home = new HomePage(page);
    await home.goto();
    await expect(page.getByTestId("home-progress-banner")).toContainText("D+");
  });

  test("홈 탭에 코치 한마디 영역이 표시됨 (oneLiner 있을 때)", async ({ page }) => {
    // 어제 날짜 로그에 oneLiner 포함해서 시드
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

    // 정리
    await clearUserData(userId);
  });

  test("체중 입력 후 홈 탭 체중 표시 업데이트", async ({ page, withSeededData }) => {
    void withSeededData;
    const inputPage = new InputPage(page);
    const home = new HomePage(page);

    // 체중 입력
    await inputPage.goto();
    await inputPage.chip("weight").click();
    await inputPage.modalWeightInput.fill("81.5");
    await page.evaluate(() => {
      (document.querySelector('[data-testid="modal-save"]') as HTMLElement)?.click();
    });
    // 저장 완료 후 체중 칩 업데이트 대기
    await expect(inputPage.chip("weight")).toContainText("81.5", { timeout: 10_000 });

    // 홈 탭으로 이동
    await home.goto();
    await expect(home.weightDisplay).toContainText("81.5");
  });
});
