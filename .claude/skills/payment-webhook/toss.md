# 토스페이먼츠 요약 (2026-10 조사 기준)

> 이 파일은 조사 노트 요약이다. 구현 직전에 `tosspayments` MCP(`get-v2-documents` 등)로 최신 문서를 확인한다. 아래에서 "미확인"은 문서로 확인하지 못한 항목이다.

## 결제

- 결제위젯(또는 API 개별 연동) → 성공 리다이렉트에 `paymentKey`, `orderId`, `amount`.
- 확인(승인) API 호출에 `Idempotency-Key` 헤더. 키는 15일 유효, 300자 이하. 같은 키 + API 키 + 엔드포인트 + 메서드면 원래 응답을 그대로 돌려준다. 승인·취소에 권장.
- 카드 수수료 3.4% + 부가세(실효 약 3.74%). 플랫폼 부담 가정.
- 출시 범위: 카드·간편결제만. 가상계좌·계좌이체는 현금영수증 의무 검토 전까지 제외.
- 퀵오픈: 개인사업자 전용, 신청 즉시 결제 가능, 카드사 심사(최대 90일) 끝날 때까지 정산 보류. 디지털콘텐츠 중개 마켓이 대상인지 W1 신청 때 확인(미확인).
- Next.js App Router 공식 예제 존재 여부: 미확인.

## 웹훅 이벤트

| 이벤트 | 용도 | 검증 |
|---|---|---|
| `PAYMENT_STATUS_CHANGED` | 결제 상태 변경 | 힌트로만 사용, 결제 조회로 재확인 |
| `CANCEL_STATUS_CHANGED` | 취소 상태 변경 | 힌트로만 사용, 재조회 |
| `DEPOSIT_CALLBACK` | 가상계좌 입금(출시 범위 밖) | 승인 때 받은 `secret`과 비교 |
| `payout.changed` | 지급대행 지급 상태 | HMAC-SHA256(payload + timestamp, 보안 키), 헤더 `tosspayments-webhook-signature` |
| `seller.changed` | 셀러 상태(승인·KYC) | 위와 같음 |

헤더에 `transmission-id`, `transmission-time`, `retried-count`가 함께 온다. `transmission-id`를 `event_key`로 저장해 중복을 막는다.

## 지급대행

- 셀러 `businessType`: `INDIVIDUAL` | `INDIVIDUAL_BUSINESS` | `CORPORATE`.
  - `INDIVIDUAL`: `individual{name, email, phone}`
  - 그 외: `company{name, representativeName, businessRegistrationNumber, email, phone}`
  - 공통: `account{bankCode, accountNumber, holderName}`, `refSellerId`(7~20자, 변경 불가)
- 개인·개인사업자는 `APPROVAL_REQUIRED`로 시작 → 토스가 휴대폰 본인확인 문자 자동 발송 → 완료 전 `PARTIALLY_APPROVED`(주 1천만원 미만 지급). 주 1천만원 초과 시 `KYC_REQUIRED`.
- `POST /v2/payouts`: `refPayoutId`, `destination`(셀러 id), `scheduleType` = `EXPRESS`(영업일 08:00~15:00 당일) | `SCHEDULED`(`payoutDate`), `amount`, `transactionDescription`(7자 이하). 요청당 100건 이하, 건당 10억원 미만.
- 본문은 JWE 암호화(64자 hex 보안 키), 헤더 `TossPayments-api-security-mode: ENCRYPTION` + Basic 인증, JWE 헤더에 `iat`, `nonce`. → Edge가 아니라 Node 런타임.
- 잔액 API: `availableAmount`, `pendingAmount`. sandbox에 실패 테스트용 더미 계좌.
- 비용: 월 30만원(1,000건 포함, 초과 건당 100원). 심사·계약 1~3영업일. 상점관리자 > 이용정보 > 서비스 추가 신청.
- 퀵오픈 정산 보류 중에도 지급대행이 도는지: 미확인(W2까지 토스에 확인).
- 지급대행 심사에 통신판매업 신고증이 필요한지: 미확인.

## SAMEPLZ 쪽 규칙

- 주문 id = `orderId` = 결제 승인 Idempotency-Key.
- 취소 Idempotency-Key = `refund:<order_id>`.
- 지급 `refPayoutId` = `payout:<payout_id>`.
- 모든 외부 호출 결과는 원본 JSON을 `private` 스키마 로그 테이블에 남기되, 카드 정보·개인정보 필드는 지운다.
