import { test, expect } from "../../fixtures";
import { SettingsPage } from "../../pages/settings.page";

test.use({ storageState: "e2e/.auth/user.json" });

test.describe("Settings", () => {
  test.beforeEach(async ({ withSeededData }) => {
    void withSeededData;
  });

  test("설정 저장 → 저장 성공", async ({ page }) => {
    const settings = new SettingsPage(page);
    await settings.goto();

    // 코치 이름 변경
    await page.getByTestId("settings-coach-name").fill("뉴코치");
    await settings.saveButton.click();

    // 저장 후 페이지 유지 (오류 없음)
    await expect(page).toHaveURL("/settings");
  });

  test("코치 이름 변경 후 저장 → 설정에 반영됨", async ({ page }) => {
    const settings = new SettingsPage(page);
    await settings.goto();

    // 설정이 DB에서 로드될 때까지 대기 (DEFAULT "Soma" → 씨드 "TestCoach")
    await expect(page.getByTestId("settings-coach-name")).toHaveValue("TestCoach", { timeout: 10_000 });

    await page.getByTestId("settings-coach-name").fill("변경된코치");
    await settings.saveButton.click();

    // "저장 완료" 버튼 텍스트로 Server Action 호출 확인
    await expect(settings.saveButton).toContainText("저장 완료", { timeout: 10_000 });
    // 2초 후 "저장"으로 복귀할 때까지 대기 → 비동기 쓰기 완료 보장
    await expect(settings.saveButton).not.toContainText("완료", { timeout: 5_000 });

    // 페이지 새로고침 후 DB에 반영됐는지 확인
    await page.reload();
    await expect(page.getByTestId("settings-coach-name")).toHaveValue("변경된코치", { timeout: 10_000 });
  });

  test("로그아웃 버튼 클릭 → 확인 UI 표시", async ({ page }) => {
    const settings = new SettingsPage(page);
    await settings.goto();

    await settings.logoutButton.click();

    // 확인 메시지 표시
    await expect(page.getByText("로그아웃 하시겠어요?")).toBeVisible();
  });

  test("로그아웃 취소 → 설정 페이지 유지", async ({ page }) => {
    const settings = new SettingsPage(page);
    await settings.goto();

    await settings.logoutButton.click();
    await page.getByText("취소").click();

    // 설정 페이지 유지
    await expect(page).toHaveURL("/settings");
    await expect(settings.saveButton).toBeVisible();
  });

  test("로그아웃 확인 → /login으로 이동", async ({ page }) => {
    const settings = new SettingsPage(page);
    await settings.goto();

    await settings.logoutButton.click();
    await page.getByText("로그아웃 하시겠어요?").waitFor();

    // 로그아웃 확인 버튼 클릭
    await page.getByRole("button", { name: "로그아웃" }).last().click();

    // /login으로 이동
    await expect(page).toHaveURL("/login");
  });
});
