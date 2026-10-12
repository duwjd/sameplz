# 마이그레이션 체크리스트

## 파일

- [ ] `supabase migration new`로 만든 새 파일이다. 기존 파일을 고치지 않았다.
- [ ] 한 파일 = 한 목적. 되돌릴 수 없는 변경(컬럼 삭제, 타입 축소)은 따로 나누고 PR 설명에 적는다.
- [ ] 객체 이름은 모두 스키마로 한정했다(`public.orders`, `private.refund_order`).

## 테이블

- [ ] `alter table … enable row level security;`
- [ ] 필요한 정책이 모두 있다(SELECT/INSERT/UPDATE/DELETE 중 필요한 것). UPDATE는 `using` + `with check`, 그리고 SELECT 정책도 있다.
- [ ] 정책에 쓰는 컬럼(owner_id, buyer_id, user_id …)에 인덱스.
- [ ] 금액은 정수 원(`bigint`/`integer`), 비율은 bps 정수(`platform_fee_bps` 500/1500). float 금지.
- [ ] 멱등 키·외부 키(`pg_payment_key`, `event_key`, `idempotency_key`, `provider_request_id`, `client_request_id`)에 unique.
- [ ] 상태 컬럼은 check 제약 또는 enum으로 값 목록 고정.
- [ ] 개인정보 컬럼(계좌번호)은 암호화 컬럼 + 마스킹 뷰로만 노출.
- [ ] 원문 테이블(`recipe_version_secrets`, `private.play_prompts`)은 RLS 켜고 정책 0개.

## 함수

- [ ] `security definer`면 `private` 스키마, `set search_path = ''`.
- [ ] `revoke execute on function … from public, anon, authenticated;`
- [ ] 한 트랜잭션 안에서 상태 확인 → 잠금(`for update`) → 변경 → 원장 기록 → 알림 행.
- [ ] 클라이언트가 보낸 금액을 인자로 받지 않는다(주문 id만 받고 금액은 DB에서).
- [ ] 같은 호출을 두 번 해도 결과가 같다(멱등). 두 번째는 noop 또는 같은 결과 반환.
- [ ] 오류는 사유 코드로(`raise exception using errcode = 'P0001', message = 'REFUND_WINDOW_CLOSED'`).

## 트리거

- [ ] 원장(`credit_ledger`, `seller_earnings`, `consent_events`, `admin_actions`): UPDATE·DELETE 거부.
- [ ] 승인된 `recipe_versions`의 내용 컬럼 UPDATE 거부.
- [ ] 카운터·통계는 트리거보다 `pg_cron` 배치를 우선(경합 줄이기).

## 뷰·검색

- [ ] 뷰는 `with (security_invoker = true)`.
- [ ] 한국어 검색은 PGroonga 인덱스와 `&@~` 연산자.
- [ ] MV(`mv_recipe_popularity`)는 unique index가 있어야 `refresh … concurrently` 가능.

## 테스트와 타입

- [ ] `supabase db reset` 성공
- [ ] `supabase gen types typescript --local > src/types/database.types.ts`
- [ ] pgTAP: 정책마다 "다른 사용자는 못 읽는다/못 쓴다", 함수마다 성공·실패·멱등·경합
- [ ] `supabase test db` 통과
- [ ] `seed.sql`이 새 컬럼·제약과 맞는다
