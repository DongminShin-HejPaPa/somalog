import { FullConfig } from "@playwright/test";
import * as dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { createTestUser } from "./helpers/supabase-admin";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env.test.local"), override: true });

export default async function globalSetup(_config: FullConfig) {
  // 필수 환경 변수 확인
  const email = process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_USER_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "TEST_USER_EMAIL 또는 TEST_USER_PASSWORD 환경 변수가 설정되지 않았습니다.\n" +
        ".env.test.local 파일을 확인하세요."
    );
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY 환경 변수가 설정되지 않았습니다.\n" +
        ".env.test.local 파일을 확인하세요."
    );
  }

  // e2e/.auth 디렉토리 생성
  const authDir = path.resolve(process.cwd(), "e2e/.auth");
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  // 테스트 유저 생성 (이미 존재하면 무시)
  try {
    await createTestUser(email, password);
    console.log(`✅ 테스트 유저 생성: ${email}`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("already") || msg.includes("duplicate") || msg.includes("email")) {
      console.log(`ℹ️  테스트 유저 이미 존재: ${email}`);
    } else {
      throw error;
    }
  }
}
