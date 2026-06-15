-- =====================
-- achievements 테이블 — 목표 달성/마일스톤 기록
-- =====================
CREATE TABLE IF NOT EXISTS achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,                       -- 'goal_reached' | 'milestone_-5kg' | 'streak_30' ...
  achieved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload JSONB,                            -- 달성 당시 스냅샷(시작/목표/최종 체중, D+N, 기록일수 등)
  seen_at TIMESTAMPTZ,                      -- 세리머니를 본 시각(중복 노출 방지)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, type)
);

ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "achievements: 본인만 조회" ON achievements
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "achievements: 본인만 삽입" ON achievements
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "achievements: 본인만 수정" ON achievements
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "achievements: 본인만 삭제" ON achievements
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS achievements_user_idx ON achievements (user_id, achieved_at DESC);

-- =====================
-- settings.mode — 감량 모드 / 유지 모드
-- =====================
ALTER TABLE settings ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'losing'
  CHECK (mode IN ('losing', 'maintaining'));
