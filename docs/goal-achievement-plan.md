# 목표 달성 경험(Goal Achievement) 구현 플랜

> 사용자가 `settings.targetWeight`에 도달하는 순간을 SomaLog 여정의 클라이맥스로 만드는 기능.
> 작성일: 2026-06-15. 상태: **1차 구현 완료** (커밋 50ecbbe).

---

## ✅ 구현 완료 요약 (2026-06-16)

- **데이터:** `achievements` 테이블(RLS) + `settings.mode('losing'|'maintaining')`.
  마이그레이션 `supabase/migrations/20260616000000_create_achievements.sql` — **적용 완료**(이력은 `migration repair`로 정합화).
- **판정:** `lib/services/achievement-service.ts`
  - 순수 로직 `decideGoalEventKind()` + 유닛 테스트 9종.
  - `detectGoalAchievement()`는 `actionCloseDailyLog`에서 마감 직후 호출(`closeDailyLog` 자체는 미변경).
- **재달성 정책(C안):**
  - 최초 달성 → 풀 세리머니(1막→2막→3막), `achievements` 1행 INSERT(`seen_at`로 중복 방지).
  - 재달성(요요 후 목표 재진입, 감량 모드, 직전 체중이 목표 위였을 때만) → 미니 토스트.
  - 유지 모드 또는 목표 이하 연속 → 이벤트 없음(매일 토스트 방지).
- **UI:** `components/celebration/goal-ceremony.tsx`(지연 로드) + `confetti.tsx`(경량 CSS).
  입력탭·홈탭 마감 직후 모두 배선 — 어느 탭에서 마감해도 노출. 초기 번들 영향 0.
- **3막 동작:** 유지 모드 전환(`mode='maintaining'`) / 새 목표(새 챕터 모달) / 나중에.

### ✅ 추가 완료 (2026-06-16, 챕터 모델 도입)

- **2막 리포트 개편(B 일부):** 카드 8종 재배치(운동·수분·야식·술·세끼·기록·일평균·주평균),
  습관 비율 분모를 "해당 항목을 입력한 날"로 보정(미입력일 제외), 일/주 평균 감량 추가.
  **공유 완료** — `html-to-image`로 1막·2막 카드 2장 캡처 → `navigator.share`(미지원 시 로컬 저장 + 안내 토스트).
- **챕터(캠페인) 모델:** `diet_chapters` 테이블(RLS) — 마이그레이션 `20260616010000_create_diet_chapters.sql` **적용 완료**.
  - 개념 분리: **기록 타임라인**(`daily_logs`, 불변) ↔ **현재 챕터**(`settings`의 시작일·시작체중·목표).
  - `lib/services/chapter-service.ts` — `startNewChapter()`(직전 챕터 아카이브 + 달성 기록 초기화 + settings 갱신), `getChapters()`.
  - `app/actions/chapter-actions.ts` — `actionStartNewChapter` / `actionGetChapters`.
  - **새출발/새 목표 UX:** `components/chapter/new-chapter-modal.tsx` — 결과(이전 챕터 종료·기록 보존·Day 리셋·시작체중 갱신)를 명시하고 재확인.
    설정 탭의 시작일/시작체중 **직접 편집 제거** → 모달 경유로만. 세레머니 3막 "새 목표"는 `/settings?newChapter=1`로 모달 자동 오픈.
  - **며칠째 = 현재 챕터 기준(메인)** + **총 누적 일수(보조)**: 홈 배너는 `dietStartDate` live 계산(D+N) + 첫 기록일 기준 "총 N일째"(이전 챕터 있을 때만, 캐시된 전체 로그 사용 — 신규 쿼리 0).
- **데모 갱신:** `mock-data-new.ts`에 술(`dinnerAlcohol`/`lateSnackAlcohol`)·야식 연결("저녁 식사 연결") 사례 추가, `loadMockDailyLogs`가 술 컬럼 매핑하도록 보정.
- **마이그레이션 이력 정렬:** 원격에 적용됐으나 이력 누락이던 `20260421/20260615/20260616000000`을 `migration repair`로 정합화(스키마는 이미 존재, 재실행 아님).

---

## 🔜 아직 안 한 것 (후속 작업 상세)

> **공통 제약:** 모든 후속 작업도 **앱 진입·탭 이동 속도 훼손 0** 원칙을 지킨다.
> 무거운 자산은 지연 로드, 신규 쿼리는 세리머니/리포트 진입 시점에만, 탭 마운트 경로에 fetch 추가 금지.

