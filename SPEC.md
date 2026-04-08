# Soma Log — 기능 구현 실행 계획 (SPEC)

## Context

UI/UX 구현, Supabase Auth 연동 및 **Supabase Database (CRUD) 연동까지 모두 완료**된 상태입니다. 아래의 단계별 계획들은 초기 Mock 데이터 단계를 거쳐 현재는 완전히 **실제 DB를 바라보는 서비스 레이어**로 교체 및 구현이 끝났음을 나타냅니다. 

## 현재 상태

- [x] 5개 탭 UI + 온보딩 + 로그인/회원가입 완성
- [x] Supabase Auth 동작 (로그인/회원가입/미들웨어)
- [x] 모든 탭의 데이터 소스를 Mock에서 실제 Supabase 연동 서비스 레이어(`lib/services/`) 및 Server Actions(`app/actions/`)로 교체 완료
- [x] 입력/저장/수정 기능 실제 DB 연동 구현
- [x] 탭 간 데이터 동기화 완료

## 접근법: 하이브리드 레이어-탭 분리

> **탭 별로 나누는 것이 아니라, "공유 기반 → 쓰기 기능 → 읽기 기능 → 통합"** 순서로 진행합니다.
>
> 이유: 탭 별로 에이전트를 나누면, 각 에이전트가 데이터 접근 패턴을 중복 구현하거나 서로 다른 패턴을 만들어 통합 시 충돌합니다. 공유 기반을 먼저 깔고, 그 위에서 탭 별 병렬 작업을 수행하는 것이 최적입니다.

## Phase 의존성 다이어그램

```
Phase 0 (공유 기반) ─────► Phase 1 (Settings + 온보딩) ─────► Phase 2 (Input 탭 CRUD)
                                                                        │
                                                          ┌─────────────┼─────────────┐
                                                          ▼             ▼             ▼
                                                     Phase 3A      Phase 3B      Phase 3C
                                                     (Home 탭)     (Log 탭)     (Graph 탭)
                                                          │             │             │
                                                          └─────────────┼─────────────┘
                                                                        ▼
                                                               Phase 4 (통합 검증)
```

**병렬 실행 가능**: Phase 3A + 3B + 3C는 모두 읽기 전용이므로 동시 실행 가능

## 실행 타임라인

```
Phase 0 ████████
                 Phase 1 ████████
                                  Phase 2 ████████████
                                                       Phase 3A ██████ ┐
                                                       Phase 3B ██████ ├ 병렬
                                                       Phase 3C ██████ ┘
                                                                        Phase 4 ████████
```

---

## Phase 0: 공유 기반 레이어 (완료)

### 오버뷰
모든 타입 시스템(`lib/types.ts`)과 데이터 서비스 인터페이스(`lib/services/`)가 구축되었습니다. 초기에는 Mock 데이터를 바라보았으나, 현재는 해당 서비스 함수들이 모두 실제 Supabase DB 호출을 수행하도록 진화 및 완성되었습니다.

### 구현 체크리스트

- [x] `lib/types.ts` 생성 — `DailyLog`, `WeeklyLog`, `Settings` 인터페이스를 `mock-data.ts`에서 분리
- [x] 유틸리티 타입 추가 — `DailyLogInput`, `DailyLogUpdate`(Partial), `SettingsInput`, `SettingsUpdate`
- [x] `lib/services/daily-log-service.ts` 생성 — `getTodayLog()`, `getDailyLog(date)`, `getRecentDailyLogs(count)`, `upsertDailyLog(date, data)`, `closeDailyLog(date)`
- [x] `lib/services/weekly-log-service.ts` 생성 — `getWeeklyLog(weekStart)`, `getWeeklyLogs(count)`
- [x] `lib/services/settings-service.ts` 생성 — `getSettings()`, `updateSettings(data)`, `initializeSettings(data)`
- [x] `lib/services/stats-service.ts` 생성 — `getLowestWeight()`, `getAvgWeight3d(date)`, `getWeightChange(date)`
- [x] `lib/utils/date-utils.ts` 생성 — `getDayNumber()`, `getWeekRange()`, `formatDate()`, `isToday()`
- [x] `lib/mock-data.ts` 정리 — mock 상수만 남기고, 타입은 `lib/types.ts`에서 re-export (기존 import 호환)

