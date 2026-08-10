-- 자주 쓰는 메뉴 프리셋 — 운동/아침/점심/저녁/야식 입력 모달에서 칩으로 노출된다.
-- 항목별 문자열 배열을 담는 JSONB (항목당 최대 5개, 앱 레이어에서 검증).
-- 예: {"exercise": ["헬스 1시간"], "breakfast": ["그릭요거트"], ...}
ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS input_presets JSONB NOT NULL DEFAULT '{}'::jsonb;
