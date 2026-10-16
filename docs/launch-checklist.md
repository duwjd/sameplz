# 출시 체크리스트 (MVP 무료 출시)

출시 판단은 `docs/plan-12w.md` 「출시 판단(go/no-go)」을 따른다. 상태는 출시 직전에 사람이 채운다. 비밀 값은 채팅에 붙이지 않고 각 콘솔에 직접 넣는다.

## 1. go/no-go

| # | 항목 | 상태 | 근거·확인 방법 |
|---|---|---|---|
| 1 | 무료 레시피 40개 이상(목표 60) | 확인 필요 | 운영 SQL: `select count(*) from public.recipes where status = 'live';` |
| 2 | 창립 크리에이터 6명 이상 | 확인 필요 | `select count(distinct owner_id) from public.recipes where status = 'live' and owner_id <> '<운영팀 계정 id>';` |
| 3 | 직무마다 레시피 3개 이상 | 확인 필요 | `select j, count(*) from public.recipes r, unnest(r.job_codes) j where r.status = 'live' group by j order by 2;` — 9개 직무가 모두 3 이상 |
| 4 | 실사용자 SAME 인증 40건 | 확인 필요 | `select count(*) from public.gallery_posts where kind = 'same_cert' and status = 'visible';`(운영팀 계정 글은 빼고 센다) |
| 5 | MVP SCN e2e 통과 | **파일 9/9, CI `e2e` 통과로 확인** | SCN 1 `guest-to-same` · 5 `same-cert-to-gallery` · 6 `trial-to-certify`(PR O) · 7 `first-sale-registration` · 8 `fork-free-share` · 9 `stopped-recipe` · 10 `zero-result-search` · 11 `my-page-tour` · 12 `withdraw-rejoin`. 승격 PR의 CI `e2e` 통과 기록을 본다 |
| 6 | 처리방침·약관·금지 콘텐츠 정책·AI 고지 게시 | **페이지 있음**, 운영 배포·법률 검토는 확인 필요 | `src/app/terms`, `src/app/privacy`, `src/app/policy/content`, `src/app/policy/ai`, `src/app/guide` + `e2e/scenarios/policy.spec.ts`. 운영자 정보는 `src/lib/policy/operator.ts` |
| 7 | 월 예산 킬 스위치·계정 일일 한도·레이트 리밋 동작 | **구현·pgTAP 있음**, CI 통과는 확인 필요 | `supabase/tests/credits.test.sql`: `BUDGET_EXHAUSTED`(예산 초과·`paused`), `DAILY_LIMIT`, `RATE_LIMITED`, IP당 하루 가입 3개. 운영 예산 행 40,250C(D12) |
| 8 | 서치어드바이저·서치콘솔 등록 | 확인 필요 | 아래 2-6 |

## 2. 사용자 할 일 (출시 전)

### 2-1. Vercel 환경 변수 (Production, `stg`는 Preview·브랜치 `stg`)
`env.example` 기준. 이름만 적는다.

| 변수 | MVP | 메모 |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | 필요 | `https://sameplz.vercel.app` |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 필요 | |
| `SUPABASE_SECRET_KEY` | 필요 | 서버 전용. `NEXT_PUBLIC_` 금지 |
| `GENERATION_PROVIDER` | 필요 | `fal`(기본값 `mock`이면 실제 생성 안 됨) |
| `FAL_KEY`, `FAL_USER_ID` | 필요 | `FAL_USER_ID`가 없으면 운영에서 fal 웹훅을 받지 않는다 |
| `GENERATION_WEBHOOK_BASE_URL` | 선택 | 비우면 `NEXT_PUBLIC_SITE_URL` |
| `OPENAI_API_KEY` | 필요 | 모더레이션(2층·플레이그라운드) |
| `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET` | 필요 | D4-B |
| `CRON_SECRET` | 필요 | Vault `sameplz_cron_secret`과 같은 값 |
| `OPS_ALERT_WEBHOOK_URL` | 필요 | Slack·Discord 수신 웹후크(https). 없으면 예산·SLA·P0 알림이 안 간다 |
| `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN` | 권장 | 켜면 `/privacy`에 Sentry 위탁이 표시된다 |
| `REPLICATE_API_TOKEN`, `REPLICATE_WEBHOOK_SECRET` | 불필요 | fal 사용(D8) |
| `RESEND_API_KEY`, `SOLAPI_API_KEY`, `SOLAPI_API_SECRET`, `KAKAO_PFID` | 불필요 | 코드에서 쓰지 않음(확인함) |
| `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` | 불필요 | GA4로 바꿈(D21) |
| `NEXT_PUBLIC_TOSS_CLIENT_KEY`, `TOSS_SECRET_KEY`, `TOSS_PAYOUT_SECURITY_KEY`, `TOSS_WEBHOOK_SECRET` | 불필요 | 유료 전환 단계 |
| `NEXT_PUBLIC_PORTONE_STORE_ID`, `NEXT_PUBLIC_PORTONE_IDENTITY_CHANNEL_KEY`, `PORTONE_API_SECRET` | 불필요 | 유료 전환 단계 |

