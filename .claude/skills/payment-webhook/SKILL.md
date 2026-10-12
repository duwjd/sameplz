---
name: payment-webhook
description: (유료 전환 단계 전용) 토스페이먼츠 결제·환불·지급대행·웹훅을 구현하거나 고칠 때 쓴다. MVP 무료 출시에는 쓰지 않는다.
---
> **유료 전환 단계 전용 — MVP에서는 쓰지 않는다.** MVP(무료 출시)는 사업자등록·PG 계약·통신판매업 신고·본인인증이 없어 결제·환불·지급대행·토스 웹훅 코드를 만들지 않는다(`docs/plan-12w.md` 「유료 전환 단계」). MVP 크레딧은 `credit-ledger` 스킬.

# 결제·환불·지급대행

참고: [toss.md](toss.md)(API 형식 요약), [idempotency.md](idempotency.md)(멱등·상태 기계). 돈 숫자는 `.claude/rules/money.md`.

API 형식은 기억에 기대지 않는다. 구현 전에 `tosspayments` MCP로 해당 문서를 찾아 확인한다("토스페이먼츠 MCP를 사용해서 확인"). 결과가 `toss.md`와 다르면 문서를 따르고 `toss.md`를 고치자고 제안한다.

## 결제 흐름 (PAY)

1. `get_checkout_quote(recipe_id, coupon_code?, share_link_id?)` — 서버가 가격·쿠폰·유입·수수료 bps를 정한다. 클라이언트 금액은 쓰지 않는다.
2. `create_pending_order` — 이미 받음·내 레시피·판매 중지 차단. 주문 id = PG `orderId` = Idempotency-Key. 동의 문구 버전·시각·`trial_available` 저장.
3. 결제위젯 → 성공 리다이렉트(`paymentKey`, `orderId`, `amount`) → 서버에서 amount를 주문 행과 비교.
4. 확인 API(`Idempotency-Key: <orderId>`) → 성공이면 `confirm_order_paid`(주문 paid → 권리 → `seller_earnings` + 로열티 → 알림, 한 트랜잭션).
5. 실패: 한도 초과 → "결제되지 않았어요" + 「다시 결제하기」. 창 닫음 → 선택 유지.

## 웹훅 (`/api/webhooks/toss`, Node 런타임)

- `PAYMENT_STATUS_CHANGED`, `CANCEL_STATUS_CHANGED`: **힌트로만** 쓴다. 결제 조회 API로 상태를 다시 읽고 그 결과로 상태를 옮긴다.
- 지급대행 `payout.changed`, `seller.changed`: 원본 body + 타임스탬프 HMAC-SHA256 서명 검증(`tosspayments-webhook-signature`).
- `DEPOSIT_CALLBACK`(가상계좌): 출시 범위 밖. 받으면 `secret` 비교 후 무시·기록.
- 같은 이벤트 재수신: `private.webhook_events(provider, event_key unique)` insert 충돌 → 200 + no-op.
- 처리 순서: 원본 body 읽기 → 서명 검증 → 이벤트 키 기록(충돌이면 종료) → 재조회 → RPC.

## 환불 (LIB-04, F3-6)

- `refund_order(order_id)`: `now() < paid_at + 7d AND opened_at IS NULL`일 때만. 권리 행 `for update`(열기와 경합).
- PG 취소 API를 **즉시** 호출(큐 금지, 3영업일 의무). 취소 Idempotency-Key = `refund:<order_id>`.
- 성공 → 권리 회수 → `seller_earnings` `refund_reversal` 음수 행 → 구매자·판매자 알림 → 상세에 다시 「SAME 하기」.
- 열어 본 뒤: 환불 대신 신고(F3-9, 운영자 예외 경로).

## 지급대행 (SELL-05, F5-8, F5-9)

- 판매자 등록: PortOne 본인인증 `VERIFIED` → 주소·이메일 → 계좌(예금주 확인) → 소득 구분·원천징수·지급대행 동의 → 토스 셀러 등록(`INDIVIDUAL`/`INDIVIDUAL_BUSINESS`/`CORPORATE`) → 토스 SMS 본인확인 → `seller.changed`.
- 매일 `release_earnings_holds`(`pg_cron`): `hold_until` 지난 행, 열린 환불·신고 제외.
- 화요일 Vercel Cron → `build_payout_batch` → `POST /v2/payouts`(`SCHEDULED`, `payoutDate` = 수요일, 요청당 100건 이하, JWE 암호화 본문, Node 런타임).
- 원천징수율은 `seller_profiles.withholding_rate_bp`(D2). 3.3% 하드코딩 금지.
- 지급한 돈은 회수가 어렵다. 지급 뒤 환불분은 다음 정산에서 상계.

## 끝나면

- pgTAP: 금액 동결, 멱등, 환불 창, 열기 경합, 이중 웹훅
- Vitest: 수수료·로열티·원천징수 계산 표(경계값)
- payment-auditor 감사
