# SCN · 시나리오 12개

와이어프레임 v0.5의 시나리오. 각 SCN은 Playwright 파일 하나다. 단계별 상세는 `.claude/skills/e2e-scenario/scenarios.md`, 시드 사용자와 mock 공급자는 `e2e/CLAUDE.md`.

> **MVP 범위**: 무료 출시라 SCN 2·3·4는 유료 전환 단계다. SCN 1·6·7·9·11·12는 결제·체험·충전·본인인증 단계를 빼고 같은 파일 이름으로 돈다(아래 설명의 「MVP:」). 파일 이름은 바꾸지 않는다.

| # | SCN | 설명 | 사용자 | 파일 | 목표 주 | 화면 |
|---|---|---|---|---|---|---|
| 1 | 비회원으로 구경하다 SAME 하기 | 로그인 없이 구경하고, 받으려는 순간 로그인 → 하려던 일로 바로 돌아오기. MVP: 무료 받기, 18+ 자기 확인 포함. W3는 받기 → 「라이브러리에서 열기」까지, SAME 인증 올리기는 갤러리(W6). | guest → jiwoo | `e2e/scenarios/guest-to-same.spec.ts` | W3 | HOME, MKT, PRM, LIB, MY |
| 2 | 유료 SAME · 쿠폰 · 원문 열기 | 상세 → 결제 → 라이브러리 → 원문까지 한 번에. | jiwoo | `e2e/scenarios/paid-same-coupon-open.spec.ts` | 유료 전환 | PRM, PAY, LIB |
| 3 | 열기 전 환불 | 원문을 열기 전, 7일 안이면 바로 환불. | jiwoo | `e2e/scenarios/refund-before-open.spec.ts` | 유료 전환 | LIB, ORD, PRM |
| 4 | 열어 본 뒤엔 환불 대신 신고 | 열어 본 레시피는 환불이 막히고 “설명과 달라요” 신고로 이어진다. | jiwoo | `e2e/scenarios/report-after-open.spec.ts` | 유료 전환 | LIB, ACTV |
| 5 | SAME 인증이 갤러리로 | 따라 만든 결과를 올리면 갤러리·SAME 수·크리에이터 알림이 함께 바뀐다. | jiwoo | `e2e/scenarios/same-cert-to-gallery.spec.ts` | W6 | LIB, GAL, PRM, SELL, NOTI |
| 6 | 체험 → SAME → 충전 → 생성 → 인증 | 플레이그라운드 체험이 구매와 SAME 인증까지 이어지는 흐름. MVP: 무료 SAME → 월 무료 크레딧으로 생성 → 인증(체험·충전 없음). | jiwoo | `e2e/scenarios/trial-to-certify.spec.ts` | W6 | PRM, PLAY, PAY, CRD, GAL |
| 7 | 첫 판매 등록 (본인인증) | 판매를 처음 고르면 본인인증·정산 정보를 받고, 올린 레시피가 바로 탐색에 뜬다. MVP: 첫 무료 등록 → 탐색에 뜸 + 대기 명단 신청(본인인증 없음). | jiwoo | `e2e/scenarios/first-sale-registration.spec.ts` | W4 | UP, SELL, MKT |
| 8 | 갤러리에서 포크 → 무료 공유 | 원작 정보를 담아 올리고, 상세에 원작이 표시된다. | jiwoo | `e2e/scenarios/fork-free-share.spec.ts` | W6 | GAL, UP, PRM |
| 9 | 판매 중지된 레시피 | 링크로 들어와도 대체 화면, 받은 사람은 계속 쓸 수 있다. MVP: PAY 차단 단계 없음. | guest · jiwoo · creator | `e2e/scenarios/stopped-recipe.spec.ts` | W3 | STOP, LIB, PAY |
| 10 | 검색 결과 없음 → 인기 검색어로 | GNB에서 없는 걸 찾으면 마켓 전체 0건 화면에서 인기 검색어로 다시 찾는다. | guest | `e2e/scenarios/zero-result-search.spec.ts` | W2 | MKT, HOME |
| 11 | 마이페이지 한 바퀴 | GNB 마이페이지에서 구매 내역·크레딧·프로필을 거쳐 판매자 센터의 레시피 올리기까지. MVP: 구매 내역·충전 없이 무료 크레딧 잔액·프로필·내 레시피·올리기. | jiwoo | `e2e/scenarios/my-page-tour.spec.ts` | W6 | MY, ORD, CRD, PRF, SELL, UP |
| 12 | 회원 탈퇴 → 다시 가입 | 탈퇴 팝업에서 사라지는 것을 확인하고 탈퇴하면 비회원 홈으로, 다시 로그인하면 새 회원으로 시작. MVP: 정산·유료 크레딧 게이트 없음, 무료 크레딧 소멸 안내. | jiwoo | `e2e/scenarios/withdraw-rejoin.spec.ts` | W6 | ACC, HOME, MY, CRD |

## 통과 게이트 (MVP 7주)

- W2: zero-result-search
- W3: guest-to-same(무료 SAME), stopped-recipe
- W4: first-sale-registration(MVP: 첫 무료 등록 + 대기 명단)
- W6: same-cert-to-gallery, trial-to-certify(MVP: 받은 무료 레시피 → 월 무료 크레딧으로 생성 → 인증), fork-free-share, my-page-tour, withdraw-rejoin
- W7: MVP SCN 9개 전부 (go/no-go 항목)
- 유료 전환 단계: paid-same-coupon-open, refund-before-open, report-after-open, 그리고 SCN 6·7·11·12의 결제·충전·본인인증 단계
