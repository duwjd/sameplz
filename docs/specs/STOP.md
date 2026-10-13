# STOP · 판매 중지 레시피

- 경로: `/r/[id]` (status=stopped)
- 와이어프레임: `docs/wireframe/sameplz-wireframe-v0.5.html` (key `item-stopped`), 인벤토리 `docs/wireframe/_context_wireframe_inventory.md`
- 기능 묶음: [F2](F2-detail.md) — F2 상세 — PRM · AGT · SKL · STOP
- 의존 결정: D9 (`docs/decisions.md`) — open이면 해당 부분은 멈추고 묻는다

## 목적

링크로 들어와도 받기 버튼 없이 사유와 비슷한 레시피를 보여 준다.

## 아이템

- **STOP-01** 중지 안내: 사유와 함께 지금은 받을 수 없다고 알린다.
- **STOP-02** 받은 사람 안내: 받은 버전은 계속 쓸 수 있다는 안내와 「받은 버전 열기」.
- **STOP-03** 비슷한 레시피: 막힌 길에서 돌아갈 곳.

### 필수 콘텐츠 (보고서 F 묶음에서)

- **STOP-01~03**: 중지 사유(코드 5~6종 문구), 받은 사람용 「받은 버전 열기」, 비슷한 레시피 3개

## 동작

- 받은 사람: 「받은 버전 열기」 → 원문(계속 사용)
- 안 받은 사람: 사유 + 비슷한 레시피

## 규칙 (rl)

- 받은 버전은 판매가 멈춰도 계속 사용
- 중지 사유가 설명과 다름에 해당하면 신고로 환불

## 경우의 수 (c)

- 비회원·안 받은 회원: 받기 버튼 없음
- 받은 회원: 「받은 버전 열기」 · 라이브러리
- 만든 사람: 일반 상세 + 「판매 중지」 상태 띠

## 중지 사유 코드 (W3 확정, `recipes.stopped_reason`)

| 코드 | 문구 |
|---|---|
| `creator_request` | 크리에이터가 판매를 멈췄어요. |
| `rights_claim` | 권리 침해 신고가 들어와 확인하고 있어요. |
| `policy_violation` | 운영 정책에 맞지 않아 판매를 멈췄어요. |
| `misleading` | 설명과 결과가 달라 판매를 멈췄어요. |
| `quality` | 결과가 안정적으로 나오지 않아 판매를 멈췄어요. |
| `other` | 운영 사정으로 판매를 멈췄어요. |

MVP: STOP-02의 환불·신고 문장은 없다(무료 출시). 만든 사람에게는 「판매를 멈춘 내 레시피예요」 띠 + 일반 상세.

## 예외 (EX)

- [ ] 받은 사람이 들어옴
- [ ] 안 받은 사람이 들어옴

## 데이터 · API

`getRecipePublic(publicId)`(태그 `recipe:{id}`), `getViewerState(recipeId)`(동적), 액션 `toggleLike`·`toggleFollow`·`createReport`·`recordShareClick`, `generateMetadata`, `opengraph-image.tsx`(한글 폰트 포함). 상세는 SSR로 실제 텍스트를 HTML에 담는다(네이버는 SPA에 SSR 권장). 원문은 담지 않는다.

## 수용 기준

| ID | P | 요구 | 수용 기준 | 목표 주 |
|---|---|---|---|---|
| F2-4 | P0 | 판매 중지 레시피는 막되 받은 사람은 계속 쓴다 | 비회원·안 받은 회원: 받기 버튼 없음 + 사유 + 비슷한 레시피 / 받은 회원: 「받은 버전 열기」 / 만든 사람: 일반 상세 + 「판매 중지」 띠. 검색엔진용 `noindex` 또는 `availability: Discontinued` | W3 |

## 테스트 매핑

| 대상 | 테스트 위치 |
|---|---|
| SCN: 판매 중지된 레시피 (guest · jiwoo · creator, W4) | `e2e/scenarios/stopped-recipe.spec.ts` |
| EX 항목 전체 | `e2e/scenarios/stopped-recipe.spec.ts` `describe('EX')` 또는 컴포넌트 테스트 |
| F2-4 | Vitest / Playwright — 테스트 이름에 `F2-4` |

## 열린 질문

- 텍스트 레시피 체험 출력의 노출 범위(디자인, 유료 전환 단계 — MVP에는 체험 없음)
- ~~판매 중지 사유 코드 5~6종 문구~~ → W3 확정(STOP.md 「중지 사유 코드」)
