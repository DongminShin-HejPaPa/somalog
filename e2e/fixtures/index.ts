/**
 * 모든 fixture를 합쳐서 re-export.
 * 테스트 파일에서는 이 파일만 import하면 됨.
 *
 * import { test, expect } from "../../fixtures";
 */
import { mergeTests, mergeExpects } from "@playwright/test";
import { test as authTest, expect as authExpect } from "./auth.fixture";
import { test as seededTest, expect as seededExpect } from "./seeded.fixture";

export const test = mergeTests(authTest, seededTest);
export const expect = mergeExpects(authExpect, seededExpect);
