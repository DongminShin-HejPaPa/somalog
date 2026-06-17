import { test, expect } from "@playwright/test";
import { InputPage } from "../../pages/input.page";
import { TEST_IDS } from "../../helpers/test-ids";
import {
  getUserIdByEmail,
  clearUserData,
  seedSettings,
  seedDailyLogs,
} from "../../helpers/supabase-admin";

test.use({ storageState: "e2e/.auth/user.json" });

/** 앱과 동일한 KST 기준 오늘 날짜 (YYYY-MM-DD) */
function todayKST(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
}

/** 7개 항목을 모두 채운 오늘 로그 — 미완성 마감 확인 다이얼로그 없이 바로 마감되게 */
function completeTodayLog(weight: number) {
  return {
    date: todayKST(),
    weight,
    water: 2.5,
    exercise: "Y",
    breakfast: "오트밀",
    lunch: "샐러드",
    dinner: "닭가슴살",
    late_snack: "N",
    closed: false,
  };
}

test.describe("목표 달성 세레머니", () => {
  let userId: string;

  test.beforeEach(async () => {
    userId = await getUserIdByEmail(process.env.TEST_USER_EMAIL!);
    await clearUserData(userId); // achievements/diet_chapters 포함 정리 → 매번 '최초 달성' 상태
    await seedSettings(userId, {
      start_weight: 80,
      target_weight: 79,
      diet_start_date: "2024-06-01",
      // 공지 팝업이 입력 화면을 가리지 않도록 모든 기존 공지를 '읽음' 처리
      last_notice_seen_at: new Date().toISOString(),
    });
  });

  test("목표 체중 이하로 마감 → 풀 세레머니 노출", async ({ page }) => {
    await seedDailyLogs(userId, [completeTodayLog(79)]);

    const inputPage = new InputPage(page);
    await inputPage.goto();
    await expect(inputPage.closeButton).toBeVisible({ timeout: 15_000 });
    await inputPage.closeButton.click();

    await expect(page.getByTestId(TEST_IDS.GOAL_CEREMONY)).toBeVisible({
      timeout: 15_000,
    });
  });

  test("목표 위 체중으로 마감 → 세레머니 미노출", async ({ page }) => {
    await seedDailyLogs(userId, [completeTodayLog(85)]);

    const inputPage = new InputPage(page);
    await inputPage.goto();
    await expect(inputPage.closeButton).toBeVisible({ timeout: 15_000 });
    await inputPage.closeButton.click();

    // 목표 미달 — 마감 응답(goalEvent)이 처리될 시간을 준 뒤 세레머니가 없음을 확인
    await page.waitForTimeout(3500);
    await expect(page.getByTestId(TEST_IDS.GOAL_CEREMONY)).toHaveCount(0);
  });
});
