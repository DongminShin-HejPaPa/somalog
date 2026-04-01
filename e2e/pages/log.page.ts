import { type Page, type Locator } from "@playwright/test";
import { TEST_IDS } from "../helpers/test-ids";

export class LogPage {
  readonly page: Page;
  readonly logList: Locator;

  constructor(page: Page) {
    this.page = page;
    this.logList = page.getByTestId(TEST_IDS.LOG_LIST);
  }

  async goto() {
    await this.page.goto("/log");
  }

  logItem(date: string): Locator {
    return this.page.getByTestId(TEST_IDS.LOG_ITEM(date));
  }
}
