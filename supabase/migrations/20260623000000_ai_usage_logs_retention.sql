-- =====================
-- ai_usage_logs 보존 정책
-- =====================
-- AI 호출마다 1행이 쌓이므로(유저당 하루 수~수십 건) 수년 누적 시 관리자
-- 대시보드 집계와 스토리지가 무거워진다. 기본 180일 초과 로그를 삭제하는
-- 함수와, pg_cron 이 설치돼 있으면 일 1회 자동 정리 스케줄을 등록한다.

CREATE OR REPLACE FUNCTION public.purge_old_ai_usage_logs(retention_days integer DEFAULT 180)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted integer;
BEGIN
  DELETE FROM public.ai_usage_logs
  WHERE created_at < NOW() - (retention_days || ' days')::interval;
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;

-- 일반 사용자에게 노출하지 않음 (관리자/스케줄러 전용).
REVOKE ALL ON FUNCTION public.purge_old_ai_usage_logs(integer) FROM PUBLIC;

-- pg_cron 확장이 있으면 매일 03:30(UTC) 정리 스케줄 등록.
-- (확장이 없으면 함수만 생성 — Supabase Scheduled Functions 등으로 호출 가능)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'purge-ai-usage-logs',
      '30 3 * * *',
      $cron$ SELECT public.purge_old_ai_usage_logs(180); $cron$
    );
  END IF;
END;
$$;
