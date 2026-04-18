-- user_profiles 에 앱 방문 시각 컬럼 추가
-- (last_sign_in_at 는 세션 유지 시 갱신 안 됨 → 별도 last_seen_at 트래킹)
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
