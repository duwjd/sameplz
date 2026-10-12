# 토큰

와이어프레임 v0.5는 흑백 와이어프레임이다. 아래 값은 와이어프레임 CSS에서 뽑은 구조 토큰이고, 브랜드 색·최종 타이포는 아직 정하지 않았다.

> TODO(open): 브랜드 포인트 색과 최종 폰트는 디자인 결정 전이다. 정해지면 이 파일과 `src/app/globals.css`의 shadcn 변수를 함께 바꾼다. 그전까지 회색조로 만든다.
> 원천: claude.ai/design 프로젝트(`docs/design-system.md`). 토큰을 옮길 때 이 파일과 함께 갱신한다.

## 색 (와이어프레임 CSS 변수 → shadcn 변수)

| 와이어프레임 | 라이트 | 다크 | shadcn(Tailwind v4) |
|---|---|---|---|
| `--bg` | `#ffffff` | `#0e0e0e` | `--background` |
| `--fg` | `#121212` | `#efefef` | `--foreground` |
| `--mute` | `#5f5f5f` | `#a8a8a8` | `--muted-foreground` |
| `--hair` | `#cdcdcd` | `#3b3b3b` | `--border`, `--input` |
| `--fill` | `#eeeeee` | `#1f1f1f` | `--muted`, `--secondary` |
| `--fill2` | `#f7f7f7` | `#171717` | `--card` |
| `--ph` | `#dddddd` | `#2d2d2d` | 자리표시 이미지 배경 |
| `--ph2` | `#c6c6c6` | `#404040` | 자리표시 테두리 |
| `--ph-ink` | `#5a5a5a` | `#a3a3a3` | 자리표시 글자 |
| `--scrim` | `rgba(0,0,0,.55)` | `rgba(0,0,0,.72)` | 팝업 뒤 배경 |

다크 모드는 `prefers-color-scheme: dark`를 따른다.

## 글꼴

- 본문: `'IBM Plex Sans KR', 'Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans KR', system-ui, sans-serif`
- 숫자·코드: `'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace` (가격·크레딧·순위 숫자, 설치 명령)
- 와이어프레임 크기 분포: 11 · 12 · 12.5 · 13 · 14 · 15 · 16 · 20px. 본문 14px, 보조 12~13px, 섹션 제목 16~20px.
- OG 이미지(`opengraph-image.tsx`)에는 한글 폰트를 포함한다.

## 레이아웃

- 모서리: 와이어프레임은 `border-radius: 0`. 최종 반경은 브랜드 결정 뒤.
- 마이페이지 왼쪽 메뉴 폭 `--lw: 256px`, 오른쪽 패널 `--rw: 344px`.
- 중단점: 1180px, 900px, 700px. 700px 이하가 모바일(하위 메뉴 줄, 필터 접힘, SAME 바 하단 고정).
- `prefers-reduced-motion: reduce`면 배너 자동 넘김과 전환 애니메이션을 끈다.

## 미디어

- 영상은 원래 비율(9:16 포함) 그대로, 포스터 + 눌러서 재생.
- 썸네일에는 가격·할인·별점 글자를 넣지 않는다(반려 R14).
- 결과물마다 「AI 생성」 배지.
