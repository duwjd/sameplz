# SAMEPLZ 개발 하네스

SAMEPLZ(AI 레시피 마켓플레이스 + 플레이그라운드)를 **7주 무료 MVP**(W1 = 2026-10-05, 출시 W7 = 11/22까지)로 1인 개발해 내기 위한 **Claude Code 하네스 + 프로젝트 문서** 한 벌이다. Next.js 앱은 아직 없다. W1 첫 세션에서 Claude Code가 이 하네스를 쓰면서 앱을 스캐폴드한다.

원칙은 하나다. **반드시 일어나야 하는 일은 훅으로, 영역별 지식은 경로 규칙과 스킬로, 루트 CLAUDE.md는 짧게.** 하네스의 진짜 역할은 "운영에 닿지 않기, 원문이 새지 않기, 돈 함수 테스트가 먼저 있기"를 강제하는 것이다. 모든 것이 저장소에 커밋되므로 로컬과 클라우드 세션(claude.ai/code, `claude --cloud`)에서 똑같이 돈다(저장소에 선언한 플러그인은 클라우드에서 설치되지 않으므로 플러그인을 쓰지 않는다).

## MVP 범위 (무료 출시)

사업자등록 전이라 **PG 계약·통신판매업 신고·PortOne 본인인증이 없다.** 레시피는 전부 무료로 받고, 플레이그라운드는 월 무료 크레딧(가입·매월 리셋, D11)으로만 돈다. 계정 일일 한도·IP/기기 레이트 리밋·전체 월 예산 킬 스위치(D12·D13)가 출시 조건이다. UP은 무료 올리기만, SELL은 「내 레시피」 + 「유료 판매 오픈 알림 신청」 대기 명단. PAY·ORD·CRD 충전/환불·쿠폰·수수료·포크 로열티·지급대행·본인인증·「열기 전 7일」 환불은 `docs/plan-12w.md`의 「유료 전환 단계(사업자등록 후)」로 옮겼다. 하네스의 돈 규칙은 MVP에서 **크레딧 원장(grant·hold·settle)에만** 적용한다. 로그인은 Google + 카카오(개인 앱, 이메일 없음 → 키는 `auth.users.id`), 네이버는 W1 스파이크 또는 P1. 18+는 약관 + 자기 확인 체크박스.

## 무엇이 들어 있나

```
CLAUDE.md                 루트 규칙(절대 규칙 8개, 명령, 작업 방식, 문서 포인터)
.claude/settings.json     권한(allow/ask/deny), 훅 5개, MCP 승인 목록, plansDirectory
.claude/hooks/            protect-paths · guard-bash · format-file · stop-verify · session-context (+ lib/common.sh)
.claude/rules/            경로 규칙 6개(money, hidden-content, supabase-sql, nextjs-app, ux-copy-a11y, testing)
.claude/agents/           서브에이전트 7개(spec-planner, test-writer, db-migration-reviewer, security-auditor,
                          payment-auditor, ui-verifier, code-reviewer)
.claude/skills/           스킬 10개(/feature-from-spec, /wireframe-to-ui, /supabase-migration, rls-policy,
                          /credit-ledger, /payment-webhook, /generation-pipeline, /e2e-scenario, /sprint-status, /ship)
.claude/prod-ref.txt      운영 Supabase ref(비밀 아님) — guard-bash가 읽어 차단
.mcp.json                 dev 전용 MCP(로컬 Supabase, context7, 토스 문서, playwright, shadcn). shadcn 서버는 디자인 시스템 도입으로 쓰지 않는다
.github/workflows/        ci.yml · claude.yml(@claude) · deploy-db.yml(운영 스키마 반영). PR 자동 리뷰(claude-review)는 쓰지 않는다
src/app/CLAUDE.md, supabase/CLAUDE.md, e2e/CLAUDE.md   중첩 규칙(해당 폴더 파일을 읽을 때 로드)
docs/decisions.md         착공 전 결정 D1~D14 (MVP open: D4·D8·D10~D13, closed: D5·D6·D14, 유료 전환 deferred: D1·D2·D3·D7·D9)
docs/plan-12w.md          7주 MVP 계획(파일 이름만 12w), 외부 할 일, go/no-go, 잘라 낼 순서, 유료 전환 단계
docs/architecture.md      스택, 테이블 묶음, 돈 RPC 불변식, 경로↔화면, 배포 파이프라인, 함정 12개
docs/content-baseline.md  출시 콘텐츠 수량·가격대·시딩 계획
docs/specs/               기능 묶음 PRD F1~F8 + 화면 명세 22개 + ADM + SCN
docs/features.json        P0 요구사항 64개(passes:false, MVP 52 + "phase":"paid" 12) — 장기 실행 하네스용 기능 목록
docs/progress.md          진행 로그(세션마다 한 줄)
docs/plans/               계획 모드 산출물(plansDirectory)
docs/runbooks/            런북 목록(MVP는 W7까지, 돈 런북은 유료 전환 단계)
docs/wireframe/           와이어프레임 v0.5 HTML + 화면 인벤토리
scripts/                  check-rls.sql(CI), check-types.sh
env.example               환경 변수 이름 목록(값 없음)
vercel.json               { "regions": ["icn1"] }
```

