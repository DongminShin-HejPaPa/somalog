-- 코치 이름(coach_name) 설정 기능 제거.
-- 코치 이름은 항상 'Soma' 고정으로 변경됨 — 사용자 설정/컬럼 불필요.
ALTER TABLE settings DROP COLUMN IF EXISTS coach_name;