### 검증 체크리스트

- [x] `pnpm build` 성공 (타입 에러 없음)
- [x] 기존 모든 페이지 정상 렌더링 (import 경로 호환)
- [x] 서비스 함수가 mock 데이터를 올바르게 반환

### 에이전트 문맥

- 필수 파일: `lib/mock-data.ts`, `lib/utils.ts`, `lib/supabase/server.ts`
- 원칙: 서비스 함수는 async로 만들어 나중에 Supabase 호출로 교체 가능하게. Server Component에서 직접 import 사용

---

## Phase 1: Settings CRUD + 온보딩 저장 (완료)

### 오버뷰
Settings는 모든 탭에서 참조하는 전역 설정입니다. Settings 탭의 폼을 통해 설정 변경이 발생하면 실제 Supabase DB에 값이 저장 및 동기화되며, 전역 Context(`SettingsProvider`)를 활용해 각 탭과 클라이언트 상태를 유지합니다.

### 구현 체크리스트

- [x] Settings 상태 관리 — React Context (`SettingsProvider`) 생성, `app/(tabs)/layout.tsx`에 Provider 추가
- [x] `components/settings/settings-form.tsx` — 각 필드에 `onChange` 핸들러 추가, "저장" 버튼 추가
- [x] 온보딩 데이터 수집 보완 — `onboarding-flow.tsx`에서 누락된 step 데이터(키, 체중, 성별, 수분 목표, 루틴, Intensive Day) state 추가
- [x] 온보딩 완료 시 — `settingsService.initializeSettings()` 호출 → `defaultTab` 기반 리다이렉트
- [x] Settings 변경 시 다른 탭에 즉시 반영

### 검증 체크리스트

- [x] Settings에서 코치 이름 변경 → Home 탭에서 반영 확인
- [x] 온보딩 완주 → Settings 페이지에서 입력값 확인
- [x] 새로고침 후 설정 유지 (localStorage)
- [x] `pnpm build` 성공

### 에이전트 문맥

- 필수 파일: `components/settings/settings-form.tsx`, `components/onboarding/onboarding-flow.tsx`, `app/(tabs)/layout.tsx`, Phase 0에서 생성한 `lib/services/settings-service.ts`, `lib/types.ts`
- 원칙: Context Provider를 `app/(tabs)/layout.tsx`에 추가하여 모든 탭에서 접근. `SettingsForm`은 이미 `"use client"`

---

## Phase 2: Input 탭 CRUD

### 오버뷰
사용자가 일일 데이터(체중, 수분, 운동, 식단, 야식, 체력, 메모)를 입력/수정하는 핵심 쓰기 인터페이스를 구현합니다. 칩 클릭 → 입력 모달 → 저장 → 진행률 업데이트 → 마감 플로우를 완성합니다.

### 구현 체크리스트

- [x] 입력 모달/바텀시트 컴포넌트 생성 — `components/input/input-modal.tsx` (항목별 입력 UI)
  - [x] 체중: 숫자 (소수점 1자리)
  - [x] 수분: 0.5L 단위 프리셋 버튼
  - [x] 운동: Y/N 토글
  - [x] 아침/점심/저녁: 자유 텍스트
  - [x] 야식: Y/N 토글
  - [x] 체력: 여유/보통/피곤 3택