## 준비물

| 도구 | 버전 | 메모 |
|---|---|---|
| Claude Code | v2.1.285(stable) 이상, 이 하네스는 v2.1.288에서 형식 검사 | `Read` 거부가 Write까지 막는 동작은 v2.1.228+, `/doctor prompt-audit`는 v2.1.283+ |
| Node.js | 22 | 토스 MCP가 Node 22 필요. 훅 스크립트가 JSON 처리에 node를 쓴다 |
| pnpm | 최신 | 클라우드 VM에도 있다 |
| git, gh | 최신 | GitHub은 MCP 대신 `gh` CLI |
| Supabase CLI | 최신 | `supabase start`에 Docker 필요 |
| Docker Desktop | 최신 | 로컬 Supabase |
| Vercel CLI | 최신 | `vercel link`, `vercel env pull` |
| jq | 선택 | node가 없을 때 훅의 대체 JSON 파서 |

훅은 bash 3.2(macOS 기본)와 bash 5 모두에서 돌도록 썼고, `git`과 `node`만 있으면 된다.

## 설치

### 1. 저장소 만들기

```bash
gh repo create sameplz --private --clone
cd sameplz
unzip ~/Downloads/sameplz-harness.zip -d /tmp/            # /tmp/sameplz-harness/ 생성
cp -R /tmp/sameplz-harness/. .                           # 숨김 파일(.claude, .github …) 포함 복사
chmod +x .claude/hooks/*.sh scripts/*.sh                 # zip이 실행 비트를 보존하지만 확인
git add -A && git commit -m "chore: add Claude Code harness and project docs"
git push -u origin main
```

### 2. 환경 변수

```bash
cp env.example .env.local     # 값은 직접 넣는다. Claude는 .env* 를 읽거나 쓰지 못한다(deny + 훅)
```

- `env.example`이라는 이름은 일부러다. `.claude/settings.json`이 `Read(./.env.*)`를 거부하므로 `.env.example`이면 Claude가 변수 목록을 읽지 못한다.
- MCP용 키는 셸 환경 변수로: `export CONTEXT7_API_KEY=...`(선택, 없으면 무료 한도).
- `SUPABASE_ACCESS_TOKEN`, PG secret 같은 값은 Claude를 띄우는 셸에 두지 않는다. 둬야 한다면 `export CLAUDE_CODE_SUBPROCESS_ENV_SCRUB=1`.

### 3. Supabase

> **MVP는 Supabase Free 단일 프로젝트(D14).** 클라우드 프로젝트 1개 = 운영, 개발은 로컬 Supabase, 운영 반영은 `deploy-db` 워크플로. Pro로 옮기면 Branching 구성(dev 프로젝트·staging 브랜치)으로 되돌린다.

