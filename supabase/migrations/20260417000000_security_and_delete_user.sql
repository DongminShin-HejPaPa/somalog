-- 사용자가 본인 계정을 스스로 삭제할 수 있는 RPC 함수
-- auth.users 삭제 → ON DELETE CASCADE로 모든 관련 데이터 자동 삭제
CREATE OR REPLACE FUNCTION delete_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 현재 로그인한 사용자만 본인 계정 삭제 가능
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;

-- 인증된 사용자만 이 함수 호출 가능
REVOKE ALL ON FUNCTION delete_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION delete_user() TO authenticated;

-- notices 테이블 쓰기 RLS: 현재는 모든 클라이언트 INSERT 차단
-- (Plan 2에서 Admin 권한 구현 후 admin 전용 정책으로 교체 예정)
DO $$
BEGIN
  -- INSERT 차단
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'notices' AND policyname = 'notices: 관리자만 삽입'
  ) THEN
    CREATE POLICY "notices: 관리자만 삽입" ON notices
      FOR INSERT WITH CHECK (false);
  END IF;

  -- UPDATE 차단
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'notices' AND policyname = 'notices: 관리자만 수정'
  ) THEN
    CREATE POLICY "notices: 관리자만 수정" ON notices
      FOR UPDATE USING (false);
  END IF;

  -- DELETE 차단
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'notices' AND policyname = 'notices: 관리자만 삭제'
  ) THEN
    CREATE POLICY "notices: 관리자만 삭제" ON notices
      FOR DELETE USING (false);
  END IF;
END$$;
