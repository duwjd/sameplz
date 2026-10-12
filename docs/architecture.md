# 아키텍처

모든 화면은 세 겹 데이터(바뀌는 헤더 · 고정 스냅숏 · 덧붙이기만 하는 원장)와 SQL 안의 돈 계산 위에 선다. 22개 화면은 대부분 같은 골격(공개 캐시 + 보는 사람 상태 + 서버 액션 → SQL 함수)을 반복한다.

> **MVP(무료 출시, 7주)**: 결제·주문·환불·정산·체험·본인인증 묶음(`orders`, `refunds`, `coupons`, `seller_earnings`, `payouts`, `trial_uses`, `credit_purchases`, `credit_refunds`, 토스·PortOne 연동)은 유료 전환 단계라 만들지 않는다. MVP는 크레딧 원장(월 무료 지급, `monthly_grant` 로트)과 `generation_budget`·`rate_limit_buckets`·`abuse_signals`·`creator_waitlist`를 더한다. 범위는 `docs/plan-12w.md`, 규칙은 `.claude/rules/money.md` 「MVP 크레딧」. 아래 본문은 전체(유료 포함) 설계다.

## 1. 스택

Next.js 16.3.x · Supabase 서울(`ap-northeast-2`) · Vercel `icn1`. ORM은 쓰지 않는다(Prisma·Drizzle은 테이블 소유 역할로 붙어 RLS를 우회한다).

| 층 | 선택 | 이유·주의 |
|---|---|---|
| 프레임워크 | `next@16.3.x`, `react@19.2`, Turbopack, `cacheComponents: true` | 공개 카탈로그만 `"use cache"`, 사용자별 화면은 항상 동적. 8~9월 치명 등급 보안 릴리스 3회 → Renovate/Dependabot으로 최신 패치 |
| 인증·세션 | `@supabase/ssr`, `proxy.ts`는 세션 갱신만, 서버에서는 `getClaims()` | 서버에서 `getSession()`을 믿지 말 것. 캐시된 응답의 `Set-Cookie` 유출 주의 |
| 키 | `sb_publishable_…` / `sb_secret_…` 새 키로 시작 | 기존 `anon`/`service_role`은 2026년 말 폐기 예정 |
| 데이터 접근 | `server-only` DAL(`src/data`) + 서버 액션(`src/actions`) → RPC | 서버 액션은 직접 POST로 닿는 공개 엔드포인트 → 액션마다 인가 재확인 |
| 검색 | PGroonga(`&@~`) | 기본 전문 검색은 알파벳 언어용, `pg_bigm`은 목록에 없음 |
| 실시간 | Broadcast + 비공개 채널(`user:{uid}`, `run:{id}`) | Postgres Changes는 확장성이 떨어짐 |
| 작업 | DB 내부 작업은 `pg_cron`(랭킹, 통계, 보류 해제, 정리), Node SDK가 필요한 작업만 Vercel Cron(지급 배치) | Vercel Cron은 Hobby 하루 1회, Pro 분 단위 |
| UI·폼 | shadcn/ui(Tailwind v4, `sonner`), zod + react-hook-form 공용 스키마 | shadcn v4에서 `toast` → `sonner` |
| 테스트 | Vitest(수수료·크레딧 계산), pgTAP(RLS·원장 불변식), Playwright(SCN 12개) | 돈 경로를 테스트로 먼저 고정 |
| 관측·분석 | Sentry, PostHog Cloud, Better Stack(가동 감시) | 무료 구간으로 출시 가능 |

Next 16 변경점: `middleware.ts` → `proxy.ts`(Node 런타임), `params`·`cookies()` 비동기, `revalidateTag`는 cacheLife 프로필 필수.

### W1 스캐폴드 메모

- `create-next-app`은 비어 있지 않은 폴더를 거부한다. 임시 폴더에 만든 뒤 하네스 파일을 덮어쓰지 않게 옮긴다(README의 W1 프롬프트 참조).
- 옵션: TypeScript, ESLint, Tailwind, App Router, `src/` 디렉터리, import alias `@/*`, pnpm.
- `package.json` 스크립트 이름은 하네스가 기대하는 것으로: `dev`, `build`, `start`, `typecheck`(`tsc --noEmit`), `lint`, `test`(`vitest run`).
- `supabase init` → `supabase/config.toml`. PGroonga·pg_cron·pgTAP 확장은 첫 마이그레이션에서 켠다.

