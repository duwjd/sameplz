# PRF · 프로필

- 경로: `/my/profile`
- 와이어프레임: `docs/wireframe/sameplz-wireframe-v0.5.html` (key `profile`), 인벤토리 `docs/wireframe/_context_wireframe_inventory.md`
- 기능 묶음: [F7](F7-account-notifications-policy.md) — F7 계정·알림·정책 — MY · NOTI · PRF · ACC · GUIDE · 로그인
- 의존 결정: D3, D4, D5 (`docs/decisions.md`) — open이면 해당 부분은 멈추고 묻는다

## 목적

닉네임·핸들·소개·대표 직무·프로필 사진. 레시피 상세와 갤러리에 보이는 정보.

## 아이템

- **PRF-01** 프로필 사진: 올리기 · 기본 이미지로.
- **PRF-02** 닉네임 · 핸들: 필수. 핸들은 중복 확인.
- **PRF-03** 소개: 60자, 글자 수 표시.
- **PRF-04** 대표 직무: 2개까지. 추천에 쓴다.
- **PRF-05** 저장 · 되돌리기: 변경이 있을 때만 켜진다.

### 필수 콘텐츠 (보고서 F 묶음에서)

- **PRF-01~05**: 사진(5MB 이하)·닉네임 2~12자·핸들(영문 소문자·숫자·밑줄 3~15자, 중복 확인)·소개 60자·대표 직무 2개, 오류 5종, 기본 이미지 3~6개

## 동작

- 고치면 「저장」이 켜지고 「저장하지 않은 변경이 있어요」 표시
- 핸들 「중복 확인」 · 저장할 때도 다시 확인
- 저장 → GNB 이름, 내 레시피 상세의 크리에이터 이름, 갤러리 인증에 바로 반영

## 규칙 (rl)

- 닉네임 2~12자 · 핸들 영문 소문자·숫자·밑줄 3~15자 · 소개 60자 · 대표 직무 2개까지 · 사진 5MB 이하
- 이메일은 공개하지 않음

## 경우의 수 (c)

- 닉네임 길이 오류 · 핸들 형식 오류 · 이미 쓰는 핸들: 칸 아래 오류 + 포커스
- 직무 3개째: 칸 아래 오류
- 서버 오류: 입력값 유지

## 예외 (EX)

- [ ] 닉네임 1자로 저장
- [ ] 이미 쓰는 핸들
- [ ] 핸들 형식 오류 (대문자·공백)
- [ ] 대표 직무 3개째
- [ ] 이름 바꾸면 내 레시피 상세에 반영
- [ ] 저장 중 서버 오류

## 데이터 · API

`profiles`, `notifications`, `notification_settings`, `marketing_consents`, `consent_events`, `archive.*`, 비공개 채널 `user:{uid}`, 액션 `updateProfile`·`checkHandle`(레이트 리밋)·`markAllRead`·`setNotificationSetting`·`setMarketingConsent`·`linkIdentity`·`unlinkIdentity`·`withdrawAccount`. UX 카피는 해요체·능동형·긍정형, 부정 소식은 사실 → 이유 → 다음 할 일, "검증·인증·보장"은 금지어(전문 영역 배지만 예외).

## 수용 기준

| ID | P | 요구 | 수용 기준 | 목표 주 |
|---|---|---|---|---|
| F7-4 | P0 | 프로필 저장 즉시 반영 | 핸들은 확인 때와 저장 때 두 번 중복 확인. 저장하면 GNB·내 레시피 상세·갤러리 이름 바로 반영. 서버 오류면 입력 유지 | W6 |

## 테스트 매핑

| 대상 | 테스트 위치 |
|---|---|
| SCN: 마이페이지 한 바퀴 (jiwoo, W6) | `e2e/scenarios/my-page-tour.spec.ts` |
| EX 항목 전체 | `e2e/scenarios/my-page-tour.spec.ts` `describe('EX')` 또는 컴포넌트 테스트 |
| F7-4 | Vitest / Playwright — 테스트 이름에 `F7-4` |

## 열린 질문

- Supabase identity 연결·해제 동작(W1 스파이크)
- 가입 혜택 보너스 크레딧 수량·유효기간(D3)
- 알림톡 템플릿 심사 리드타임(미확인)
