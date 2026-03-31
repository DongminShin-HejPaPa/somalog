-- =====================
-- 1. settings 테이블
-- =====================
CREATE TABLE settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  coach_name TEXT NOT NULL DEFAULT 'Soma',
  height NUMERIC(5,1) NOT NULL DEFAULT 0,
  current_weight NUMERIC(5,1) NOT NULL DEFAULT 0,
  gender TEXT NOT NULL DEFAULT '남성' CHECK (gender IN ('남성', '여성')),
  diet_start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  start_weight NUMERIC(5,1) NOT NULL DEFAULT 0,
  target_weight NUMERIC(5,1) NOT NULL DEFAULT 0,
  diet_preset TEXT NOT NULL DEFAULT 'sustainable' CHECK (diet_preset IN ('sustainable', 'medium', 'intensive', 'custom')),
  target_months INTEGER NOT NULL DEFAULT 12,
  water_goal NUMERIC(3,1) NOT NULL DEFAULT 2.8,
  routine_weight_time TEXT NOT NULL DEFAULT '아침 기상 직후',
  routine_energy_time TEXT NOT NULL DEFAULT '21:00',
  routine_extra TEXT[] NOT NULL DEFAULT '{}',
  intensive_day_on BOOLEAN NOT NULL DEFAULT TRUE,
  intensive_day_criteria TEXT NOT NULL DEFAULT '역대최저' CHECK (intensive_day_criteria IN ('역대최저', '0.5kg', '1.0kg', '직접입력')),
  coach_style_preset TEXT NOT NULL DEFAULT 'strong' CHECK (coach_style_preset IN ('strong', 'balanced', 'empathy', 'data')),
  coach_style_extra TEXT[] NOT NULL DEFAULT '{}',
  default_tab TEXT NOT NULL DEFAULT 'input' CHECK (default_tab IN ('input', 'home')),
  onboarding_complete BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================
-- 2. daily_logs 테이블
-- =====================
CREATE TABLE daily_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  day INTEGER NOT NULL DEFAULT 0,
  weight NUMERIC(5,1),
  avg_weight_3d NUMERIC(5,1),
  weight_change NUMERIC(5,1),
  water NUMERIC(3,1),
  exercise TEXT CHECK (exercise IN ('Y', 'N')),
  breakfast TEXT,
  lunch TEXT,
  dinner TEXT,
  late_snack TEXT CHECK (late_snack IN ('Y', 'N')),
  energy TEXT CHECK (energy IN ('여유', '보통', '피곤')),
  note TEXT,
  closed BOOLEAN NOT NULL DEFAULT FALSE,
  intensive_day BOOLEAN,
  feedback TEXT,
  daily_summary TEXT,
  one_liner TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, date)
);

-- =====================
-- 3. weekly_logs 테이블
-- =====================
CREATE TABLE weekly_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  avg_weight NUMERIC(5,1) NOT NULL DEFAULT 0,
  exercise_days INTEGER NOT NULL DEFAULT 0,
  late_snack_count INTEGER NOT NULL DEFAULT 0,
  weekly_summary TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, week_start)
);

-- =====================
-- 4. updated_at 자동 갱신 트리거
-- =====================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER settings_updated_at
  BEFORE UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER daily_logs_updated_at
  BEFORE UPDATE ON daily_logs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER weekly_logs_updated_at
  BEFORE UPDATE ON weekly_logs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================
-- 5. RLS 활성화
-- =====================
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_logs ENABLE ROW LEVEL SECURITY;

-- =====================
-- 6. RLS 정책 — settings
-- =====================
CREATE POLICY "settings: 본인만 조회" ON settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "settings: 본인만 삽입" ON settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "settings: 본인만 수정" ON settings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "settings: 본인만 삭제" ON settings
  FOR DELETE USING (auth.uid() = user_id);

-- =====================
-- 7. RLS 정책 — daily_logs
-- =====================
CREATE POLICY "daily_logs: 본인만 조회" ON daily_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "daily_logs: 본인만 삽입" ON daily_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "daily_logs: 본인만 수정" ON daily_logs
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "daily_logs: 본인만 삭제" ON daily_logs
  FOR DELETE USING (auth.uid() = user_id);

-- =====================
-- 8. RLS 정책 — weekly_logs
-- =====================
CREATE POLICY "weekly_logs: 본인만 조회" ON weekly_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "weekly_logs: 본인만 삽입" ON weekly_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "weekly_logs: 본인만 수정" ON weekly_logs
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "weekly_logs: 본인만 삭제" ON weekly_logs
  FOR DELETE USING (auth.uid() = user_id);

-- =====================
-- 9. 성능 인덱스
-- =====================
CREATE INDEX daily_logs_user_date_idx ON daily_logs (user_id, date DESC);
CREATE INDEX weekly_logs_user_week_idx ON weekly_logs (user_id, week_start DESC);