**코드에서 쓰지만 `env.example`에 없는 것** (같이 넣는다):
- `ANTHROPIC_API_KEY` — 올리기 2층 검사. 없으면 모든 올리기가 사람 확인으로 간다(`docs/branching.md`).
- `KAKAO_REST_API_KEY`, `KAKAO_CLIENT_SECRET` — 카카오 로그인(`src/lib/auth/kakao.ts`).
- `NEXT_PUBLIC_GA_ID` — GA4(D21). 없으면 로드하지 않고 `/privacy`에도 표시하지 않는다.
- `MODERATION_PROVIDER` — 운영에서는 **넣지 않는다**(`mock`이면 검사를 건너뜀).
- `SENTRY_DSN` — 선택(서버용, 없으면 `NEXT_PUBLIC_SENTRY_DSN`).

### 2-2. Supabase Vault (pg_cron이 씀)
SQL Editor(운영)에서 사용자가 값을 넣는다: `select vault.create_secret('<값>', '<이름>');`
- `sameplz_site_url` — `https://sameplz.vercel.app`
- `sameplz_cron_secret` — Vercel `CRON_SECRET`과 같은 값

둘 중 하나라도 없으면 sweeper가 조용히 돌지 않는다 → 생성 마무리·파일 정리·모든 운영 알림이 멈춘다.

### 2-3. 공급자
- fal 지출 한도(spend cap)를 **월 $50 이하**(D12 예산 40,250C)로 건다.
- fal 동시 요청 한도 상향 확인(신규 2건, D8).
- OpenAI 사용량 알림.

### 2-4. 계정 보안
- 관리자 Google 계정 **2단계 인증**(D23). 관리자 지정은 런북 12.
- Supabase·Vercel·GitHub·fal 계정 2단계 인증.

### 2-5. 로그인 설정
- Supabase Auth Redirect URLs, Google OAuth 동의 화면, 카카오·네이버 콘솔 콜백에 운영 주소(필요하면 stg 주소).

### 2-6. 검색 등록
- 네이버 서치어드바이저·구글 서치콘솔에 `https://sameplz.vercel.app` 등록, `https://sameplz.vercel.app/sitemap.xml` 제출. 색인은 약 2주.

### 2-7. 승격·DB 반영
1. `dev → stg` PR(머지 커밋) → stg 미리보기 확인
2. `stg → main` PR(머지 커밋) → Vercel 운영 배포
3. `deploy-db`가 `production` 환경 승인을 기다린다 → dry-run 출력(대기 마이그레이션)을 보고 승인 → `supabase db push`
4. GitHub `production` 환경 secret(`SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_REF`)이 있는지 먼저 확인

## 3. 운영 스모크 (배포·DB 반영 뒤, 시험 계정으로)

1. **로그인**: Google·카카오·네이버 각각 → 가입 마무리(약관 + 만 18세) → 크레딧 270C
2. **레시피 받기**: 상세 → 「무료로 SAME 하기」 → 라이브러리 → 원문 열기
3. **플레이그라운드 1회**: 받은 레시피로 이미지 1장 → 결과가 뜨고 크레딧 내역에 차감(실패면 반환) 확인
4. **SAME 인증**: 결과로 SAME 인증 올리기 → 갤러리·상세에 보임
5. **/admin**: 관리자로 개요·심사 큐·신고함·레시피 조치·회원이 열림, 일반 계정은 안 열림
6. **크론**: SQL Editor에서
   ```sql
   select status, start_time from cron.job_run_details
    where jobid = (select jobid from cron.job where jobname = 'sameplz-play-sweeper')
    order by start_time desc limit 5;
   ```
   매분 `succeeded`이고 Vercel 로그에 `/api/cron/play-sweeper` 200이 찍히는지. 운영 웹후크에 시험 알림이 오는지(예: 신고 1건을 20시간 두지 말고 웹후크 URL로 직접 POST해 본다).

시험 데이터는 운영에 남는다. 끝나면 시험 레시피는 비공개로, 시험 SAME 인증은 지운다.

## 모니터링 계정 설정 (키를 넣기 전에 꼭)

처리방침 §3·§4 문구가 사실이 되려면 아래 설정이 필요해요.

- **GA4**(관리 → 데이터 스트림 → 웹)
  - 「향상된 측정」을 끈다. 특히 「브라우저 기록 이벤트 기반 페이지 변경」과 「사이트 검색」.
  - Google 신호·광고 개인화를 끈다. 앱도 꺼서 보낸다.
  - 앱은 비공개 화면(`/my`·`/play`·`/admin`·`/welcome`·`/auth`·`/blocked`)에서 GA를 끄고 쿼리 없는 경로만 보낸다(`src/components/shell/Analytics.tsx`).
- **Sentry**(Project Settings → Security & Privacy)
  - 「Prevent Storing of IP Addresses」를 켠다.
  - 「Data Scrubber」를 켜고 기본 규칙을 둔다.
  - 「Allowed Domains」를 `sameplz.vercel.app`으로 한다.
  - Spike Protection과 프로젝트 레이트 리밋을 켠다. DSN은 공개 값이라 누구나 이벤트를 보낼 수 있다.
  - 앱은 비공개 화면의 오류 메시지 본문을 보내지 않고, 프롬프트·토큰·이메일·행 값은 지운다(`src/lib/ops/sentry.ts`).