1. 대시보드에서 운영 프로젝트를 **서울(`ap-northeast-2`)**로 직접 고른다('APAC 일반'은 싱가포르).
2. 운영 project ref를 `.claude/prod-ref.txt`의 주석 아래 줄에 적는다(비밀 아님). guard-bash가 이 ref가 들어간 명령을 막는다.
3. `.mcp.json`에서 `supabase-dev` 서버 블록을 지운다(dev 클라우드 프로젝트가 없고 운영에는 MCP를 붙이지 않는다). `supabase-local`은 남긴다.
4. 운영 반영용 GitHub 시크릿을 `production` 환경에 넣는다(환경은 필수 승인자 duwjd, 배포 브랜치 main).
   ```bash
   gh secret set SUPABASE_ACCESS_TOKEN --env production   # supabase.com → Account → Access Tokens
   gh secret set SUPABASE_DB_PASSWORD  --env production   # 프로젝트 만들 때 정한 DB 비밀번호
   gh secret set SUPABASE_PROJECT_REF  --env production   # 운영 project ref
   ```
5. 로컬은 `supabase start` 후 `supabase status -o env` 값으로 `.env.local`을 채운다. 로컬에서 `supabase link`는 하지 않는다(링크할 dev가 없다).

### 4. Vercel

```bash
vercel link                    # 새 프로젝트, 루트 디렉터리 그대로
```

- 대시보드 → Integrations에서 Supabase 연동을 켜면 프리뷰 브랜치 환경 변수가 프리뷰 배포에 들어간다.
- 함수 리전은 `vercel.json`이 `icn1`로 고정한다(기본 `iad1`이면 DB 왕복이 태평양을 건넌다).
- 운영 배포는 main 머지로만. `vercel --prod`는 deny.

### 5. MCP 서버

프로젝트 서버는 `.mcp.json`에 이미 있다. 첫 세션에서 `/mcp`로 승인한다. `supabase-local`은 `supabase start` 뒤에 붙는다(Free 단일 프로젝트라 `supabase-dev`는 쓰지 않는다, D14).

계정 단위 권한을 갖는 서버는 **커밋하지 않고** 로컬·사용자 범위로만, W6(베타) 이후에 붙인다:

```bash
claude mcp add --transport http vercel https://mcp.vercel.com
claude mcp add --transport http sentry https://mcp.sentry.dev/mcp/<org>/<project>
claude mcp add --transport http posthog https://mcp.posthog.com/mcp -s user
claude plugin install figma@claude-plugins-official      # 또는 claude.ai Figma 커넥터
```

선택(로컬만): Supabase 공식 스킬 플러그인

```bash
claude plugin marketplace add supabase/agent-skills
claude plugin install supabase@supabase-agent-skills
```

운영 Supabase와 PortOne 콘솔(MCP 기본값이 운영 환경)은 어떤 범위로도 연결하지 않는다. PortOne 문서는 WebFetch로 본다.

### 6. GitHub Actions

```bash
claude setup-token                                   # 구독 토큰 발급
gh secret set CLAUDE_CODE_OAUTH_TOKEN                # 붙여넣기
```

- Claude GitHub App 설치: Claude Code에서 `/install-github-app`(또는 GitHub에서 Claude 앱 수동 설치).
- main 보호 규칙에서 필수 체크 지정: `harness`, `checks`, `db`, `e2e`(아래 명령 또는 Settings → Branches).

```bash
gh api -X PUT repos/<owner>/sameplz/branches/main/protection --input - <<'JSON'
{
  "required_status_checks": { "strict": true, "contexts": ["harness", "checks", "db", "e2e"] },
  "enforce_admins": false,
  "required_pull_request_reviews": null,
  "restrictions": null
}
JSON
```

`checks`·`db`·`e2e`는 앱과 `supabase/config.toml`이 생기기 전까지 건너뛴다(`detect` 잡). W1 게이트 "빈 앱에서 CI 통과"는 스캐폴드 뒤 이 세 잡이 실제로 도는 것을 뜻한다.

### 7. 사용자 전역 설정 (커밋 안 함, 선택)

`~/.claude/settings.json`에 macOS 알림:

```json
{
  "hooks": {
    "Notification": [
      { "matcher": "permission_prompt|idle_prompt",
        "hooks": [ { "type": "command", "command": "osascript -e 'display notification \"Claude Code가 기다려요\" with title \"SAMEPLZ\"'" } ] }
    ]
  }
}
```

### 8. 설치 확인

```bash
claude doctor                          # 설정 파일을 신뢰 프롬프트 없이 읽어 점검
claude plugin validate .claude         # 스킬·에이전트 프론트매터 점검
```