- [x] `input-chip-list.tsx` — 칩 onClick → 입력 모달 열기, 입력 완료 시 칩 상태 업데이트
- [x] 입력값 저장 — `dailyLogService.upsertDailyLog(date, data)` 호출
- [x] 진행률 바 — 실제 입력 완료 수 기반 동적 업데이트
- [x] `free-text-input.tsx` — 기본 키워드 파싱 ("아침은 샌드위치" → breakfast 업데이트)
- [x] 마감 버튼 — `closeDailyLog(date)` 호출, 마감 후 수정 차단
- [x] `date-header.tsx` — 이전/다음 날 이동, 해당 날짜 DailyLog 로드
- [x] 빈 DailyLog 자동 생성 — 오늘 날짜 로그 없으면 빈 로그 생성

### 검증 체크리스트

- [x] 체중 입력 → 칩에 "89.2 kg" 표시, 진행률 업데이트
- [x] 8개 항목 모두 입력 → 마감 버튼 활성화
- [x] 마감 후 칩 클릭 차단
- [x] 날짜 이동 → 해당 날짜 데이터 로드
- [x] `pnpm build` 성공

### 에이전트 문맥

- 필수 파일: `components/input/input-chip-list.tsx`, `components/input/free-text-input.tsx`, `components/input/date-header.tsx`, `components/input/feedback-area.tsx`, `app/(tabs)/input/page.tsx`, `lib/services/daily-log-service.ts`
- 원칙: page.tsx는 Server Component에서 데이터를 fetch → Client Component에 props 전달 패턴 유지. Input 모달은 navy/coral/secondary 컬러 시스템 + 44x44px 터치 타겟 준수

---

## Phase 3A: Home 탭 (읽기 전용 대시보드) — ⚡ 병렬 가능

### 오버뷰
Home 탭의 mock import를 서비스 호출로 교체하여 실시간 데이터를 표시합니다. 쓰기 로직 없음.

### 구현 체크리스트

- [x] `app/(tabs)/home/page.tsx` — `mockDailyLogs`/`mockSettings` → `dailyLogService`/`settingsService` 호출로 교체
- [x] `DietProgressBanner` — 서비스 데이터 기반 렌더링
- [x] `InputStatusChips` — 오늘의 실제 입력 상태 반영
- [x] `CoachOneLiner` — 데이터 소스 교체 (로직은 기존 유지)
- [x] `WeightMiniGraph` — 서비스에서 14일 데이터 가져오기
- [x] `DailySummary` — 서비스 데이터 기반 렌더링
- [x] 빈 상태(신규 유저) — 안내 메시지 표시

### 검증 체크리스트

- [x] Input에서 체중 입력 → Home에서 변경된 체중 확인
- [x] Settings 코치 이름 변경 → Home에서 반영
- [x] 빈 상태 UI 정상 표시
- [x] `pnpm build` 성공

### 에이전트 문맥

- 필수 파일: `app/(tabs)/home/page.tsx`, `components/home/*` (5개 파일), `lib/services/daily-log-service.ts`, `lib/services/settings-service.ts`
- 원칙: page.tsx는 Server Component 유지. `lib/services/*`는 읽기만 (수정 금지). 새 컴포넌트는 `components/home/`에만 추가

---

## Phase 3B: Log 탭 (히스토리) — ⚡ 병렬 가능

### 오버뷰
Log 탭의 mock import를 서비스 호출로 교체하고, 일별/주별 로그 조회 기능을 완성합니다.

### 구현 체크리스트

- [x] `app/(tabs)/log/page.tsx` — mock import → 서비스 호출로 교체
- [x] `components/log/log-list.tsx` — 서비스 데이터 기반, 날짜 범위 선택 또는 무한 스크롤
- [x] 주간 요약 카드 — 해당 주 실제 계산값 (avgWeight, exerciseDays, lateSnackCount)
- [x] 일별 로그 카드 클릭 시 상세 보기 (확장 또는 모달) — 선택적
- [x] 빈 상태 UI

### 검증 체크리스트

