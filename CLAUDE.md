# SomaLog — Claude Code 가이드

AI 코치와 함께하는 다이어트 기록 앱. Next.js 15 App Router + Supabase 백엔드.

---

## 프로젝트 개요

| 항목 | 내용 |
|------|------|
| 프레임워크 | Next.js 15 (App Router, Turbopack) |
| 언어 | TypeScript (strict) |
| 스타일 | Tailwind CSS v4 |
| 백엔드 | Supabase (PostgreSQL + RLS + Auth) |
| 패키지 매니저 | pnpm |

---

## 주요 명령어

```bash
pnpm dev              # 개발 서버 (http://localhost:3000)
pnpm build            # 프로덕션 빌드
pnpm test             # 유닛 테스트 (Vitest)
pnpm test:coverage    # 유닛 테스트 + 커버리지
pnpm test:e2e         # E2E 테스트 (Playwright)
pnpm test:e2e:ui      # Playwright UI 모드
pnpm test:e2e:debug   # Playwright 디버그 모드
```

---

## 아키텍처

### 서비스 레이어

DB 컬럼(snake_case) ↔ TypeScript 타입(camelCase) 변환은 각 서비스의 mapper 함수가 담당한다.

```
lib/services/
├── settings-service.ts     # Settings CRUD
├── daily-log-service.ts    # DailyLog CRUD + 계산 파이프라인
└── weekly-log-service.ts   # WeeklyLog CRUD (일요일 자동 생성)
```

### Server Actions

클라이언트 컴포넌트는 서비스 레이어를 직접 호출하지 않고 Server Actions를 통해 접근한다.

```
app/actions/
├── log-actions.ts           # actionGetDailyLog, actionUpsertDailyLog, actionCloseDailyLog
├── settings-actions.ts      # actionGetSettings, actionUpdateSettings, actionInitializeSettings
└── data-actions.ts          # serverResetAllData, serverLoadDemoData
```

### Supabase 클라이언트

- **Server Component / Server Action**: `lib/supabase/server.ts` → `createClient()`
- **Client Component**: `lib/supabase/client.ts` → `createBrowserClient()`
- RLS 정책: 모든 테이블에 `user_id = auth.uid()` 조건 적용

---

## 유닛 테스트 (Vitest)

```
tests/
├── setup.ts                          # 전역 설정
├── fixtures/
│   └── mock-data.ts                  # mockSettings, mockDailyLog, createMockSupabaseClient()
└── unit/
    ├── utils/
    │   ├── compute-daily.test.ts     # 28 tests — 일별 계산 로직
    │   ├── date-utils.test.ts        # 14 tests — 날짜 유틸
    │   └── templates.test.ts         # 41 tests — 텍스트 템플릿
    └── services/
        ├── settings-service.test.ts  # 10 tests
        ├── daily-log-service.test.ts # 15 tests
        └── weekly-log-service.test.ts # 8 tests
```

**Supabase mock 패턴**: 메서드 체이닝은 `vi.fn().mockReturnThis()`, 터미널 메서드는 `mockResolvedValue()`.

---

## E2E 테스트 (Playwright)

### 사전 준비

`.env.test.local.example`을 복사하고 값을 채운다:

```bash
cp e2e/.env.test.local.example .env.test.local
```

필요한 환경 변수:

| 변수 | 설명 | 획득 방법 |
|------|------|-----------|
| `SUPABASE_SERVICE_ROLE_KEY` | Admin API 키 (RLS 우회) | Supabase 대시보드 → Project Settings → API → `service_role` |
| `TEST_USER_EMAIL` | 테스트 전용 계정 이메일 | 임의 지정 (예: `e2e-test@somalog.local`) |
| `TEST_USER_PASSWORD` | 테스트 계정 비밀번호 (6자 이상) | 임의 지정 |

> ⚠️ `.env.test.local`은 `.gitignore`에 등록되어 있어 커밋되지 않는다.

### 폴더 구조