세션 안에서: `/hooks`(훅 5개 등록 확인), `/mcp`(서버 승인·로그인), `/context`(CLAUDE.md·규칙 로드 확인), `/agents`(7개).

## 하네스가 막는 것

| 상황 | 결과 | 어디서 |
|---|---|---|
| `.env*` 읽기·편집 | 거부 | `Read(./.env*)` deny + protect-paths |
| `.git/`, `pnpm-lock.yaml`, `.claude/settings*.json`, `.claude/hooks/*`, `.claude/prod-ref.txt`, `.mcp.json`, `src/types/database.types.ts` 편집 | 거부 | protect-paths |
| `origin/main`에 있는 `supabase/migrations/*.sql` 편집 | 거부 + "supabase migration new" 안내 | protect-paths |
| spec-planner가 `docs/plans`·`docs/specs` 밖에 쓰기, 리뷰어 5종의 모든 쓰기 | 거부 | protect-paths(`agent_type`) |
| 운영 ref 포함 명령, `--prod`, `supabase db push`(dry-run 제외), `db reset --linked/--db-url`, `--db-url`, `migration repair`, `projects delete`, psql DROP/TRUNCATE, `curl \| sh`, `rm` 재귀+강제, 강제 push | 거부 | guard-bash + deny 규칙 |
| `git push`(모든 형태, `git -C . push` 포함), `gh pr create/merge`, `pnpm add`, `supabase link`, `vercel *`, `git reset --hard`, `git clean` | 확인 창 | ask 규칙 + guard-bash |
| 턴 종료 시 바뀐 TS/SQL | typecheck·관련 테스트 실패면 종료 차단 | stop-verify(`SAMEPLZ_SKIP_STOP_VERIFY=1`로 끔) |
| 파일 편집 후 | prettier·eslint, 마이그레이션 후속 단계 상기, 원문 테이블 참조 경고 | format-file |
| 세션 시작·재개·압축 | 주차·이번 주 외부 일정·게이트·브랜치 명세·다음 작업·미통과 기능·open 결정·최근 진행 | session-context |

막혔을 때 우회하지 말고(설정을 고치게 하지 말고) 사람이 판단한다. 하네스 파일은 사람이 직접 고친다.

## W1 첫 세션 프롬프트

계획 모드(Shift+Tab 또는 `claude --permission-mode plan`)에서 시작한다. 브랜치: `git switch -c chore/scaffold`.

### 프롬프트 1 — 앱 스캐폴드

```text
docs/architecture.md(1장 스택과 'W1 스캐폴드 메모'), CLAUDE.md, src/app/CLAUDE.md, supabase/CLAUDE.md, e2e/CLAUDE.md를 읽고
SAMEPLZ Next.js 앱을 이 저장소에 스캐폴드하는 계획을 세워 줘. 범위는 스캐폴드만이고 기능·스키마는 만들지 않는다.

요구사항:
- create-next-app은 비어 있지 않은 폴더를 거부할 수 있으니 /tmp/sameplz-app 에 만든 뒤 옮긴다.
  옵션: TypeScript, ESLint, Tailwind v4, App Router, src/ 디렉터리, import alias @/*, pnpm.
  옮길 때 기존 하네스 파일(CLAUDE.md, src/app/CLAUDE.md, .gitignore, README.md, docs/ 등)을 덮어쓰지 않는다. .gitignore는 합친다.
- next@16.3.x 최신 패치, cacheComponents: true, proxy.ts는 세션 갱신만(@supabase/ssr).
- package.json 스크립트: dev, build, start, typecheck(tsc --noEmit), lint, test(vitest run).
- 개발 의존성: vitest, @playwright/test, prettier. (shadcn/ui는 W1에 넣었다가 SAMEPLZ 디자인 시스템으로 대체)
- 폴더 골격: src/data(server-only, secrets.ts 자리만), src/actions, src/lib/{supabase,credits,payments,generation,moderation,validation},
  src/components, src/types, e2e/scenarios, e2e/fixtures. 빈 파일 대신 각 폴더의 역할을 한 줄 주석으로 가진 index.ts만.
- supabase init(supabase/config.toml), seed.sql 빈 틀, supabase/tests/ 에 RLS 켜짐을 확인하는 pgTAP 1개.
- 앱이 뜨는지(pnpm dev), pnpm typecheck·lint·test, supabase start·db reset·test db, scripts/check-rls.sql 이 통과하는지 확인.
- 끝나면 docs/progress.md 에 한 줄, PR은 /ship 으로.
```

