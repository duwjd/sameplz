---
name: wireframe-to-ui
description: SAMEPLZ 와이어프레임 아이템을 Next.js 화면·컴포넌트로 옮긴다. src/app·src/components 작업 때 쓴다.
# TODO(unverified): 스킬 `paths` 값 표기(YAML 목록 vs 쉼표 문자열)는 스킬 문서에서 확정하지 못했다.
# 경로 규칙(.claude/rules) 문서의 YAML 목록 형식을 따랐다. /context 또는 /skills 에서 자동 로드되는지 확인할 것.
paths:
  - "src/app/**/*.tsx"
  - "src/components/**"
---
# 와이어프레임 → UI

참고 파일:
- [screen-map.md](screen-map.md) — 경로 ↔ 화면 코드 ↔ 아이템 ↔ 팝업
- [voice.md](voice.md) — 카피 규칙과 자주 쓰는 문구
- [tokens.md](tokens.md) — SAMEPLZ 디자인 시스템 토큰(`--sp-*`)과 컴포넌트 위치
- 디자인 시스템: `docs/design-system.md`, 컴포넌트 `src/components/ds/`
- 원본: `docs/wireframe/sameplz-wireframe-v0.5.html`, `docs/wireframe/_context_wireframe_inventory.md`
- 명세: `docs/specs/<CODE>.md`

## 순서

1. **아이템 → 컴포넌트 매핑**: 명세의 아이템(예: PRM-01~08)마다 컴포넌트 하나. 이름은 역할로(`ResultGallery`, `SameButton`), 파일 위 주석에 아이템 ID.
2. **서버/클라이언트 경계**: 기본은 서버 컴포넌트. 상호작용이 필요한 가장 작은 조각만 `'use client'`. 원문은 절대 클라이언트 props로 넘기지 않는다.
3. **디자인 시스템**: 화면은 `src/components/ds/`(`@/components/ds`)의 컴포넌트로만 조립한다. 색·간격·글꼴은 `var(--sp-*)` 토큰만 쓰고 hex를 새로 쓰지 않는다. 없는 부품은 같은 그룹 폴더에 같은 방식(인라인 스타일 + 토큰)으로 추가한다. 토스트는 `ds/feedback/Toast`. shadcn은 쓰지 않는다.
4. **카피**: [voice.md](voice.md). 명세·와이어프레임의 문구를 그대로 쓰고, 없으면 보이스 규칙대로 만든다.
5. **EX 상태별 변형**: 명세의 예외(EX) 목록마다 화면 상태를 만든다(빈 화면, 비회원, 오류, 연결 끊김, 권한 없음). 상태는 props나 Suspense 경계로 나눈다.
6. **상태별 주 버튼 하나**: 상세 화면의 SAME 버튼은 상태(비회원/안 받음/무료/받음/내 레시피/판매 중지)마다 하나만.
7. **접근성**: `.claude/rules/ux-copy-a11y.md`. 배너 WCAG 2.2.2, 폼 오류 포커스, 키보드, 대체 텍스트, 「AI 생성」 표시.
8. **반응형**: 데스크톱/모바일 차이(와이어프레임 c 항목: 모바일 SAME 바 고정, 하위 메뉴 줄, 필터 접힘 등).
9. **검증**: ui-verifier에 화면 코드와 확인할 아이템·EX 목록을 넘긴다.

## 하지 않는 것

- 와이어프레임에 없는 화면 요소(별점·리뷰·카테고리 입구 카드)를 만들지 않는다.
- 데이터 접근을 컴포넌트 안에서 직접 하지 않는다. DAL(`src/data`)과 서버 액션(`src/actions`)을 쓴다.
- 9:16 영상 자동 재생. 포스터 + 눌러서 재생.
