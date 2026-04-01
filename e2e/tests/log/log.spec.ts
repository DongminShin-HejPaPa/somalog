import { test, expect } from "../../fixtures";

test.use({ storageState: "e2e/.auth/user.json" });

test.describe("Log", () => {
  test.beforeEach(async ({ withSeededData }) => {
    void withSeededData;
  });

  test("기록 목록이 표시됨", async ({ page }) => {
    await page.goto("/log");
    await expect(page.getByTestId("log-list")).toBeVisible();
  });

  test("시드 데이터의 로그 항목이 목록에 표시됨", async ({ page }) => {
    await page.goto("/log");
    const today = new Date().toISOString().split("T")[0];
    await expect(page.getByTestId(`log-item-${today}`)).toBeVisible();
  });

  test("로그 항목 클릭 → 상세 펼침", async ({ page }) => {
    await page.goto("/log");
    const today = new Date().toISOString().split("T")[0];
    const item = page.getByTestId(`log-item-${today}`);
    await item.click();
    // 펼쳐지면 내부 상세 정보가 보임
    await expect(item.locator("text=체중")).toBeVisible();
  });
});
