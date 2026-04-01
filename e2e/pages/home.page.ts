import { type Page, type Locator } from "@playwright/test";
import { TEST_IDS } from "../helpers/test-ids";

export class HomePage {
  readonly page: Page;
  readonly coachOneLiner: Locator;
  readonly weightDisplay: Locator;
  readonly progressBanner: Locator;

  constructor(page: Page) {
    this.page = page;
    this.coachOneLiner = page.getByTestId(TEST_IDS.HOME_COACH_ONELINER);
    this.weightDisplay = page.getByTestId(TEST_IDS.HOME_WEIGHT_DISPLAY);
    this.progressBanner = page.getByTestId(TEST_IDS.HOME_PROGRESS_BANNER);
  }

  async goto() {
    await this.page.goto("/home");
  }
}
