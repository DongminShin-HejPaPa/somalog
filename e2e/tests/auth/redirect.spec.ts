import { test, expect } from "../../fixtures";

test.describe("Auth Redirect", () => {
  test("비인증 상태에서 /home 접근 → /login으로 리다이렉트", async ({ browser }) => {
    // storageState 없이 새 컨텍스트 생성
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto("http://localhost:3000/home");
    await expect(page).toHaveURL(/\/login/);

    await context.close();
  });

  test("비인증 상태에서 /input 접근 → /login으로 리다이렉트", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto("http://localhost:3000/input");
    await expect(page).toHaveURL(/\/login/);

    await context.close();
  });
});
