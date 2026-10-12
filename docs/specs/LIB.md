# LIB · 라이브러리

- 경로: `/my/library`
- 와이어프레임: `docs/wireframe/sameplz-wireframe-v0.5.html` (key `library`), 인벤토리 `docs/wireframe/_context_wireframe_inventory.md`
- 기능 묶음: [F3](F3-checkout-library.md) — F3 결제·라이브러리 — PAY · LIB · ORD
- 의존 결정: D1, D6, D9 (`docs/decisions.md`) — open이면 해당 부분은 멈추고 묻는다

## 목적

마이페이지의 하위 기능. 받은 레시피를 바로 쓰는 곳. 레시피마다 받은 버전에 고정되고, 상태에 따라 환불·신고 버튼이 갈린다.

## 아이템

- **LIB-01** 업데이트 알림: 받은 버전에 고정. 변경 내역을 보고 업데이트를 고른다.
- **LIB-02** 상태: 열기 전(환불 기한) / 열어 봄(환불 제한) / 판매 종료(받은 버전은 계속 사용).
- **LIB-03** 쓰기: 원문 열기·파일 받기(처음엔 확인 창), 플레이그라운드에서 쓰기, 설치 안내, SAME 인증 올리기.
- **LIB-04** 환불·신고: 열기 전 7일 안이면 환불 요청. 연 뒤에는 환불 대신 “설명과 달라요” 신고(3개월).

### 필수 콘텐츠 (보고서 F 묶음에서)

- **LIB-01~04 · 팝업**: 업데이트 줄(변경 내용), 상태 라벨 3종(열기 전·열어 봄·판매 종료), m:openConfirm "열면 환불이 제한돼요. 결과물과 미리보기로 충분히 확인했나요?", m:original(받은 사람 식별 정보 포함), m:refund, m:guide(도구별 3단계), 빈 화면("무료 레시피부터 하나 받아 봐요" + 무료 3개)

## 동작

- 원문 열기·파일 받기: 처음엔 「열면 환불이 제한돼요」 확인 창
- 만들어 보기 → 플레이그라운드(내 레시피 모드)
- SAME 인증 올리기 → 갤러리 · SAME 수 +1 · 크리에이터 알림
- 업데이트 → 그 줄만 새 버전으로

## 규칙 (rl)

- 열기 전 7일 안: 환불 요청
- 열어 본 뒤: 환불 대신 「설명과 달라요」 신고(3개월)
- 판매 종료: 받은 버전은 계속 사용

## 경우의 수 (c)

- 열기 전 · 기간 지남: 환불 버튼 없음
- 업데이트가 여러 개면 줄마다 따로
- 받은 게 없음: 갤러리 구경하기
- 비회원: 로그인 안내 화면

## 팝업

### m:report · 신고하기 (팝업)

- 설명: 열어 본 뒤 문제가 있을 때 환불 대신 쓰는 길.
- 동작: 사유 4개 중 하나 + 내용 · 접수하면 알림
- 규칙: 첫 답 1영업일
- 규칙: 설명과 다르면 크리에이터 소명 뒤 환불 결정(3개월 안)

### m:openConfirm · 원문 열기 확인 (팝업)

- 설명: 처음 열 때만 뜬다. 열면 환불이 제한되고 연 시각이 기록된다.
- 동작: 열기 → 원문 창 · 라이브러리 상태가 「열어 봄 · 환불 제한」으로
- 경우: 두 번째부터는 바로 원문

### m:original · 원문 (팝업)

- 설명: 받은 버전의 원문. 받은 사람 식별 정보가 들어 있다.
- 동작: 프롬프트는 「플레이그라운드에서 쓰기」로 이어짐
- 경우: 판매가 멈춘 레시피도 받은 버전은 열림

### m:refund · 환불 요청 (팝업)

- 설명: 원문을 열기 전, 받은 지 7일 안에만 뜬다.
- 동작: 신청 → 라이브러리에서 빠짐 · 크리에이터 매출 차감과 알림 · 상세에 다시 「SAME 하기」
- 규칙: 전액 환불 · 카드 취소 3~5영업일
- 경우: 서버 오류: 창을 그대로 두고 다시 시도

### m:guide · 설치 안내 (팝업)