### A. 챕터 회고 화면 — 명예의 전당 + 지난 도전 기록 — 우선순위 ★★★  *(데이터 기반 완료, UI는 나중에)*
- **상태:** 데이터·액션 준비됨 — `getAchievements`/`actionGetAchievements`(달성 순간)에 더해
  **`diet_chapters` 테이블 + `getChapters`/`actionGetChapters`(종료된 챕터 이력)까지 완비**. 전용 **UI만** 미구현.
- **설계 합의(2026-06-16):** 챕터 데이터 기반은 지금 깔아두고, **회고 화면(UI)은 나중에** 만든다.
- **두 갈래로 분리(중요):** `diet_chapters`는 **종료된 모든 챕터**를 보관하되 `achieved` 플래그로 두 surface로 나눠 보여준다.
  - **① 명예의 전당** = `achieved = true`(종료 시 체중 ≤ 목표) 챕터 → 트로피 카드. 자랑·자부심 톤.
  - **② 지난 도전 기록** = `achieved = false`(중도 새출발/포기) 챕터 → 트로피 아님. "그때도 N일 기록했어" 식의 담백한 이력. 누적 일수·연속성 근거.
  - 두 surface는 한 화면의 탭/섹션으로 묶거나 분리 가능. **명예의 전당에는 미달성 챕터를 절대 노출하지 않는다.**
  - 새 챕터 모달 첫 안내문도 이 분기에 맞춰 "🏆 명예의 전당 보관" vs "🗂️ 지난 도전 기록 보관"으로 다르게 노출 — **구현 완료**.
- **할 일:**
  - 화면 위치 결정: 설정 하위(`/settings` 내 섹션) 또는 신규 라우트. 탭 추가는 지양(탭 진입 속도 영향).
  - 소스: `diet_chapters`(종료 챕터: 시작/목표/종료 체중·기간·`achieved`) + `achievements`(달성 스냅샷). 시간순 카드 리스트.
  - 명예의 전당: `achieved=true` 챕터 + `achievements.payload`로 달성 요약 카드.
  - 지난 도전 기록: `achieved=false` 챕터를 별도 섹션/탭으로(담백한 톤, "포기"라는 표현 지양 → "지난 도전").
  - 3막 `next-step-sheet`의 "명예의 전당" 진입점을 이 화면에 연결(현재 3막은 유지/새목표/나중에만 노출).
  - 재진입 배너: 홈 상단에 "내 달성 기록 보기"(이미 `seen_at` 있는 업적 대상) — 선택.
- **주의:** 회고 화면 자체도 지연 로드(`dynamic`)로, 설정 탭 초기 번들에 안 실리게.

### B. 2막 리포트 공유 (Web Share) — ✅ 완료 (2026-06-16)
- **구현:** `ReportAct`에 "친구에게 자랑하기" — `html-to-image`로 1막(달성)·2막(여정) 카드 2장 캡처(동적 import),
  `navigator.share({ files })` 우선, 미지원 시 로컬 PNG 2장 저장 + "사진첩에서 확인" 토스트.
  오프스크린 캡처용 카드는 인라인 스타일(캡처 안정성). 프라이버시: 카드엔 집계 데이터만, 식단 원문 제외.
- **남은 선택지:** 카카오 링크 공유(현재 Web Share만). 필요 시 추가.

### C. 점진적 빌드업 (게이지 글로우 / 마일스톤) — 우선순위 ★★
- **상태:** 미구현. 최종 세리머니가 갑작스럽지 않게 "쌓아온 결과"로 느껴지게 하는 선행 연출.
- **할 일:**
  - 목표 2~3kg 전부터 홈 BMI 게이지에 "목표까지 {x}kg" 글로우 + 코치 멘트.
  - 마일스톤 업적 추가: `achievements.type = 'milestone_-5kg' | 'milestone_-10kg' | 'streak_30'` 등.
    - `decideGoalEventKind`와 별개의 마일스톤 판정 함수 신설(순수 함수로 분리 + 유닛 테스트).
    - 마감 시점 판정에 합류(현재 goal_reached만 판정). 마일스톤은 작은 토스트/뱃지 수준.
  - 게이지 연출은 홈 탭 렌더 경로 — **반드시 CSS 기반 경량**, JS 연산 추가 최소화.

### D. 축하 강도 스케일링 — 우선순위 ★
- **상태:** 현재는 조건과 무관하게 **항상 풀 세리머니**(설계 원칙 2 미반영).
- **할 일:**
  - 갭·기간 작은 목표(예: `totalLoss < 2kg && daysElapsed < 14`)는 풀스크린 대신 **인앱 토스트+미니 컨페티**.
  - 판정은 `snapshot`(이미 계산됨)으로 클라이언트에서 즉시 분기 — 추가 쿼리 0.
  - `goal-ceremony.tsx`에 `variant: 'full' | 'mini'` prop 추가, `input/home-container`에서 snapshot 기준 결정.

