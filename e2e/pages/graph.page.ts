import { type Page, type Locator } from "@playwright/test";
import { TEST_IDS } from "../helpers/test-ids";

export class GraphPage {
  readonly page: Page;
  readonly weightChart: Locator;

  constructor(page: Page) {
    this.page = page;
    this.weightChart = page.getByTestId(TEST_IDS.GRAPH_WEIGHT_CHART);
  }

  async goto() {
    await this.page.goto("/graph");
  }
}
