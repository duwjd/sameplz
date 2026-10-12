# ACTV · SAME 인증 · 팔로잉

- 경로: `/my/activity`
- 와이어프레임: `docs/wireframe/sameplz-wireframe-v0.5.html` (key `activity`), 인벤토리 `docs/wireframe/_context_wireframe_inventory.md`
- 기능 묶음: [F6](F6-gallery-activity.md) — F6 갤러리·활동 — GAL · ACTV
- 의존 결정: D1 (`docs/decisions.md`) — open이면 해당 부분은 멈추고 묻는다

## 목적

내가 올린 SAME 인증, 팔로우한 크리에이터, 신고 내역을 모은 활동 화면.

## 아이템

- **ACTV-01** 탭: SAME 인증 · 팔로잉 · 신고.
- **ACTV-02** 내 SAME 인증: 갤러리에 올린 결과. 내릴 수 있다.
- **ACTV-03** 팔로잉: 팔로우한 크리에이터와 판매 중 레시피 수.
- **ACTV-04** 신고 내역: 접수일·사유·상태.

### 필수 콘텐츠 (보고서 F 묶음에서)

- **ACTV-01~04**: 탭 SAME 인증·팔로잉·신고, 인증 「내리기」, 팔로잉 「레시피 보기」·끊기, 신고 내역(접수일·사유·답변 대기/완료), 탭별 빈 화면 문구

## 동작

- 탭: SAME 인증 · 팔로잉 · 신고
- 인증 「내리기」 → 갤러리에서 빠지고 레시피 SAME 수 -1
- 팔로잉 「레시피 보기」 → 마켓에서 그 크리에이터로 검색 · 「팔로잉」 → 팔로우 끊기

## 규칙 (rl)

- 신고 첫 답 1영업일 · 상태는 답변 대기 → 답변 완료

## 경우의 수 (c)

- 올린 인증·팔로잉·신고가 없으면 탭마다 다음 할 일 안내

## 예외 (EX)

- [ ] 올린 인증이 없음
- [ ] 팔로잉 탭
- [ ] 신고 내역

## 데이터 · API

`gallery_posts`(kind `original`/`same_cert`, entitlement_id, generated_here, status), `post_likes`, `follows`, `reports`, 정책 `same_cert` INSERT → `private.has_entitlement()`, 액션 `postSameCert`·`removeSameCert`·`forkRecipe`·`toggleFollow`·`createReport`. 추천·보증 심사지침에 따라 크레딧을 주는 인증(「첫 SAME 챌린지」)에는 "이벤트 참여" 표시.

## 수용 기준

| ID | P | 요구 | 수용 기준 | 목표 주 |
|---|---|---|---|---|
| F6-1 | P0 | 받은 사람만 인증을 올린다 | `gallery_posts` `same_cert` INSERT 정책이 활성 권리(`has_entitlement`)를 요구. 올리면 갤러리 맨 위 + SAME +1 + 크리에이터 알림 + 대시보드 반영. 내리면 −1 | W6 |
| F6-4 | P0 | 활동 화면 | 탭별 빈 화면, 신고 상태 2단계, 비회원 좋아요·포크·올리기는 로그인 뒤 이어서 | W6 |

## 테스트 매핑

| 대상 | 테스트 위치 |
|---|---|
| SCN: 열어 본 뒤엔 환불 대신 신고 (jiwoo, 유료 전환) | `e2e/scenarios/report-after-open.spec.ts` |
| EX 항목 전체 | `e2e/scenarios/report-after-open.spec.ts` `describe('EX')` 또는 컴포넌트 테스트 |
| F6-1 | pgTAP `supabase/tests/` — 테스트 이름에 `F6-1` |
| F6-4 | Vitest / Playwright — 테스트 이름에 `F6-4` |

## 열린 질문

- 갤러리 원본:SAME 비율(출시 첫 2주 60:40) 이후 기준
