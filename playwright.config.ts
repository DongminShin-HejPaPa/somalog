import { defineConfig, devices } from "@playwright/test";
import * as dotenv from "dotenv";
import path from "path";

// .env.local → .env.test.local 순서로 로드 (뒤에 오는 파일이 우선)
dotenv.config({ path: path.resolve(__dirname, ".env.local") });
dotenv.config({ path: path.resolve(__dirname, ".env.test.local"), override: true });

export default defineConfig({
  testDir: "./e2e/tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  projects: [
    // 브라우저 인증 상태 저장 (globalSetup에서 만든 유저로 로그인)
    {
      name: "setup",
      testDir: "./e2e",
      testMatch: /auth\.setup\.ts/,
    },
    // 비인증 테스트 (로그인, 회원가입, 리다이렉트)
    {
      name: "unauthenticated",
      testMatch: /tests\/auth\/.+\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    // 인증이 필요한 테스트 (그 외 모든 spec)
    {
      name: "authenticated",
      testIgnore: /tests\/auth\/.+\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/user.json",
      },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
