# GUIDE · 이용 안내

- 경로: `/guide`
- 와이어프레임: `docs/wireframe/sameplz-wireframe-v0.5.html` (key `policy`), 인벤토리 `docs/wireframe/_context_wireframe_inventory.md`
- 기능 묶음: [F7](F7-account-notifications-policy.md) — F7 계정·알림·정책 — MY · NOTI · PRF · ACC · GUIDE · 로그인
- 의존 결정: D3, D4, D5 (`docs/decisions.md`) — open이면 해당 부분은 멈추고 묻는다

## 목적

푸터에서 들어오는 정책 요약. 위쪽 칩으로 섹션을 오간다.

## 아이템

- **GUIDE-01** 라이선스: 개인·상업 구분 없이 하나. 필요해지면 나눈다.
- **GUIDE-02** 환불: 열기 전 7일. 연 뒤에는 철회 제한(미리보기·플레이그라운드 체험으로 시험 사용 제공).
- **GUIDE-03** 안전 검사: 뒤에서 돌린다. 스크립트·외부 실행은 사람 확인.
- **GUIDE-04** 크레딧: 생성에만 쓰는 SAMEPLZ 자체 크레딧. 안 쓴 유료 크레딧은 환불.
- **GUIDE-05** 금지와 신고: 전문 영역은 검토 보조만. 신고 첫 응답 1영업일.

### 필수 콘텐츠 (보고서 F 묶음에서)

- **GUIDE-01~05**: 섹션마다 한 줄 요약과 숫자: 라이선스("개인·업무 모두 쓸 수 있어요. 원문을 다시 팔거나 나눠 주는 건 안 돼요"), 환불(7일·3개월·3~5영업일), 안전 검사(1~2일, "검증·인증이 아님"), 크레딧(1C=10원), 금지와 신고(1영업일, 임시 비공개 최대 30일), 랭킹 공식 공개

## 동작

- 칩 → 해당 섹션으로 스크롤

## 규칙 (rl)

- —

## 경우의 수 (c)

- —

## 예외 (EX)

- (와이어프레임 EX 없음)

## 데이터 · API

`profiles`, `notifications`, `notification_settings`, `marketing_consents`, `consent_events`, `archive.*`, 비공개 채널 `user:{uid}`, 액션 `updateProfile`·`checkHandle`(레이트 리밋)·`markAllRead`·`setNotificationSetting`·`setMarketingConsent`·`linkIdentity`·`unlinkIdentity`·`withdrawAccount`. UX 카피는 해요체·능동형·긍정형, 부정 소식은 사실 → 이유 → 다음 할 일, "검증·인증·보장"은 금지어(전문 영역 배지만 예외).

## 수용 기준

| ID | P | 요구 | 수용 기준 | 목표 주 |
|---|---|---|---|---|
| F7-7 | P0 | 정책 문서 | 이용약관·개인정보처리방침·판매자 약관·통신판매중개 고지 문안 법률 검토. 처리방침의 국외이전 수탁자에는 Supabase, Vercel, 생성 모델 공급자, 구글 로그인, 이메일·SMS 업체를 넣는다. 계약 이행에 필요한 위탁·보관을 처리방침에 공개하면 별도 동의는 필요 없다 | W7 |

## 테스트 매핑

| 대상 | 테스트 위치 |
|---|---|
| EX 항목 전체 | 컴포넌트 테스트 `src/app/**/*.test.tsx` 또는 컴포넌트 테스트 |
| F7-7 | Vitest / Playwright — 테스트 이름에 `F7-7` |

## 열린 질문

- Supabase identity 연결·해제 동작(W1 스파이크)
- 가입 혜택 보너스 크레딧 수량·유효기간(D3)
- 알림톡 템플릿 심사 리드타임(미확인)
