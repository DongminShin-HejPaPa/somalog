import { test, expect } from "../../fixtures";
import { RegisterPage } from "../../pages/register.page";
import { deleteTestUser } from "../../helpers/supabase-admin";

test.describe("Register", () => {
  // J1-01: 필수 약관 미동의 → 에러
  test("필수 약관 미동의 → 에러 메시지 표시", async ({ page }) => {
    const register = new RegisterPage(page);
    await register.goto();

    await register.fill("테스트유저", "e2e-test@example.com", "Test1234!");
    // 약관 체크 없이 제출
    await register.submitButton.click();

    await expect(register.errorMessage).toContainText("이용약관 및 개인정보 처리방침에 동의해주세요");
    await expect(page).toHaveURL("/register");
  });

  // J1-02: 비밀번호 불일치 → 에러
  test("비밀번호 불일치 → 에러 메시지 표시", async ({ page }) => {
    const register = new RegisterPage(page);
    await register.goto();

    await register.fill("테스트유저", "e2e-test@example.com", "Test1234!", "Wrong5678!");
    await register.agreeRequired();
    await register.submitButton.click();

    await expect(register.errorMessage).toContainText("비밀번호가 일치하지 않습니다");
    // 이메일 필드 값 유지
    await expect(register.emailInput).toHaveValue("e2e-test@example.com");
  });

  // J1-03: 비밀번호 6자 미만 → 에러
  test("비밀번호 6자 미만 → 에러 메시지 표시", async ({ page }) => {
    const register = new RegisterPage(page);
    await register.goto();

    await register.fill("테스트유저", "e2e-new@example.com", "abc", "abc");
    await register.agreeRequired();
    await register.submitButton.click();

    await expect(register.errorMessage).toContainText("6자 이상");
  });

  // J1-04: 이미 가입된 이메일 → 에러
  test("이미 가입된 이메일 → 한글 에러 메시지 표시", async ({ page }) => {
    const register = new RegisterPage(page);
    await register.goto();

    // 이미 존재하는 테스트 유저 이메일 사용
    await register.fill("테스트유저", process.env.TEST_USER_EMAIL!, "Test1234!");
    await register.agreeRequired();
    await register.submitButton.click();

    // 한글 에러 메시지 확인 (영문 Supabase 에러 미노출)
    await expect(register.errorMessage).toBeVisible({ timeout: 10_000 });
    await expect(register.errorMessage).not.toContainText("User already registered");
  });

  // J1-05: 회원가입 성공 → /login으로 이동 + 성공 배너
  test("신규 회원가입 성공 → /login 이동 + 성공 메시지", async ({ page }) => {
    const newEmail = `e2e-new-${Date.now()}@example.com`;

    const register = new RegisterPage(page);
    await register.goto();

    await register.fill("신규유저", newEmail, "Test1234!");
    await register.agreeRequired();
    await register.submitButton.click();

    // /login으로 이동 확인 (성공 시 redirect)
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
    // URL에 success message 파라미터 또는 페이지에 성공 텍스트 표시 확인
    await expect(page.getByText(/가입이 완료/)).toBeVisible({ timeout: 5_000 });

    // 정리: 생성된 테스트 유저 삭제
    await deleteTestUser(newEmail);
  });
});
