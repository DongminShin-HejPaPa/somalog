-- 그날 적용된 수분 목표를 일별 로그에 스냅샷으로 보관.
-- (이전: 리포트가 현재 settings.water_goal를 과거 전체에 소급 적용 → 목표 변경 시 과거 달성 여부가 흔들림)
ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS water_goal NUMERIC;

-- 과거 백필: 수분이 입력된 날은 모두 해당 유저의 현재 설정 목표값으로 채운다.
UPDATE daily_logs d
SET water_goal = s.water_goal
FROM settings s
WHERE d.user_id = s.user_id
  AND d.water IS NOT NULL
  AND d.water_goal IS NULL;
