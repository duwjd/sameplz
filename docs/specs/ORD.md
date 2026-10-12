# ORD · 구매 내역

- 경로: `/my/orders`
- 와이어프레임: `docs/wireframe/sameplz-wireframe-v0.5.html` (key `orders`), 인벤토리 `docs/wireframe/_context_wireframe_inventory.md`
- 기능 묶음: [F3](F3-checkout-library.md) — F3 결제·라이브러리 — PAY · LIB · ORD
- 의존 결정: D1, D6, D9 (`docs/decisions.md`) — open이면 해당 부분은 멈추고 묻는다

> **MVP 범위**: **이 화면 전체가 유료 전환 단계다.** MVP에는 결제가 없어 구매 내역·영수증·환불이 없다(무료 레시피는 원래도 구매 내역에 없음). MY의 ORD 진입점은 숨긴다. 아래 내용은 유료 전환 때 그대로 쓴다.

## 목적

유료로 받은 레시피의 결제 기록. 영수증과 환불 상태를 본다.

## 아이템

- **ORD-01** 상태 필터: 전체 · 결제 완료 · 환불.
- **ORD-02** 주문 줄: 결제일·주문번호·레시피·판매자·유입 경로·금액·결제 수단·상태.
- **ORD-03** 영수증 · 환불: 영수증은 항상, 환불은 열기 전 7일 안에만.
- **ORD-04** 안내: 카드 취소 기간, 연 뒤에는 신고로, 크레딧 내역은 따로.

### 필수 콘텐츠 (보고서 F 묶음에서)

- **ORD-01~04 · m:receipt**: 주문 줄(결제일·주문번호·레시피·판매자·유입·금액·수단·상태), 영수증(주문번호·결제일·상품·판매자 신원·금액·쿠폰·수단·상태·중개 고지·PG 매출전표 링크), 안내(카드 취소 3~5영업일, 연 뒤에는 신고, 크레딧 내역은 따로)

## 동작

- 상태 필터: 전체 · 결제 완료 · 환불
- 영수증 → 영수증 팝업(인쇄·PDF 저장)
- 열기 전 7일 안이면 「환불 요청」 → 환불 팝업 → 이 줄이 「환불 완료」로
- 결제하면 맨 위에 새 줄(주문번호·쿠폰·유입 경로)

## 규칙 (rl)

- 무료 레시피는 구매 내역에 남지 않음
- 크레딧 충전 내역은 크레딧 화면에
- 통신판매중개 고지는 영수증에도

## 경우의 수 (c)

- 결제한 게 없음: 빈 화면 + 마켓 둘러보기
- 환불된 주문: 「환불 완료」 + 환불일

## 팝업

### m:receipt · 영수증 (팝업)

- 설명: 구매 내역의 주문 한 건. 인쇄하거나 PDF로 저장한다.
- 동작: 주문번호 · 결제일 · 상품 · 판매자 · 금액 · 쿠폰 · 결제 수단 · 상태
- 동작: 「인쇄 · PDF 저장」
- 규칙: 통신판매중개 고지 포함


## 예외 (EX)

- [ ] 결제한 레시피가 없음
- [ ] 환불된 주문만 보기
- [ ] 영수증 팝업
- [ ] 열기 전 주문 → 환불 요청

## 데이터 · API

거래 묶음 테이블(`orders`, `refunds`, `entitlements`, `entitlement_version_history`, `coupons`, `coupon_redemptions`, `share_links`, `share_link_clicks`, `private.webhook_events`), RPC `get_checkout_quote`·`create_pending_order`·`claim_free_recipe`·`confirm_order_paid`·`refund_order`·`open_original`·`apply_update`, 라우트 `/api/webhooks/toss`·`/api/files/[versionId]`. 토스 웹훅 이벤트는 `PAYMENT_STATUS_CHANGED`와 `CANCEL_STATUS_CHANGED`. 2025년 2월 시행 다크패턴 규정에 첫 과태료가 나왔으므로 미리 체크된 선택지는 두지 않고 총액을 먼저 보여 준다.

## 수용 기준

| ID | P | 요구 | 수용 기준 | 목표 주 |
|---|---|---|---|---|
| F3-6 | P0 | 열기 전 7일 안이면 한 번에 환불된다 (유료 전환 단계) | 조건을 DB 함수가 판정. PG 취소 즉시 호출 → 권리 회수 → `refund_reversal` → 양쪽 알림 → 상세에 다시 「SAME 하기」. 열기와 동시 요청이면 하나만 성공 | 유료 전환 |
| F3-7 | P0 | 구매 내역과 영수증 (유료 전환 단계) | 무료 레시피는 구매 내역에 없음. 환불 주문은 「환불 완료」 + 환불일 | 유료 전환 |

## 테스트 매핑

| 대상 | 테스트 위치 |
|---|---|
| SCN: 열기 전 환불 (jiwoo, 유료 전환) | `e2e/scenarios/refund-before-open.spec.ts` |
| SCN: 마이페이지 한 바퀴 (jiwoo, W6) | `e2e/scenarios/my-page-tour.spec.ts` |
| EX 항목 전체 | `e2e/scenarios/refund-before-open.spec.ts` `describe('EX')` 또는 컴포넌트 테스트 |
| F3-6 | Vitest / Playwright — 테스트 이름에 `F3-6` |
| F3-7 | Vitest / Playwright — 테스트 이름에 `F3-7` |

## 열린 질문

- 판매자 신원 노출 방식(법무, D9)
- 퀵오픈 정산 보류 중 지급대행 가능 여부(유료 전환 단계, 토스 신청 때 확인)
