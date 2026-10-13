# 크레딧 불변식

각 항목은 pgTAP 테스트 하나 이상과 짝이 된다. 테스트 이름에 `INV-C<n>`을 넣는다.

> **MVP(무료 출시)**: INV-C7·C8·C9·C12·C14는 유료 전환 단계(충전·환불·체험이 없음)라 MVP에서 테스트하지 않는다. INV-C18~C21은 MVP에서 추가한 불변식이다. 나머지는 MVP에도 그대로.

| ID | 불변식 | 테스트 아이디어 |
|---|---|---|
| INV-C1 | `credit_accounts.available >= 0` and `held >= 0` (check 제약) | 부족한 잔액으로 `place_hold` → 아무 행도 안 생기고 부족분 반환 |
| INV-C2 | 계정 잔액 = 원장 합. `available + held = Σ(로트 remaining)` | 무작위 시퀀스(충전·홀드·캡처·반환·소멸) 뒤 합 비교 |
| INV-C3 | 셀 정산은 정확히 1회 | 같은 `cell_id`로 `settle_cell` 두 번 → 두 번째 noop, 원장 행 수 동일 |
| INV-C4 | 반환은 홀드를 잡았던 같은 로트로 | 보너스 30C + 유료 10C로 40C 홀드 → 모델 오류 → 각 로트 remaining 원복 |
| INV-C5 | 보너스 먼저, 같은 종류면 만료 임박 먼저 | 보너스 20C(만료 내일) + 보너스 20C(만료 다음 주) + 유료 100C에서 30C 홀드 → 내일 만료 20 + 다음 주 10 |
| INV-C6 | 안전 필터 차단은 차감 없음 | outcome=`safety_blocked` → capture 없음, release만 |
| INV-C7 | (유료 전환) 보너스는 환불 불가, 유료로 바뀌지 않음 | `request_paid_refund`가 보너스 로트를 건드리지 않음 |
| INV-C8 | (유료 전환) 유료 환불 = 미사용 유료분 × 크레딧 단가(D17) − 공제(7일 안 0%, 이후 ≤10%, 카드 수수료 별도 공제 없음) | 결제 3일 차/10일 차 환불 금액 표 |
| INV-C9 | (유료 전환) 진행 중 홀드는 환불 대상이 아님 | 홀드 중 환불 요청 → 홀드분 제외 |
| INV-C10 | 원장 append-only | `update credit_ledger …`/`delete …` → 예외 |
| INV-C11 | 멱등 키 unique | 같은 `idem_key`로 grant 두 번 → 한 번만 반영 |
| INV-C12 | (유료 전환) `grant_purchase`는 결제 id로 멱등 | 같은 결제 웹훅 두 번 → 로트 하나 |
| INV-C13 | 같은 `client_request_id`로 `start_run` 두 번 → 같은 실행 반환, 홀드 한 번 | |
| INV-C14 | (유료 전환) 체험은 (user, recipe) 1회 | `trial_uses` PK 충돌 → 두 번째 실행 거절 |
| INV-C15 | 크레딧으로 레시피 주문 불가 | 주문 생성 경로에 크레딧 결제 수단 없음(스키마·함수 모두) |
| INV-C16 | 가격 버전 고정 | 견적 `price_version` ≠ 현재 → `start_run` 409 사유 코드 |
| INV-C17 | 만료 처리 멱등 | `expire_bonus()` 두 번 → 두 번째 noop |
| INV-C18 | (MVP) 월 무료 지급은 (user, 월) 1회 | 같은 달 `grant_monthly_credits` 두 번 → `monthly_grant` 로트 하나, 리셋 때 이전 로트 잔량은 `expire` 행으로 0 |
| INV-C19 | (MVP) 예산 한도면 아무것도 안 만든다 | `generation_budget` 잔여 < 견적 → `start_run`이 `BUDGET_EXHAUSTED`, 실행·셀·홀드·예약 행 0 |
| INV-C20 | (MVP) 예산 예약 = 홀드, 정산 때 맞춤 | 홀드 40C → 모델 오류 반환 → 예약 −40, 성공 → `spent` +캡처분. Σ예약 + Σ실사용이 셀 상태와 일치 |
| INV-C21 | (MVP) 계정 일일 한도 | 오늘 사용 + 견적 > 한도 → `DAILY_LIMIT`, 홀드 없음. KST 자정에 초기화 |

## 팩 (유료 전환 단계)

MVP에는 충전 팩이 없다.


| 결제 | 유료 로트 | 팩 보너스 로트 | 합계 |
|---|---|---|---|
| 5,000원 | 500C | 0C | 500C |
| 10,000원 | 1,000C | 50C | 1,050C |
| 30,000원 | 3,000C | 300C | 3,300C |

> 팩 보너스를 별도 보너스 로트로 둘지, 유료 로트 하나(1,050C)로 둘지는 환불 계산에 영향이 있다. 보고서 F4-10은 "유료 로트 + 팩 보너스 로트"로 적었으므로 위 표를 기본으로 하고, D3 결정 때 약관 문구와 함께 확정한다.
