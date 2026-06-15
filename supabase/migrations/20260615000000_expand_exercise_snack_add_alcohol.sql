-- exercise / late_snack CHECK 제약 해제 (텍스트 자유 입력 허용)
ALTER TABLE daily_logs DROP CONSTRAINT IF EXISTS daily_logs_exercise_check;
ALTER TABLE daily_logs DROP CONSTRAINT IF EXISTS daily_logs_late_snack_check;

-- 술 여부 컬럼 추가 (저녁 / 야식 각각)
ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS dinner_alcohol BOOLEAN;
ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS late_snack_alcohol BOOLEAN;
