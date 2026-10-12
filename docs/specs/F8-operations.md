# F8 운영 — ADM · 분석 · 관측 (와이어프레임 밖)

> 감사 로그가 있는 `/admin`을 직접 짓는다

- 화면 명세: [ADM](ADM.md)
- 의존 결정: D10 (`docs/decisions.md`)
- 우선순위: P0(빠지면 출시 불가) · P1(출시 후 4~8주) · P2(설계만 대비)
- 수용 기준은 Given → When → Then을 줄인 것이고, 와이어프레임 예외(EX)·시나리오(SCN)에 대응한다. 테스트 이름에 요구사항 ID를 넣는다.

## 문제

와이어프레임에는 운영 화면 코드가 없지만, 심사 1~2일과 신고 첫 답 1영업일 규칙을 지키려면 운영 화면이 출시 때 있어야 한다. Retool은 감사 로그와 세부 권한이 Business 요금제(빌더당 월 50달러)부터라 같은 Next.js 앱 안에 `/admin`을 만든다. 권한은 커스텀 액세스 토큰 훅으로 JWT에 넣은 `admin` 클레임과 RLS의 `authorize()`로 판정한다. Supabase Studio는 비상용으로만 쓴다(Studio에서 고친 내용은 앱 감사 로그와 알림을 건너뛴다).

## 목표

- 심사 1~2일, 신고 첫 답 1영업일 준수
- 모든 운영 조치의 감사 로그
- 돈 이상 신호 조기 감지

## 비목표

- Retool 등 외부 관리 도구
- 운영 화면의 와이어프레임 수준 디자인

## 필수 콘텐츠

| 아이템 | 필수 콘텐츠 |
|---|---|
| 분석 | PostHog 하나. 무료 구간은 이벤트 100만 건과 리플레이 5천 건. 결제·환불·지급·귀속 이벤트는 서버가 DB 기준으로 보낸다. `identify()` 범위를 처리방침과 가입 동의 문구에 적는다 |
| 북극성 | **주간 성공 SAME**: 한 주 받은 레시피 중 7일 안에 환불되거나 「설명과 달라요」가 인정되지 않은 건수 + SAME 인증 게시. 수수료 구조 성패는 **마켓 유입 매출 비중** |
| 핵심 이벤트 | `signup_completed`, `recipe_viewed`, `search_performed`, `play_run`, `checkout_started`, `purchase_completed`, `original_opened`, `refund_completed`, `report_submitted`, `same_posted`, `share_link_clicked`, `recipe_submitted`, `recipe_review_decided`, `payout_paid`. 이름·전화·이메일·프롬프트 텍스트는 속성에 넣지 않는다 |
| 관측 | Sentry(오류·크론 체크인), Better Stack 무료(모니터 10개, Slack 알림), Supabase 로그 7일 |
| 알림 | P0: 결제 웹훅 5xx, 결제-권리 불일치, 크레딧 음수·이중 차감, 생성 공급자 오류율 급증. P1: 심사 24시간 경과, 신고 20시간 무응답, 지급 배치 하트비트 누락 |
| 런북 14종 | 지급, 환불, 신고, 사람 확인, 저작권, 판매 중지 vs 게시중단, 사기, 제재, 불법 콘텐츠, 장애, 개인정보 사고, 관리자 접근, CS 매크로, 콘텐츠 운영(돈과 법정 기한이 걸린 것부터, `docs/runbooks/`) |


## 요구사항

| ID | P | 스토리 / 요구 | 수용 기준 | 아이템 | 목표 주 | SCN |
|---|---|---|---|---|---|---|
| F8-1 | P0 | 심사 큐 | 자동 검사 결과, 이전 버전 diff, 승인·반려(R코드 템플릿), 24시간 경과 알림 | ADM | W6 | — |
| F8-2 | P0 | 신고함 | 사유 4종, 열람 시각·구매 이력, 소명 요청, 결정(기각·환불·판매 중지·게시중단·제재), 20시간 무응답 알림 | ADM | W6 | — |
| F8-3 | P0 | 판매 중지 vs 게시중단 | 판매 중지는 받은 사람이 계속 쓰고, 게시중단(불법·권리 침해)은 모두에게 숨김. 저작권 신고는 접수 → 즉시 중단 → 게시자 통지 → 복원 요청 → 복원 흐름, 반복 침해자 정책. 명예훼손·사생활은 임시조치 최대 30일 | ADM | W6 | — |
| F8-4 | P0 | 주문 조회·환불 예외, 크레딧 조정, 지급 모니터(화요일 미리보기·보류 플래그), 제재 사다리(경고 → 판매 정지 → 계정 정지 → 차단)와 연결 계정(CI·기기·IP) | 모든 조치는 사유 필수, `admin_actions`에 insert만 | ADM | W7 | — |
| F8-5 | P1 | 공유 링크·쿠폰 악용 대시보드, 랭킹 보정, 공지 발송 | `risk_signals` 기반 | ADM | — | — |

## 데이터 · API

`admin_actions`(insert만), `review_queue`, `auto_checks`, `reports`, `risk_signals`, `orders`, `credit_ledger`(조정은 `adjust` 반대 행), `payouts`, 커스텀 액세스 토큰 훅(`admin` 클레임), `private.is_admin()`, `/admin/**`(MFA, noindex).

## 지표

- 사람 확인 2일 이내 처리율
- 신고 첫 답 1영업일 준수율
- P0 알림 건수

## 열린 질문

- 관리자 MFA 방식(Supabase MFA TOTP)
- 제재 사다리 기준 수치
