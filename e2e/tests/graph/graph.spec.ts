import { test, expect } from "../../fixtures";
import { InputPage } from "../../pages/input.page";

test.use({ storageState: "e2e/.auth/user.json" });

test.describe("Graph", () => {
  test("체중 데이터 없을 때 빈 상태 메시지 표시", async ({ page, withSeededData }) => {
    void withSeededData;
    // 시드 데이터에는 체중이 없으므로 빈 상태
    await page.goto("/graph");
    await expect(page.getByText("아직 체중 데이터가 없어요")).toBeVisible();
  });

  test("체중 입력 후 그래프 표시", async ({ page, withSeededData }) => {
    void withSeededData;
    const inputPage = new InputPage(page);
    await inputPage.goto();

    // 체중 입력
    await inputPage.chip("weight").click();
    await inputPage.modalWeightInput.fill("82.0");
    await page.evaluate(() => {
      (document.querySelector('[data-testid="modal-save"]') as HTMLElement)?.click();
    });
    // 저장 완료 후 칩에 값 표시 대기 (저장이 완료됐음을 확인)
    await expect(inputPage.chip("weight")).toContainText("82", { timeout: 10_000 });

    // 그래프 탭으로 이동
    await page.goto("/graph");

    // 체중 데이터가 있으면 그래프 표시
    await expect(page.getByTestId("graph-weight-chart")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("아직 체중 데이터가 없어요")).not.toBeVisible();
  });
});
