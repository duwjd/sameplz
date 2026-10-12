# 경로 ↔ 화면 코드 ↔ 아이템 ↔ 팝업

와이어프레임 v0.5 키(`key`)는 `docs/wireframe/sameplz-wireframe-v0.5.html` 안의 화면 식별자다.

| 경로 | 코드 | 와이어프레임 key | 아이템 | 팝업 | 명세 |
|---|---|---|---|---|---|
| `/` | HOME | home | HOME-01 롤링 배너 · 02 이번 주 다운로드 많은 · 03 실시간 인기 TOP 10 · 04 지금 뜨는 결과물 · 05 인기 크리에이터 · 06 통신판매중개 고지 | m:login | HOME.md · F1 |
| `/market`, `/market/{prompts,agents,skills}` | MKT | browse | MKT-01 위치와 제목 · 02 카테고리별 필터 · 03 정렬 · 04 적용된 필터 · 05 결과와 0건 | — | MKT.md · F1 |
| `/market/collections` | COL | collection | COL-01 큐레이션 팩 | — | COL.md · F1 |
| (없는 주소, 비공개·심사 중 레시피) | NF | nf | NF-01 안내 · 02 인기 레시피 | — | NF.md · F1 |
| `/r/[id]` (category=prompt) | PRM | item-prompt | PRM-01 결과물 갤러리 · 02 인기 지표 · 03 사용 도구·설정 · 04 프롬프트 미리보기 · 05 따라 만든 결과 · 06 SAME 하기 · 07 바로 만들어 보기 · 08 상황 띠 | m:login, m:report | PRM.md · F2 |
| `/r/[id]` (category=agent) | AGT | item-agent | AGT-01 동작 흐름 · 02 인기 지표 · 03 예시 실행 · 04 실행 환경·연동 · 05 하는 일·안 하는 일 · 06 SAME 하기 · 07 전문 영역 고지 · 08 상황 띠 | m:login | AGT.md · F2 |
| `/r/[id]` (category=skill) | SKL | item-skill | SKL-01 호출 예시 · 02 인기 지표 · 03 전후 비교 · 04 설치 안내 · 05 파일 구성 · 06 안전 검사 · 07 SAME 하기 · 08 상황 띠 | m:copy | SKL.md · F2 |
| `/r/[id]` (status=stopped) | STOP | item-stopped | STOP-01 중지 안내 · 02 받은 사람 안내 · 03 비슷한 레시피 | m:original | STOP.md · F2 |
| `/checkout` | PAY | checkout | PAY-01 단계 표시 · 02 쿠폰 · 03 필수 동의 · 04 통신판매중개 고지 · 05 유입 표시 | m:login | PAY.md · F3 |
| `/my/library` | LIB | library | LIB-01 업데이트 알림 · 02 상태 · 03 쓰기 · 04 환불·신고 | m:openConfirm, m:original, m:refund, m:guide, m:report, m:sameup | LIB.md · F3 |
| `/my/orders` | ORD | orders | ORD-01 상태 필터 · 02 주문 줄 · 03 영수증·환불 · 04 안내 | m:receipt, m:refund | ORD.md · F3 |
| `/play` | PLAY | play | PLAY-01 레시피와 모드 · 02 입력 · 03 모델 비교 · 04 예상 크레딧 · 05 결과 그리드 · 06 결과로 할 일 · 07 크레딧 | m:charge, m:sameup, m:login | PLAY.md · F4 |
| `/my/credits` | CRD | credits | CRD-01 보유 크레딧 · 02 충전하기 · 03 내역 · 04 오류와 환불 규칙 | m:charge, m:crRefund | CRD.md · F4 |
| `/my/seller/upload` | UP | create | UP-01 5단계 올리기 · 02 카테고리 선택 · 03 GPTs 가져오기 · 04 카테고리별 입력 · 05 결과물 · 06 공개 범위·가격 · 07 자동 검사 · 08 초안·새 버전 | m:verify | UP.md · F5 |
| `/my/seller` | SELL | seller | SELL-01 한눈에 보기 · 02 유입 경로별 매출 · 03 상품 관리 · 04 공유 링크·쿠폰 · 05 정산 · 06 판매 시작 전 | m:verify | SELL.md · F5 |
| `/gallery` | GAL | feed | GAL-01 결과물 모음 · 02 같은 걸로 · 03 이걸로 만들기 · 04 내 결과 올리기 | m:sameup, m:sameupEmpty, m:login | GAL.md · F6 |
| `/my/activity` | ACTV | activity | ACTV-01 탭 · 02 내 SAME 인증 · 03 팔로잉 · 04 신고 내역 | — | ACTV.md · F6 |
| `/my` | MY | my | MY-01 프로필 요약 · 02 숫자 타일 · 03 업데이트가 있어요 · 04 최근 받은 레시피 · 05 판매자 센터 카드 · 06 최근 알림 · 07 마이페이지 메뉴 | m:login | MY.md · F7 |
| `/my/notifications` | NOTI | notifs | NOTI-01 알림 목록 · 02 연결 | — | NOTI.md · F7 |
| `/my/profile` | PRF | profile | PRF-01 프로필 사진 · 02 닉네임·핸들 · 03 소개 · 04 대표 직무 · 05 저장·되돌리기 | — | PRF.md · F7 |
| `/my/account` | ACC | account | ACC-01 로그인 수단 · 02 판매자 정보 · 03 알림 설정 · 04 로그아웃·탈퇴 | m:verify, m:withdraw | ACC.md · F7 |
| `/guide` | GUIDE | policy | GUIDE-01 라이선스 · 02 환불 · 03 안전 검사 · 04 크레딧 · 05 금지와 신고 | — | GUIDE.md · F7 |
| `/admin/**` | ADM | (와이어프레임 밖) | 심사 큐 · 신고함 · 판매 중지/게시중단 · 주문·크레딧·지급 · 제재 | — | ADM.md · F8 |

