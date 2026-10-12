# GAL · 갤러리

- 경로: `/gallery`
- 와이어프레임: `docs/wireframe/sameplz-wireframe-v0.5.html` (key `feed`), 인벤토리 `docs/wireframe/_context_wireframe_inventory.md`
- 기능 묶음: [F6](F6-gallery-activity.md) — F6 갤러리·활동 — GAL · ACTV
- 의존 결정: D1 (`docs/decisions.md`) — open이면 해당 부분은 멈추고 묻는다

## 목적

GNB 갤러리(이전 이름 피드). 원본 결과물과 따라 만든 SAME 인증이 섞여 올라오는 놀이터.

## 아이템

- **GAL-01** 결과물 모음: 원본과 SAME 인증을 섞는다. 플레이그라운드에서 만든 인증은 “여기서 생성” 표시.
- **GAL-02** 같은 걸로: 어떤 결과물이든 원본 레시피로 바로.
- **GAL-03** 이걸로 만들기: 포크. 원작 정보를 담아 올리기로. 판매되면 원작자 로열티 10%.
- **GAL-04** 내 결과 올리기: 받은 레시피 중에서 골라 올린다. 받은 게 없으면 갤러리 구경으로 안내.

### 필수 콘텐츠 (보고서 F 묶음에서)

- **GAL-01~04**: 원본·SAME 인증 혼합 피드, 「여기서 생성」 표시, 「같은 걸로」·「이걸로 만들기」(포크 막힌 레시피는 버튼 없음)·「내 결과 올리기」, 캡션(첫 40건은 "어떤 입력으로 했는지" 한 줄)
- **m:sameup · m:sameupEmpty**: 받은 레시피 선택, 플레이그라운드에서 왔으면 결과 그대로, 받은 게 없으면 「먼저 레시피를 받아 보세요」 → 갤러리 구경

## 동작

- 「같은 걸로」 → 원본 레시피 상세
- 「이걸로 만들기」 → 원작 정보를 담은 올리기(포크)
- 「내 결과 올리기」 → 받은 레시피 중에서 골라 올림

## 규칙 (rl)

- 포크한 레시피가 팔리면 원작자 로열티 10%
- 플레이그라운드에서 만든 인증은 「여기서 생성」 표시

## 경우의 수 (c)

- 포크 막힌 레시피: 「이걸로 만들기」 없음
- 받은 레시피가 없으면 올리기 대신 안내
- 비회원 좋아요·포크·올리기: 로그인 뒤 이어서

## 팝업

### m:sameup · SAME 인증 올리기 (팝업)

- 설명: 따라 만든 결과를 갤러리에 올린다.
- 동작: 올리기 → 갤러리 맨 위 · 레시피 SAME +1 · 크리에이터 알림 · 대시보드 SAME
- 경우: 받은 레시피가 없으면 안내 창
- 경우: 플레이그라운드에서 오면 결과를 그대로 · 「여기서 생성」 표시
- 경우: 서버 오류: 창 유지

### m:sameupEmpty · 먼저 레시피를 받아 보세요 (팝업)

- 설명: 받은 레시피가 하나도 없을 때 SAME 인증 대신 뜬다.
- 동작: 갤러리 구경하기로 이어짐


## 예외 (EX)

- [ ] SAME 인증만 보기
- [ ] 포크 막힌 레시피 (버튼 없음)
- [ ] 받은 게 없는데 「내 결과 올리기」
- [ ] 비회원이 좋아요

## 데이터 · API

`gallery_posts`(kind `original`/`same_cert`, entitlement_id, generated_here, status), `post_likes`, `follows`, `reports`, 정책 `same_cert` INSERT → `private.has_entitlement()`, 액션 `postSameCert`·`removeSameCert`·`forkRecipe`·`toggleFollow`·`createReport`. 추천·보증 심사지침에 따라 크레딧을 주는 인증(「첫 SAME 챌린지」)에는 "이벤트 참여" 표시.

## 수용 기준

| ID | P | 요구 | 수용 기준 | 목표 주 |
|---|---|---|---|---|
| F6-1 | P0 | 받은 사람만 인증을 올린다 | `gallery_posts` `same_cert` INSERT 정책이 활성 권리(`has_entitlement`)를 요구. 올리면 갤러리 맨 위 + SAME +1 + 크리에이터 알림 + 대시보드 반영. 내리면 −1 | W6 |
| F6-2 | P0 | 포크는 원작을 기억한다 | 「이걸로 만들기」 → `forked_from_*`가 채워진 UP 초안. `fork_allowed=false`면 버튼 없음. 상세에 원작 표시. 판매 시 D1 규칙으로 로열티 | W6 |
| F6-3 | P0 | 올린 결과도 다시 거른다 | 게시 때 이미지 재검사, 신고 버튼, 검토 중이면 숨김 | W6 |
| F6-5 | P1 | 게시물 좋아요, 무한 스크롤 | — | — |

## 테스트 매핑

| 대상 | 테스트 위치 |
|---|---|
| SCN: SAME 인증이 갤러리로 (jiwoo, W6) | `e2e/scenarios/same-cert-to-gallery.spec.ts` |
| SCN: 체험 → SAME → 충전 → 생성 → 인증 (jiwoo, W6) | `e2e/scenarios/trial-to-certify.spec.ts` |
| SCN: 갤러리에서 포크 → 무료 공유 (jiwoo, W6) | `e2e/scenarios/fork-free-share.spec.ts` |
| EX 항목 전체 | `e2e/scenarios/same-cert-to-gallery.spec.ts` `describe('EX')` 또는 컴포넌트 테스트 |
| F6-1 | pgTAP `supabase/tests/` — 테스트 이름에 `F6-1` |
| F6-2 | Vitest / Playwright — 테스트 이름에 `F6-2` |
| F6-3 | Vitest / Playwright — 테스트 이름에 `F6-3` |

## 열린 질문

- 갤러리 원본:SAME 비율(출시 첫 2주 60:40) 이후 기준