### E. 검증·정합성 마감 — 우선순위 ★★
- **상태:** 핵심 유닛 테스트(판정 9종)만 존재. 아래 미완.
- **할 일:**
  - E2E: 목표 도달 마감 → 세리머니 노출 → 재진입 시 미노출(`seen_at`) 시나리오.
  - 데모 데이터/리셋 경로에서 `achievements` 정합성(리셋 시 업적도 정리할지 정책 결정).
  - 이미 목표 이하로 시작한 계정/목표 미설정 계정 무오작동 재확인(현재 판정 가드로 1차 보장).

### F. 선행 의존성 — ✅ 해소
- **DB 마이그레이션 적용 완료:** `20260616000000_create_achievements.sql`(achievements + `settings.mode`),
  `20260616010000_create_diet_chapters.sql`(diet_chapters). 원격 적용 + 이력 정합화(`migration repair`) 완료.
- 앞으로 `supabase db push`로 정상 적용 가능(드리프트 해소됨).

---

## 0. 설계 원칙

1. **여정을 보여준다, 숫자가 아니라.** "−12.4kg / D+96 / 기록 84일"처럼 쌓아온 과정을 서사로.
2. **목표 갭·기간에 따라 축하 강도를 스케일링.** 단기(예: <14일 & <2kg)는 가벼운 인앱 축하, 장기·대형 목표는 풀 세리머니.
3. **목표 달성이 이탈 사유가 되면 안 된다.** 달성 직후 반드시 "그 다음"(유지/새 목표/명예의 전당)을 제시.
4. **속도 불변 원칙.** 진입·탭 이동 속도 훼손 금지. 무거운 연출 자산은 지연 로드, 세리머니 판정은 기존에 로드된 데이터로 클라이언트에서 수행(추가 왕복 최소화).
5. **프라이버시.** 비포/애프터는 사진이 아니라 **데이터로** 증명.

---

## 1. 데이터 모델 / 트리거 조건

### 달성 판정 로직 (서버, 마감 시점)
- 위치: `lib/services/daily-log-service.ts` 의 `closeDailyLog` 마감 파이프라인 내.
- 조건: `settings.targetWeight`가 설정되어 있고(>0), 마감되는 로그의 `weight`가 **처음으로** `<= targetWeight`에 도달.
  - "처음으로" 판정: 해당 날짜 이전에 `weight <= targetWeight`인 마감 로그가 없을 때. (재달성/요요 후 재달성은 별도 마일스톤으로 다룰 수 있으나 1차 범위에서는 "최초 1회"만 풀 세리머니.)
- 결과: `daily_logs`에 `goal_reached_at`(timestamptz, nullable) 같은 마커를 기록하거나, 별도 `achievements` 테이블 1행 insert.

### 신규 컬럼/테이블 (택1)
- **간단안:** `settings`에 `goal_achieved_at timestamptz null` 추가 → 최초 달성 시각 1회 기록. 세리머니 노출 여부 판정에 사용.
- **확장안(권장):** `achievements` 테이블
  ```sql
  create table achievements (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id),
    type text not null,            -- 'goal_reached' | 'milestone_-5kg' | 'streak_30' ...
    achieved_at timestamptz not null default now(),
    payload jsonb,                  -- 달성 당시 스냅샷(시작/목표/현재 체중, D+N, 기록일수 등)
    seen_at timestamptz null,       -- 세리머니를 본 시각(중복 노출 방지)
    unique (user_id, type)
  );
  -- RLS: user_id = auth.uid()
  ```
  → 마일스톤(−5kg, −10kg), 연속 기록 등으로 자연 확장 가능. **명예의 전당(3막)과 직결**되므로 권장.

### 마감 응답 확장
- `closeDailyLog` 반환값 또는 `actionCloseDailyLog` 응답에 `justAchievedGoal: boolean`(+ 스냅샷)을 포함 → 클라이언트가 마감 직후 세리머니를 띄울지 즉시 판단(추가 fetch 불필요).

---

## 2. 1막 — 발견의 순간 (달성 즉시 세리머니)

- **트리거:** `app/(tabs)/input/input-container.tsx` 의 `handleClose` 성공 직후, 응답의 `justAchievedGoal`가 true면 전체화면 세리머니 컴포넌트 마운트.
- **컴포넌트:** `components/celebration/goal-celebration.tsx` (신규, `"use client"`, 동적 import로 지연 로드).
  - 컨페티 애니메이션(가벼운 CSS/canvas, 외부 무거운 라이브러리 지양 — 번들 영향 체크).
  - 햅틱: `navigator.vibrate?.(...)` (지원 기기 한정).
  - 코치(소마)의 개인화 한마디: `D+{N}일, {시작체중}kg에서 여기까지…` — 기존 코치 톤/이름(`settings.coachName`) 사용. AI 호출은 **선택**(없어도 템플릿으로 충분, 있으면 마감 파이프라인에서 미리 생성해 스냅샷에 저장).
  - 핵심 지표 순차 카운트업: 총 감량(`startWeight - currentWeight`), 소요 일수(D+N), 기록한 날 수.