```
e2e/
├── auth.setup.ts              # 브라우저 로그인 → storageState 저장 (e2e/.auth/user.json)
├── global-setup.ts            # [전역] Supabase Admin으로 테스트 유저 생성
├── global-teardown.ts         # [전역] 테스트 유저 삭제
├── tsconfig.json              # e2e 전용 TS 설정 (vitest/globals 타입 충돌 방지)
├── .env.test.local.example    # 환경 변수 템플릿
│
├── helpers/
│   ├── supabase-admin.ts      # createTestUser / deleteTestUser / seedDailyLogs 등
│   └── test-ids.ts            # 모든 data-testid 상수 중앙 관리 (TEST_IDS)
│
├── fixtures/
│   ├── auth.fixture.ts        # loginPage, registerPage fixture
│   ├── seeded.fixture.ts      # withSeededData fixture (씨드 + 자동 정리)
│   └── index.ts               # mergeTests로 통합 → 테스트에서 단일 import
│
├── pages/                     # Page Object Model
│   ├── login.page.ts
│   ├── register.page.ts
│   ├── onboarding.page.ts
│   ├── input.page.ts
│   ├── home.page.ts
│   ├── log.page.ts
│   ├── graph.page.ts
│   └── settings.page.ts
│
└── tests/                     # 스펙 파일 (기능별 분류)
    ├── auth/
    │   ├── login.spec.ts
    │   ├── register.spec.ts
    │   └── redirect.spec.ts
    ├── onboarding/
    │   └── onboarding.spec.ts
    ├── input/
    │   ├── chip-modal.spec.ts
    │   ├── close-log.spec.ts
    │   └── date-nav.spec.ts
    ├── home/home.spec.ts
    ├── log/log.spec.ts
    ├── graph/graph.spec.ts
    └── settings/settings.spec.ts
```

### Playwright 프로젝트 구성

`playwright.config.ts`에 3개의 프로젝트가 정의되어 있다:

| 프로젝트 | 대상 파일 | 인증 상태 | 설명 |
|---------|-----------|-----------|------|
| `setup` | `auth.setup.ts` | 없음 | 로그인 후 storageState 저장 |
| `unauthenticated` | `tests/auth/*.spec.ts` | 없음 | 로그인·회원가입·리다이렉트 테스트 |
| `authenticated` | 나머지 모든 spec | `e2e/.auth/user.json` 재사용 | setup 완료 후 실행 |

### 테스트 fixture 3-tier 구조

```
unauthPage   → 비인증 상태 (auth 테스트용)
authPage     → storageState로 로그인 상태 유지 (대부분의 테스트)
seededPage   → authPage + Supabase에 테스트 데이터 씨딩 (데이터 의존 테스트)
```

### 테스트 작성 패턴

```typescript
// 모든 fixture와 POM을 단일 경로에서 import
import { test, expect } from "../../fixtures";
import { InputPage } from "../../pages/input.page";

test.describe("Input: 칩 → 모달 → 저장", () => {
  test("체중 입력", async ({ page, withSeededData: _ }) => {
    const inputPage = new InputPage(page);
    await inputPage.goto();

    await inputPage.chip("weight").click();
    await inputPage.modalWeightInput.fill("82.5");
    await inputPage.modalSave.click();

    await expect(inputPage.chip("weight")).toContainText("82.5 kg");
  });
});
```

### data-testid 가이드

모든 `data-testid` 값은 `e2e/helpers/test-ids.ts`의 `TEST_IDS` 상수로 관리한다.
새 컴포넌트에 testid를 추가할 때는 반드시 이 파일에도 상수를 추가한다.

```typescript
// 컴포넌트
<button data-testid="close-button">마감하기</button>

// test-ids.ts
CLOSE_BUTTON: "close-button",

// 테스트
page.getByTestId(TEST_IDS.CLOSE_BUTTON)
```

---

## 코딩 컨벤션

- **Server Component 기본**: `'use client'`는 인터랙션이 필요한 경우에만
- **DB 컬럼**: snake_case / **TypeScript 타입**: camelCase — mapper 함수로 변환
- **경로 alias**: `@/` → 프로젝트 루트
- **날짜 포맷**: `YYYY-MM-DD` 문자열 (ISO, 타임존 없음)
- **에러 처리**: Server Action은 `null` 반환, 서비스 레이어는 예외 throw
