-- =====================
-- daily_logs 식단 검색용 트라이그램(GIN) 인덱스
-- =====================
-- 로그 탭 검색은 breakfast/lunch/dinner 에 ilike(%term%) 를 건다. 유저당 행이
-- 수천 단위면 seq scan 도 빠르지만, 수년·다유저 누적과 부분일치 검색을 대비해
-- pg_trgm GIN 인덱스로 ilike 를 인덱스 스캔으로 전환한다.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS daily_logs_breakfast_trgm_idx
  ON public.daily_logs USING gin (breakfast gin_trgm_ops);
CREATE INDEX IF NOT EXISTS daily_logs_lunch_trgm_idx
  ON public.daily_logs USING gin (lunch gin_trgm_ops);
CREATE INDEX IF NOT EXISTS daily_logs_dinner_trgm_idx
  ON public.daily_logs USING gin (dinner gin_trgm_ops);