## 2. 데이터: 세 겹

- **카탈로그 객체**(`recipes`, `profiles`): 수정 가능
- **콘텐츠 스냅숏**(`recipe_versions`와 숨은 원문): 승인 뒤 바꿀 수 없음
- **원장**(돈·크레딧 움직임): 덧붙이기만, 정정은 반대 기록

이렇게 나누면 와이어프레임 규칙이 저절로 성립한다. 권리 행 `entitlements`가 `(user, recipe) → version_id`를 고정하므로 "받은 버전은 그대로"이고, 업데이트는 사용자가 고를 때 포인터만 옮긴다. 판매가 멈춰도 버전 행은 남으니 받은 사람은 계속 쓴다. 주문 시점에 계산한 유입·수수료율·로열티는 주문 행에 동결한다.

### 테이블 묶음

| 묶음 | 테이블(핵심 컬럼) | 규칙 |
|---|---|---|
| 계정·참조 | `profiles`(handle citext `^[a-z0-9_]{3,15}$`, nickname 2~12, bio ≤60, job_codes ≤2, role, ai_notice_ack_at, deleted_at), `seller_profiles`(ci_hash unique, legal_name, birth_date, phone, address, contact_email, business_type `INDIVIDUAL`/`INDIVIDUAL_BUSINESS`/`CORPORATE`, business_reg_no, mail_order_reg_no, income_type, withholding_rate_bp, bank_code, account_no_encrypted, account_verified_at, toss_seller_id, toss_seller_status, consents_at), `jobs`, `tools`(has_api), `models`, `model_prices`(price_version) | 탈퇴는 익명화 soft delete. 계좌번호는 마스킹 뷰로만 노출 |
| 카탈로그 | `recipes`(public_id, owner_id, category `prompt`/`agent`/`skill`, prompt_kind, price_krw 0 또는 ≥1000, status `in_review`/`live`/`rejected`/`private`/`stopped`, current_version_id, forked_from_recipe_id/version_id, fork_allowed, job_codes[], tool_codes[], filters jsonb, 카운터, popularity_score), `recipe_versions`(version_no, changelog, review_status, public_meta jsonb, has_scripts, content_sha256, approved_at), `recipe_version_secrets`(prompt_body, skill_md, agent_config), `recipe_version_files`, `media_assets`(is_ai_generated, source), `recipe_version_media`, `collections`, `collection_items`, `banners` | 승인된 버전의 내용 컬럼 UPDATE는 트리거로 거부. `recipe_version_secrets`는 RLS 켜고 정책 0개 |
| 거래 | `orders`(order_no, buyer_id, recipe_id, version_id, list_price, coupon_id, discount, amount_paid, inflow `direct`/`market`, share_link_id, platform_fee_bps 500/1500, fork_royalty_bps 0/1000, fork_royalty_to, status, pg_payment_key unique, consent_text_version, consent_at, trial_available, receipt_url), `refunds`(order_id unique), `entitlements`(version_id, source `purchase`/`free`/`owner`, opened_at, revoked_at, 활성 행 unique(user, recipe)), `entitlement_version_history`, `coupons`, `coupon_redemptions`, `share_links`, `share_link_clicks`(visitor_id, user_id, clicked_at, ip_hash), `private.webhook_events`(provider, event_key unique) | 무료 레시피는 주문 없이 권리만. 클릭 로그는 30일 뒤 정리 |
| 판매자 돈 | `seller_earnings`(kind `sale`/`fork_royalty`/`refund_reversal`, gross, platform_fee, royalty_out, net, hold_until, payout_id, idempotency_key unique), `payouts`(period, gross, withholding_income, withholding_local, adjustments, net, payout_date, toss_payout_id, status), `payout_items`, `tax_exports` | 환불은 음수 행 추가, 지운 행 없음. 지급 뒤 환불분은 다음 정산에서 상계 |
| 크레딧·플레이그라운드 | `credit_accounts`(available ≥0, held ≥0), `credit_lots`(kind `signup_bonus`/`pack_bonus`/`promo`/`paid`, remaining, krw_per_credit, payment_id, expires_at), `credit_ledger`(entry_type `grant`/`hold`/`capture`/`release`/`refund_paid`/`expire`/`adjust`, idem_key unique), `credit_holds`(cell_id unique, allocations), `credit_purchases`, `credit_refunds`, `play_runs`(mode, client_request_id unique per user), `play_cells`(status, provider_request_id unique, price_credits, deadline_at, webhook_token_hash, watermarked), `private.play_prompts`, `trial_uses` PK(user, recipe), `face_consents` | 원장 UPDATE·DELETE 금지 트리거. 렌더링된 프롬프트는 `play_cells`에 두지 않음 |
| 소셜·신고·알림 | `follows`, `recipe_likes`, `post_likes`, `gallery_posts`(kind `original`/`same_cert`, entitlement_id, generated_here, status), `reports`(reason 4종, entitlement_id, status, answer, refund_decision), `notifications`(type, link_path, read_at), `notification_settings`, `search_queries` | `same_cert` INSERT 정책은 `has_entitlement()` 요구 |
| 판매자 운영·통계 | `recipe_drafts`(step, data jsonb), `auto_checks`, `review_queue`, `recipe_daily_stats`, `ranking_snapshots`, `mv_recipe_popularity`(MV, unique index) | 통계·랭킹은 `pg_cron` 갱신 |
| 운영·보존·동의 | `admin_actions`(insert만), `risk_signals`, `marketing_consents`(채널별), `consent_events`(append-only), `archive.*`(purge_after) | 탈퇴 뒤 주문·정산 5년, 분쟁 3년 분리 보관 |