- 설명: 받은 레시피를 쓰는 도구별 3단계.
- 동작: 프롬프트: 원문 복사 → 도구에 붙여넣기 → [대괄호] 바꾸기
- 동작: 스킬·에이전트: 파일 받기 → 도구에 넣기 → 연결하고 실행


## 예외 (EX)

- [ ] 비회원
- [ ] 업데이트 알림 줄
- [ ] 열기 전 · 7일 안 → 환불 요청
- [ ] 열기 전 · 환불 기간 지남
- [ ] 열어 본 뒤 → 「설명과 달라요」 신고
- [ ] 처음 원문 열기 → 확인 창
- [ ] 판매 종료된 레시피
- [ ] 받은 게 하나도 없음

## 데이터 · API

거래 묶음 테이블(`orders`, `refunds`, `entitlements`, `entitlement_version_history`, `coupons`, `coupon_redemptions`, `share_links`, `share_link_clicks`, `private.webhook_events`), RPC `get_checkout_quote`·`create_pending_order`·`claim_free_recipe`·`confirm_order_paid`·`refund_order`·`open_original`·`apply_update`, 라우트 `/api/webhooks/toss`·`/api/files/[versionId]`. 토스 웹훅 이벤트는 `PAYMENT_STATUS_CHANGED`와 `CANCEL_STATUS_CHANGED`. 2025년 2월 시행 다크패턴 규정에 첫 과태료가 나왔으므로 미리 체크된 선택지는 두지 않고 총액을 먼저 보여 준다.

## 수용 기준

| ID | P | 요구 | 수용 기준 | 목표 주 |
|---|---|---|---|---|
| F3-5 | P0 | 처음 열 때만 확인을 받고 시각을 남긴다 | 첫 열기에서 m:openConfirm → `open_original`이 `opened_at` 기록, 상태 「열어 봄 · 환불 제한」. 두 번째부터 바로 원문. 파일은 `/api/files/[versionId]` → 약 60초 서명 URL | W3 |
| F3-6 | P0 | 열기 전 7일 안이면 한 번에 환불된다 (유료 전환 단계) | 조건을 DB 함수가 판정. PG 취소 즉시 호출 → 권리 회수 → `refund_reversal` → 양쪽 알림 → 상세에 다시 「SAME 하기」. 열기와 동시 요청이면 하나만 성공 | 유료 전환 |
| F3-8 | P0 | 업데이트는 줄마다 고른다(LIB-01) | `apply_update`가 그 권리만 새 버전으로 옮기고 이력 행 추가 | W3 |
| F3-9 | P1 | 열어 본 뒤 「설명과 달라요」 신고(3개월) | F6·F8의 신고 흐름과 공유. 소명 → 결정 → 환불 시 `refund_order`의 운영자 예외 경로 | — |

## 테스트 매핑

| 대상 | 테스트 위치 |
|---|---|
| SCN: 비회원으로 구경하다 SAME 하기 (guest → jiwoo, W3) | `e2e/scenarios/guest-to-same.spec.ts` |
| SCN: 유료 SAME · 쿠폰 · 원문 열기 (jiwoo, 유료 전환) | `e2e/scenarios/paid-same-coupon-open.spec.ts` |
| SCN: 열기 전 환불 (jiwoo, 유료 전환) | `e2e/scenarios/refund-before-open.spec.ts` |
| SCN: 열어 본 뒤엔 환불 대신 신고 (jiwoo, 유료 전환) | `e2e/scenarios/report-after-open.spec.ts` |
| SCN: SAME 인증이 갤러리로 (jiwoo, W6) | `e2e/scenarios/same-cert-to-gallery.spec.ts` |
| SCN: 판매 중지된 레시피 (guest · jiwoo · creator, W4) | `e2e/scenarios/stopped-recipe.spec.ts` |
| EX 항목 전체 | `e2e/scenarios/guest-to-same.spec.ts` `describe('EX')` 또는 컴포넌트 테스트 |
| F3-5 | pgTAP `supabase/tests/` — 테스트 이름에 `F3-5` |
| F3-6 | Vitest / Playwright — 테스트 이름에 `F3-6` |
| F3-8 | pgTAP `supabase/tests/` — 테스트 이름에 `F3-8` |

## 열린 질문

- 판매자 신원 노출 방식(법무, D9)
- 퀵오픈 정산 보류 중 지급대행 가능 여부(유료 전환 단계, 토스 신청 때 확인)
