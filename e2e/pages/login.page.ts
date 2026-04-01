import { type Page, type Locator } from "@playwright/test";
import { TEST_IDS } from "../helpers/test-ids";

export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.getByTestId(TEST_IDS.LOGIN_EMAIL);
    this.passwordInput = page.getByTestId(TEST_IDS.LOGIN_PASSWORD);
    this.submitButton = page.getByTestId(TEST_IDS.LOGIN_SUBMIT);
    this.errorMessage = page.getByTestId(TEST_IDS.LOGIN_ERROR);
  }

  async goto() {
    await this.page.goto("/login");
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }
}
