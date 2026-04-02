import { test, expect } from "../../fixtures";
import { LoginPage } from "../../pages/login.page";

test.describe("Login", () => {
  // J3-01: 존재하지 않는 이메일 → 한글 에러
  test("존재하지 않는 이메일 → 한글 에러 메시지 표시", async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();

    await login.emailInput.fill("notexist@somalog.test");
    await login.passwordInput.fill("Test1234!");
    await login.submitButton.click();

    await expect(login.errorMessage).toBeVisible({ timeout: 10_000 });
    // 영문 Supabase 에러 미노출 확인
    await expect(login.errorMessage).not.toContainText("Invalid login credentials");
  });

  // J3-02: 잘못된 비밀번호 → 에러
  test("잘못된 비밀번호 → 에러 메시지 표시", async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();

    await login.emailInput.fill(process.env.TEST_USER_EMAIL!);
    await login.passwordInput.fill("WrongPass999");
    await login.submitButton.click();

    await expect(login.errorMessage).toBeVisible({ timeout: 10_000 });
  });

  // J3-03: 빈 필드 제출 → 브라우저 required 검증
  test("빈 필드 제출 → /login 유지 (required 검증)", async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();

    await login.submitButton.click();
    await expect(page).toHaveURL("/login");
  });

  // J3-05: 정상 로그인 → 앱으로 이동
  test("올바른 자격증명으로 로그인 성공 → 앱으로 이동", async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();

    await login.emailInput.fill(process.env.TEST_USER_EMAIL!);
    await login.passwordInput.fill(process.env.TEST_USER_PASSWORD!);
    await login.submitButton.click();

    // 로그인 성공 시 앱 탭으로 이동 (/home, /input, /onboarding 중 하나)
    await expect(page).not.toHaveURL("/login", { timeout: 10_000 });
  });
});
