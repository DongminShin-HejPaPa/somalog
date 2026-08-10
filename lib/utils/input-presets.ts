import type { InputPresets, PresetField } from "@/lib/types";

/**
 * 자주 쓰는 메뉴 프리셋 유틸.
 *
 * 식단·운동 입력값은 "닭가슴살, 고구마" 처럼 쉼표로 구분된 자유 텍스트다.
 * 프리셋 칩은 이 텍스트의 '항목' 단위로 추가/제거된다.
 * 프리셋 목록은 항목(아침/점심/저녁/야식/운동)별로 따로 관리한다.
 */

/** 항목당 등록 가능한 프리셋 최대 개수 */
export const MAX_PRESETS_PER_FIELD = 5;

/** 프리셋 1개의 최대 글자 수 */
export const MAX_PRESET_LENGTH = 60;

/** 프리셋을 쓸 수 있는 입력 항목 */
export const PRESET_FIELDS: PresetField[] = [
  "exercise",
  "breakfast",
  "lunch",
  "dinner",
  "lateSnack",
];

export const PRESET_FIELD_LABELS: Record<PresetField, string> = {
  exercise: "운동",
  breakfast: "아침",
  lunch: "점심",
  dinner: "저녁",
  lateSnack: "야식",
};

const SEPARATOR = ", ";

export function emptyInputPresets(): InputPresets {
  return { exercise: [], breakfast: [], lunch: [], dinner: [], lateSnack: [] };
}

export function isPresetField(field: string): field is PresetField {
  return (PRESET_FIELDS as string[]).includes(field);
}

/** 입력 텍스트를 쉼표 기준 항목 배열로 분해 (빈 항목 제거) */
export function parseItems(text: string): string[] {
  return text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** 해당 프리셋이 현재 텍스트에 항목으로 들어가 있는지 */
export function isPresetInText(text: string, preset: string): boolean {
  const target = preset.trim();
  if (!target) return false;
  return parseItems(text).includes(target);
}

/** 프리셋 토글 — 없으면 뒤에 추가, 있으면 제거 */
export function togglePresetInText(text: string, preset: string): string {
  const target = preset.trim();
  if (!target) return text;

  const items = parseItems(text);
  const next = items.includes(target)
    ? items.filter((item) => item !== target)
    : [...items, target];

  return next.join(SEPARATOR);
}

/** 프리셋 1개 목록 정규화 — 공백/중복/길이/개수 제한 적용 */
export function normalizePresetList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const value = item.trim().slice(0, MAX_PRESET_LENGTH);
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
    if (result.length >= MAX_PRESETS_PER_FIELD) break;
  }
  return result;
}

/** 알 수 없는 값(DB jsonb 등)을 항목별 프리셋 맵으로 정규화 */
export function normalizeInputPresets(raw: unknown): InputPresets {
  const base = emptyInputPresets();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return base;
  const source = raw as Record<string, unknown>;
  for (const field of PRESET_FIELDS) {
    base[field] = normalizePresetList(source[field]);
  }
  return base;
}

/**
 * 프리셋 추가 — 공백/중복/최대개수를 검사한다.
 * 추가할 수 없으면 원본 배열을 그대로 반환한다(참조 비교로 실패 판단 가능).
 */
export function addPreset(presets: string[], value: string): string[] {
  const trimmed = value.trim().slice(0, MAX_PRESET_LENGTH);
  if (!trimmed) return presets;
  if (presets.includes(trimmed)) return presets;
  if (presets.length >= MAX_PRESETS_PER_FIELD) return presets;
  return [...presets, trimmed];
}

/** 프리셋 삭제 */
export function removePreset(presets: string[], value: string): string[] {
  return presets.filter((p) => p !== value);
}

/** 현재 입력 텍스트를 프리셋으로 등록할 수 있는지 */
export function canRegisterPreset(presets: string[], value: string): boolean {
  const trimmed = value.trim().slice(0, MAX_PRESET_LENGTH);
  return (
    trimmed.length > 0 &&
    !presets.includes(trimmed) &&
    presets.length < MAX_PRESETS_PER_FIELD
  );
}
