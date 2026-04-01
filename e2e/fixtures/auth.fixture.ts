import { test as base } from "@playwright/test";
import { LoginPage } from "../pages/login.page";
import { RegisterPage } from "../pages/register.page";

type AuthFixtures = {
  loginPage: LoginPage;
  registerPage: RegisterPage;
};

export const test = base.extend<AuthFixtures>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  registerPage: async ({ page }, use) => {
    await use(new RegisterPage(page));
  },
});

export { expect } from "@playwright/test";
