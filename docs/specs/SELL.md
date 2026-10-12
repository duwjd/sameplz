# SELL · 판매자 센터

- 경로: `/my/seller`
- 와이어프레임: `docs/wireframe/sameplz-wireframe-v0.5.html` (key `seller`), 인벤토리 `docs/wireframe/_context_wireframe_inventory.md`
- 기능 묶음: [F5](F5-upload-seller.md) — F5 올리기·판매자 센터 — UP · SELL
- 의존 결정: D1, D2, D7, D9, D10 (`docs/decisions.md`) — open이면 해당 부분은 멈추고 묻는다

> **MVP 범위**: SELL은 **「내 레시피」 관리**로 줄인다 — 레시피 목록과 상태(SELL-03), 레시피별 조회수·다운로드·SAME 수, 공유 링크 만들기와 링크별 유입 수(SELL-04에서 쿠폰·7일 귀속·수수료 제외), 그리고 **「유료 판매 오픈 알림 신청」 버튼(F5-14)**. 매출·유입별 매출(SELL-01의 매출, SELL-02), 쿠폰, 정산(SELL-05), 판매 시작 전 본인인증·계좌(SELL-06)는 **유료 전환 단계**다. 아래 내용은 지우지 않는다.

## 목적

마이페이지의 하위 기능. 반응을 보고 파는 곳으로 한눈에 보기 · 레시피 관리 · 레시피 올리기 · 공유 링크·쿠폰 · 정산 탭이 있다.

## 아이템

- **SELL-01** 한눈에 보기: 매출·다운로드·SAME·마켓 유입 비중.
- **SELL-02** 유입 경로별 매출: 직접 유입(5%)과 마켓 유입(15%).
- **SELL-03** 상품 관리: 상태(판매 중·사람 확인 중·반려·비공개)와 새 버전.
- **SELL-04** 공유 링크·쿠폰: 링크를 누르고 7일 안에 사면 직접 유입.
- **SELL-05** 정산: 7일 보류 후 매주 수요일, PG 지급대행. 개인은 3.3% 원천징수.
- **SELL-06** 판매 시작 전: 본인인증·정산 계좌·첫 레시피 체크리스트.

### 필수 콘텐츠 (보고서 F 묶음에서)

- **SELL-01~06**: 기간 7·30·90일 숫자(매출·다운로드·SAME·마켓 유입 비중), 유입별 매출(5%·15%), 레시피 관리(반려 → 사람 확인 중 → 비공개 → 판매 중), 공유 링크·쿠폰(이름 규칙·중복 오류), 정산 탭("판매 확정 후 7일 보류 → 매주 수요일 토스페이먼츠 지급대행으로 입금 · 개인은 X% 원천징수 · 지급 후 신고로 환불되면 다음 정산에서 차감"), 판매 시작 전 체크리스트 3개
- **m:verify · 판매자 가이드**: 본인인증 → 주소·이메일 → 정산 계좌(예금주 확인) → 소득 구분과 원천징수·지급대행 동의 → 토스 SMS("정산 받을 계좌 확인 문자가 와요"). 판매자 온보딩 가이드 10장

## 동작

- 기간 7 · 30 · 90일
- 레시피 관리: 반려 → 사람 확인 중 → 비공개 → 판매 중 순서
- 공유 링크 만들기 → 「지우로 이 링크 열기」로 직접 유입 구매 따라가기
- 쿠폰 만들기 → 결제에서 적용

## 규칙 (rl)

- 직접 유입 5% · 마켓 유입 15% · 포크는 원작자 10% 추가
- 7일 보류 뒤 매주 수요일 지급 · 개인 3.3% 원천징수
- 링크 클릭 뒤 7일 안 구매만 직접 유입 · 셀프 구매 제외

## 경우의 수 (c)

- 판매 없음: 빈 화면 + 올리기
- 정산 정보 없음: 본인인증 하기
- 링크 이름 규칙 위반 · 이미 있는 링크 · 쿠폰 코드 중복: 칸 아래 오류

## 팝업

### m:verify · 판매자 정보 등록 (팝업)

