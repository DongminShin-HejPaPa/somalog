-- =====================
-- 1. user_profiles 테이블
-- =====================
CREATE TABLE public.user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user', 'premium')),
  display_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  memo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- update_updated_at() 함수는 20260331000000 마이그레이션에 이미 정의되어 있음
CREATE TRIGGER user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_profiles: 본인 조회" ON public.user_profiles
  FOR SELECT USING (auth.uid() = user_id);

-- =====================
-- 2. ai_usage_logs 테이블
-- =====================
CREATE TABLE public.ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  call_type TEXT NOT NULL CHECK (call_type IN ('feedback', 'daily_summary', 'one_liner', 'parse', 'notice_rewrite')),
  model TEXT NOT NULL,
  input_tokens INTEGER,
  output_tokens INTEGER,
  cost_usd NUMERIC(10, 6),
  latency_ms INTEGER,
  success BOOLEAN NOT NULL DEFAULT TRUE,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_usage_logs: 본인 조회" ON public.ai_usage_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE INDEX ai_usage_logs_user_created_idx ON public.ai_usage_logs (user_id, created_at DESC);
CREATE INDEX ai_usage_logs_created_idx ON public.ai_usage_logs (created_at DESC);

-- =====================
-- 3. 회원가입 시 자동 트리거
-- =====================
CREATE OR REPLACE FUNCTION public.create_user_profile_on_signup()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, role, display_name)
  VALUES (
    NEW.id,
    'user',
    NEW.raw_user_meta_data->>'full_name'
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_user_profile_on_signup();

-- =====================
-- 4. 기존 회원 데이터 백필(Backfill)
-- =====================
INSERT INTO public.user_profiles (user_id, role, display_name)
SELECT id, 'user', raw_user_meta_data->>'full_name' FROM auth.users
ON CONFLICT (user_id) DO NOTHING;
