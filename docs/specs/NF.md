# NF · 404 · 없는 주소

- 경로: (없는 주소, 비공개·심사 중 레시피) → `notFound()`
- 와이어프레임: `docs/wireframe/sameplz-wireframe-v0.5.html` (key `nf`), 인벤토리 `docs/wireframe/_context_wireframe_inventory.md`
- 기능 묶음: [F1](F1-discovery.md) — F1 탐색 — HOME · MKT · COL · NF

## 목적

주소가 바뀌었거나 비공개·사람 확인 중인 레시피, 또는 없는 화면 주소.

## 아이템

- **NF-01** 안내: 이유를 쉬운 말로, 홈과 탐색으로 가는 버튼.
- **NF-02** 인기 레시피: 바로 구경할 거리.

### 필수 콘텐츠 (보고서 F 묶음에서)

- **NF-01 · 02**: 이유 문구, 홈·탐색 버튼, 인기 레시피 4~6개 — 출처 E+S

## 동작

- 홈 · 프롬프트 보기 · 인기 레시피로 돌려보냄
- 주소창에 아무 주소나 넣어도 이 화면(예: /r/zz99, /abc)

## 규칙 (rl)

- —

## 경우의 수 (c)

- 비공개·사람 확인 중 레시피를 남이 열면 404와 같은 화면(있는지 없는지 알리지 않음)

## 예외 (EX)

- [ ] 없는 레시피 주소 (404)

## 데이터 · API

DAL `getHomeSections()`(`"use cache"`, `cacheLife('minutes')`), `searchRecipes()` → RPC `search_recipes(q, filters, sort, cursor)`, `getZeroResultHints()`, 액션 `toggleFollow`, `logSearch`, `pg_cron`의 MV(`mv_recipe_popularity`) 갱신과 매시 `ranking_snapshots`.

## 수용 기준

| ID | P | 요구 | 수용 기준 | 목표 주 |
|---|---|---|---|---|
| F1-7 | P0 | 비공개·심사 중 레시피의 존재를 숨긴다 | 남이 `/r/{id}`를 열면 없는 주소와 같은 NF 화면, HTTP 404 | W3 |

## 테스트 매핑

| 대상 | 테스트 위치 |
|---|---|
| EX 항목 전체 | 컴포넌트 테스트 `src/app/**/*.test.tsx` 또는 컴포넌트 테스트 |
| F1-7 | Vitest / Playwright — 테스트 이름에 `F1-7` |

## 열린 질문

- ▲▼ 임계값(데이터, 베타로 보정)
- 인기 검색어 전환 기준(주간 검색 약 500회부터 시스템 계산)
- HOME-06 첫 화면 한 줄 고지 위치(변호사 확정)