## 3. 쓰기: 서버 액션 → SQL 함수

읽기는 서버 컴포넌트가 DAL을 부른다. 쓰기는 서버 액션이 zod 검증 → `getClaims()` → 소유권 확인 → RPC → `updateTag`. 라우트 핸들러는 여섯 곳만(OAuth 콜백, 결제 웹훅, 생성 시작 `POST /api/play/runs`, 생성 웹훅, 파일 리다이렉트, 크론). 돈이 걸린 RPC는 `private` 스키마 `SECURITY DEFINER`, `search_path = ''`, `anon`·`authenticated` 실행 권한 제거.

### 돈 RPC 불변식

| RPC (private) | 하는 일 | 불변식 |
|---|---|---|
| `get_checkout_quote` | 가격, 쿠폰 유효성(없는 코드와 다른 크리에이터 쿠폰을 구분), 유입 판정(7일 안 마지막 클릭, 구매자≠크리에이터를 user·CI·기기로 판정, 쿠폰이면 직접), 수수료 bps | 클라이언트가 보낸 금액은 쓰지 않는다 |
| `create_pending_order` / `claim_free_recipe` | 이미 받음·내 레시피·판매 중지면 막음 | 주문 id = PG `orderId` = Idempotency-Key |
| `confirm_order_paid` | 주문 paid → 권리 → `seller_earnings`(+로열티) → 알림, 한 트랜잭션 | `pg_payment_key`, `event_key` unique |
| `refund_order` | `now() < paid_at + 7d AND opened_at IS NULL`일 때만, 권리 회수, 반대 행, 알림 | 권리 행을 잠가 열기와 경합 차단 |
| `open_original` | 처음 열면 `opened_at` 기록, 받은 사람 식별 정보를 넣은 원문 반환 | 같은 권리 행 잠금 |
| `apply_update` | 그 권리만 새 버전으로, 이력 행 추가 | 다른 권리에 영향 없음 |
| `start_run` · `place_hold` · `settle_cell` | 실행·셀·체험·셀별 홀드를 한 번에, 성공하면 캡처, 실패하면 같은 로트로 반환 | 셀마다 정산은 정확히 한 번 |
| `grant_purchase` · `request_paid_refund` · `expire_bonus` | 충전 로트 생성, 유료 잔여분 환불, 보너스 소멸 | 보너스는 유료로 바뀌지 않음 |
| `release_earnings_holds` · `build_payout_batch` | 보류 해제(열린 환불·신고 제외), 화요일 배치 | 원천징수율은 판매자 설정에서 읽음 |
| `submit_recipe_version` · `approve_version` · `reject_version` | 자동 검사 결과로 `auto_passed`/`pending_review`, 사유 코드 | 승인 뒤 내용 고정 |

