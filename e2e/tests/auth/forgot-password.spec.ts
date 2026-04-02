import { test, expect } from "../../fixtures";

test.describe("Forgot Password", () => {
  // J2-01: 로그인 페이지에서 비밀번호 찾기 링크
  test("로그인 페이지 → 비밀번호 찾기 링크 클릭 → /forgot-password 이동", async ({ page }) => {
    await page.goto("/login");
    await page.getByText("비밀번호를 잊으셨나요?").click();
    await expect(page).toHaveURL("/forgot-password");
  });

  // J2-02: 이메일 없이 제출 → 브라우저 validation
  test("이메일 미입력 → 제출 불가 (required 검증)", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.getByRole("button", { name: "재설정 링크 발송" }).click();
    // 이메일 input이 required이므로 /forgot-password에 머물러 있어야 함
    await expect(page).toHaveURL("/forgot-password");
  });

  // J2-03: 정상 발송 → 성공 메시지
  test("이메일 입력 후 발송 → 성공 메시지 표시", async ({ page }) => {
    // 고유 이메일로 rate-limit 회피 (Supabase는 존재하지 않는 이메일도 success 반환)
    const uniqueEmail = `e2e-reset-${Date.now()}@example.com`;
    await page.goto("/forgot-password");
    await page.getByPlaceholder("email@example.com").fill(uniqueEmail);
    await page.getByRole("button", { name: "재설정 링크 발송" }).click();

    // 로딩 → 성공 메시지
    await expect(page.getByText("재설정 링크를 이메일로 발송했어요")).toBeVisible({ timeout: 15_000 });
    // 로그인으로 돌아가기 버튼 표시 (footer에도 같은 링크가 있으므로 first() 사용)
    await expect(page.getByRole("link", { name: "로그인으로 돌아가기" }).first()).toBeVisible();
  });

  // J2-03 후속: 로그인으로 돌아가기
  test("성공 후 로그인으로 돌아가기 → /login 이동", async ({ page }) => {
    const uniqueEmail = `e2e-reset-${Date.now()}@example.com`;
    await page.goto("/forgot-password");
    await page.getByPlaceholder("email@example.com").fill(uniqueEmail);
    await page.getByRole("button", { name: "재설정 링크 발송" }).click();
    await expect(page.getByText("재설정 링크를 이메일로 발송했어요")).toBeVisible({ timeout: 15_000 });

    await page.getByRole("link", { name: "로그인으로 돌아가기" }).first().click();
    await expect(page).toHaveURL("/login");
  });

  // J2-04: /reset-password UI — 비밀번호 불일치
  test("/reset-password 비밀번호 불일치 → 에러 표시", async ({ page }) => {
    await page.goto("/reset-password");
    await page.getByPlaceholder("6자 이상 입력하세요").fill("NewPass1234!");
    await page.getByPlaceholder("비밀번호를 다시 입력하세요").fill("Different!");
    await page.getByRole("button", { name: "비밀번호 변경" }).click();

    await expect(page.getByText("비밀번호가 일치하지 않습니다")).toBeVisible({ timeout: 5_000 });
  });

  // J2-04: /reset-password UI — 세션 없이 제출 → 에러
  test("/reset-password 세션 없이 변경 시도 → 에러 표시", async ({ page }) => {
    await page.goto("/reset-password");
    await page.getByPlaceholder("6자 이상 입력하세요").fill("NewPass1234!");
    await page.getByPlaceholder("비밀번호를 다시 입력하세요").fill("NewPass1234!");
    await page.getByRole("button", { name: "비밀번호 변경" }).click();

    // 세션 없이 접근 시 실패 메시지
    await expect(page.getByText("비밀번호 변경에 실패했습니다")).toBeVisible({ timeout: 10_000 });
  });
});
