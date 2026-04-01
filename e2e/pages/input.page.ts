import { type Page, type Locator } from "@playwright/test";
import { TEST_IDS } from "../helpers/test-ids";

export class InputPage {
  readonly page: Page;
  readonly datePrev: Locator;
  readonly dateNext: Locator;
  readonly dateDisplay: Locator;
  readonly closeButton: Locator;
  readonly freeTextInput: Locator;
  readonly freeTextSubmit: Locator;
  readonly progressBar: Locator;

  // 모달 관련
  readonly modalClose: Locator;
  readonly modalWeightInput: Locator;
  readonly modalSave: Locator;
  readonly modalMealInput: Locator;

  constructor(page: Page) {
    this.page = page;
    this.datePrev = page.getByTestId(TEST_IDS.DATE_PREV);
    this.dateNext = page.getByTestId(TEST_IDS.DATE_NEXT);
    this.dateDisplay = page.getByTestId(TEST_IDS.DATE_DISPLAY);
    this.closeButton = page.getByTestId(TEST_IDS.CLOSE_BUTTON);
    this.freeTextInput = page.getByTestId(TEST_IDS.FREE_TEXT_INPUT);
    this.freeTextSubmit = page.getByTestId(TEST_IDS.FREE_TEXT_SUBMIT);
    this.progressBar = page.getByTestId(TEST_IDS.PROGRESS_BAR);
    this.modalClose = page.getByTestId(TEST_IDS.MODAL_CLOSE);
    this.modalWeightInput = page.getByTestId(TEST_IDS.MODAL_WEIGHT_INPUT);
    this.modalSave = page.getByTestId(TEST_IDS.MODAL_SAVE);
    this.modalMealInput = page.getByTestId(TEST_IDS.MODAL_MEAL_INPUT);
  }

  async goto() {
    await this.page.goto("/input");
  }

  chip(key: "weight" | "water" | "exercise" | "breakfast" | "lunch" | "dinner" | "lateSnack" | "energy") {
    const idMap = {
      weight: TEST_IDS.CHIP_WEIGHT,
      water: TEST_IDS.CHIP_WATER,
      exercise: TEST_IDS.CHIP_EXERCISE,
      breakfast: TEST_IDS.CHIP_BREAKFAST,
      lunch: TEST_IDS.CHIP_LUNCH,
      dinner: TEST_IDS.CHIP_DINNER,
      lateSnack: TEST_IDS.CHIP_LATE_SNACK,
      energy: TEST_IDS.CHIP_ENERGY,
    };
    return this.page.getByTestId(idMap[key]);
  }

  modalWaterPreset(value: number) {
    return this.page.getByTestId(TEST_IDS.MODAL_WATER_PRESET(value));
  }

  modalEnergyButton(value: "여유" | "보통" | "피곤") {
    return this.page.getByTestId(TEST_IDS.MODAL_ENERGY(value));
  }
}