### 프롬프트 2 — W1 스파이크 4개 (각각 새 세션, `/clear` 후)

```text
W1 스파이크: <카카오 개인 앱 로그인(이메일 없음, auth.users.id 키) | D4 네이버 로그인 | PGroonga 한국어 검색 | fal vs Replicate 지연·웹훅 | Supabase identity 연결·해제>.
docs/decisions.md 의 해당 결정과 docs/specs 의 관련 요구사항을 읽고, 버릴 코드로 하루 안에 확인할 실험 계획을 세워 줘.
결과는 docs/decisions.md 해당 결정의 '결정' 줄에 넣을 근거(측정값, 된다/안 된다, 막힌 지점)로 요약하고 상태는 바꾸지 말 것(내가 닫는다).
실험 코드는 spike/<이름> 브랜치에만 두고 main에 머지하지 않는다.
```

W1 외부 할 일(전부 사업자등록 없이 된다)은 코드보다 먼저 건다. `docs/plan-12w.md` 「외부 할 일」 참조.

- 도메인 구입, Supabase 서울(MVP는 Free, D14)·Vercel(`icn1`)
- Google OAuth 동의 화면, 카카오 개인 앱(이메일 동의 항목 없음), 네이버 앱
- fal 계정 + 동시성 상향 요청 + 지출 한도(spend cap, D12 월 예산 이하)
- OpenAI 모더레이션 키
- 개인정보처리방침·이용약관·금지 콘텐츠 정책·AI 고지 초안(W2~W3 → W6 최종)
- 네이버 서치어드바이저·구글 서치콘솔은 운영 도메인을 공개하는 W5에

사업자등록 → 통신판매업 신고 → 토스 신청(카드사 심사 최대 90일이라 유료 출시 약 3개월 전)은 **유료 전환 단계**다. MVP 기간에는 걸지 않는다.

## 하루 루프

| 단계 | 명령·도구 | 산출물 |
|---|---|---|
| 1 시작 | `claude -w <CODE>-<slug>`(워크트리, `.worktreeinclude`가 `.env.local` 복사). 병렬·장시간은 `claude --cloud "…"` | SessionStart가 주차·다음 작업·open 결정 출력 |
| 2 명세 | 명세가 부족하면 "Interview me in detail… then write a complete spec"로 `docs/specs/<CODE>.md` 보강 → `/clear` | 자기완결 명세 |
| 3 계획 | 계획 모드에서 `/feature-from-spec <CODE>` → spec-planner → Ctrl+G로 수정·승인 | `docs/plans/<CODE>.md` |
| 4 TDD | test-writer가 실패 테스트 → 커밋(`tests: PAY-03 consent gate`) → 구현 | 포매터(PostToolUse), typecheck·관련 테스트(Stop) |
| 5 DB | `/supabase-migration` → db-migration-reviewer → 타입 재생성 | 새 마이그레이션 + pgTAP |
| 6 확인 | ui-verifier(Playwright MCP, localhost), `/verify` | 아이템·EX 대조 보고 |
| 7 리뷰 | `/code-review` + 돈이면 payment-auditor, 인증·업로드·원문이면 security-auditor | 리뷰 노트 |
| 8 출하 | `/ship` → push(확인) → PR → Supabase 프리뷰·Vercel 프리뷰·CI·경로 필터 리뷰 → 머지 → 운영 마이그레이션 | PR |
| 9 마감 | `docs/progress.md` 한 줄, `docs/features.json` `passes: true`, `/clear` | 한 세션 한 기능 |
| 주간 | `/sprint-status`, `/doctor prompt-audit`, `/context`, `.claude/settings.local.json`에 쌓인 승인 검토, Next.js·Supabase 패치 확인 | — |

수정이 두 번 실패하면 `/clear`하고 첫 프롬프트를 고쳐 쓴다. `claude -p` 자동화에는 `--max-turns`, `--max-budget-usd`, `SAMEPLZ_SKIP_STOP_VERIFY=1`.

## 아직 확인하지 못한 것

