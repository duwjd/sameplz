# F6 갤러리·활동 — GAL · ACTV

> 받은 사람만 인증을 올린다

- 화면 명세: [GAL](GAL.md) · [ACTV](ACTV.md)
- 의존 결정: D1 (`docs/decisions.md`)
- 우선순위: P0(빠지면 출시 불가) · P1(출시 후 4~8주) · P2(설계만 대비)
- 수용 기준은 Given → When → Then을 줄인 것이고, 와이어프레임 예외(EX)·시나리오(SCN)에 대응한다. 테스트 이름에 요구사항 ID를 넣는다.

## 문제

SAMEPLZ는 "검증 배지" 대신 "몇 명이 따라 했는지"를 신뢰 신호로 쓴다. 그러니 SAME 인증은 실제로 받은 사람만 올릴 수 있어야 하고, 이 규칙을 화면이 아니라 INSERT 정책이 지켜야 한다. 포크는 원작 정보를 달고 판매 시 원작자에게 10%를 준다.

## 목표

- 실구매자 인증
- 포크 계보 보존

## 비목표

- 댓글·DM

## 필수 콘텐츠

| 아이템 | 필수 콘텐츠 |
|---|---|
| GAL-01~04 | 원본·SAME 인증 혼합 피드, 「여기서 생성」 표시, 「같은 걸로」·「이걸로 만들기」(포크 막힌 레시피는 버튼 없음)·「내 결과 올리기」, 캡션(첫 40건은 "어떤 입력으로 했는지" 한 줄) |
| m:sameup · m:sameupEmpty | 받은 레시피 선택, 플레이그라운드에서 왔으면 결과 그대로, 받은 게 없으면 「먼저 레시피를 받아 보세요」 → 갤러리 구경 |
| ACTV-01~04 | 탭 SAME 인증·팔로잉·신고, 인증 「내리기」, 팔로잉 「레시피 보기」·끊기, 신고 내역(접수일·사유·답변 대기/완료), 탭별 빈 화면 문구 |


## 요구사항

| ID | P | 스토리 / 요구 | 수용 기준 | 아이템 | 목표 주 | SCN |
|---|---|---|---|---|---|---|
| F6-1 | P0 | 받은 사람만 인증을 올린다 | `gallery_posts` `same_cert` INSERT 정책이 활성 권리(`has_entitlement`)를 요구. 올리면 갤러리 맨 위 + SAME +1 + 크리에이터 알림 + 대시보드 반영. 내리면 −1 | GAL-04, PRM-05, ACTV-02 | W6 | `same-cert-to-gallery` |
| F6-2 | P0 | 포크는 원작을 기억한다 | 「이걸로 만들기」 → `forked_from_*`가 채워진 UP 초안. `fork_allowed=false`면 버튼 없음. 상세에 원작 표시. 판매 시 D1 규칙으로 로열티 | GAL-03 | W6 | `fork-free-share` |
| F6-3 | P0 | 올린 결과도 다시 거른다 | 게시 때 이미지 재검사, 신고 버튼, 검토 중이면 숨김 | GAL-01 | W6 | — |
| F6-4 | P0 | 활동 화면 | 탭별 빈 화면, 신고 상태 2단계, 비회원 좋아요·포크·올리기는 로그인 뒤 이어서 | ACTV-01, ACTV-02, ACTV-03, ACTV-04 | W6 | `report-after-open` |
| F6-5 | P1 | 게시물 좋아요, 무한 스크롤 | — | GAL-01 | — | — |

## 데이터 · API

`gallery_posts`(kind `original`/`same_cert`, entitlement_id, generated_here, status), `post_likes`, `follows`, `reports`, 정책 `same_cert` INSERT → `private.has_entitlement()`, 액션 `postSameCert`·`removeSameCert`·`forkRecipe`·`toggleFollow`·`createReport`. 추천·보증 심사지침에 따라 크레딧을 주는 인증(「첫 SAME 챌린지」)에는 "이벤트 참여" 표시.

## 지표

- 구매 대비 SAME 인증 비율
- 갤러리→상세 클릭률

## 열린 질문

- 갤러리 원본:SAME 비율(출시 첫 2주 60:40) 이후 기준
