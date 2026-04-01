import { test, expect } from "../../fixtures";
import { InputPage } from "../../pages/input.page";

test.use({ storageState: "e2e/.auth/user.json" });

/**
 * AI 코칭 피드백 E2E 테스트
 *
 * - 실제 OpenRouter API를 호출하므로 네트워크 필요
 * - AI 응답은 비결정적 → 내용이 아닌 "텍스트가 있는가"만 검증
 * - API 키 없으면 fallback 텍스트가 보여야 함
 */
test.describe("Input: AI 코칭 피드백", () => {
  test("체중 입력 후 피드백 영역에 텍스트가 표시된다", async ({
    page,
    withSeededData,
  }) => {
    void withSeededData;
    const inputPage = new InputPage(page);
    await inputPage.goto();

    // 체중 입력 → 저장
    await inputPage.chip("weight").click();
    await inputPage.modalWeightInput.fill("80.5");
    await page.evaluate(() => {
      (document.querySelector('[data-testid="modal-save"]') as HTMLElement)?.click();
    });

    // 칩 업데이트 확인 (AI 10초 abort + 서버 액션 완료 대기 — 최대 20초)
    await expect(inputPage.chip("weight")).toContainText("80", { timeout: 20_000 });

    // 피드백 영역에 텍스트 존재 확인 (AI or fallback)
    const feedbackArea = page.getByTestId("feedback-area");
    await expect(feedbackArea).toBeVisible({ timeout: 10_000 });
    const feedbackText = await feedbackArea.textContent();
    expect(feedbackText?.trim().length).toBeGreaterThan(0);
  });

  test("마감 후 홈 탭 코치 한마디에 텍스트가 표시된다", async ({
    page,
    withSeededData,
  }) => {
    void withSeededData;
    const inputPage = new InputPage(page);
    await inputPage.goto();

    // 체중만 입력하고 마감
    await inputPage.chip("weight").click();
    await inputPage.modalWeightInput.fill("80.5");
    await page.evaluate(() => {
      (document.querySelector('[data-testid="modal-save"]') as HTMLElement)?.click();
    });
    // AI abort(10초) + 서버 응답 대기
    await expect(inputPage.chip("weight")).toContainText("80", { timeout: 20_000 });

    await inputPage.closeButton.click();
    // 마감 완료 대기 (AI oneLiner 생성 시간 포함 — 최대 40초)
    await expect(inputPage.closeButton).toContainText("마감 완료", { timeout: 40_000 });

    // 홈 탭 이동
    await page.goto("/home");

    // 코치 한마디 텍스트 확인
    const oneLiner = page.getByTestId("home-coach-oneliner");
    await expect(oneLiner).toBeVisible({ timeout: 10_000 });
    const text = await oneLiner.textContent();
    expect(text?.trim().length).toBeGreaterThan(0);
  });
});
