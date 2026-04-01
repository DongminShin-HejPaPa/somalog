import { type Page, type Locator } from "@playwright/test";
import { TEST_IDS } from "../helpers/test-ids";

export class RegisterPage {
  readonly page: Page;
  readonly nameInput: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly passwordConfirmInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.nameInput = page.getByTestId(TEST_IDS.REGISTER_NAME);
    this.emailInput = page.getByTestId(TEST_IDS.REGISTER_EMAIL);
    this.passwordInput = page.getByTestId(TEST_IDS.REGISTER_PASSWORD);
    this.passwordConfirmInput = page.getByTestId(TEST_IDS.REGISTER_PASSWORD_CONFIRM);
    this.submitButton = page.getByTestId(TEST_IDS.REGISTER_SUBMIT);
    this.errorMessage = page.getByTestId(TEST_IDS.REGISTER_ERROR);
  }

  async goto() {
    await this.page.goto("/register");
  }

  async register(name: string, email: string, password: string) {
    await this.nameInput.fill(name);
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.passwordConfirmInput.fill(password);
    await this.submitButton.click();
  }
}
