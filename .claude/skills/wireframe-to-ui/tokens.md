# 토큰

화면의 색·글꼴·간격은 **SAMEPLZ 디자인 시스템**(Vapor 기반, `docs/design-system.md`)을 따른다. 와이어프레임 v0.5의 흑백·직각 값은 구조 참고용이고 시각 값으로 쓰지 않는다.

- 토큰 파일: `src/styles/sameplz/{colors,typography,spacing,base}.css` → `src/app/globals.css`가 불러온다. 접두사는 `--sp-`.
- 컴포넌트: `src/components/ds/<group>/<Name>.tsx`. 아이콘은 `@/components/ds/icons/Icon`(`<Icon name="SearchOutlineIcon" size={16} />`).
- hex를 새로 쓰지 않는다. 필요한 값이 없으면 토큰을 추가하고 `docs/design-system.md`에 적는다.

## 색 (자주 쓰는 의미 토큰)

| 용도 | 토큰 |
|---|---|
| 페이지 바탕 / 카드 면 | `--sp-bg-canvas` / `--sp-bg-surface` |
| 본문 글자 / 보조 글자 | `--sp-fg-normal` / `--sp-fg-hint` |
| 테두리 | `--sp-border-normal` |
| 주 버튼·선택·포커스 (Mint) | `--sp-bg-primary`, 위 글자 `--sp-fg-accent`(잉크, 흰색 금지) |
| 흰 바탕 위 브랜드색 글자 | `--sp-fg-primary`(Mint 900) |
| 잉크 면(툴팁·선택 칩·미디어 태그) | `--sp-bg-contrast` + `--sp-fg-on-contrast`(Mint 글자) |
| 성공 / 경고 / 위험 | `--sp-*-success`(Lime) / `--sp-*-warning`(Yellow) / `--sp-*-danger`(#F5535E) |
| 브랜드 그라데이션 | `--sp-brand-gradient` — 로고와 배너 아트에만 |

다크 테마는 조상 요소에 `data-theme="dark"`. 홈 배너는 항상 다크.

## 글꼴

- 본문: Pretendard(가변, `next/font/local`, `src/app/fonts/PretendardVariable.woff2`) → `--sp-font-sans`
- 코드: Fira Code(`next/font/google`) → `--sp-font-code`
- 크기 `--sp-fs-050…900`(12→80px), 글자 클래스 `.sp-display-1`, `.sp-heading-1…6`, `.sp-body-1/2`, `.sp-label-1/2`, `.sp-caption`, `.sp-code`
- 가격·다운로드·SAME 수는 고정폭 숫자(`font-variant-numeric: tabular-nums`). 한글 줄 높이 1.5 이상.
- OG 이미지(`opengraph-image.tsx`)에는 한글 폰트를 포함한다.

## 레이아웃

- 4px 기준, `--sp-space-100` = 8px. 컨트롤 높이 24/32/40/48(sm/md/lg/xl).
- 모서리: 컨트롤 8px(`--sp-radius-300`), 카드 12–16px, 알약·스위치·아바타 full. 직각 없음.
- 그림자는 오버레이(메뉴·팝오버·토스트·대화상자)만. 카드는 테두리로 구분.
- 앱 셸: 왼쪽 사이드바 약 248px, 상단 바 60px. 마케팅 페이지 최대 폭 1120–1200px.
- 중단점(와이어프레임): 1180px, 900px, 700px. 700px 이하가 모바일(하위 메뉴 줄, 필터 접힘, SAME 바 하단 고정).
- `prefers-reduced-motion: reduce`면 배너 자동 넘김과 전환 애니메이션을 끈다.

## 미디어

- 영상은 원래 비율(9:16 포함) 그대로, 포스터 + 눌러서 재생.
- 썸네일에는 가격·할인·별점 글자를 넣지 않는다(반려 R14).
- 결과물마다 「AI 생성」 표시, 체험 결과는 「SAMEPLZ 체험」 워터마크.
