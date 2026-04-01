import { type Page, type Locator } from "@playwright/test";
import { TEST_IDS } from "../helpers/test-ids";

export class SettingsPage {
  readonly page: Page;
  readonly saveButton: Locator;
  readonly resetButton: Locator;
  readonly demoButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.saveButton = page.getByTestId(TEST_IDS.SETTINGS_SAVE);
    this.resetButton = page.getByTestId(TEST_IDS.SETTINGS_RESET);
    this.demoButton = page.getByTestId(TEST_IDS.SETTINGS_DEMO);
  }

  async goto() {
    await this.page.goto("/settings");
  }
}
