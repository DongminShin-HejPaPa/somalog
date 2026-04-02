import { test, expect } from "../../fixtures";
import { OnboardingPage } from "../../pages/onboarding.page";
import { SettingsPage } from "../../pages/settings.page";
import { getUserIdByEmail, clearUserData } from "../../helpers/supabase-admin";

test.use({ storageState: "e2e/.auth/user.json" });

test.describe("Onboarding", () => {
  // J4-10: 온보딩 전체 8단계 완료 후 /input으로 이동
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

    // Step 3: 다이어트 목표 (목표 체중 입력 필수)
    await expect(onboarding.stepIndicator).toContainText("Step 3");
    await page.getByPlaceholder("목표 체중").fill("80");
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

  // J4-03: 온보딩에서 입력한 코치 이름이 설정에 반영됨
  test("온보딩에서 입력한 코치 이름이 설정에 반영됨", async ({ page }) => {
    const onboarding = new OnboardingPage(page);
    const settings = new SettingsPage(page);

    await onboarding.goto();
    // 코치 이름 "소마코치" 입력
    await onboarding.coachNameInput.fill("소마코치");
    await onboarding.nextButton.click();
    // 나머지 단계 기본값으로 빠르게 완료
    await onboarding.nextButton.click(); // Step 2
    await page.getByPlaceholder("목표 체중").fill("80"); // Step 3: 목표 체중 입력 필수
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

  // J4-01: "온보딩 없이 바로 사용" 스킵 링크
  test("온보딩 스킵 → 확인 카드 표시 → 취소 → 온보딩 유지", async ({ page }) => {
    // 데이터 없는 상태에서 진행 (settings 없음 = 온보딩 강제)
    const email = process.env.TEST_USER_EMAIL!;
    const userId = await getUserIdByEmail(email);
    await clearUserData(userId);

    const onboarding = new OnboardingPage(page);
    await onboarding.goto();

    // 스킵 링크 클릭
    await page.getByText("온보딩 없이 바로 사용할게요").click();
    // 확인 카드 표시
    await expect(page.getByText("기본값으로 시작")).toBeVisible();
    // 취소 → 온보딩 유지
    await page.getByText("취소").click();
    await expect(onboarding.stepIndicator).toContainText("Step 1");
  });

  // J4-01 continued: 스킵 확인 → /input으로 이동
  test("온보딩 스킵 확인 → /input으로 이동", async ({ page }) => {
    const email = process.env.TEST_USER_EMAIL!;
    const userId = await getUserIdByEmail(email);
    await clearUserData(userId);

    const onboarding = new OnboardingPage(page);
    await onboarding.goto();

    await page.getByText("온보딩 없이 바로 사용할게요").click();
    await expect(page.getByText("기본값으로 시작")).toBeVisible();
    // 확인 버튼 클릭
    await page.getByText("네, 기본값으로 시작할게요").click();
    await expect(page).toHaveURL("/input", { timeout: 15_000 });
  });

  // J4-05: Step 3 — 목표 체중 없이 다음 클릭 → 버튼 비활성
  test("Step 3 목표 체중 미입력 → 다음 버튼 비활성", async ({ page }) => {
    const onboarding = new OnboardingPage(page);
    await onboarding.goto();
    await onboarding.nextButton.click(); // Step 2
    await onboarding.nextButton.click(); // Step 3

    // Step 3에서 목표 체중 없이 다음 버튼이 disabled
    await expect(onboarding.nextButton).toBeDisabled();
  });

  // J4-10: 더블클릭 방지 — 완료 버튼 연속 클릭 시 비활성
  test("온보딩 완료 버튼 클릭 후 비활성 상태 (더블클릭 방지)", async ({ page }) => {
    const onboarding = new OnboardingPage(page);
    await onboarding.goto();

    // Step 1~7 빠르게 통과
    await onboarding.nextButton.click(); // Step 2
    await onboarding.nextButton.click(); // Step 2→3
    await page.getByPlaceholder("목표 체중").fill("80");
    await onboarding.nextButton.click(); // Step 3→4
    await page.getByText("2.8L로 할게").click(); // Step 5
    await page.getByText("응, 이대로 할게").click(); // Step 6
    await page.getByText("응, 켜줘").click(); // Step 7
    await onboarding.nextButton.click(); // Step 8

    // 완료 버튼 클릭
    await onboarding.completeButton.click();
    // 클릭 직후 비활성 또는 텍스트 변경 확인
    await expect(onboarding.completeButton).toBeDisabled({ timeout: 3_000 });
  });
});
