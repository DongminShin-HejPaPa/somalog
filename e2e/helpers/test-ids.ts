/**
 * E2E 테스트에서 사용하는 data-testid 상수 모음.
 * 컴포넌트에 data-testid를 추가할 때 이 파일의 값과 일치시킬 것.
 */
export const TEST_IDS = {
  // ── Auth: Login ──────────────────────────────────────
  LOGIN_EMAIL: "login-email",
  LOGIN_PASSWORD: "login-password",
  LOGIN_SUBMIT: "login-submit",
  LOGIN_ERROR: "login-error",

  // ── Auth: Register ───────────────────────────────────
  REGISTER_NAME: "register-name",
  REGISTER_EMAIL: "register-email",
  REGISTER_PASSWORD: "register-password",
  REGISTER_PASSWORD_CONFIRM: "register-password-confirm",
  REGISTER_SUBMIT: "register-submit",
  REGISTER_ERROR: "register-error",

  // ── Onboarding ───────────────────────────────────────
  ONBOARDING_PROGRESS: "onboarding-progress",
  ONBOARDING_STEP_INDICATOR: "onboarding-step-indicator",
  ONBOARDING_COACH_NAME: "onboarding-coach-name",
  ONBOARDING_NEXT: "onboarding-next",
  ONBOARDING_COMPLETE: "onboarding-complete",

  // ── Navigation (BottomNav) ────────────────────────────
  NAV_HOME: "nav-home",
  NAV_INPUT: "nav-input",
  NAV_LOG: "nav-log",
  NAV_GRAPH: "nav-graph",
  NAV_SETTINGS: "nav-settings",

  // ── Input Page: DateHeader ────────────────────────────
  DATE_PREV: "date-prev",
  DATE_NEXT: "date-next",
  DATE_DISPLAY: "date-display",

  // ── Input Page: Chips ─────────────────────────────────
  CHIP_WEIGHT: "chip-weight",
  CHIP_WATER: "chip-water",
  CHIP_EXERCISE: "chip-exercise",
  CHIP_BREAKFAST: "chip-breakfast",
  CHIP_LUNCH: "chip-lunch",
  CHIP_DINNER: "chip-dinner",
  CHIP_LATE_SNACK: "chip-lateSnack",
  CHIP_ENERGY: "chip-energy",
  PROGRESS_BAR: "progress-bar",

  // ── Input Page: Buttons ───────────────────────────────
  CLOSE_BUTTON: "close-button",
  FREE_TEXT_INPUT: "free-text-input",
  FREE_TEXT_SUBMIT: "free-text-submit",

  // ── Input Modal ───────────────────────────────────────
  MODAL_CLOSE: "modal-close",
  MODAL_WEIGHT_INPUT: "modal-weight-input",
  MODAL_WATER_PRESET: (v: number) => `modal-water-${v}`,
  MODAL_SAVE: "modal-save",
  MODAL_EXERCISE_Y: "modal-exercise-y",
  MODAL_EXERCISE_N: "modal-exercise-n",
  MODAL_MEAL_INPUT: "modal-meal-input",
  MODAL_LATE_SNACK_Y: "modal-late-snack-y",
  MODAL_LATE_SNACK_N: "modal-late-snack-n",
  MODAL_ENERGY: (e: string) => `modal-energy-${e}`,

  // ── Home Page ─────────────────────────────────────────
  HOME_COACH_ONELINER: "home-coach-oneliner",
  HOME_WEIGHT_DISPLAY: "home-weight-display",
  HOME_PROGRESS_BANNER: "home-progress-banner",

  // ── Log Page ──────────────────────────────────────────
  LOG_LIST: "log-list",
  LOG_ITEM: (date: string) => `log-item-${date}`,

  // ── Graph Page ────────────────────────────────────────
  GRAPH_WEIGHT_CHART: "graph-weight-chart",

  // ── Settings Page ─────────────────────────────────────
  SETTINGS_COACH_NAME: "settings-coach-name",
  SETTINGS_SAVE: "settings-save",
  SETTINGS_RESET: "settings-reset",
  SETTINGS_DEMO: "settings-demo",
  SETTINGS_LOGOUT: "settings-logout",
} as const;
