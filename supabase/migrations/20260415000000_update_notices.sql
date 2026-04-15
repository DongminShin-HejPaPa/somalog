-- =====================
-- 1. notice_comments에 name 컬럼 추가
-- =====================
ALTER TABLE notice_comments ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT '';

-- =====================
-- 2. 기존 AI 생성 공지사항 본문 앞에 AI 안내 문구 추가
-- =====================
UPDATE notices
SET content = E'* 이 글은 AI가 자동으로 생성한 것입니다.\n\n' || content
WHERE author = '관리자';

-- =====================
-- 3. 새 중요 공지사항 추가 (공지사항 기능 추가 안내)
-- =====================
INSERT INTO notices (title, content, author, published_at, is_important) VALUES
(
  '[업데이트] 공지사항 기능 추가',
  E'공지사항 기능이 새롭게 추가되었습니다.\n\n주요 변경사항:\n- 설정 탭 최상단에 공지사항 메뉴 추가\n- 공지 목록 및 상세 페이지 제공\n- 게시글마다 댓글 작성 가능\n- 로그인 시 미확인 중요 공지 자동 팝업 (좌/우 내비게이션)\n- 계정별 마지막 확인 시각 추적으로 이미 본 공지는 재표시 안 됨',
  '관리자',
  NOW(),
  TRUE
);
