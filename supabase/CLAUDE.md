# supabase — DB 규약

Supabase 서울(`ap-northeast-2`). ORM 없음. 사용자 경로는 supabase-js + 생성 타입, 돈 로직은 SQL 함수.

> **MVP(무료 출시)**: 실결제가 없다. `orders`·`refunds`·`coupons`·`seller_earnings`·`payouts`·`trial_uses`·`credit_purchases`·`credit_refunds`와 `confirm_order_paid`·`refund_order`·`grant_purchase`·`request_paid_refund`는 유료 전환 단계라 만들지 않는다. 돈 함수 규약(아래)은 **크레딧 원장**(`grant_monthly_credits`·`place_hold`·`start_run`·`settle_cell`·`expire_bonus`)과 `generation_budget` 예약에 그대로 적용한다. MVP 새 테이블: `creator_waitlist`, `generation_budget`, `rate_limit_buckets`, `abuse_signals`.

## 마이그레이션 흐름

1. `supabase migration new <name>` 으로 **새 파일만** 만든다. `origin/main`에 있는 파일은 훅이 편집을 막는다.
2. SQL 작성 → `supabase db reset`(로컬만, `--linked` 금지)
3. `supabase gen types typescript --local > src/types/database.types.ts`
4. 정책·함수마다 pgTAP 테스트(`supabase/tests/*.sql`) → `supabase test db`
5. db-migration-reviewer에 검토를 맡긴다.

운영 반영은 main 머지 때 `.github/workflows/deploy-db.yml`이 한다(`production` 환경 승인 → `supabase db push`). Supabase Free 플랜이라 Branching·프리뷰 브랜치·dev 클라우드 프로젝트가 없다(D14). 에이전트의 `supabase db push`는 `--dry-run`만 허용되고, `supabase link`도 하지 않는다.

## 함수 규약 (돈이 걸린 RPC)

```sql
create or replace function private.refund_order(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$ … $$;

revoke execute on function private.refund_order(uuid) from public, anon, authenticated;
```

- `private` 스키마, `security definer`, `set search_path = ''`, 모든 객체를 스키마로 한정(`public.orders`).
- `anon`·`authenticated` 실행 권한을 뺀다. 서버 액션이 secret 키 클라이언트로만 부른다.
- 한 함수 = 한 트랜잭션. 경합 행은 `select … for update`. 멱등 키는 unique 제약으로.

## 검색 (D15)

- 레시피 검색은 `public.search_recipes` RPC로만 한다. RLS 테이블에 PGroonga `&@~`를 직접 걸지 않는다(인덱스를 못 써서 2만 행에 2.4초).
- RPC 안에서 공개 조건(`status = 'live'`)을 직접 건다. 사용자 입력은 `pgroonga_query_escape()`로 감싼다.
- 이 함수만 `set search_path = extensions, public`(예외, D15). 결과는 공개 필드만.
- 금액·수수료율·로열티는 계산 시점에 주문 행에 동결하고 다시 계산하지 않는다.

## 데이터 세 겹

- 카탈로그(`recipes`, `profiles`): 수정 가능
- 스냅숏(`recipe_versions`, `recipe_version_secrets`): 승인 뒤 내용 컬럼 UPDATE를 트리거로 거부
- 원장(`credit_ledger`, `seller_earnings`, `consent_events`, `admin_actions`): UPDATE·DELETE 금지 트리거, 정정은 반대 행

## RLS 요약

- 모든 새 테이블 `enable row level security`. CI가 `rowsecurity = false`인 public·private 테이블을 잡는다(`scripts/check-rls.sql`).
- `recipe_version_secrets`, `private.play_prompts`: RLS 켜고 정책 0개.
- `(select auth.uid())`로 감싸고, 정책에 쓰는 컬럼에 인덱스.
- `TO authenticated`만으로는 인가가 아니다. 소유권 조건을 반드시 붙인다.
- UPDATE는 `USING`과 `WITH CHECK` 둘 다, 그리고 SELECT 정책도 필요.
- 뷰는 `with (security_invoker = true)`. `user_metadata`로 인가하지 않는다(관리자는 `app_metadata`/커스텀 클레임 `admin`).
- `gallery_posts` `same_cert` INSERT는 `has_entitlement()`를 요구.

패턴과 pgTAP 템플릿: `.claude/skills/rls-policy/`.

## 시드

`seed.sql`은 로컬 `db reset`과 CI(`db`·`e2e` 잡)가 쓴다. 운영에는 들어가지 않는다. 사용자 guest·jiwoo·creator·admin, 레시피 3카테고리 × 무료(MVP는 유료 레시피 시드 없음), 판매 중지 1, 심사 중 1, 포크 1, 이번 달 `generation_budget` 1행. 실제 개인정보·키를 넣지 않는다.
