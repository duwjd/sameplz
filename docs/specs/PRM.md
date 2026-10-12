# PRM · 프롬프트 상세

- 경로: `/r/[id]` (category=prompt)
- 와이어프레임: `docs/wireframe/sameplz-wireframe-v0.5.html` (key `item-prompt`), 인벤토리 `docs/wireframe/_context_wireframe_inventory.md`
- 기능 묶음: [F2](F2-detail.md) — F2 상세 — PRM · AGT · SKL · STOP
- 의존 결정: D9 (`docs/decisions.md`) — open이면 해당 부분은 멈추고 묻는다

## 목적

결과물이 첫 화면. 본문은 가리고 변수만 보여 주며, 받기 전에는 플레이그라운드 체험 1회로 확인한다.

## 아이템

- **PRM-01** 결과물 갤러리: 첫 화면은 결과물. 영상은 비율 그대로(9:16) 재생.
- **PRM-02** 인기 지표: 다운로드·SAME·좋아요·업데이트일. 검증 배지 대신 “몇 명이 따라 했는지”.
- **PRM-03** 사용 도구·설정: 같은 결과를 내는 데 필요한 값.
- **PRM-04** 프롬프트 미리보기: 본문은 가리고 변수만. 받은 뒤 라이브러리나 플레이그라운드에서 연다.
- **PRM-05** 따라 만든 결과: 받은 사람이 올린 SAME 인증. 받기 전에는 “SAME 한 뒤 올릴 수 있어요”.
- **PRM-06** SAME 하기 (상태별): 비회원 → 로그인 → 이어서 결제 / 이미 받음 → 라이브러리 / 내 레시피 → 편집 / 무료 → 바로 라이브러리.
- **PRM-07** 바로 만들어 보기: 플레이그라운드로 연결. 안 받은 유료 레시피는 체험 1회(워터마크, 원문 비공개). API가 없는 도구는 실행 불가 안내.
- **PRM-08** 상황 띠: 공유 링크로 들어왔을 때(직접 유입), 내 레시피가 검토 중·반려됐을 때만 나타난다.

### 필수 콘텐츠 (보고서 F 묶음에서)

- **PRM-01~08**: 결과물 갤러리(영상 9:16 그대로), 다운로드·SAME·좋아요·업데이트일, 사용 도구·설정, [변수] 미리보기(본문 가림), 따라 만든 결과, 상태별 주 버튼, 「바로 만들어 보기」(API 없는 도구면 꺼짐 + 이유), 상황 띠(링크로 들어옴·검토 중·반려)
- **공통**: 판매자 블록(사업자: 상호·대표자·주소·전화·이메일·사업자번호·신고번호를 청약 전에 표시 / 개인: 「본인인증 완료 판매자」와 분쟁 해결용 정보 요청 경로), 구매 버튼 위 철회 제한 고지 + "미리보기·체험 1회로 먼저 확인할 수 있어요", 결과물의 「AI 생성」 표시

## 동작

- 주 버튼은 상태마다 하나: 안 받음 「SAME 하기」 · 무료 「무료로 SAME 하기」 · 받음 「라이브러리에서 열기」 · 내 레시피 「새 버전 올리기」
- 「바로 만들어 보기」 → 플레이그라운드(안 받은 유료는 체험 1회)
- 좋아요·팔로우·신고·요청은 로그인 뒤 이어서
- 모바일은 아래에 SAME 바 고정

## 규칙 (rl)

- 가격도 라이선스도 하나
- 원문을 열기 전 7일 안에만 환불
- 따라 만든 결과는 받은 사람만 올릴 수 있음

## 경우의 수 (c)

- 공유 링크(?ref=)로 들어오면 「링크로 들어옴」 띠 → 결제에서 직접 유입 5%
- API 없는 도구(Midjourney 전용)는 「바로 만들어 보기」를 끄고 이유 표시
- 내 레시피가 사람 확인 중·반려·비공개면 상단 상태 띠
- 판매 중지면 다른 사람에겐 대체 화면 · 없는 주소는 404

## 예외 (EX)

- [ ] 비회원이 SAME 하기 → 로그인
- [ ] 무료 레시피
- [ ] 이미 받은 레시피
- [ ] 내 레시피 (만든 사람)
- [ ] 체험을 이미 씀
- [ ] API 없는 도구 (Midjourney 전용)
- [ ] 공유 링크로 들어옴
- [ ] 판매 중지된 레시피
- [ ] 없는 레시피 주소 (404)