형식은 공식 문서·`@anthropic-ai/claude-agent-sdk` 0.3.288 타입·CLI 2.1.288(`claude plugin validate`)로 확인했다. 아래는 실제 세션에서 돌려 봐야 한다. 해당 파일에는 `TODO(unverified)` 주석을 달았다(JSON 파일은 주석을 못 달아 이 표에만 적는다).

| 항목 | 위치 | 확인 방법 |
|---|---|---|
| 훅 5개의 실제 세션 동작(컨테이너에서 합성 stdin으로만 시험) | `.claude/hooks/*` | `/hooks`, 일부러 `.env.local` 편집·`supabase db push` 요청해 보기 |
| 프로젝트 서브에이전트의 `agent_type` 값이 `name`과 같은지 | protect-paths | spec-planner에게 `src/` 쓰기를 시켜 막히는지 |
| 스킬 `paths` 값 표기(YAML 목록) | `wireframe-to-ui/SKILL.md` | `src/app/**/*.tsx`를 읽을 때 자동 로드되는지 `/context`로 |
| 스킬 `allowed-tools` 값 표기(공백 구분 문자열) | `ship/SKILL.md` | `/ship`에서 git add/commit이 확인 없이 도는지 |
| 동적 컨텍스트 명령이 실패할 때(origin/main 없음) 스킬 동작 | `supabase-migration/SKILL.md` | push 전 저장소에서 `/supabase-migration` |
| 로컬 Supabase MCP(`localhost:54321/mcp`) 도구 이름이 원격과 같은지 | settings ask 규칙 `mcp__supabase-local__*` | `/mcp` 도구 목록 보고 allow/ask 확정 |
| Playwright MCP `--allowed-origins` 와일드카드(`*.vercel.app`) | `.mcp.json` | 지금은 localhost:3000 하나만 |
| `ci.yml` 서드파티 액션 버전, `supabase status -o env` 변수 이름 | `ci.yml` | W1에 버전(SHA) 고정 후 dry run |
| gitleaks-action 라이선스 필요 여부(조직 계정) | `ci.yml` `secrets` 잡 | 개인 계정이면 불필요로 알려짐 |
| 클라우드 세션에서 `supabase start`(Docker) | — | 그전까지 클라우드에서는 CI `db` 잡에 의존 |
| `deploy-db` 워크플로의 첫 실제 반영(승인 → db push) | `.github/workflows/deploy-db.yml` | 첫 마이그레이션 머지 때. 그전에 `workflow_dispatch`로 dry run |
| 샌드박스 `excludedCommands` 목록 | (꺼 둠) | 권한·훅이 안정된 뒤 로컬에서 시험 |
| Next.js DevTools MCP 설정 형식 | (제외) | 형식 확인 뒤 추가 |
| `create-next-app`이 비어 있지 않은 폴더를 거부하는지 | W1 프롬프트 | 그래서 임시 폴더 경유로 적었다 |
| fal 동시성 상향·지출 한도 동작, 카카오 개인 앱 로그인(이메일 없음)과 Supabase 연동, 공급자 안전 차단 과금 | `docs/plan-12w.md`, `docs/decisions.md` | W1 스파이크·외부 확인 |
| 토스 퀵오픈 대상 업종·보류 중 지급대행, PortOne 채널·알림톡 리드타임 | `docs/plan-12w.md` 「유료 전환 단계」 | 유료 전환 때 |

## 문서를 고칠 때

- 결정을 닫으면 `docs/decisions.md` 요약 표의 상태를 `closed`로, 본문 "결정" 줄에 날짜·선택·근거. 숫자가 바뀌면 `.claude/rules/money.md`도 같이.
- `docs/plan-12w.md` 주간 표와 `docs/decisions.md` 요약 표는 SessionStart 훅이 열 위치로 읽는다. 열 순서를 바꾸지 않는다.
- `docs/features.json`은 `passes`만 바꾼다. 항목을 지우거나 수용 기준을 고치지 않는다(바꿔야 하면 명세를 먼저 고치고 사람이 반영). `"phase": "paid"` 항목은 유료 전환 단계라 SessionStart 훅·`/sprint-status` 집계에서 빠진다. MVP에서 줄어든 범위는 `mvp_note`에 있다.
