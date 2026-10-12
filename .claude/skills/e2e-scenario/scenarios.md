# SCN 12개

출처: 와이어프레임 v0.5 SCN 목록. 단계는 화면 규칙(rl)과 아이템에서 옮겼다. 통과 목표 주는 `docs/plan-12w.md`(7주 MVP).

> **MVP(무료 출시)**: SCN 2·3·4는 유료 전환 단계라 MVP에서 쓰지 않는다. SCN 1·6·7·9·11·12는 아래 단계 중 결제(PAY)·체험·충전(m:charge, CRD 충전)·본인인증(m:verify)·구매 내역(ORD) 단계를 빼고 쓴다 — 6은 「무료 SAME → 월 무료 크레딧으로 생성 → 인증」, 7은 「첫 무료 등록 → 탐색 노출 + 대기 명단 신청」. 빠진 단계는 지우지 않고 유료 전환 때 되살린다(`docs/specs/SCN.md`).

| # | SCN | 파일 | 사용자 | 목표 주 | 주요 화면 |
|---|---|---|---|---|---|
| 1 | 비회원으로 구경하다 SAME 하기 | `guest-to-same.spec.ts` | guest → jiwoo | W3 | HOME, MKT, PRM, m:login, LIB |
| 2 | 유료 SAME · 쿠폰 · 원문 열기 | `paid-same-coupon-open.spec.ts` | jiwoo | 유료 전환 | PRM, PAY, LIB, m:openConfirm, m:original |
| 3 | 열기 전 환불 | `refund-before-open.spec.ts` | jiwoo | 유료 전환 | LIB, m:refund, ORD, PRM |
| 4 | 열어 본 뒤엔 환불 대신 신고 | `report-after-open.spec.ts` | jiwoo | 유료 전환 | LIB, m:report, ACTV |
| 5 | SAME 인증이 갤러리로 | `same-cert-to-gallery.spec.ts` | jiwoo | W6 | LIB, m:sameup, GAL, PRM, SELL |
| 6 | 체험 → SAME → 충전 → 생성 → 인증 | `trial-to-certify.spec.ts` | jiwoo | W6 | PRM, PLAY, PAY, m:charge, CRD, m:sameup |
| 7 | 첫 판매 등록(본인인증) | `first-sale-registration.spec.ts` | jiwoo | W4 | UP, m:verify, SELL, MKT |
| 8 | 갤러리에서 포크 → 무료 공유 | `fork-free-share.spec.ts` | jiwoo | W6 | GAL, UP, PRM |
| 9 | 판매 중지된 레시피 | `stopped-recipe.spec.ts` | guest, jiwoo, creator | W3 | STOP, LIB |
| 10 | 검색 결과 없음 → 인기 검색어로 | `zero-result-search.spec.ts` | guest | W2 | GNB 검색, MKT |
| 11 | 마이페이지 한 바퀴 | `my-page-tour.spec.ts` | jiwoo | W6 | MY, ORD, CRD, PRF, SELL, UP |
| 12 | 회원 탈퇴 → 다시 가입 | `withdraw-rejoin.spec.ts` | jiwoo | W6 | ACC, m:withdraw, HOME, m:login |

## 단계

### 1. guest-to-same
로그인 없이 구경하고, 받으려는 순간 로그인 → 하려던 일로 바로 돌아오기.
1. guest로 `/` → 섹션 순서(배너 → HOME-02 → 03 → 04 → 05) 확인 (F1-1)
2. GNB 마켓 → 프롬프트 → 무료 레시피 상세 (MKT, PRM)
3. 상세 HTML·RSC에 원문 샘플 문자열 없음 (F2-2)
4. 「무료로 SAME 하기」 → m:login → (테스트 로그인) → 하려던 받기가 이어서 실행 (F7-1)
5. 라이브러리에 새 줄, 상태 「열기 전」 (LIB-02)

### 2. paid-same-coupon-open
상세 → 결제 → 라이브러리 → 원문까지 한 번에.
1. jiwoo로 유료 레시피 상세 → 「SAME 하기」 → `/checkout`
2. 다른 크리에이터 쿠폰 → 오류 문구, 없는 코드 → 다른 오류 문구 (PAY-02)
3. 맞는 쿠폰 → 할인 + "직접 유입(수수료 5%)" (PAY-05, F3-1)
4. 동의 2개 전 결제 버튼 비활성 → 체크 후 활성 (PAY-03, F3-2)
5. sandbox 결제 → 완료 → 라이브러리 (F3-3)
6. 「원문 열기」 → m:openConfirm → 원문(받은 사람 식별 정보 포함) → 상태 「열어 봄 · 환불 제한」 (F3-5)
7. 두 번째 열기는 확인 창 없이 바로