## 데이터 · API

`getRecipePublic(publicId)`(태그 `recipe:{id}`), `getViewerState(recipeId)`(동적), 액션 `toggleLike`·`toggleFollow`·`createReport`·`recordShareClick`, `generateMetadata`, `opengraph-image.tsx`(한글 폰트 포함). 상세는 SSR로 실제 텍스트를 HTML에 담는다(네이버는 SPA에 SSR 권장). 원문은 담지 않는다.

## 수용 기준

| ID | P | 요구 | 수용 기준 | 목표 주 |
|---|---|---|---|---|
| F2-1 | P0 | 구매자가 상태에 맞는 버튼 하나만 본다(PRM-06·AGT-06·SKL-07) | 비회원 「SAME 하기」 → 로그인 → 결제로 복귀 / 받음 → 「라이브러리에서 열기」 / 내 레시피 → 「새 버전 올리기」 / 무료 → 「무료로 SAME 하기」 → 라이브러리 | W3 |
| F2-2 | P0 | 본문은 어떤 경로로도 안 받은 사람에게 가지 않는다 | 익명·안 받은 회원으로 받은 HTML, RSC 페이로드, `/api/*` 응답 어디에도 본문의 고유 샘플 문자열이 없음 | W3 |
| F2-3 | P0 | 공유 링크 유입을 기록한다 | `?ref=` 진입 시 「링크로 들어옴」 띠, `recordShareClick` 실행, 1st-party 방문자 쿠키, 7일 안 구매는 직접 유입 | W3 |
| F2-5 | P0 | API 없는 도구 레시피는 실행 버튼을 끈다 | Midjourney 전용 레시피에서 「바로 만들어 보기」 비활성 + 이유 문구 | W3 |
| F2-7 | P0 | 판매자 신원을 청약 전에 보여 준다 (유료 전환 단계) | 사업자 판매자 상세에 7개 신원 필드 표시. 개인 판매자는 구분 배지 | 유료 전환 |
| F6-1 | P0 | 받은 사람만 인증을 올린다 | `gallery_posts` `same_cert` INSERT 정책이 활성 권리(`has_entitlement`)를 요구. 올리면 갤러리 맨 위 + SAME +1 + 크리에이터 알림 + 대시보드 반영. 내리면 −1 | W6 |

## 테스트 매핑

| 대상 | 테스트 위치 |
|---|---|
| SCN: 비회원으로 구경하다 SAME 하기 (guest → jiwoo, W3) | `e2e/scenarios/guest-to-same.spec.ts` |
| SCN: 유료 SAME · 쿠폰 · 원문 열기 (jiwoo, 유료 전환) | `e2e/scenarios/paid-same-coupon-open.spec.ts` |
| SCN: 열기 전 환불 (jiwoo, 유료 전환) | `e2e/scenarios/refund-before-open.spec.ts` |
| SCN: SAME 인증이 갤러리로 (jiwoo, W6) | `e2e/scenarios/same-cert-to-gallery.spec.ts` |
| SCN: 체험 → SAME → 충전 → 생성 → 인증 (jiwoo, W6) | `e2e/scenarios/trial-to-certify.spec.ts` |
| SCN: 갤러리에서 포크 → 무료 공유 (jiwoo, W6) | `e2e/scenarios/fork-free-share.spec.ts` |
| EX 항목 전체 | `e2e/scenarios/guest-to-same.spec.ts` `describe('EX')` 또는 컴포넌트 테스트 |
| F2-1 | Vitest / Playwright — 테스트 이름에 `F2-1` |
| F2-2 | Vitest / Playwright — 테스트 이름에 `F2-2` |
| F2-3 | Vitest / Playwright — 테스트 이름에 `F2-3` |
| F2-5 | Vitest / Playwright — 테스트 이름에 `F2-5` |
| F2-7 | Vitest / Playwright — 테스트 이름에 `F2-7` |
| F6-1 | pgTAP `supabase/tests/` — 테스트 이름에 `F6-1` |

## 열린 질문

- 텍스트 레시피 체험 출력의 노출 범위(디자인, 유료 전환 단계 — MVP에는 체험 없음)
- 판매 중지 사유 코드 5~6종 문구
