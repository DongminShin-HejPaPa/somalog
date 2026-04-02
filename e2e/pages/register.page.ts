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

  /** 필수 약관(이용약관 + 개인정보처리방침) 체크 */
  async agreeRequired() {
    await this.page.locator("label").filter({ hasText: "이용약관 동의" }).locator("input[type=checkbox]").click();
    await this.page.locator("label").filter({ hasText: "개인정보 처리방침 동의" }).locator("input[type=checkbox]").click();
  }

  /** 전체 동의 체크 */
  async agreeAll() {
    await this.page.locator("label").filter({ hasText: "전체 동의" }).locator("input[type=checkbox]").click();
  }

  /** 기본 필드 채우기 (passwordConfirm 미입력 시 password와 동일) */
  async fill(name: string, email: string, password: string, passwordConfirm?: string) {
    await this.nameInput.fill(name);
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.passwordConfirmInput.fill(passwordConfirm ?? password);
  }

  async register(name: string, email: string, password: string) {
    await this.fill(name, email, password);
    await this.agreeAll();
    await this.submitButton.click();
  }
}
