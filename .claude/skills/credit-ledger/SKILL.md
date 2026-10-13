---
name: credit-ledger
description: 크레딧(D17 단위 1C≈3.7원, 보너스 먼저, 반환·차감 없음, MVP 월 무료 지급·한도·예산, 유료 전환 때 유료분 환불) 규칙과 SQL을 다룰 때 쓴다.
---
# 크레딧 원장

규칙 원문: `.claude/rules/money.md` 「MVP 크레딧」·「크레딧」 절, `docs/decisions.md` D11·D12·D13(MVP), D3(유료 전환). 불변식: [invariants.md](invariants.md).

## MVP (무료 출시)

- **월 무료 지급만 있다.** 지급 로트는 보너스 계열 `kind = monthly_grant`(`expires_at` = 다음 리셋). 가입 때 그달 몫(270C, D11), 매월 리셋 때 남은 몫 `expire` → 새 로트 지급.
- **유료 로트(`paid`)·충전(`grant_purchase`, `credit_purchases`)·크레딧 환불(`request_paid_refund`, `credit_refunds`)은 MVP에 없다.** 만들지 않는다.
- MVP 함수: `grant_monthly_credits`, `place_hold`, `start_run`(18+ 자기 확인·일일 한도·레이트 리밋·예산 예약을 홀드 전에), `settle_cell`, `expire_bonus`. 홀드·정산·반환 규칙은 아래와 같다.
- 전체 월 예산(`generation_budget`, D12)은 홀드와 같은 트랜잭션에서 예약하고 `settle_cell`에서 실사용으로 맞춘다. 한도면 `BUDGET_EXHAUSTED`로 아무것도 만들지 않는다.
- 불변식 중 INV-C7·C8·C9·C12·C14는 유료 전환 단계, INV-C18~C21은 MVP 전용.

## 구조

- `credit_accounts(user_id, available ≥ 0, held ≥ 0)` — 빠른 조회용 합계. 원장과 항상 같아야 한다.
- `credit_lots(kind monthly_grant|signup_bonus|pack_bonus|promo|paid, remaining, krw_per_credit, payment_id, expires_at)` — 로트별 잔량. 보너스 계열(`monthly_grant` 포함)은 유효기간을 명시, 유료는 5년. MVP는 `monthly_grant`(+ 이벤트 `promo`)만.
- `credit_ledger(entry_type grant|hold|capture|release|refund_paid|expire|adjust, lot_id, delta, idem_key unique)` — append-only. UPDATE·DELETE 금지 트리거.
- `credit_holds(cell_id unique, allocations jsonb)` — 셀별 홀드가 어느 로트에서 얼마를 잡았는지.
- (유료 전환 단계) `credit_purchases`, `credit_refunds` — 충전 결제와 유료분 환불.
- (MVP) `generation_budget(month, cap_credits, reserved, spent, state)` — 전체 월 예산과 킬 스위치 상태.

## 함수 (private, security definer)

| 함수 | 하는 일 | 핵심 |
|---|---|---|
| `grant_monthly_credits(user_id, month)` | (MVP) 그달 `monthly_grant` 로트 지급, 이전 달 잔량 `expire` | `(user, month)` idem_key로 멱등 |
| `grant_purchase(payment_id)` | (유료 전환 단계) 결제 확인 뒤 유료 로트 + 팩 보너스 로트 | 결제 id로 멱등 |
| `place_hold(cell_id, credits)` | 보너스 → 만료 임박 순으로 로트를 잠그고 홀드 | `for update`, 부족하면 아무것도 안 함 + 부족분 반환 |
| `start_run(...)` | 실행·셀·셀별 홀드(+ MVP: 일일 한도·예산 예약, 유료 전환: 체험 행)를 한 트랜잭션 | 같은 `client_request_id`면 기존 실행 반환 |
| `settle_cell(cell_id, outcome)` | 성공 → capture, 모델 오류 → 같은 로트로 release, 안전 필터 → release(차감 없음), 시간 초과 → 조회 뒤 결정 | 셀마다 정확히 1회, 두 번째부터 noop |
| `request_paid_refund(user_id)` | (유료 전환 단계) 유료 잔여 × 크레딧 단가(D17·D3) − 수수료(D3), 진행 중 홀드 제외 | 보너스 제외 |
| `expire_bonus()` | 만료 보너스 소멸(`pg_cron`) | 원장 `expire` 행 |

## 수정 절차

1. 불변식 테스트부터: [invariants.md](invariants.md)의 해당 항목을 pgTAP으로(test-writer).
2. 함수 수정은 새 마이그레이션(`/supabase-migration`).
3. 잔액 감소와 원장 기록은 같은 트랜잭션. 계정 행을 `for update`로 직렬화.
4. 금액·단가는 `model_prices(price_version)`에서. 견적의 `price_version`과 다르면 409.
5. payment-auditor 검토.

## 하지 않는 것

- 크레딧으로 레시피 결제(PLAY-07). 양도·현금화·제휴 사용(D3 면제 5원칙).
- 보너스를 유료로 바꾸기, 보너스 환불.
- 원장 행 수정·삭제. 정정은 `adjust` 반대 행 + `admin_actions` 기록.
