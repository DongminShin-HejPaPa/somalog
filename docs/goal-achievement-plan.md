# 목표 달성 경험(Goal Achievement) 구현 플랜

> 사용자가 `settings.targetWeight`에 도달하는 순간을 SomaLog 여정의 클라이맥스로 만드는 기능.
> 작성일: 2026-06-15. 상태: **착수 대기** (선행: AI 모델/Hard Reset 버그 수정 완료 후 시작).

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
