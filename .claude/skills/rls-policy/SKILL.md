---
name: rls-policy
description: SAMEPLZ 테이블의 RLS 정책과 pgTAP 테스트 규칙. 새 테이블을 만들거나 정책·권한을 바꿀 때 쓴다.
user-invocable: false
---
# RLS 정책과 pgTAP

SAMEPLZ의 모든 테이블은 아래 6가지 패턴 중 하나(또는 조합)를 쓴다. SQL 예시는 [patterns.md](patterns.md), 테스트 틀은 [pgtap-template.sql](pgtap-template.sql).

| # | 패턴 | 대표 테이블 | 요지 |
|---|---|---|---|
| 1 | 공개 카탈로그 | `recipes`(status='live'), `recipe_versions`(공개 메타), `profiles`(공개 컬럼), `collections`, `banners` | anon·authenticated SELECT는 공개 상태만. 소유자는 자기 비공개·심사 중도 봄 |
| 2 | 소유자 전용 | `recipe_drafts`, `notifications`, `notification_settings`, `credit_accounts`, `credit_ledger`(SELECT만), `orders`(구매자) | `(select auth.uid()) = user_id` |
| 3 | 판매자 전용 | `seller_profiles`, `seller_earnings`, `payouts`, `share_links`, `coupons`, `recipe_daily_stats` | 소유 판매자만 SELECT. 쓰기는 RPC만 |
| 4 | 원문 | `recipe_version_secrets`, `private.play_prompts` | RLS 켜고 **정책 0개**. `security definer` 함수만 접근 |
| 5 | 소셜 + 권리 | `gallery_posts`, `recipe_likes`, `post_likes`, `follows`, `reports` | 읽기는 공개(숨김 제외), `same_cert` INSERT는 `private.has_entitlement()` 필수 |
| 6 | 관리자 | `review_queue`, `admin_actions`, `risk_signals`, 신고 처리 | `private.is_admin()` = JWT `admin` 클레임(커스텀 액세스 토큰 훅). `user_metadata` 금지 |

## 공통 규칙

- 돈·권리 테이블(`orders`, `entitlements`, `seller_earnings`, `credit_*`)은 클라이언트 INSERT/UPDATE/DELETE 정책을 두지 않는다. 쓰기는 `private` RPC만.
- `TO authenticated`에는 항상 소유권 조건을 붙인다.
- UPDATE 정책은 `using` + `with check`, 그리고 SELECT 정책.
- `(select auth.uid())`로 감싸고 정책 컬럼에 인덱스.
- 비공개·심사 중 레시피는 남에게 행 자체가 안 보여야 한다(404와 같은 결과).

## 테스트 규칙

- 정책마다 최소 3개: 허용(주인), 거부(다른 사용자), 거부(anon).
- 원문 테이블: authenticated·anon 모두 0행.
- 돈 RPC: anon·authenticated가 `execute` 권한이 없음을 `function_privs_are`로.
- 경합: 같은 권리 행에 열기와 환불을 동시에 → 하나만 성공(`docs/specs/F3-checkout-library.md` F3-6).
- CI는 `scripts/check-rls.sql`로 `rowsecurity = false`인 public·private 테이블이 하나라도 있으면 실패한다.