- [x] Input에서 데이터 입력 → Log에서 해당 일자 로그 확인
- [x] 주간 요약 수치 일치 확인
- [x] `pnpm build` 성공

### 에이전트 문맥

- 필수 파일: `app/(tabs)/log/page.tsx`, `components/log/log-list.tsx`, `lib/services/daily-log-service.ts`, `lib/services/weekly-log-service.ts`
- 원칙: `lib/services/*` 읽기만. 새 컴포넌트는 `components/log/`에만 추가

---

## Phase 3C: Graph 탭 (차트) — ⚡ 병렬 가능

### 오버뷰
Graph 탭의 mock import를 서비스 호출로 교체하고, 기간 필터/목표선 인터랙션을 완성합니다.

### 구현 체크리스트

- [x] `app/(tabs)/graph/page.tsx` — mock import → 서비스 호출로 교체
- [x] `components/graph/weight-chart.tsx` — 기간 선택 (2주/1개월/3개월/전체) 동적 필터링
- [x] 최저 체중 마커, 목표 체중 기준선 — 실제 데이터 기반 동작
- [x] 3일 평균선 표시 토글
- [x] 빈 상태 UI

### 검증 체크리스트

- [x] Input에서 체중 입력 → Graph에서 최신 포인트 확인
- [x] 기간 필터 전환 시 차트 정상 업데이트
- [x] 최저 체중 마커 위치 정확성
- [x] `pnpm build` 성공

### 에이전트 문맥

- 필수 파일: `app/(tabs)/graph/page.tsx`, `components/graph/weight-chart.tsx`, `lib/services/daily-log-service.ts`, `lib/services/stats-service.ts`
- 원칙: `lib/services/*` 읽기만. Recharts 이미 설치됨. `WeightChart`는 `"use client"` 유지

---

## Phase 4: 통합 검증 + 계산 로직

### 오버뷰
모든 탭이 동작하는 상태에서 탭 간 데이터 흐름을 검증하고, 자동 계산(avgWeight3d, weightChange, intensiveDay)과 마감 시 요약 생성을 구현합니다.

### 구현 체크리스트

- [x] 자동 계산 — avgWeight3d (3일 평균), weightChange (시작 대비), intensiveDay (역대 최저 기준), day (dietStartDate 기반)
- [x] 마감 로직 — 마감 시 dailySummary, oneLiner 필드 생성 (템플릿 기반, AI 연동은 이후)
- [x] 주간 로그 자동 생성 — 일요일 마감 시 WeeklyLog 계산
- [x] 피드백 생성 — 입력 후 즉시 피드백 (템플릿 기반)
- [x] 탭 간 데이터 일관성 검증
- [x] 에러 처리 + 로딩 상태 (스켈레톤 UI)

### 검증 체크리스트

- [x] 전체 시나리오: 온보딩 → 첫 입력 → 마감 → Home 확인 → Log 확인 → Graph 확인 → Settings 변경
- [x] 3일 평균 계산 정확성 (수동 검산)
- [x] Intensive Day 판정 로직 정확성
- [x] `pnpm build` 성공
- [x] 모바일 뷰포트 전체 플로우 동작

### 에이전트 문맥

- 필수 파일: 모든 서비스 파일, 모든 page.tsx, `lib/types.ts`
- 원칙: "접착제" Phase. 개별 탭의 독립 동작을 연결하고 보강

---

## 병렬 실행 규칙

Phase 3A/3B/3C 병렬 실행 시 **반드시 지킬 것**:

- [ ] `lib/services/*` 파일 수정 금지 (읽기만)
- [ ] `lib/types.ts` 수정 금지
- [ ] `app/(tabs)/layout.tsx` 수정 금지
- [ ] 공유 컴포넌트 (`components/ui/`) 신규 생성 금지
- [ ] 각 탭 전용 디렉토리에만 파일 추가 (`components/home/`, `components/log/`, `components/graph/`)