### 3. refund-before-open
1. jiwoo, 열기 전·7일 안 주문 → 라이브러리 「환불 요청」 → m:refund → 신청 (F3-6)
2. 라이브러리에서 빠짐, 구매 내역 「환불 완료」 + 환불일 (F3-7)
3. 상세에 다시 「SAME 하기」
4. (fixture) 결제 8일 지난 주문 → 환불 버튼 없음

### 4. report-after-open
1. jiwoo, 열어 본 주문 → 환불 버튼 대신 「설명과 달라요」 신고 (LIB-04)
2. m:report 사유 4개 중 하나 + 내용 → 접수 알림
3. ACTV 신고 탭에 「답변 대기」 (ACTV-04)

### 5. same-cert-to-gallery
1. jiwoo, 받은 레시피 → 「SAME 인증 올리기」 → m:sameup → 올리기 (F6-1)
2. 갤러리 맨 위, 레시피 SAME +1, 크리에이터 알림, 판매자 대시보드 SAME
3. 안 받은 레시피로 인증 INSERT 시도(API) → RLS 거부

### 6. trial-to-certify
플레이그라운드 체험이 구매와 SAME 인증까지 이어지는 흐름.
1. jiwoo, 안 받은 유료 레시피 → 「바로 만들어 보기」 → PLAY 체험 모드 (PLAY-01)
2. 첫 실행 고지 팝업 확인 → 「예시로 채우기」 → 만들기 → mock 결과 + 워터마크 + 「AI 생성」 (F4-6, F4-9)
3. 다시 만들기 → 실행 버튼 꺼짐 + 「SAME 하고 계속 만들기」 → 결제 → 플레이그라운드로 복귀
4. 내 레시피 모드, 3모델 선택 → 예상 크레딧 표시 → 부족 → m:charge(모자란 만큼 표시) → 충전 → 같은 입력으로 재실행 (F4-1, F4-2, F4-10)
5. mock: 1개 모델 오류 → 그 칸만 「반환」, 나머지는 결과 (F4-5, FM-14)
6. 결과 → SAME 인증 올리기 → 갤러리 「여기서 생성」 (F4-11)
7. CRD 내역: 충전 · 사용 · 반환 줄

### 7. first-sale-registration
1. jiwoo, UP 5단계 → 공개·가격에서 「판매」 선택 → m:verify (UP-06)
2. 본인인증(sandbox) → 주소·이메일 → 계좌 → 동의 → 완료 (F5-8)
3. 가격 900원 → 오류, 1,000원 → 통과 (F5-2)
4. 결과물 2개 → 검사 실패 「결과물 부족」 → 3개 → 통과
5. 자동 검사 통과 → 공개 → 탐색 목록에 뜸 (프롬프트 지침형은 사람 확인 없음)

### 8. fork-free-share
1. jiwoo, 갤러리 결과 → 「이걸로 만들기」 → 원작 정보가 담긴 UP 초안 (F6-2)
2. 무료로 공개 → 상세에 원작 표시
3. `fork_allowed=false` 레시피 결과에는 「이걸로 만들기」 없음

### 9. stopped-recipe
1. guest, 판매 중지 레시피 링크 → 받기 버튼 없음 + 사유 + 비슷한 레시피 (F2-4)
2. jiwoo(받은 사람) → 「받은 버전 열기」 → 원문
3. creator(만든 사람) → 일반 상세 + 「판매 중지」 띠
4. 결제 시도(API) → 차단

### 10. zero-result-search
1. guest, GNB 검색 "없는검색어" → 마켓 전체 0건 → 인기 검색어 칩 10개 + 「필터 초기화」 (F1-6)
2. 칩 클릭 → 결과 있음, 검색어 칩으로 남음 (F1-4)
3. 두 글자 검색 "세무" → 결과 있음 (F1-5)

### 11. my-page-tour
1. jiwoo, GNB 마이페이지 → 숫자 타일 → 구매 내역 → 영수증 팝업 (MY, ORD)
2. 크레딧 → 내역 필터 (CRD)
3. 프로필 → 핸들 중복 확인 → 저장 → GNB 이름 반영 (PRF, F7-4)
4. 판매자 센터 → 레시피 올리기 탭 (SELL, UP)

### 12. withdraw-rejoin
1. jiwoo(정산 대기 없음, 유료 크레딧 있음) → ACC → 탈퇴 → 「크레딧 환불 먼저」 (F7-6)
2. 크레딧 환불 → 탈퇴 팝업 → 확인 체크 없이 → 오류 → 체크 → 탈퇴 → 비회원 홈
3. 갤러리 SAME 인증은 「탈퇴한 회원」으로 남음
4. 다시 로그인 → 새 회원(숫자 0, 다음 할 일 안내)
5. (fixture) creator 정산 대기 → 탈퇴 버튼 꺼짐

## EX 목록

화면별 EX는 `docs/specs/<CODE>.md`의 "예외(EX)" 절에 있다(와이어프레임 v0.5 EX/EXL에서 추출). EX는 해당 SCN 파일의 `describe('EX')` 또는 컴포넌트 테스트로 옮긴다.
