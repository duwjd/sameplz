# <CODE> 구현 계획

- 명세: `docs/specs/<CODE>.md` · 기능 묶음: `docs/specs/F<n>-….md`
- 범위: <아이템 ID 목록 또는 "화면 전체">
- 목표 주: W<n> · 관련 SCN: `<scn-file>.spec.ts`
- 작성: spec-planner, YYYY-MM-DD

## 막힘

- [ ] D<n> <결정 이름> — open. 이 결정에 의존하는 작업: <작업 번호>. 그 전까지 할 수 있는 것: <…>

(막힌 결정이 없으면 "없음")

## 작업

순서: 테스트 → DB → DAL/액션 → UI → e2e. 한 줄 = 한 커밋.

- [ ] 1. tests: <ID> <무엇을 검증하는지> (`supabase/tests/<area>.test.sql`)
- [ ] 2. tests: <ID> … (`src/lib/…/*.test.ts`)
- [ ] 3. db: <마이그레이션 이름> — 테이블/함수/정책 (`supabase/migrations/<ts>_<name>.sql`)
- [ ] 4. data: `src/data/<…>.ts` — <DAL 함수>
- [ ] 5. action: `src/actions/<…>.ts` — <액션> (zod → getClaims → 소유권 → RPC → updateTag)
- [ ] 6. ui: `src/app/<route>/…` — <아이템 ID> <컴포넌트>
- [ ] 7. ui: EX <예외 상태> 변형
- [ ] 8. e2e: `e2e/scenarios/<scn>.spec.ts` — <단계>

## 수용 테스트 목록

| 요구사항/EX | 테스트 이름 | 종류 | 파일 |
|---|---|---|---|
| F<n>-<m> | `F<n>-<m> <기준 요약>` | pgTAP / Vitest / Playwright | `<path>` |
| EX: <예외> | `<CODE> EX <예외>` | … | … |

## 건드릴 파일

- 새 파일: …
- 바꿀 파일: …
- 생성 파일(직접 편집 금지): `src/types/database.types.ts` → `supabase gen types typescript --local`

## 데이터·API

- 테이블: …
- RPC: … (불변식: …)
- 라우트 핸들러: … (없으면 "없음")
- 캐시 태그: …

## 범위 밖

- P1/P2: …
- 이번에 하지 않는 것: …

## 열린 질문

- …

## e2e 검증 단계

1. `supabase db reset` (seed.sql)
2. `GENERATION_PROVIDER=mock pnpm dev`
3. `pnpm exec playwright test e2e/scenarios/<scn>.spec.ts` — 사용자 <guest|jiwoo|creator|admin>
4. 기대 결과: …