## 팝업(m:*) 한 줄 정의

| 팝업 | 뜨는 때 | 핵심 규칙 |
|---|---|---|
| m:login | 받기·좋아요·팔로우·올리기·실행 직전 | 하려던 일을 기억했다가 로그인 뒤 이어서. 닫으면 취소. 서버 오류면 창 유지 |
| m:report | 열어 본 뒤 문제 | 사유 4개 중 하나 + 내용, 첫 답 1영업일, 3개월 안 |
| m:openConfirm | 처음 원문 열기 | "열면 환불이 제한돼요. 결과물과 미리보기로 충분히 확인했나요?" → `opened_at` 기록 |
| m:original | 받은 버전 원문 | 받은 사람 식별 정보 포함, 판매 중지여도 열림 |
| m:refund | 열기 전 7일 안 | 전액 환불, 카드 취소 3~5영업일, 서버 오류면 창 유지 |
| m:guide | 받은 레시피 쓰기 | 도구별 3단계(프롬프트: 복사→붙여넣기→[대괄호] 바꾸기 / 스킬·에이전트: 파일 받기→도구에 넣기→연결·실행) |
| m:sameup | SAME 인증 올리기 | 받은 레시피만, 플레이그라운드에서 오면 결과 그대로 + 「여기서 생성」 |
| m:sameupEmpty | 받은 레시피 없음 | 「먼저 레시피를 받아 보세요」 → 갤러리 구경 |
| m:charge | 크레딧 충전 | 팩 3종, 모자란 만큼 표시, 미리 체크 없음, 서버 오류면 "결제되지 않았어요" |
| m:verify | 처음 판매 선택 | 본인인증 → 주소·이메일 → 계좌(예금주 확인) → 소득 구분·원천징수·지급대행 동의 → 토스 SMS 안내 |
| m:copy | 클립보드 막힘 | 내용을 선택된 채로 보여 줌 |
| m:receipt | 주문 영수증 | 주문번호·결제일·상품·판매자 신원·금액·쿠폰·수단·상태·중개 고지·PG 매출전표, 인쇄·PDF |
| m:crRefund | 충전 크레딧 환불 | 보너스 환불 불가, 공제율은 약관(D3) |
| m:withdraw | 회원 탈퇴 | 사라지는 것·남는 것, 정산 대기면 버튼 꺼짐, 유료 크레딧 있으면 「크레딧 환불 먼저」, 확인 체크 필수 |

## GNB

- 비회원: 오른쪽은 「로그인」 하나
- 회원: 알림(안 읽은 수) · 크레딧(잔액) · 마이페이지(아바타)
- 마켓: 호버·포커스로 하위 메뉴(프롬프트·에이전트·스킬·컬렉션), ▾ 버튼은 클릭·Enter로 열고 Esc로 닫음. 모바일은 GNB 아래 하위 메뉴 줄
- 검색창 하나, 검색하면 마켓 전체로 가서 칩으로 남음
