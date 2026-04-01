import { test, expect } from "../../fixtures";
import { InputPage } from "../../pages/input.page";

test.use({ storageState: "e2e/.auth/user.json" });

test.describe("Input: 칩 → 모달 → 저장", () => {
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
    await expect(page.getByTestId("modal-save")).not.toBeVisible({ timeout: 10_000 });
  }

  test("체중 칩 클릭 → 모달 열림 → 값 입력 → 저장 → 칩에 값 표시", async ({ page }) => {
    await inputPage.chip("weight").click();

    // 모달 열림 확인
    await expect(inputPage.modalWeightInput).toBeVisible();

    // 값 입력
    await inputPage.modalWeightInput.fill("82.3");

    await saveModal(page);

    // 칩에 값 표시
    await expect(inputPage.chip("weight")).toContainText("82.3");
  });

  test("수분 프리셋 선택 → 저장", async ({ page }) => {
    await inputPage.chip("water").click();

    // 2.5L 프리셋 선택
    await inputPage.modalWaterPreset(2.5).click();

    await saveModal(page);

    await expect(inputPage.chip("water")).toContainText("2.5");
  });

  test("운동 Y 선택 → 즉시 저장", async ({ page }) => {
    await inputPage.chip("exercise").click();

    await page.getByTestId("modal-exercise-y").click();

    // 운동 모달은 선택 즉시 저장됨 → 칩 업데이트 대기
    await expect(inputPage.chip("exercise")).toContainText("했음", { timeout: 10_000 });
  });

  test("운동 N 선택 → 즉시 저장", async ({ page }) => {
    await inputPage.chip("exercise").click();

    await page.getByTestId("modal-exercise-n").click();

    await expect(inputPage.chip("exercise")).toContainText("안 했음", { timeout: 10_000 });
  });

  test("야식 Y 선택 → 즉시 저장", async ({ page }) => {
    await inputPage.chip("lateSnack").click();

    await page.getByTestId("modal-late-snack-y").click();

    await expect(inputPage.chip("lateSnack")).toContainText("먹음", { timeout: 10_000 });
  });

  test("야식 N 선택 → 즉시 저장", async ({ page }) => {
    await inputPage.chip("lateSnack").click();

    await page.getByTestId("modal-late-snack-n").click();

    await expect(inputPage.chip("lateSnack")).toContainText("안 먹음", { timeout: 10_000 });
  });

  test("체력 '보통' 선택 → 즉시 저장", async ({ page }) => {
    await inputPage.chip("energy").click();

    await inputPage.modalEnergyButton("보통").click();

    await expect(inputPage.chip("energy")).toContainText("보통", { timeout: 10_000 });
  });

  test("아침 식사 텍스트 입력 → 저장", async ({ page }) => {
    await inputPage.chip("breakfast").click();

    await expect(inputPage.modalMealInput).toBeVisible();
    await inputPage.modalMealInput.fill("관리식단 도시락");

    await saveModal(page);

    await expect(inputPage.chip("breakfast")).toContainText("관리식단 도시락");
  });

  test("점심 식사 텍스트 입력 → 저장", async ({ page }) => {
    await inputPage.chip("lunch").click();

    await inputPage.modalMealInput.fill("한식 백반 소식");

    await saveModal(page);

    await expect(inputPage.chip("lunch")).toContainText("한식 백반");
  });

  test("저녁 식사 텍스트 입력 → 저장", async ({ page }) => {
    await inputPage.chip("dinner").click();

    await inputPage.modalMealInput.fill("닭가슴살 샐러드");

    await saveModal(page);

    await expect(inputPage.chip("dinner")).toContainText("닭가슴살");
  });

  test("모달 닫기 버튼 클릭 → 모달 닫힘", async ({ page }) => {
    await inputPage.chip("weight").click();

    await expect(inputPage.modalWeightInput).toBeVisible();

    await inputPage.modalClose.click();

    await expect(inputPage.modalWeightInput).not.toBeVisible();
  });
});
