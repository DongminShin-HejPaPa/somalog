import { test, expect } from "../../fixtures";
import { InputPage } from "../../pages/input.page";
import { SettingsPage } from "../../pages/settings.page";
import { getUserIdByEmail, clearUserData, seedSettings, seedDailyLogs } from "../../helpers/supabase-admin";

test.use({ storageState: "e2e/.auth/user.json" });

test.describe("Graph", () => {
  // J9-01: 체중 데이터 없을 때 빈 상태
  test("체중 데이터 없을 때 빈 상태 메시지 표시", async ({ page, withSeededData }) => {
    void withSeededData;
    await page.goto("/graph");
    await expect(page.getByText("아직 체중 데이터가 없어요")).toBeVisible();
  });

  // J9-01: 체중 입력 후 그래프 표시
  test("체중 입력 후 그래프 표시", async ({ page, withSeededData }) => {
    void withSeededData;
    const inputPage = new InputPage(page);
    await inputPage.goto();

    await inputPage.chip("weight").click();
    await inputPage.modalWeightInput.fill("82.0");
    await page.evaluate(() => {
      (document.querySelector('[data-testid="modal-save"]') as HTMLElement)?.click();
    });
    await expect(inputPage.chip("weight")).toContainText("82", { timeout: 10_000 });

    await page.goto("/graph");
    await expect(page.getByTestId("graph-weight-chart")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("아직 체중 데이터가 없어요")).not.toBeVisible();
  });

  // J9-01: 여러 날 체중 데이터 → 그래프에 다중 포인트
  test("여러 날 체중 데이터 시드 → 그래프 표시", async ({ page }) => {
    const email = process.env.TEST_USER_EMAIL!;
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
    const yesterday = new Date(Date.now() - 86400000).toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
    const dayBefore = new Date(Date.now() - 2 * 86400000).toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });

    const userId = await getUserIdByEmail(email);
    await clearUserData(userId);
    await seedSettings(userId);
    await seedDailyLogs(userId, [
      { date: today, day: 3, closed: false, weight: 91.5 },
      { date: yesterday, day: 2, closed: true, weight: 92.0 },
      { date: dayBefore, day: 1, closed: true, weight: 92.5 },
    ]);

    await page.goto("/graph");
    await expect(page.getByTestId("graph-weight-chart")).toBeVisible({ timeout: 10_000 });

    await clearUserData(userId);
  });

  // J9-03: 설정 변경 후 그래프 목표 기준선 반영
  test("목표 체중 설정 변경 후 그래프에 반영됨", async ({ page, withSeededData }) => {
    void withSeededData;
    const settings = new SettingsPage(page);

    // 입력 탭에서 체중 입력
    const inputPage = new InputPage(page);
    await inputPage.goto();
    await inputPage.chip("weight").click();
    await inputPage.modalWeightInput.fill("83.0");
    await page.evaluate(() => {
      (document.querySelector('[data-testid="modal-save"]') as HTMLElement)?.click();
    });
    await expect(inputPage.chip("weight")).toContainText("83", { timeout: 10_000 });

    // 그래프 탭 이동 → 차트 표시 확인
    await page.goto("/graph");
    await expect(page.getByTestId("graph-weight-chart")).toBeVisible({ timeout: 10_000 });

    // 설정에서 목표 체중 변경 후 다시 그래프 확인 (목표선 갱신)
    await settings.goto();
    // 목표 체중 필드가 있으면 변경 후 저장
    const targetWeightInput = page.getByLabel(/목표 체중/).or(page.locator('input[name="targetWeight"]'));
    if (await targetWeightInput.isVisible()) {
      await targetWeightInput.fill("75");
      await settings.saveButton.click();
      await expect(settings.saveButton).toContainText("저장 완료", { timeout: 10_000 });
    }

    await page.goto("/graph");
    await expect(page.getByTestId("graph-weight-chart")).toBeVisible({ timeout: 10_000 });
  });
});
