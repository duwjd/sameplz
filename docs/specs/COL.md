# COL · 마켓 · 컬렉션

- 경로: `/market/collections`
- 와이어프레임: `docs/wireframe/sameplz-wireframe-v0.5.html` (key `collection`), 인벤토리 `docs/wireframe/_context_wireframe_inventory.md`
- 기능 묶음: [F1](F1-discovery.md) — F1 탐색 — HOME · MKT · COL · NF

## 목적

마켓 하위 메뉴의 컬렉션. 카테고리를 섞어 묶은 편집 팩. 인기순만으로는 안 보이는 레시피를 꺼낸다.

## 아이템

- **COL-01** 큐레이션 팩: 카테고리를 섞어 묶은 편집 팩.

### 필수 콘텐츠 (보고서 F 묶음에서)

- **COL-01**: 팩 6개 × 레시피 6~8개, 팩마다 제목·소개·커버(결과물 3장)·추천 이유 1줄, 다운로드 하위 50% 레시피 2개 이상 — 출처 E · 이후 주 1팩

## 동작

- 팩 펼치기 → 아래에 카드 목록 · 다시 누르면 접힘

## 규칙 (rl)

- —

## 경우의 수 (c)

- —

## 예외 (EX)

- [ ] 마켓 하위 메뉴 펼침 (호버 상태)

## 데이터 · API

DAL `getHomeSections()`(`"use cache"`, `cacheLife('minutes')`), `searchRecipes()` → RPC `search_recipes(q, filters, sort, cursor)`, `getZeroResultHints()`, 액션 `toggleFollow`, `logSearch`, `pg_cron`의 MV(`mv_recipe_popularity`) 갱신과 매시 `ranking_snapshots`.

## 수용 기준

| ID | P | 요구 | 수용 기준 | 목표 주 |
|---|---|---|---|---|
| F1-9 | P1 | 컬렉션 펼침·급상승 정렬 | 급상승은 공개 14일 이내 레시피만, 증가율 기준 | — |

## 테스트 매핑

| 대상 | 테스트 위치 |
|---|---|
| EX 항목 전체 | 컴포넌트 테스트 `src/app/**/*.test.tsx` 또는 컴포넌트 테스트 |

## 열린 질문

- ▲▼ 임계값(데이터, 베타로 보정)
- 인기 검색어 전환 기준(주간 검색 약 500회부터 시스템 계산)
- HOME-06 첫 화면 한 줄 고지 위치(변호사 확정)
