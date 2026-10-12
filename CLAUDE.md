# SAMEPLZ

AI 레시피(프롬프트·에이전트·스킬) 한국어 마켓플레이스 + 플레이그라운드. 구매자는 원문 대신 결과물·[변수]·실행 기록을 보고 산다.
돈 규칙(유입별 수수료 5%/15%, 포크 로열티 10%, 열기 전 7일 환불, 7일 보류 후 수요일 정산, 보너스 먼저 쓰는 크레딧)은 화면보다 먼저 SQL 함수와 pgTAP로 고정한다.
**MVP(무료 출시, 7주)에는 실결제가 없다.** 돈 규칙은 크레딧 원장(grant·hold·settle)에만 적용하고 주문·수수료·환불·정산은 유료 전환 단계다(`docs/plan-12w.md`). `features.json`의 `"phase": "paid"` 항목은 MVP에서 만들지 않는다.
UI 카피는 한국어 해요체. 코드·식별자·커밋은 영어.

화면 코드(22 + 운영): HOME MKT COL NF · PRM AGT SKL STOP · PAY LIB ORD · PLAY CRD · UP SELL · GAL ACTV · MY NOTI PRF ACC GUIDE · ADM(와이어프레임 밖)
MVP에서 PAY·ORD·CRD 충전/환불은 유료 전환 단계, UP·PLAY·SELL은 축소(각 명세 맨 위 「MVP 범위」).
아이템 ID는 `<CODE>-NN`(예: PAY-03), 요구사항 ID는 `F<n>-<m>`(예: F3-2). 둘 다 `docs/specs/`에 있다.

## 명령

```bash
pnpm dev                     # 로컬 앱 (http://localhost:3000)
pnpm typecheck               # tsc --noEmit
pnpm lint
pnpm test                    # Vitest (수수료·크레딧 계산 등)
pnpm exec playwright test e2e/scenarios/<name>.spec.ts
supabase start               # 로컬 스택 (Docker 필요)
supabase db reset            # 로컬 DB 재생성 + seed.sql
supabase migration new <name>
supabase gen types typescript --local > src/types/database.types.ts
supabase test db             # pgTAP
```

앱은 W1에 스캐폴드한다. `package.json`이 없으면 위 pnpm 명령은 아직 없다. 스캐폴드 방법은 `docs/architecture.md`와 README의 W1 프롬프트를 따른다.

## 작업 방식

- 한 세션 한 기능. 브랜치 `feat/<CODE>-<slug>`(예: `feat/PAY-consent-gate`), PR 제목 `<ITEM-ID>: …`.
- 여러 파일을 건드리면 계획 모드 → `/feature-from-spec <CODE>`. 한 문장으로 설명되는 diff면 계획 생략.
- 돈 경로는 테스트 먼저(test-writer). 테스트를 지우거나 약화하지 않는다.
- DB를 바꾸면 `/supabase-migration` → db-migration-reviewer.
- 완료를 주장하기 전에 `pnpm typecheck`와 관련 테스트 결과를 보여 준다. 근거 없는 "됐습니다" 금지.
- 결정이 필요하면 `docs/decisions.md`에 open으로 남기고 멈춘다. 추측으로 결정하지 않는다.
- 기능을 마치면 `docs/progress.md`에 한 줄, `docs/features.json`의 해당 항목 `passes: true`. 다른 필드는 고치지 않는다.
- 비싼 감사는 위임: 결제·크레딧 → payment-auditor, 인증·RLS·업로드·원문 → security-auditor.

## 절대 규칙

1. 운영 Supabase·Vercel에 직접 쓰지 않는다. 스키마는 PR 머지(Supabase Branching)로만 운영에 간다.
2. `origin/main`에 있는 마이그레이션 파일은 고치지 않는다. 새 파일을 만든다.
3. secret 키(`sb_secret_…`, PG secret, 공급자 키)를 클라이언트 코드나 `NEXT_PUBLIC_*`에 두지 않는다.
4. 돈·크레딧 계산은 SQL 함수와 `src/lib/credits`·`src/lib/payments`에서만 한다. 클라이언트가 보낸 금액은 쓰지 않는다.
5. 모든 테이블에 RLS. 원문 테이블(`recipe_version_secrets`, `private.play_prompts`)은 `src/data/secrets.ts` 밖에서 select 금지.
6. 서버 액션은 zod → `getClaims()` → 소유권 확인 → RPC → `updateTag`. `getSession()`을 서버 인가에 쓰지 않는다.
7. 공급자 응답 객체와 프롬프트 원문을 DTO·로그·Realtime 페이로드에 싣지 않는다.
8. "검증·인증·보장" 문구 금지(증빙 있는 전문 영역 배지만 예외).

## 위치

- `src/app` — 라우트(경로 ↔ 화면 코드 표는 `src/app/CLAUDE.md`)
- `src/data` — `server-only` DAL. 원문 접근은 `src/data/secrets.ts`만
- `src/actions` — `'use server'` 얇은 래퍼
- `src/lib/{supabase,credits,payments,generation,moderation,validation}`
- `src/types/database.types.ts` — 생성 파일, 직접 편집 금지
- `supabase/` — `config.toml`, `migrations/`, `seed.sql`, `tests/`(pgTAP), `functions/`
- `e2e/` — `scenarios/*.spec.ts`(SCN 12개), `fixtures/`
- `docs/specs` — 화면별 명세(`<CODE>.md`)와 기능 묶음 PRD(`F1-*.md` … `F8-*.md`)

## 문서 포인터 (필요할 때 읽는다)

- 명세: `docs/specs/<CODE>.md` · 기능 묶음: `docs/specs/F<n>-*.md` · 시나리오: `docs/specs/SCN.md`
- 결정: `docs/decisions.md` · 일정: `docs/plan-12w.md`(7주 MVP) · 구조: `docs/architecture.md`
- 돈 규칙: `.claude/rules/money.md` · 원문 비노출: `.claude/rules/hidden-content.md`
- 진행: `docs/progress.md` · 기능 목록: `docs/features.json` · 와이어프레임: `docs/wireframe/`

## 하네스

- 훅이 막는 것: `.env*`·잠금 파일·`.git/`·하네스 설정·생성 타입·적용된 마이그레이션 편집, 운영 ref·`--linked` reset·`--db-url`·`db push`(dry-run 제외)·`curl | sh`·강제 push. 막히면 우회하지 말고 사용자에게 알린다.
- Stop 훅이 typecheck·관련 테스트를 돌린다. 자동화(`claude -p`)에서는 `SAMEPLZ_SKIP_STOP_VERIFY=1`.
- 원격 MCP는 dev 프로젝트·읽기 전용만. 운영 DB와 PortOne 콘솔은 어떤 범위로도 연결하지 않는다.

## 압축

When compacting, keep the modified-file list, current spec ID, failing test names and open decisions.
