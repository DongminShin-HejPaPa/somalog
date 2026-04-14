-- =====================
-- 1. notices 테이블
-- =====================
CREATE TABLE notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  author TEXT NOT NULL DEFAULT '관리자',
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_important BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================
-- 2. notice_comments 테이블
-- =====================
CREATE TABLE notice_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notice_id UUID NOT NULL REFERENCES notices(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================
-- 3. settings에 last_notice_seen_at 컬럼 추가
-- =====================
ALTER TABLE settings ADD COLUMN IF NOT EXISTS last_notice_seen_at TIMESTAMPTZ;

-- =====================
-- 4. updated_at 트리거 — notice_comments
-- =====================
CREATE TRIGGER notice_comments_updated_at
  BEFORE UPDATE ON notice_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================
-- 5. RLS 활성화
-- =====================
ALTER TABLE notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE notice_comments ENABLE ROW LEVEL SECURITY;

-- =====================
-- 6. RLS 정책 — notices (인증 사용자 전체 공개 읽기, 쓰기 불가)
-- =====================
CREATE POLICY "notices: 인증 사용자 조회" ON notices
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- =====================
-- 7. RLS 정책 — notice_comments
-- =====================
CREATE POLICY "notice_comments: 인증 사용자 조회" ON notice_comments
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "notice_comments: 본인만 삽입" ON notice_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "notice_comments: 본인만 수정" ON notice_comments
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "notice_comments: 본인만 삭제" ON notice_comments
  FOR DELETE USING (auth.uid() = user_id);

-- =====================
-- 8. 성능 인덱스
-- =====================
CREATE INDEX notice_comments_notice_id_idx ON notice_comments (notice_id, created_at DESC);

-- =====================
-- 9. 샘플 공지사항 데이터 (최근 커밋 기반)
-- =====================
INSERT INTO notices (title, content, author, published_at, is_important) VALUES

(
  'Soma Log 정식 출시!',
  E'안녕하세요!\n\nAI 코치와 함께하는 다이어트 기록 앱, Soma Log가 정식 출시되었습니다.\n\n매일 체중, 식사, 운동, 수분을 기록하면 AI 코치 소마가 여러분의 기록을 분석해 맞춤 피드백을 드립니다.\n\n꾸준한 기록으로 건강한 목표를 이뤄가세요! 응원합니다 💪',
  '관리자',
  NOW() - INTERVAL '14 days',
  TRUE
),

(
  '[업데이트] iOS 키보드 가림 현상 수정',
  E'iOS 기기에서 텍스트 입력 시 키보드가 올라오면 입력창이 키보드 뒤로 가려지던 문제가 수정되었습니다.\n\nvisualViewport API를 활용하여 입력창이 항상 키보드 위에 올바르게 표시되도록 개선하였습니다.\n\n불편을 드려 죄송합니다.',
  '관리자',
  NOW() - INTERVAL '10 days',
  TRUE
),

(
  '[업데이트] Hard Reset Mode 표시 오류 수정',
  E'체중을 입력하지 않은 날에도 Hard Reset Mode 여부가 올바르게 표시되지 않던 문제가 수정되었습니다.\n\n이제 체중 기록이 없는 날에도 직전 체중을 기준으로 Hard Reset Mode를 올바르게 판정합니다.\n\n홈·입력·기록 탭 모두에 반영되었습니다.',
  '관리자',
  NOW() - INTERVAL '8 days',
  TRUE
),

(
  '[업데이트] 빈 로그 자동 생성 시 쏘마의 한마디 오류 수정',
  E'아무 기록도 하지 않은 날에 쏘마의 한마디가 자동으로 생성되는 문제가 수정되었습니다.\n\n이제 실제 기록(체중, 식사, 운동 등)이 있는 날에만 쏘마의 한마디가 생성됩니다.',
  '관리자',
  NOW() - INTERVAL '7 days',
  FALSE
),

(
  '[업데이트] 빠진 날짜 자동 채움 기능 추가',
  E'앱을 7일 이상 사용하지 않은 경우, 빠진 날짜의 로그가 자동으로 생성되어 마감 처리됩니다.\n\n기록 공백이 있어도 흐름이 자연스럽게 이어지도록 개선하였습니다.\n\n단, 자동 마감된 날은 기록이 비어있으므로 필요 시 직접 입력하실 수 있습니다.',
  '관리자',
  NOW() - INTERVAL '12 days',
  FALSE
),

(
  '[업데이트] 홈 탭 쏘마의 한마디 추가',
  E'홈 탭에서 오늘의 쏘마의 한마디를 바로 확인할 수 있습니다.\n\n마감된 날의 AI 요약이 홈 화면에서도 확인 가능하며, 펼치기 버튼으로 전체 내용을 볼 수 있습니다.',
  '관리자',
  NOW() - INTERVAL '20 days',
  FALSE
),

(
  '[업데이트] AI 코칭 품질 개선',
  E'소마의 피드백 품질이 개선되었습니다.\n\n이제 가장 최근에 변경된 항목에 집중하여 더욱 핀포인트 피드백을 제공합니다. 예를 들어 체중을 입력하면 체중 변화에 대한 코칭이, 운동을 기록하면 운동 패턴에 대한 코칭이 우선적으로 제공됩니다.',
  '관리자',
  NOW() - INTERVAL '22 days',
  FALSE
),

(
  '[업데이트] 마감 후 로그 재오픈 시 요약 초기화 수정',
  E'마감된 로그를 다시 열면 이전 일일 요약과 쏘마의 한마디가 초기화되는 문제가 수정되었습니다.\n\n이제 로그를 재오픈해도 기존 AI 요약 내용이 보존됩니다.',
  '관리자',
  NOW() - INTERVAL '25 days',
  FALSE
),

(
  '[업데이트] 멀티 계정 캐시 버그 수정',
  E'여러 계정을 번갈아 사용할 때 이전 계정의 데이터 캐시가 새 계정에 노출되는 버그가 수정되었습니다.\n\n설정 캐시 및 로그 캐시 모두 계정 ID 기준으로 격리됩니다.',
  '관리자',
  NOW() - INTERVAL '28 days',
  FALSE
),

(
  '[업데이트] 데이터 로딩 성능 향상',
  E'주간 요약 생성 및 일일 기록 조회 시 데이터 로딩 속도가 개선되었습니다.\n\n일부 쿼리를 병렬로 처리하여 대기 시간을 줄였습니다.',
  '관리자',
  NOW() - INTERVAL '30 days',
  FALSE
);
