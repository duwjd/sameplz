---
name: e2e-scenario
description: SAMEPLZ SCN 12개 여정과 EX 예외를 Playwright로 쓰거나 돌린다.
argument-hint: "[scn-file-name]"
---
# e2e 시나리오

인자: `$ARGUMENTS` — 시나리오 파일 이름(`trial-to-certify`) 또는 비워 두면 전체.

시나리오 정의와 단계: [scenarios.md](scenarios.md). 화면별 EX 목록: `docs/specs/<CODE>.md`의 "예외(EX)" 절. 시드 사용자·mock 공급자: `e2e/CLAUDE.md`.

## 준비

1. `supabase start` → `supabase db reset`(seed.sql: guest·jiwoo·creator·admin)
2. `GENERATION_PROVIDER=mock`으로 앱 실행(`pnpm dev` 또는 CI에서는 `pnpm build && pnpm start`)
3. 토스 sandbox 키(`.env.local`, 사용자가 넣음)

## 실행

```bash
pnpm exec playwright test e2e/scenarios/$ARGUMENTS.spec.ts
pnpm exec playwright test                       # 전체
pnpm exec playwright test --grep "PAY-03"       # 아이템 ID로
```

## 쓰는 법

- 파일 하나 = SCN 하나: `e2e/scenarios/<scn>.spec.ts`. 이름은 scenarios.md 표 그대로.
- `test.describe('<SCN 이름>')` 안에 단계별 `test.step`. 아이템 ID를 step 이름에 넣는다.
- 해당 화면의 EX는 같은 파일의 `test.describe('EX')`에 하나씩. 상태 만들기는 fixture(`e2e/fixtures/`)로.
- 로그인은 fixture가 storageState로 처리. UI로 매번 로그인하지 않는다(m:login 자체를 테스트할 때만).
- 결제는 토스 sandbox 결제창 또는 테스트용 확인 우회 fixture(서버가 sandbox 확인 API를 부르는 경로). 금액은 서버 견적과 비교.
- 원문 비노출 검사: 각 상세·플레이그라운드 시나리오에 "익명/안 받은 회원 응답에 `SAMEPLZ-SECRET-SAMPLE-` 문자열 없음" 단계를 넣는다.
- 셀렉터는 역할·라벨 우선(`getByRole('button', { name: 'SAME 하기' })`). 와이어프레임 문구가 곧 접근 가능한 이름이다.
- 시간 의존(7일 환불 창, 7일 보류)은 DB 시각 조작 fixture로. 실제로 기다리지 않는다.

## 실패했을 때

테스트를 고쳐 통과시키지 않는다. 앱 버그인지 테스트 버그인지 근거와 함께 보고하고, 테스트 버그라고 판단되면 사용자 확인을 받는다.