- 설명: 처음 판매를 고를 때 한 번만. 무료 공유·비공개는 없이도 올린다.
- 동작: 휴대폰 본인인증 → 정산 은행·계좌 → 원천징수·지급대행 동의 → 등록 완료
- 경우: 인증 없이 등록 · 계좌번호 8자리 미만 · 동의 안 함: 창 안에 오류


## 예외 (EX)

- [ ] 비회원
- [ ] 판매 시작 전 (판매 없음)
- [ ] 사람 확인 중 → 승인·반려 보내기
- [ ] 반려된 레시피가 맨 위
- [ ] 링크 이름 규칙 위반
- [ ] 이미 있는 링크
- [ ] 쿠폰 코드 중복
- [ ] 정산 정보 없음

## 데이터 · API

`recipe_drafts`·`recipe_versions`·`auto_checks`·`review_queue`·`seller_profiles`·`seller_earnings`·`payouts`·`share_links`·`coupons`·`recipe_daily_stats`, 액션 `saveDraft`(디바운스)·`createSignedUpload`·`submitRecipe`·`registerSeller`·`createShareLink`·`createCoupon`·`stopRecipe`·`setRecipeVisibility`. 크론은 Vercel Cron 화요일 지급 배치와 `pg_cron` 일간 통계·보류 해제. 토스 지급대행 웹훅은 페이로드+타임스탬프 HMAC-SHA256으로 검증.

## 수용 기준

| ID | P | 요구 | 수용 기준 | 목표 주 |
|---|---|---|---|---|
| F5-8 | P0 | 판매자 등록(m:verify) (유료 전환 단계) | PortOne 본인인증 → 서버 `GET /identity-verifications/{id}` 상태 `VERIFIED`일 때만 진행. `ci_hash` unique(한 사람 한 판매자 계정). 19세 미만 차단. 토스 셀러 등록 → `seller.changed` 웹훅. 인증 전 개인 셀러는 주 1천만원 미만으로 제한 | 유료 전환 |
| F5-9 | P0 | 정산이 정확하다 (유료 전환 단계) | `hold_until = paid_at + 7d`. 매일 보류 해제(열린 환불·신고 있으면 제외). 화요일 배치 → `POST /v2/payouts` `SCHEDULED`(수요일, 요청당 100건 이하, JWE 암호화, Node 런타임) → `payout.changed` 웹훅. 음수는 다음 정산에서 상계 | 유료 전환 |
| F5-10 | P0 | 판매자 센터 숫자 | `recipe_daily_stats` 기준 7·30·90일. 링크 이름 규칙 위반·중복 링크·중복 쿠폰은 칸 아래 오류 | W4 |
| F5-14 | P0 | 「유료 판매 오픈 알림 신청」 대기 명단 | SELL·UP의 버튼으로 `creator_waitlist`(user_id unique, 신청 시각, 관심 카테고리, 알림 동의 버전)에 한 번만 등록. 다시 누르면 「신청했어요」 상태와 취소. RLS로 본인 행만 보임. 가격 입력·판매자 등록 화면은 없음 | W4 |

## 테스트 매핑

| 대상 | 테스트 위치 |
|---|---|
| SCN: SAME 인증이 갤러리로 (jiwoo, W6) | `e2e/scenarios/same-cert-to-gallery.spec.ts` |
| SCN: 첫 판매 등록 (본인인증) (jiwoo, W4) | `e2e/scenarios/first-sale-registration.spec.ts` |
| SCN: 마이페이지 한 바퀴 (jiwoo, W6) | `e2e/scenarios/my-page-tour.spec.ts` |
| EX 항목 전체 | `e2e/scenarios/same-cert-to-gallery.spec.ts` `describe('EX')` 또는 컴포넌트 테스트 |
| F5-8 | pgTAP `supabase/tests/` — 테스트 이름에 `F5-8` |
| F5-9 | Vitest / Playwright — 테스트 이름에 `F5-9` |
| F5-10 | Vitest / Playwright — 테스트 이름에 `F5-10` |

## 열린 질문

- 지급대행 심사에 통신판매업 신고증이 필요한지(미확인)
- 사업소득 간이지급명세서 주기(세무사)
- 개인 판매자 주민등록번호 수집·암호화 보관(세무사 + 변호사)
