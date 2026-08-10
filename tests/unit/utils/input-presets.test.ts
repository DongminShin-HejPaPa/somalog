import { describe, it, expect } from "vitest";
import {
  MAX_PRESETS_PER_FIELD,
  MAX_PRESET_LENGTH,
  addPreset,
  canRegisterPreset,
  emptyInputPresets,
  isPresetField,
  isPresetInText,
  normalizeInputPresets,
  normalizePresetList,
  parseItems,
  removePreset,
  togglePresetInText,
} from "@/lib/utils/input-presets";

describe("parseItems", () => {
  it("쉼표로 분리하고 공백을 제거한다", () => {
    expect(parseItems("닭가슴살,  고구마 ")).toEqual(["닭가슴살", "고구마"]);
  });

  it("빈 항목은 버린다", () => {
    expect(parseItems(" , 샐러드, ,")).toEqual(["샐러드"]);
  });

  it("빈 문자열은 빈 배열", () => {
    expect(parseItems("")).toEqual([]);
  });
});

describe("isPresetInText", () => {
  it("항목으로 정확히 존재하면 true", () => {
    expect(isPresetInText("닭가슴살, 고구마", "고구마")).toBe(true);
  });

  it("부분 문자열만 겹치면 false", () => {
    expect(isPresetInText("고구마맛탕", "고구마")).toBe(false);
  });

  it("빈 프리셋은 false", () => {
    expect(isPresetInText("고구마", "  ")).toBe(false);
  });
});

describe("togglePresetInText", () => {
  it("없으면 뒤에 추가한다", () => {
    expect(togglePresetInText("닭가슴살", "고구마")).toBe("닭가슴살, 고구마");
  });

  it("빈 입력에 추가하면 프리셋만 남는다", () => {
    expect(togglePresetInText("", "고구마")).toBe("고구마");
  });

  it("이미 있으면 제거한다", () => {
    expect(togglePresetInText("닭가슴살, 고구마", "닭가슴살")).toBe("고구마");
  });

  it("마지막 항목을 제거하면 빈 문자열", () => {
    expect(togglePresetInText("고구마", "고구마")).toBe("");
  });

  it("구분자 공백을 정규화한다", () => {
    expect(togglePresetInText("닭가슴살,고구마", "샐러드")).toBe(
      "닭가슴살, 고구마, 샐러드"
    );
  });
});

describe("addPreset", () => {
  it("트림해서 추가한다", () => {
    expect(addPreset([], "  고구마 ")).toEqual(["고구마"]);
  });

  it("공백만 있으면 원본을 그대로 반환한다", () => {
    const presets = ["고구마"];
    expect(addPreset(presets, "   ")).toBe(presets);
  });

  it("중복이면 원본을 그대로 반환한다", () => {
    const presets = ["고구마"];
    expect(addPreset(presets, "고구마")).toBe(presets);
  });

  it(`${MAX_PRESETS_PER_FIELD}개가 차면 더 추가하지 않는다`, () => {
    const presets = ["1", "2", "3", "4", "5"];
    expect(presets.length).toBe(MAX_PRESETS_PER_FIELD);
    expect(addPreset(presets, "6")).toBe(presets);
  });

  it("최대 길이로 자른다", () => {
    const long = "가".repeat(MAX_PRESET_LENGTH + 10);
    expect(addPreset([], long)[0]).toHaveLength(MAX_PRESET_LENGTH);
  });
});

describe("removePreset", () => {
  it("해당 값만 제거한다", () => {
    expect(removePreset(["고구마", "샐러드"], "고구마")).toEqual(["샐러드"]);
  });

  it("없는 값이면 그대로", () => {
    expect(removePreset(["고구마"], "치킨")).toEqual(["고구마"]);
  });
});

describe("canRegisterPreset", () => {
  it("새로운 값이면 true", () => {
    expect(canRegisterPreset(["고구마"], "샐러드")).toBe(true);
  });

  it("공백이면 false", () => {
    expect(canRegisterPreset([], "  ")).toBe(false);
  });

  it("이미 등록된 값이면 false", () => {
    expect(canRegisterPreset(["고구마"], " 고구마 ")).toBe(false);
  });

  it("가득 찼으면 false", () => {
    expect(canRegisterPreset(["1", "2", "3", "4", "5"], "6")).toBe(false);
  });
});

describe("normalizePresetList", () => {
  it("배열이 아니면 빈 배열", () => {
    expect(normalizePresetList(null)).toEqual([]);
    expect(normalizePresetList("고구마")).toEqual([]);
  });

  it("문자열이 아닌 항목·공백·중복을 걸러낸다", () => {
    expect(normalizePresetList(["고구마", 3, " 고구마 ", "", "샐러드"])).toEqual([
      "고구마",
      "샐러드",
    ]);
  });

  it(`${MAX_PRESETS_PER_FIELD}개까지만 남긴다`, () => {
    expect(normalizePresetList(["1", "2", "3", "4", "5", "6", "7"])).toHaveLength(
      MAX_PRESETS_PER_FIELD
    );
  });
});

describe("normalizeInputPresets", () => {
  it("null/배열이면 빈 프리셋 맵", () => {
    expect(normalizeInputPresets(null)).toEqual(emptyInputPresets());
    expect(normalizeInputPresets(["고구마"])).toEqual(emptyInputPresets());
  });

  it("알려진 항목만 남긴다", () => {
    const result = normalizeInputPresets({
      breakfast: ["그릭요거트"],
      weight: ["70"],
    });
    expect(result.breakfast).toEqual(["그릭요거트"]);
    expect(result.lunch).toEqual([]);
    expect("weight" in result).toBe(false);
  });

  it("항목별로 독립적으로 관리된다", () => {
    const result = normalizeInputPresets({
      exercise: ["헬스 1시간"],
      lateSnack: ["방울토마토"],
    });
    expect(result.exercise).toEqual(["헬스 1시간"]);
    expect(result.lateSnack).toEqual(["방울토마토"]);
    expect(result.dinner).toEqual([]);
  });
});

describe("isPresetField", () => {
  it("프리셋 지원 항목은 true", () => {
    expect(isPresetField("breakfast")).toBe(true);
    expect(isPresetField("exercise")).toBe(true);
  });

  it("체중·수분·맞춤입력은 false", () => {
    expect(isPresetField("weight")).toBe(false);
    expect(isPresetField("water")).toBe(false);
    expect(isPresetField("customFieldValue")).toBe(false);
  });
});
