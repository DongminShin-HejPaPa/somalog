import { test, expect } from "../../fixtures";
import { LoginPage } from "../../pages/login.page";

test.describe("Login", () => {
  test("올바른 자격증명으로 로그인 성공 → 앱으로 이동", async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();

    await login.emailInput.fill(process.env.TEST_USER_EMAIL!);
    await login.passwordInput.fill(process.env.TEST_USER_PASSWORD!);
    await login.submitButton.click();

    // 로그인 성공 시 앱 탭으로 이동 (/home, /input, /onboarding 중 하나)
    await expect(page).not.toHaveURL("/login");
  });

  test("잘못된 비밀번호 → 에러 메시지 표시", async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();

    await login.emailInput.fill(process.env.TEST_USER_EMAIL!);
    await login.passwordInput.fill("wrongpassword");
    await login.submitButton.click();

    await expect(login.errorMessage).toBeVisible();
  });
});
