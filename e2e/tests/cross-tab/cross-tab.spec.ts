import { test, expect } from "../../fixtures";
import { InputPage } from "../../pages/input.page";
import { HomePage } from "../../pages/home.page";
import { SettingsPage } from "../../pages/settings.page";

test.use({ storageState: "e2e/.auth/user.json" });

test.describe("Cross-tab 일관성 (J10)", () => {
  // J10-01: 입력 탭 체중 입력 → 홈/기록/그래프 탭 반영
  test("체중 입력 → 홈·기록·그래프 탭 모두 반영", async ({ page, withSeededData }) => {
    void withSeededData;
    const inputPage = new InputPage(page);
    const home = new HomePage(page);

    // 입력 탭: 체중 91.3 입력 (소수점 있는 값으로 trailing zero 미관련 값 사용)
    await inputPage.goto();
    await inputPage.chip("weight").click();
    await inputPage.modalWeightInput.fill("91.3");
    // 모달 저장 버튼 클릭 (Playwright 공식 방식)
    await inputPage.modalSave.click();
    await expect(inputPage.chip("weight")).toContainText("91.3", { timeout: 10_000 });

    // 홈 탭: 체중 91.3 반영 확인
    await home.goto();
    await expect(home.weightDisplay).toContainText("91.3");

    // 기록 탭: 오늘 날짜 항목 표시 확인
    await page.goto("/log");
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
    await expect(page.getByTestId(`log-item-${today}`)).toBeVisible();

    // 그래프 탭: 차트 표시 확인
    await page.goto("/graph");
    await expect(page.getByTestId("graph-weight-chart")).toBeVisible({ timeout: 10_000 });
  });

  // J10-02: 마감 후 홈 탭 코치 한마디 갱신 (AI 총평)
  test("마감 후 홈 탭에 코치 한마디 표시됨", async ({ page, withSeededData }) => {
    void withSeededData;
    const inputPage = new InputPage(page);
    const home = new HomePage(page);

    await inputPage.goto();

    // 체중 입력 후 마감
    await inputPage.chip("weight").click();
    await inputPage.modalWeightInput.fill("90.5");
    await inputPage.modalSave.click();
    await expect(inputPage.chip("weight")).toContainText("90.5", { timeout: 10_000 });

    await inputPage.closeButton.click();
    await expect(inputPage.closeButton).toContainText("마감 완료", { timeout: 15_000 });

    // 홈 탭으로 이동 → 코치 한마디 표시 확인 (AI 생성 대기)
    await home.goto();
    await expect(home.coachOneLiner).toBeVisible({ timeout: 30_000 });
  });

  // J10-03: 페이지 이동 후에도 오늘 데이터 유지 (세션 유지 확인)
  // NOTE: 로그아웃 테스트는 settings.spec.ts에서 별도 수행 (세션 invalidation 방지)
  test("여러 탭 이동 후에도 오늘 입력 데이터 유지됨", async ({ page, withSeededData }) => {
    void withSeededData;
    const inputPage = new InputPage(page);
    await inputPage.goto();

    // 오늘 체중 입력
    await inputPage.chip("weight").click();
    await inputPage.modalWeightInput.fill("89.5");
    await inputPage.modalSave.click();
    await expect(inputPage.chip("weight")).toContainText("89.5", { timeout: 10_000 });

    // 다른 탭을 거쳐도 오늘 데이터 유지
    await page.goto("/home");
    await page.goto("/log");
    await page.goto("/graph");
    await inputPage.goto();
    await expect(inputPage.chip("weight")).toContainText("89.5");
  });

  // J10-03: 설정값 유지 확인 (재방문 후)
  test("설정 탭 방문 후 다시 돌아와도 설정 유지됨", async ({ page, withSeededData }) => {
    void withSeededData;
    const settings = new SettingsPage(page);

    await settings.goto();
    await expect(page.getByTestId("settings-coach-name")).toHaveValue("TestCoach", { timeout: 10_000 });

    // 다른 탭 방문 후 복귀
    await page.goto("/input");
    await page.goto("/home");
    await settings.goto();

    // 설정값 유지 확인
    await expect(page.getByTestId("settings-coach-name")).toHaveValue("TestCoach", { timeout: 10_000 });
  });
});
