import { test, expect } from "../../fixtures";
import { InputPage } from "../../pages/input.page";

test.use({ storageState: "e2e/.auth/user.json" });

test.describe("Input: 마감 플로우", () => {
  let inputPage: InputPage;

  test.beforeEach(async ({ page, withSeededData }) => {
    void withSeededData;
    inputPage = new InputPage(page);
    await inputPage.goto();
  });

  /** modal-save를 JS클릭 후 모달이 사라질 때까지 대기 */
  async function saveModal(page: import("@playwright/test").Page) {
    await page.evaluate(() => {
      (document.querySelector('[data-testid="modal-save"]') as HTMLElement)?.click();
    });
    // 모달이 DOM에서 사라질 때까지 대기
    await expect(page.getByTestId("modal-save")).not.toBeVisible({ timeout: 10_000 });
  }

  /** 8개 항목을 모두 채우는 헬퍼 */
  async function fillAllFields(page: import("@playwright/test").Page) {
    // 1. 체중
    await inputPage.chip("weight").click();
    await inputPage.modalWeightInput.fill("82.3");
    await saveModal(page);

    // 2. 수분
    await inputPage.chip("water").click();
    await inputPage.modalWaterPreset(2.5).click();
    await saveModal(page);

    // 3. 운동
    await inputPage.chip("exercise").click();
    await page.getByTestId("modal-exercise-y").click();
    // 운동/야식/체력은 선택 즉시 저장 + 모달 닫힘 → chip 업데이트 대기
    await expect(inputPage.chip("exercise")).toContainText("했음", { timeout: 10_000 });

    // 4. 아침
    await inputPage.chip("breakfast").click();
    await inputPage.modalMealInput.fill("오트밀");
    await saveModal(page);

    // 5. 점심
    await inputPage.chip("lunch").click();
    await inputPage.modalMealInput.fill("샐러드");
    await saveModal(page);

    // 6. 저녁
    await inputPage.chip("dinner").click();
    await inputPage.modalMealInput.fill("닭가슴살");
    await saveModal(page);

    // 7. 야식
    await inputPage.chip("lateSnack").click();
    await page.getByTestId("modal-late-snack-n").click();
    await expect(inputPage.chip("lateSnack")).toContainText("안 먹음", { timeout: 10_000 });

    // 8. 체력
    await inputPage.chip("energy").click();
    await inputPage.modalEnergyButton("보통").click();
    await expect(inputPage.chip("energy")).toContainText("보통", { timeout: 10_000 });
  }

  test("8개 항목 모두 입력 후 마감 → 마감 완료 상태", async ({ page }) => {
    await fillAllFields(page);

    // 마감 버튼 클릭
    await inputPage.closeButton.click();

    // 마감 완료 후 버튼 텍스트 변경
    await expect(inputPage.closeButton).toContainText("마감 완료", { timeout: 10_000 });
  });

  test("마감 완료 후 칩이 disabled 상태", async ({ page }) => {
    await fillAllFields(page);
    await inputPage.closeButton.click();
    await expect(inputPage.closeButton).toContainText("마감 완료", { timeout: 10_000 });

    // 칩들이 비활성화(disabled)됨
    await expect(inputPage.chip("weight")).toBeDisabled();
    await expect(inputPage.chip("exercise")).toBeDisabled();
    await expect(inputPage.chip("breakfast")).toBeDisabled();
  });

  test("마감 완료 후 마감 버튼 재클릭 불가 (cursor-default)", async ({ page }) => {
    await fillAllFields(page);
    await inputPage.closeButton.click();
    await expect(inputPage.closeButton).toContainText("마감 완료", { timeout: 10_000 });

    // 마감 버튼을 다시 클릭해도 상태 변화 없음 (이미 마감 완료)
    await inputPage.closeButton.click({ force: true });
    await expect(inputPage.closeButton).toContainText("마감 완료");
  });
});