- **스케일링:** 갭/기간 작은 목표는 풀스크린 대신 인앱 토스트+컨페티 미니 버전.

## 3. 2막 — 여정 회고 리포트 (공유 가능)

- **컴포넌트:** `components/celebration/journey-report.tsx` — "Wrapped" 스타일 카드.
- **데이터 소스:** 이미 로드된 `allLogs` / 주간 로그 / `stats-service` 재사용(신규 쿼리 최소화).
  - 시작↔목표 BMI 게이지 풀샷(기존 BMI 게이지 컴포넌트 재활용).
  - 최저 체중 갱신 횟수, 최장 연속 기록일, Hard Reset을 이겨낸 날 수, 운동/수분 달성률.
- **공유:** 기존 Web Share / 카카오 링크 자산 재사용(최근 커밋들에서 정비된 share 경로). 공유 카드 이미지는 클라이언트 렌더 후 캡처 또는 서버 OG 이미지.
- **진입점:** 세리머니 마지막 단계 "내 여정 보기" + 홈 탭 상단 배너에서 재진입.

## 4. 3막 — "그 다음" 설계 (이탈 방지)

세리머니 종료 시 3가지 길 제시(`components/celebration/next-step-sheet.tsx`):
1. **유지 모드(Maintenance):** 목표 ±밴드 유지가 새 목표가 됨.
   - 기존 `intensiveDay`(Hard Reset) 로직을 "유지 밴드 이탈" 감지로 재활용 가능 — `intensiveDayCriteria`를 유지 모드용으로 재해석.
   - `settings`에 `mode: 'losing' | 'maintaining'` 류 상태 추가 검토.
2. **새 목표 설정:** `targetWeight` 갱신 플로우 재사용(설정 화면). 더 낮은 체중 또는 체성분 목표.
3. **명예의 전당:** `achievements` 타임라인을 영구 노출하는 화면(`app/(tabs)/...` 또는 설정 하위). 돌아올 이유 제공.

---

## 5. 점진적 기대감 (선행 빌드업)

- 목표 2~3kg 전부터 홈 BMI 게이지에 "목표까지 {x}kg" 글로우 + 코치 멘트로 막판 몰입 상승.
- 마일스톤(−5/−10kg, 연속기록 N일)마다 작은 축하를 미리 깔아, 최종 세리머니가 갑작스럽지 않고 쌓아온 결과로 느껴지게.

---

## 6. 구현 순서 (제안)

1. **데이터/트리거**: `achievements` 테이블 + RLS, `closeDailyLog`에 최초 달성 판정 + 스냅샷, `actionCloseDailyLog` 응답 확장. (E2E·유닛 테스트 포함)
2. **1막 세리머니** 컴포넌트 + 트리거 배선 + 스케일링.
3. **2막 리포트** + 공유.
4. **3막 next-step** + 유지 모드 토대.
5. **빌드업**(게이지 글로우/마일스톤) — 여력에 따라.

## 7. 검증 체크리스트

- [ ] 최초 달성 시 1회만 세리머니, 재진입/새로고침 시 중복 노출 없음(`seen_at`).
- [ ] 목표 미설정/이미 목표 이하로 시작한 계정에서 오작동 없음.
- [ ] 세리머니/리포트 지연 로드로 입력·홈 탭 초기 진입 속도 영향 0 (번들 사이즈 측정).
- [ ] 단기 목표 vs 장기 목표 축하 강도 스케일링 동작.
- [ ] 공유 카드 정상 생성(카카오 링크 클릭 가능 — 기존 회귀 주의).
- [ ] 데모 데이터/리셋 경로에서 achievements 정합성.

---

### 참고 — 관련 기존 코드
- 목표 체중: `settings.targetWeight`, 시작: `settings.startWeight`, 현재: `settings.currentWeight` (`lib/types.ts`)
- 마감 파이프라인: `closeDailyLog` (`lib/services/daily-log-service.ts`)
- 입력 마감 트리거: `handleClose` (`components/input/input-container.tsx`)
- 통계: `lib/services/stats-service.ts`
- 공유: 최근 커밋(5c47825, 065ad02 등)에서 정비된 Web Share/카카오 경로
