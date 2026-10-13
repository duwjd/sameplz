# src/app — 라우트 규약

Next.js 16.3.x App Router, `cacheComponents: true`. 서버 컴포넌트가 기본이다.

> **MVP(무료 출시)**: `/checkout`(PAY), `/my/orders`(ORD), `/api/webhooks/toss`는 유료 전환 단계라 만들지 않는다. `/my/credits`는 무료 크레딧 잔액·내역만, `/my/seller`는 「내 레시피」 + 대기 명단, `/my/seller/upload`는 무료 올리기만. 받기 버튼은 결제 없이 `claim_free_recipe`.

## 경로 ↔ 화면 코드

| 경로 | 화면 | 렌더링 |
|---|---|---|
| `/` | HOME | 정적 셸 + `"use cache"` 섹션(태그 `rankings`, `gallery`). GNB 사용자 영역은 Suspense |
| `/market`, `/market/{prompts,agents,skills,collections}` | MKT, COL | 동적(searchParams). 내부 쿼리 함수만 정규화한 파라미터로 캐시 |
| `/r/[id]` | PRM·AGT·SKL·STOP | 공개 부분은 `recipe:{id}` 태그로 캐시, 보는 사람 상태는 Suspense. 비공개·심사 중·없음이면 `notFound()` |
| `/gallery` | GAL | 무한 스크롤(TanStack Query) |
| `/play` | PLAY | 클라이언트 중심, `run:{id}` 비공개 채널 구독 |
| `/checkout` | PAY | 동적, 로그인 필수 |
| `/guide` | GUIDE | 정적 |
| `/my`, `/my/{library,orders,credits,notifications,activity,profile,account}` | MY·LIB·ORD·CRD·NOTI·ACTV·PRF·ACC | 동적. 사용자 키 없이 `"use cache"` 금지 |
| `/my/seller`, `/my/seller/upload` | SELL, UP | 동적. 미디어는 서명 업로드 URL로 Storage 직행 |
| `/admin/**` | ADM | `admin` 클레임 + MFA, noindex |
| `/auth/callback`(구글), `/auth/kakao`·`/auth/kakao/callback`(카카오 OIDC → ID 토큰), `/auth/naver`·`/auth/naver/callback`(D4-B) | 로그인 | Route Handler. 성공하면 가입 미완료는 `/welcome`, 실패는 `next?auth_error=` |
| `/welcome` | 가입 마무리(F7-9) | 동적, 로그인 필수, noindex |
| `/terms`, `/privacy` | 정책(초안 자리) | 정적 |
| `/api/webhooks/toss`, `/api/webhooks/generation/[provider]`, `/api/play/runs`, `/api/files/[versionId]`, `/api/cron/[job]` | — | Node 런타임, 원본 body로 서명 검증 |

없는 주소·비공개·심사 중·반려 레시피는 같은 NF 화면(`src/app/not-found.tsx`, HTTP 404)이다. 존재 여부를 알리지 않는다.
`/r/[id]`는 `params`와 캐시된 `getRecipePublic`을 Suspense **앞에서** 확인하고 `notFound()`한다(스트리밍이 시작되면 404 상태를 못 보낸다). `generateStaticParams`는 인기 레시피 20개(없으면 자리표시 1개 — Cache Components는 빈 배열을 거부).
`sitemap.ts`(라이브 레시피·마켓)와 `robots.ts`(`/my`·`/checkout`·`/play`·`/admin`·`/welcome`·`/auth`·`/api` 제외).

## 규칙

- 라우트 핸들러는 위 6곳만. 나머지 쓰기는 `src/actions`의 서버 액션 → RPC.
- `"use cache"`는 공개 데이터에만. 사용자별 데이터를 레시피 키만으로 캐시하지 않는다.
- 보는 사람 상태(받음·내 레시피·체험 사용 여부 — 체험은 유료 전환 단계)는 Suspense 경계 안에서 동적으로 읽는다.
- `params`·`cookies()`는 비동기다. `revalidateTag`는 cacheLife 프로필을 받는다. 쓰기 뒤에는 `updateTag`.
- `proxy.ts`(구 middleware)는 세션 갱신만 한다. 인가 판단을 넣지 않는다.
- `robots`에서 `/my`, `/checkout`, `/play`, `/admin`을 제외한다. STOP은 `noindex` 또는 `availability: Discontinued`.
- 상세(`/r/[id]`)는 SSR로 실제 텍스트를 HTML에 담는다(네이버 색인). 원문은 절대 넣지 않는다.
- 결과물 이미지·영상에는 「AI 생성」 표시. 9:16 영상은 포스터 + 눌러서 재생(자동 재생 금지).
- 배너는 5초 자동 넘김, 호버·포커스 시 멈춤, 직접 넘기면 자동 넘김 끔, `prefers-reduced-motion`이면 처음부터 멈춤(WCAG 2.2.2).

세부 규칙은 경로 규칙(`.claude/rules/nextjs-app.md`, `hidden-content.md`, `ux-copy-a11y.md`)이 파일을 열 때 자동으로 붙는다.