## 4. 경로 ↔ 화면

| 경로 | 화면 | 렌더링 |
|---|---|---|
| `/` | HOME | 정적 셸 + `"use cache"` 섹션(태그 `rankings`, `gallery`), GNB 사용자 영역은 Suspense |
| `/market`, `/market/{prompts,agents,skills,collections}` | MKT, COL | 동적(searchParams), 내부 쿼리 함수만 정규화한 파라미터로 캐시 |
| `/r/[id]` | PRM·AGT·SKL·STOP | 공개 부분은 `recipe:{id}` 태그로 캐시, 보는 사람 상태는 Suspense. 비공개·심사 중·없음이면 `notFound()` |
| `/gallery` | GAL | 무한 스크롤(TanStack Query) |
| `/play` | PLAY | 클라이언트 중심, `run:{id}` 구독 |
| `/checkout` | PAY | 동적, 로그인 필수 |
| `/guide` | GUIDE | 정적 |
| `/my`, `/my/{library,orders,credits,notifications,activity,profile,account}` | MY·LIB·ORD·CRD·NOTI·ACTV·PRF·ACC | 동적, 사용자 키 없이 `"use cache"` 금지 |
| `/my/seller`, `/my/seller/upload` | SELL, UP | 동적, 미디어는 서명 업로드 URL로 Storage에 직접 |
| `/admin/**` | ADM(와이어프레임 밖) | admin 클레임 + MFA, noindex |
| `/auth/callback`, `/auth/naver/*`(D4-B일 때) | 로그인 | Route Handler |
| `/api/webhooks/toss`, `/api/webhooks/generation/[provider]`, `/api/play/runs`, `/api/files/[versionId]`, `/api/cron/[job]` | — | Node 런타임, 원본 body로 서명 검증 |

## 5. 배포 파이프라인

> **MVP(D14)**: Supabase Free 플랜, 클라우드 프로젝트 1개 = 운영. Branching·프리뷰 브랜치·dev 클라우드 프로젝트·상시 staging이 없다. 개발·테스트 DB는 로컬 Supabase(Docker)와 CI의 일회용 스택이다.

1. 스키마는 `supabase/migrations/*.sql`에만 둔다.
2. PR을 열면 CI `db` 잡이 깨끗한 로컬 스택에 마이그레이션과 `seed.sql`을 적용하고 pgTAP·RLS 검사를 돌린다. `e2e` 잡도 같은 일회용 스택을 쓴다.
3. Vercel 프리뷰 배포는 운영 Supabase를 본다(프리뷰 브랜치 없음). 머지 전 마이그레이션은 운영에 없으므로, 스키마가 바뀐 PR의 프리뷰는 화면 확인용으로만 쓰고 DB 동작은 로컬·CI에서 확인한다.
4. CI(`checks`, `db`, `e2e`)가 돈다(PR 자동 Claude 리뷰는 쓰지 않는다. 리뷰는 로컬 `/code-review`와 감사 서브에이전트로). **`checks`·`db`·`e2e`를 필수 체크로** 걸어야 실패한 PR이 운영에 닿지 않는다.
5. main에 머지하면 `deploy-db` 워크플로가 `production` 환경 승인(duwjd)을 기다린 뒤 `supabase db push --dry-run` → `supabase db push`로 운영에 반영하고, Vercel이 운영 배포한다. 마이그레이션은 반드시 이전 버전 앱과 호환되게(추가 먼저, 삭제는 다음 PR) 쓴다. 배포 순서가 보장되지 않는다.
6. OAuth 리다이렉트 URI는 운영 도메인과 로컬(`http://127.0.0.1:54321/auth/v1/callback`)에만 등록한다. 소셜 로그인은 로컬에서 시험한다.

### 월 비용(약 5천 MAU)

