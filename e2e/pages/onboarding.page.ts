import { type Page, type Locator } from "@playwright/test";
import { TEST_IDS } from "../helpers/test-ids";

export class OnboardingPage {
  readonly page: Page;
  readonly stepIndicator: Locator;
  readonly progressBar: Locator;
  readonly coachNameInput: Locator;
  readonly nextButton: Locator;
  readonly completeButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.stepIndicator = page.getByTestId(TEST_IDS.ONBOARDING_STEP_INDICATOR);
    this.progressBar = page.getByTestId(TEST_IDS.ONBOARDING_PROGRESS);
    this.coachNameInput = page.getByTestId(TEST_IDS.ONBOARDING_COACH_NAME);
    this.nextButton = page.getByTestId(TEST_IDS.ONBOARDING_NEXT);
    this.completeButton = page.getByTestId(TEST_IDS.ONBOARDING_COMPLETE);
  }

  async goto() {
    await this.page.goto("/onboarding");
  }

  /** 모든 스텝을 기본값으로 빠르게 완료 */
  async completeWithDefaults() {
    await this.goto();
    // Step 1: 코치 이름 (기본값 사용)
    await this.nextButton.click();
    // Step 2: 신체 정보
    await this.nextButton.click();
    // Step 3: 다이어트 목표
    await this.nextButton.click();
    // Step 4: 수분 목표 → 버튼 클릭으로 바로 다음 스텝
    await this.page.getByText("2.8L로 할게").click();
    // Step 5: 루틴 → 이대로 할게
    await this.page.getByText("응, 이대로 할게").click();
    // Step 6: Intensive Day → 응 켜줘
    await this.page.getByText("응, 켜줘").click();
    // Step 7: 코치 스타일
    await this.nextButton.click();
    // Step 8: 완료
    await this.completeButton.click();
  }
}
