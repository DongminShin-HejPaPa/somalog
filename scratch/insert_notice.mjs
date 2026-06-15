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

const title = "[업데이트] 그래프 탭 대폭 강화! 스마트 바디 분석 및 건강 지표 추가";
const content = `> ℹ️ 이 글은 AI가 자동으로 생성한 것입니다.

안녕하세요, Soma Log입니다. 
사용자 여러분의 기록이 단순한 숫자를 넘어 더욱 가치 있는 인사이트로 이어질 수 있도록, **그래프 탭에 스마트 바디 분석 및 건강 지표 카드** 기능을 새롭게 도입했습니다. 

이제 단순히 체중의 증감을 확인하는 것을 넘어, 내 몸의 상태를 다각도로 분석한 핵심 데이터들을 한눈에 확인하실 수 있습니다.

**나만의 맞춤형 건강 지표 카드 서비스**
- **스마트 바디 분석**: 입력하신 신체 정보를 바탕으로 현재 체중 대비 제지방량과 체지방률을 추정하여 분석해 드립니다.
- **직관적인 BMI 게이지**: 나의 체질량지수(BMI)를 한눈에 들어오는 게이지 바(낮음/건강/높음/비만) 형태로 제공하여 현재 건강 상태를 쉽게 파악할 수 있도록 돕습니다.
- **정밀 에너지 분석 (BMR & TDEE)**: 생존에 필요한 기초대사량(BMR)부터 실제 활동량을 고려한 하루 총 에너지 소모량(TDEE)까지 계산하여, 나에게 꼭 적합한 관리 기준을 제시해 드립니다.

기록만 하면 자동으로 채워지는 건강 지표 카드를 통해, 더욱 체계적이고 과학적으로 내 몸의 변화를 관찰해 보세요! (※ 더욱 정확한 분석 결과를 확인하시려면 설정 탭에서 '생년월일' 정보를 업데이트해 주시기 바랍니다.)

Soma Log는 앞으로도 여러분의 건강한 변화를 가장 가까이에서 응원하고 지원하겠습니다.

언제나 더 나은 서비스를 위해 최선을 다하겠습니다. 
감사합니다.

작성자 : 관리자`;

async function run() {
  const { data, error } = await supabase
    .from('notices')
    .insert([
      {
        title,
        content,
        author: '관리자',
        is_important: true,
        published_at: new Date().toISOString()
      }
    ])
    .select();

  if (error) {
    console.error('Error inserting notice:', error);
    process.exit(1);
  } else {
    console.log('Notice inserted successfully:', data);
  }
}

run();
