# NOTI · 알림

- 경로: `/my/notifications`
- 와이어프레임: `docs/wireframe/sameplz-wireframe-v0.5.html` (key `notifs`), 인벤토리 `docs/wireframe/_context_wireframe_inventory.md`
- 기능 묶음: [F7](F7-account-notifications-policy.md) — F7 계정·알림·정책 — MY · NOTI · PRF · ACC · GUIDE · 로그인
- 의존 결정: D3, D4, D5 (`docs/decisions.md`) — open이면 해당 부분은 멈추고 묻는다

## 목적

마이페이지 안의 알림 목록. GNB 알림 버튼도 여기로 온다. 놓친 변화를 모으는 곳. 누르면 해당 화면으로 가고, 이 화면을 보면 GNB 숫자가 사라진다.

## 아이템

- **NOTI-01** 알림 목록: 업데이트, 판매, SAME 인증, 사람 확인 결과, 신고 답변, 팔로우한 크리에이터 새 레시피.
- **NOTI-02** 연결: 모든 알림은 해당 화면으로 바로 이어진다. 읽으면 GNB 숫자가 줄어든다.

### 필수 콘텐츠 (보고서 F 묶음에서)

- **NOTI-01 · 02**: 알림 템플릿 18종(새 버전·판매·포크 판매·환불 2종·SAME 인증·팔로우한 크리에이터 새 레시피·새 팔로워·사람 확인 통과·반려·판매 중지 2종·신고 접수·신고 답변·정산·크레딧 반환·크레딧 환불·판매자 등록 완료), 제목 1줄 + 본문 1~2줄 + 이동할 화면
- **이메일 · 알림톡**: 영수증·환불·정산·사람 확인 결과·신고 5종. 필수 알림은 알림톡(카카오가 거래 알림에 권장) + 이메일 사본

## 동작

- 알림 누르기 → 해당 화면(라이브러리·판매자 센터·상세·갤러리)
- 이 화면을 열면 모두 읽음 처리

## 규칙 (rl)

- 계정마다 따로 쌓임
- 다른 계정의 행동이 알림을 만듦(판매·SAME 인증·업데이트·사람 확인 결과)

## 경우의 수 (c)

- 알림 없음: 빈 화면 안내
- 비회원: 로그인 안내 화면

## 예외 (EX)

- [ ] 비회원
- [ ] 알림 없음

## 데이터 · API

`profiles`, `notifications`, `notification_settings`, `marketing_consents`, `consent_events`, `archive.*`, 비공개 채널 `user:{uid}`, 액션 `updateProfile`·`checkHandle`(레이트 리밋)·`markAllRead`·`setNotificationSetting`·`setMarketingConsent`·`linkIdentity`·`unlinkIdentity`·`withdrawAccount`. UX 카피는 해요체·능동형·긍정형, 부정 소식은 사실 → 이유 → 다음 할 일, "검증·인증·보장"은 금지어(전문 영역 배지만 예외).

## 수용 기준

| ID | P | 요구 | 수용 기준 | 목표 주 |
|---|---|---|---|---|
| F7-3 | P0 | 알림이 실시간으로 오고 필수는 못 끈다 | RPC·트리거가 `notifications`에 넣으면 `user:{uid}` 비공개 채널로 방송. NOTI를 열면 모두 읽음, GNB 숫자 0. 필수 6종은 스위치 무시 | W6 |

## 테스트 매핑

| 대상 | 테스트 위치 |
|---|---|
| SCN: SAME 인증이 갤러리로 (jiwoo, W6) | `e2e/scenarios/same-cert-to-gallery.spec.ts` |
| EX 항목 전체 | `e2e/scenarios/same-cert-to-gallery.spec.ts` `describe('EX')` 또는 컴포넌트 테스트 |
| F7-3 | pgTAP `supabase/tests/` — 테스트 이름에 `F7-3` |

## 열린 질문

- Supabase identity 연결·해제 동작(W1 스파이크)
- 가입 혜택 보너스 크레딧 수량·유효기간(D3)
- 알림톡 템플릿 심사 리드타임(미확인)
