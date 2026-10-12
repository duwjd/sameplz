# 멱등성과 상태 기계

## 키

| 대상 | 키 | 제약 |
|---|---|---|
| 주문 승인 | `orders.id` (= PG `orderId` = Idempotency-Key) | PK |
| 결제 키 | `orders.pg_payment_key` | unique |
| 웹훅 이벤트 | `private.webhook_events(provider, event_key)` | unique |
| 환불 | `refunds.order_id` | unique (주문당 1회) |
| PG 취소 호출 | Idempotency-Key `refund:<order_id>` | PG 측 15일 |
| 판매자 수익 | `seller_earnings.idempotency_key` (`sale:<order_id>`, `royalty:<order_id>`, `reversal:<order_id>`) | unique |
| 지급 | `payouts.toss_payout_id`, refPayoutId `payout:<payout_id>` | unique |
| 크레딧 원장 | `credit_ledger.idem_key` | unique |
| 크레딧 충전 | `credit_purchases.payment_id` | unique |
| 생성 실행 | `play_runs(user_id, client_request_id)` | unique |
| 생성 셀 | `play_cells.provider_request_id`, `credit_holds.cell_id` | unique |

## 주문 상태

```
pending ──(확인 API 성공)──▶ paid ──(refund_order)──▶ refunded
   │                          │
   │                          └─(운영자 예외 환불, F3-9)──▶ refunded
   └─(실패·만료)──▶ failed / expired
```

- `confirm_order_paid`는 `pending`일 때만 `paid`로. 이미 `paid`면 같은 결과 반환(no-op).
- `refund_order`는 `paid` + 창 안 + 미열람일 때만. 이미 `refunded`면 no-op.
- 상태 전이는 `update … where id = $1 and status = 'pending' returning *` 같은 원자적 claim으로. 0행이면 이미 처리됨.

## 권리(entitlement)

```
(없음) ──purchase/free/owner──▶ active(opened_at null) ──open_original──▶ active(opened_at set)
                                   │
                                   └──refund_order──▶ revoked
```

- 활성 행은 `(user_id, recipe_id)` unique(부분 인덱스 `where revoked_at is null`).
- 열기와 환불은 같은 권리 행을 `for update`로 잠근다. 먼저 잡은 쪽만 성공.

## 웹훅 처리 틀

```ts
export const runtime = 'nodejs'
export async function POST(req: Request) {
  const raw = await req.text()                       // 1 원본 body
  verifySignature(raw, req.headers)                  // 2 서명(지급대행) — 실패 401
  const evt = JSON.parse(raw)
  const fresh = await recordWebhookEvent('toss', eventKey(req.headers, evt)) // 3 unique insert
  if (!fresh) return new Response('ok')              //   중복이면 no-op
  const status = await fetchPaymentFromToss(evt)      // 4 재조회 (웹훅 본문을 믿지 않음)
  await rpc('apply_payment_status', status)           // 5 RPC 한 트랜잭션
  return new Response('ok')
}
```

## 테스트

- 같은 웹훅 두 번 → 원장·권리 행 수 동일
- 확인 API 두 번(같은 Idempotency-Key) → 권리 1개
- 열기와 환불 동시 → 하나만 성공
- 리다이렉트 amount ≠ 주문 금액 → 거절, 결제 취소
