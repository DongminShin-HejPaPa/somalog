# 성능 백로그

미해결 / 보류 중인 성능 항목. 호출 시 다시 검토 후 실행.

**호출 방법:** "perf backlog 봐줘" 또는 항목 이름으로 직접 호출

---

## [INPUT-LOADING-1-2S] 입력 탭 "로딩 중..." 1-2초 노출 (가끔)

### 증상
강제종료 후 빠른 재진입 시, 홈 탭에서 짧게 머문 뒤 입력 탭으로 이동하면 "로딩 중..." 텍스트가 1-2초 노출되는 경우가 가끔 발생.

### "로딩 중..." 출처
`components/input/input-container.tsx:386-392`
```tsx
if (isLoading) {
  return <div ...>로딩 중...</div>;
}
```
`isLoading`은 `useState(true)` 초기값 (line 44). `loadLog` 가 `setIsLoading(false)` 부를 때까지 노출.

### 정확한 발생 조건 (세 조건 동시 성립 필요)
1. **오늘 로그가 `logStore.cache`에 없음** — 오늘 처음 input 진입이고, recentLogs에도 오늘이 없음 (오늘 입력 0회 + 홈의 fetchFresh가 today를 채우기 전).
2. **미마감 로그도 없음** — `getFirstUnclosedLog()` 결과 null → `targetDate = today`.
3. **`loadLog(today)` 실행 → `logStore.getLog(today)` 미스 → `actionGetDailyLog(today)` null 반환 → `actionUpsertDailyLog(today, {})` 호출** → **서버 왕복 2회**, 모바일에서 1-2초.

### 왜 가끔만 발생하는가
- 홈 탭에 600~800ms 머물면 `fetchFresh`가 today를 `logStore`에 채워줌 → 적중 → 즉시
- 한 번 input에서 today를 로드한 후로는 `logStore.cache`에 영구 적중
- 미마감 로그 있는 사용자는 `targetDate`가 캐시에 있는 과거 일자 → 항상 즉시
- 즉 "오늘 캐시 미스 + 미마감 없음 + 홈에서 빨리 떠남" 교집합에서만 발생

### 해법 옵션

**옵션 1 (간단):** `isLoading` 초기값을 localStorage의 home cache에 today가 있는지로 결정. 있으면 false로 시작.

**옵션 2 (충실):** `useState(true)` 패턴 자체 제거. 항상 UI 구조는 그리고, currentLog가 null일 때만 chip이 빈 상태로 보임. familyTime ChatRoom 동일 패턴.

옵션 2가 더 깔끔. 빈 chip이 잠깐 보였다가 채워지는 깜빡임 트레이드오프 (familyTime 채팅도 동일).

### 보류 사유
사용자가 추가 테스트 10회에서 재현 안 됨. 발생 빈도 낮고 해법 단순. 다른 우선순위 작업 후 처리.

---

## [PRESET-REVALIDATE] ✅ 해결 — 프리셋 등록이 탭 전환 prefetch 를 통째로 버리던 문제

### 증상
"자주 쓰는 메뉴" 칩을 등록·삭제한 직후 홈/기록/그래프 탭으로 이동하면 첫 전환이 느려짐.

### 원인
입력 탭의 프리셋 등록이 `updateSettings()` → `actionUpdateSettings()` 를 타고 있었다.
이 액션은 끝에서 `revalidatePath("/graph")` + `revalidatePath("/home")` 을 부른다.
서버 액션 안의 `revalidatePath` 는 **클라이언트 라우터 캐시 전체를 무효화**하므로,
`BottomNav` 의 `<Link prefetch>` 가 미리 받아둔 4개 탭 RSC 페이로드가 전부 버려지고
다음 탭 이동이 서버 왕복이 된다.

프리셋 하나 등록할 때 실제로 발생하던 비용:
- settings 전체 read + 전체 컬럼 upsert (문자열 하나 저장하려고)
- `revalidatePath` ×2 → 라우터 캐시 전체 무효화 + 현재 라우트 RSC 리프레시
- 그 리프레시로 `(tabs)/layout` 재실행 → `getAuthUser()` + `after()` 의 `user_profiles` UPDATE

이 기능 전에는 `actionUpdateSettings` 를 설정 화면에서만 불렀기 때문에 문제가 드러나지 않았다.
입력 탭(최다 사용 화면)이 같은 경로를 타면서 영향 범위가 일상 흐름으로 넓어진 것.

### 해결
프리셋 전용 경량 경로를 분리했다.
- `updateInputPresets()` (settings-service) — `input_presets` 컬럼만 UPDATE, revalidate 없음
- `actionUpdateInputPresets()` — `revalidatePath` 호출 안 함
- context 의 `updateInputPresets()` — 로컬 state 먼저 반영(낙관적), 서버 응답 대기 안 함

프리셋을 읽는 서버 컴포넌트가 없어서 무효화할 캐시가 애초에 없다.
회귀 방지 테스트: `settings-service.test.ts` TC-13 (`revalidateTag` 미호출 단언).

### 남은 관련 사항
`revalidateTag(\`settings-${userId}\`)` 는 소비자가 없다 (unstable_cache → React.cache 전환 이후 유실).
지금은 라우터 캐시만 비우는 순수 비용. 제거 후보지만 `settings/chapters` 가
서버에서 `getSettings()` 를 읽으므로 설정 변경 후 stale 가능성 검토가 먼저 필요.
