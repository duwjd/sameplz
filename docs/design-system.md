# 디자인 시스템

SAMEPLZ UI는 **SAMEPLZ Design System**을 쓴다. goorm의 오픈소스 Vapor 디자인 시스템 구조(토큰·컴포넌트·아이콘)에 브랜드 4색 Mint `#00FF9C` · Lime `#B6FFA1` · Lemon `#FEFFA7` · Yellow `#FFE700`으로 색을 다시 짠 것이다.

- 원천: Claude Design 프로젝트 「Vapor design system 컬러 재구성」의 핸드오프 번들(`vapor-design-system/`, 기준 화면 `SAMEPLZ Home.dc.html`)
- 원본 규칙 전문: 번들의 `project/readme.md`. 아래는 코드에서 지킬 요약이다.

## 코드 위치

| 무엇 | 위치 |
|---|---|
| 토큰(색·글자·간격·리셋) | `src/styles/sameplz/*.css` → `src/app/globals.css` |
| 글꼴 | Pretendard 가변(`src/app/fonts/PretendardVariable.woff2`, OFL-1.1), Fira Code(`next/font/google`) — `src/app/layout.tsx` |
| 아이콘 159개 | `src/components/ds/icons/{icon-data.ts,Icon.tsx}` |
| 로고 SVG | `public/brand/sameplz-{symbol,wordmark,wordmark-white,lockup,lockup-white}.svg` |
| 기본 컴포넌트 | `src/components/ds/{actions,layout,forms,data-display,data-table,disclosure,feedback,navigation,overlay}/` |
| SAMEPLZ 도메인 컴포넌트 | `src/components/ds/{brand,shell,market,detail,gallery,playground,account}/` |
| 포맷터 | `src/components/ds/market/format.ts`(formatWon·formatCount·formatCredit) |
| 묶음 export | `@/components/ds` |

컴포넌트는 번들의 `.jsx`를 TypeScript로 그대로 옮긴 것이다(인라인 스타일 + `var(--sp-*)`). 시각 값을 바꿀 때는 토큰을 먼저 바꾼다. shadcn/ui는 쓰지 않는다.

## 지킬 규칙

- **색**: 브랜드색은 채움·강조용이다. 밝은 채움 위 글자는 잉크 `#0E1A14`(`--sp-fg-accent`), 흰색 금지. 흰 바탕 위 브랜드색 글자는 진한 단계(Mint 900 등). 한 화면에 큰 Mint 면은 하나 이하.
- **그라데이션**(`--sp-brand-gradient`)은 로고와 배너 아트에만. 버튼·칩·글자·상태에 쓰지 않는다.
- **그림자**는 오버레이만. 카드는 테두리. 글로우·색 그림자·글래스모피즘 금지.
- **상태**: 호버는 한 단계 진하게, 누름에 크기 변화 없음, 비활성은 40% 투명도 + 이유 표시, 선택은 primary-soft 바탕 + primary 글자.
- **모션**: 100/150/200/500ms, `ease`. 바운스·스프링·무한 장식 반복 없음.
- **카피**: 해요체, 문장형 대소문자, 버튼은 동사, 느낌표·이모지 없음.
- **아이콘 매핑**: SAME → CopyOutlineIcon, 크레딧 → LightningIcon, 포크 → ForkIcon, 바로 만들어 보기 → MagicWandIcon, 다운로드 → DownloadOutlineIcon, 좋아요 → Heart(Outline)Icon.
- **결과물**: 원래 비율 그대로, 「AI 생성」 표시. 홈 배너는 항상 다크 테마.

토큰 요약과 레이아웃 값은 `.claude/skills/wireframe-to-ui/tokens.md`.
