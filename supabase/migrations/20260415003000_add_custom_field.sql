-- settings 테이블: 맞춤 입력 필드 정의 추가
ALTER TABLE settings ADD COLUMN IF NOT EXISTS custom_field JSONB DEFAULT NULL;

-- daily_logs 테이블: 맞춤 입력 값 추가
ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS custom_field_value TEXT DEFAULT NULL;
