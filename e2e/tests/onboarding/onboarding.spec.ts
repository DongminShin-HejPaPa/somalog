import { test, expect } from "../../fixtures";
import { OnboardingPage } from "../../pages/onboarding.page";
import { SettingsPage } from "../../pages/settings.page";

test.use({ storageState: "e2e/.auth/user.json" });

test.describe("Onboarding", () => {
  test("온보딩 전체 8단계 완료 후 /input으로 이동", async ({ page }) => {
    const onboarding = new OnboardingPage(page);
    await onboarding.goto();

    // Step 1: 코치 이름
    await expect(onboarding.stepIndicator).toContainText("Step 1");
    await onboarding.coachNameInput.fill("테스트코치");
    await onboarding.nextButton.click();

    // Step 2: 신체 정보
    await expect(onboarding.stepIndicator).toContainText("Step 2");
    await onboarding.nextButton.click();

    // Step 3: 다이어트 목표
    await expect(onboarding.stepIndicator).toContainText("Step 3");
    await onboarding.nextButton.click();

    // Step 4: 수분 목표
    await expect(onboarding.stepIndicator).toContainText("Step 4");
    await page.getByText("2.8L로 할게").click();

    // Step 5: 루틴
    await expect(onboarding.stepIndicator).toContainText("Step 5");
    await page.getByText("응, 이대로 할게").click();

    // Step 6: Intensive Day
    await expect(onboarding.stepIndicator).toContainText("Step 6");
    await page.getByText("응, 켜줘").click();

    // Step 7: 코치 스타일
    await expect(onboarding.stepIndicator).toContainText("Step 7");
    await onboarding.nextButton.click();

    // Step 8: 완료
    await expect(onboarding.stepIndicator).toContainText("Step 8");
    await onboarding.completeButton.click();

    // 완료 후 /input으로 이동
    await expect(page).toHaveURL("/input", { timeout: 15_000 });
  });

  test("온보딩에서 입력한 코치 이름이 설정에 반영됨", async ({ page }) => {
    const onboarding = new OnboardingPage(page);
    const settings = new SettingsPage(page);

    await onboarding.goto();
    // 코치 이름 "소마코치" 입력
    await onboarding.coachNameInput.fill("소마코치");
    await onboarding.nextButton.click();
    // 나머지 단계 기본값으로 빠르게 완료
    await onboarding.nextButton.click(); // Step 2
    await onboarding.nextButton.click(); // Step 3
    await page.getByText("2.8L로 할게").click(); // Step 4
    await page.getByText("응, 이대로 할게").click(); // Step 5
    await page.getByText("응, 켜줘").click(); // Step 6
    await onboarding.nextButton.click(); // Step 7
    await onboarding.completeButton.click(); // Step 8 → /input

    // 설정 탭으로 이동
    await settings.goto();
    // 코치 이름 필드에 "소마코치" 표시
    await expect(page.getByTestId("settings-coach-name")).toHaveValue("소마코치");
  });
});
