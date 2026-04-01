import { test as setup, expect } from "@playwright/test";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env.test.local"), override: true });

const AUTH_FILE = path.resolve(process.cwd(), "e2e/.auth/user.json");

setup("테스트 유저 인증 상태 저장", async ({ page }) => {
  const email = process.env.TEST_USER_EMAIL!;
  const password = process.env.TEST_USER_PASSWORD!;

  if (!email || !password) {
    throw new Error("TEST_USER_EMAIL / TEST_USER_PASSWORD 환경 변수가 필요합니다.");
  }

  await page.goto("/login");

  await page.getByTestId("login-email").fill(email);
  await page.getByTestId("login-password").fill(password);
  await page.getByTestId("login-submit").click();

  // 로그인 성공 → 앱 내부로 리다이렉트 확인
  await expect(page).toHaveURL(/\/(input|home|onboarding)/, { timeout: 15_000 });

  // storageState 저장 (Supabase 세션 쿠키 포함)
  await page.context().storageState({ path: AUTH_FILE });
});
