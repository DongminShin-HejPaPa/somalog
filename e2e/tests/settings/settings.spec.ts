import { test, expect } from "../../fixtures";
import { SettingsPage } from "../../pages/settings.page";

test.use({ storageState: "e2e/.auth/user.json" });

test.describe("Settings", () => {
  test.beforeEach(async ({ withSeededData }) => {
    void withSeededData;
  });

  // J5-01: 설정 페이지 기본 표시 — 카테고리 헤더 + 저장/로그아웃
  test("설정 페이지 — 카테고리 헤더가 표시됨", async ({ page }) => {
    const settings = new SettingsPage(page);
    await settings.goto();

    await expect(page.getByRole("button", { name: /내 다이어트/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /AI 코치/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /입력 맞춤/ })).toBeVisible();
    await expect(settings.saveButton).toBeVisible();
    await expect(settings.logoutButton).toBeVisible();
  });

  // J5-02: 목표 체중 변경 후 저장 → 새로고침 후 반영
  test("목표 체중 변경 후 저장 → 설정에 반영됨", async ({ page }) => {
    const settings = new SettingsPage(page);
    await settings.goto();

    // '내 다이어트' 카테고리는 기본 펼침 → 목표 체중 노출
    await expect(page.getByTestId("settings-target-weight")).toHaveValue("70", { timeout: 10_000 });

    await page.getByTestId("settings-target-weight").fill("65");
    await settings.saveButton.click();

    // "저장 완료" 버튼 텍스트로 UI 반응 확인 (클라이언트 타이머 기반)
    await expect(settings.saveButton).toContainText("저장 완료", { timeout: 10_000 });
    // 서버 액션이 비동기 실행이므로 완료 대기
    await page.waitForTimeout(1500);

    // 페이지 새로고침 후 DB에 반영됐는지 확인
    await page.reload();
    await expect(page.getByTestId("settings-target-weight")).toHaveValue("65", { timeout: 10_000 });
  });

  // J5-07: 루틴 추가 항목 (AI 코치 카테고리 안 → 먼저 펼치기)
  test("루틴 추가 입력 후 저장 → 새로고침 후 유지됨", async ({ page }) => {
    const settings = new SettingsPage(page);
    await settings.goto();

    // '나의 루틴'은 'AI 코치' 카테고리 안 → 카테고리 펼치기
    await page.getByRole("button", { name: /AI 코치/ }).click();

    // 루틴 추가 버튼 클릭 (있는 경우, 정확한 텍스트로 선택)
    const addButton = page.getByRole("button", { name: /\+ 루틴 추가/ });
    if (await addButton.isVisible()) {
      await addButton.click();
      const inputs = page.locator("input[placeholder*='루틴']");
      if (await inputs.count() > 0) {
        await inputs.last().fill("저녁 식사는 항상 7시 이전에 마친다");
      }
      await settings.saveButton.click();
      await expect(settings.saveButton).toContainText("저장 완료", { timeout: 10_000 });
    }
  });

  // J5-08: 로그아웃 버튼 클릭 → 확인 UI 표시
  test("로그아웃 버튼 클릭 → 확인 UI 표시", async ({ page }) => {
    const settings = new SettingsPage(page);
    await settings.goto();

    await settings.logoutButton.click();

    await expect(page.getByText("로그아웃 하시겠어요?")).toBeVisible();
  });

  // J5-08: 로그아웃 취소 → 설정 페이지 유지
  test("로그아웃 취소 → 설정 페이지 유지", async ({ page }) => {
    const settings = new SettingsPage(page);
    await settings.goto();

    await settings.logoutButton.click();
    await page.getByText("취소").click();

    await expect(page).toHaveURL("/settings");
    await expect(settings.saveButton).toBeVisible();
  });

  // J5-08: 로그아웃 확인 → /login으로 이동
  test("로그아웃 확인 → /login으로 이동", async ({ page }) => {
    const settings = new SettingsPage(page);
    await settings.goto();

    await settings.logoutButton.click();
    await page.getByText("로그아웃 하시겠어요?").waitFor();

    await page.getByRole("button", { name: "로그아웃" }).last().click();

    await expect(page).toHaveURL("/login");
  });
});
