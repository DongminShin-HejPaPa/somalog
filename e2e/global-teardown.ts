import { FullConfig } from "@playwright/test";
import * as dotenv from "dotenv";
import path from "path";
import { deleteTestUser } from "./helpers/supabase-admin";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env.test.local"), override: true });

export default async function globalTeardown(_config: FullConfig) {
  const email = process.env.TEST_USER_EMAIL;
  if (!email) return;

  try {
    await deleteTestUser(email);
    console.log(`🗑️  테스트 유저 삭제: ${email}`);
  } catch (error) {
    console.warn("테스트 유저 삭제 실패 (무시됨):", error);
  }
}
