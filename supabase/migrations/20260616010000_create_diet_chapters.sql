-- =====================
-- diet_chapters 테이블 — 종료된 다이어트 챕터(캠페인) 아카이브
-- 새 목표 설정 / 새출발 시 직전 챕터를 1행으로 보존한다.
-- 현재 진행 중인 챕터는 settings(diet_start_date/start_weight/target_weight)가 보유.
-- 기록(daily_logs)은 실제 날짜 기준이라 챕터와 무관하게 보존된다.
-- =====================
CREATE TABLE IF NOT EXISTS diet_chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,                 -- 챕터 시작일
  start_weight NUMERIC NOT NULL,            -- 챕터 시작 체중
  target_weight NUMERIC NOT NULL,           -- 챕터 목표 체중
  end_date DATE NOT NULL,                   -- 챕터 종료일(아카이브된 날)
  end_weight NUMERIC,                       -- 종료 시점 체중(미기록 시 null)
  achieved BOOLEAN NOT NULL DEFAULT FALSE,  -- 목표 달성으로 종료됐는지
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE diet_chapters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "diet_chapters: 본인만 조회" ON diet_chapters
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "diet_chapters: 본인만 삽입" ON diet_chapters
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "diet_chapters: 본인만 수정" ON diet_chapters
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "diet_chapters: 본인만 삭제" ON diet_chapters
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS diet_chapters_user_idx ON diet_chapters (user_id, end_date DESC);