| 항목 | 월 비용 | 메모 |
|---|---|---|
| Supabase Pro(서울) | $25, 상시 staging 브랜치 약 $10 추가 | MVP는 Free(D14): 1주 미사용 시 일시 정지, 일일 백업 없음, 이미지 변환 없음. 베타(W6) 전 Pro 재검토 |
| Vercel Pro | $20(사용량 크레딧 $20 포함) | 함수 최대 800초, 요청·응답 4.5MB |
| Resend Pro / Solapi 알림톡 | $20 / 건당 13원 | 무료 이메일은 하루 100통 |
| Sentry / PostHog / Better Stack / 채널톡 | $0~26 / $0 / $0 / 0원부터 | |
| 변동비 | 생성 API(크레딧으로 회수), 카드 3.4%+부가세, 지급대행 월 30만원, 본인인증 건당 40원 | |

고정 인프라비 월 약 45~75달러(운영 도구 포함 70~170달러).

## 6. 출시를 망칠 함정 12개

| 함정 | 막는 곳 |
|---|---|
| 숨은 원문이 RSC props·공유 캐시·Realtime·로그로 새어 나감 | `hidden-content` 규칙, `format-file.sh` 경고, 익명으로 상세 HTML을 받아 본문 샘플 문자열을 찾는 e2e |
| 서버 액션 IDOR(orderId, entitlementId 바꿔치기) | `nextjs-app` 규칙, security-auditor, 액션 단위 테스트 |
| RLS 빠진 새 테이블 | CI의 `pg_tables.rowsecurity = false` 검사(`scripts/check-rls.sql`), pgTAP "B는 A의 비밀·주문·초안을 못 읽음" |
| 결제·크레딧 이중 처리 | unique 키 + 한 트랜잭션 RPC + `FOR UPDATE`, payment-auditor |
| 열기와 환불 동시 요청 | 권리 행 잠금, pgTAP 경합 테스트 |
| 유입 판정 우회(셀프 구매, 게스트 클릭 뒤 로그인) | 로그인 시 `visitor_id`→`user_id` 연결, CI 기준 셀프 제외 |
| 함수 리전 `iad1` | `vercel.json`의 `regions: ["icn1"]` |
| 4.5MB 본문 한도 | 서명 업로드 URL로 Storage 직행, 파일은 60초 서명 URL로 리다이렉트 |
| 9:16 영상 자동 재생으로 egress 폭증 | 포스터 + 눌러서 재생, 썸네일 미리 생성 |
| 적용된 마이그레이션 수정 | `protect-paths.sh`가 `origin/main`에 있는 파일 편집을 거부 |
| 운영 DB에 에이전트가 쓰기 | 운영 MCP 미연결, `guard-bash.sh`가 운영 ref·`--linked` reset·`--db-url`·`db push` 차단 |
| Next.js 보안 패치 누락 | Renovate, 주간 점검 |

## 7. 분석·관측

- 분석은 PostHog 하나. 결제·환불·지급·귀속 이벤트는 서버가 DB 기준으로 보낸다. 이름·전화·이메일·프롬프트 텍스트는 이벤트 속성에 넣지 않는다. `identify()` 범위를 처리방침·가입 동의 문구에 적는다.
- 북극성: **주간 성공 SAME**(한 주 받은 레시피 중 7일 안 환불 또는 「설명과 달라요」 인정이 아닌 건 + SAME 인증 게시). 수수료 구조 성패는 **마켓 유입 매출 비중**.
- 핵심 이벤트: `signup_completed`, `recipe_viewed`, `search_performed`, `play_run`, `checkout_started`, `purchase_completed`, `original_opened`, `refund_completed`, `report_submitted`, `same_posted`, `share_link_clicked`, `recipe_submitted`, `recipe_review_decided`, `payout_paid`.
- 관측: Sentry(오류·크론 체크인), Better Stack 무료(모니터 10개, Slack 알림), Supabase 로그 7일.
- P0 알림: 결제 웹훅 5xx, 결제-권리 불일치, 크레딧 음수·이중 차감, 생성 공급자 오류율 급증. P1: 심사 24시간 경과, 신고 20시간 무응답, 지급 배치 하트비트 누락.
