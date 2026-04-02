import { test, expect } from "../../fixtures";

test.describe("Auth Redirect", () => {
  // J3-04: 비인증 접근 → /login 리다이렉트
  test("비인증 상태에서 /home 접근 → /login으로 리다이렉트", async ({ browser }) => {
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

  test("비인증 상태에서 /settings 접근 → /login으로 리다이렉트", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("http://localhost:3000/settings");
    await expect(page).toHaveURL(/\/login/);
    await context.close();
  });

  test("비인증 상태에서 /log 접근 → /login으로 리다이렉트", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("http://localhost:3000/log");
    await expect(page).toHaveURL(/\/login/);
    await context.close();
  });

  // 공개 라우트는 리다이렉트 없이 접근 가능
  test("/login 비인증 접근 → /login 유지", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("http://localhost:3000/login");
    await expect(page).toHaveURL(/\/login/);
    await context.close();
  });

  test("/forgot-password 비인증 접근 → 접근 가능", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("http://localhost:3000/forgot-password");
    await expect(page).toHaveURL(/\/forgot-password/);
    await context.close();
  });
});
