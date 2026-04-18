import { createAdminClient } from "@/lib/supabase/admin";

export type AiCallType = 'feedback' | 'daily_summary' | 'one_liner' | 'parse' | 'notice_rewrite';

interface LogAiUsageParams {
  userId: string;
  callType: AiCallType;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs?: number;
  success: boolean;
  errorMessage?: string;
}

export async function logAiUsage(params: LogAiUsageParams) {
  try {
    // 향후 모델 다변화를 대비해 모델명에 따른 구체적 단가 매핑 (1M tokens 기준 예상 단가)
    const PRICING: Record<string, { in: number; out: number }> = {
      'google/gemini-2.5-flash': { in: 0.10, out: 0.40 }, 
      'google/gemini-2.5-pro': { in: 2.50, out: 10.00 },
      'anthropic/claude-3.5-haiku': { in: 0.25, out: 1.25 },
    };
    
    // 지원하지 않는 모델의 경우 임시적으로 0 처리 (단가 측정 불가)
    const price = PRICING[params.model] || { in: 0, out: 0 };
    const costUsd =
      ((params.inputTokens ?? 0) / 1_000_000) * price.in +
      ((params.outputTokens ?? 0) / 1_000_000) * price.out;

    const adminClient = createAdminClient();
    
    // 로깅 과정에서 에러가 터지더라도 메인 비즈니스 로직(AI 반환)을 방해해선 안 됨 (fire-and-forget 의도)
    (async () => {
      try {
        const { error } = await adminClient
          .from('ai_usage_logs')
          .insert({
            user_id: params.userId,
            call_type: params.callType,
            model: params.model,
            input_tokens: params.inputTokens ?? null,
            output_tokens: params.outputTokens ?? null,
            cost_usd: costUsd,
            latency_ms: params.latencyMs ?? null,
            success: params.success,
            error_message: params.errorMessage ?? null,
          });
        if (error) {
          console.error('[AI Usage Log Error] Failed to insert log:', error.message);
        }
      } catch (err) {
        console.error('[AI Usage Log Catch] Insert exception:', err);
      }
    })();
  } catch (error) {
    // createAdminClient 등 자체 에러가 발생해도 로깅 때문에 시스템이 크래시되지 않도록 최소 방어
    console.error('[AI Usage Log Catch] Exception:', error);
  }
}
