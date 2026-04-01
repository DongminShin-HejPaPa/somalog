import { test as base } from "@playwright/test";
import * as dotenv from "dotenv";
import path from "path";
import {
  getUserIdByEmail,
  clearUserData,
  seedSettings,
  seedDailyLogs,
} from "../helpers/supabase-admin";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env.test.local"), override: true });

type SeededFixtures = {
  /** 테스트 전 데이터를 씨딩하고, 테스트 후 정리하는 픽스처 */
  withSeededData: void;
};

export const test = base.extend<SeededFixtures>({
  withSeededData: [
    async ({}, use) => {
      const email = process.env.TEST_USER_EMAIL!;
      const today = new Date().toISOString().split("T")[0];

      // 1. 데이터 준비
      const userId = await getUserIdByEmail(email);
      await clearUserData(userId);
      await seedSettings(userId);
      await seedDailyLogs(userId, [
        { date: today, day: 1, closed: false },
      ]);

      await use();

      // 2. 정리
      await clearUserData(userId);
    },
    { auto: false },
  ],
});

export { expect } from "@playwright/test";
