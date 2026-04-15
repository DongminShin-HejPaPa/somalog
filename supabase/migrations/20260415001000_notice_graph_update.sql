-- 그래프 개선 업데이트 공지사항 추가
INSERT INTO notices (title, content, author, published_at, is_important) VALUES
(
  '[업데이트] 체중 그래프 개선',
  '체중 그래프가 더 보기 좋게 개선되었습니다.' || chr(10) || chr(10) || '주요 변경사항:' || chr(10) || '- 전체적인 체중 변화 흐름을 한눈에 파악할 수 있는 추세선 추가 (주황색 점선)' || chr(10) || '- 단기적인 오르내림보다 장기적인 방향성을 확인하는 데 도움이 됩니다',
  '관리자',
  NOW(),
  FALSE
);
