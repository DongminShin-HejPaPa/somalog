import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// .env.local 로드
const envPath = path.resolve(process.cwd(), '.env.local');
const envConfig = dotenv.parse(fs.readFileSync(envPath));
for (const k in envConfig) {
  process.env[k] = envConfig[k];
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  // 6/24에 잘못 올라간 스마트 바디 분석 공지 삭제
  const { error: delError } = await supabase
    .from('notices')
    .delete()
    .ilike('title', '%스마트 바디%')
    .gte('published_at', '2026-06-24T00:00:00+00:00');

  if (delError) {
    console.error('삭제 실패:', delError);
    process.exit(1);
  } else {
    console.log('잘못 올라간 공지 삭제 완료');
  }

  // 챕터 별 보기 기능 공지 삽입
  const { data, error: insError } = await supabase
    .from('notices')
    .insert([
      {
        title: '기록 · 그래프 탭에서 챕터별 데이터 보기 기능 추가',
        content: `기록 탭과 그래프 탭이 업데이트됐어요.

지금까지는 기록/그래프가 항상 전체 기간의 데이터를 보여줬는데, 이제 챕터 단위로 선택해서 볼 수 있어요.

■ 어떻게 바뀌었나요?

기록 탭 · 그래프 탭 오른쪽 상단에 챕터 선택 드롭다운이 생겼어요. 드롭다운에서 아래 항목 중 하나를 선택하면 해당 기간의 데이터만 보여요.
- 전체 기간 — 지금까지 쌓인 모든 기록 (기존과 동일)
- 진행 중인 챕터 — 현재 다이어트 시작일부터 지금까지
- 지난 챕터 — 이전에 완료된 챕터(목표 달성 또는 재도전 시작으로 마무리된 기간)

선택한 챕터는 기기에 저장되어, 앱을 껐다 켜도 유지돼요.

■ 기록 탭 — 운동 · 야식 · 술 누적 비율 차트

기록 탭에서 운동, 야식, 술 필터를 선택하면, 해당 챕터 시작일부터 각 날짜까지의 누적 비율 추세를 미니 차트로 확인할 수 있어요.
- 차트 오른쪽 상단에 총 경과일 중 실제 해당 일수 표시 (예: 전체 170일 중 58일 운동)
- 평균선(회색 점선)이 함께 표시되어 나의 흐름을 한눈에 파악할 수 있어요

■ 그래프 탭

선택한 챕터 범위에 맞게 체중 그래프, 역대 최저 기준점, 목표선이 모두 해당 챕터 기준으로 표시돼요. 챕터를 바꿔도 별도 로딩 없이 즉시 전환됩니다.

다이어트를 여러 번 반복하거나, 지난 챕터와 현재를 비교하고 싶을 때 유용하게 쓸 수 있을 거예요. 기록이 쌓일수록 더 의미 있는 기능이 됩니다.`,
        author: '관리자',
        is_important: false,
        published_at: new Date().toISOString(),
      },
    ])
    .select();

  if (insError) {
    console.error('공지 삽입 실패:', insError);
    process.exit(1);
  } else {
    console.log('공지 삽입 완료:', data);
  }
}

run();
