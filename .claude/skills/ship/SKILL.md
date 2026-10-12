---
name: ship
description: 현재 기능의 PR을 연다.
disable-model-invocation: true
# allowed-tools: 이 턴에만 사전 승인한다(deny는 넘지 못함). git push는 일부러 빼서
# 설정의 ask 규칙과 guard-bash의 ask가 사용자 확인을 받게 한다.
# TODO(unverified): allowed-tools 값 표기(공백 구분 문자열 vs YAML 목록)는 스킬 문서에서 확정하지 못했다.
# Agent Skills 명세의 공백 구분 문자열을 따랐다. /ship 실행 때 git add/commit 이 확인 없이 도는지 확인할 것.
allowed-tools: Bash(git add *) Bash(git commit *) Bash(gh pr create *)
---
# PR 열기

현재 상태:

!`git status --short --branch`

## 1. 검사

- `pnpm typecheck`, `pnpm lint`, `pnpm test`
- DB가 바뀌었으면 `supabase db reset && supabase test db`, 타입 재생성 후 diff 없음
- 이 기능의 SCN이 있으면 `pnpm exec playwright test e2e/scenarios/<scn>.spec.ts`
- 하나라도 실패하면 멈추고 보고한다. 실패한 채로 PR을 열지 않는다.

## 2. 리뷰

- `/code-review`(번들 스킬) 또는 code-reviewer 서브에이전트
- 돈 경로(`src/lib/payments`, `src/lib/credits`, checkout, `supabase/migrations`의 돈 함수)를 건드렸으면 payment-auditor
- 인증·RLS·업로드·원문·play를 건드렸으면 security-auditor
- 정확성·명세 빈틈만 고친다.

## 3. 커밋

- 명세 ID로: `<ITEM-ID>: <요약>` (예: `PAY-03: block checkout until both consents are checked`)
- `docs/progress.md` 한 줄과 `docs/features.json` `passes` 갱신이 커밋에 들어갔는지 확인

## 4. push (사용자 확인)

`git push -u origin <branch>` — 확인 창이 뜬다. 강제 push는 막혀 있다.

## 5. PR

`gh pr create --title "<ITEM-ID>: <요약>" --body-file -` 로 아래 본문:

```markdown
## 명세
- <ITEM-ID / F#-n> — docs/specs/<CODE>.md

## 변경
- …

## 테스트
- [ ] pnpm typecheck / lint / test
- [ ] supabase test db
- [ ] e2e: <scn>.spec.ts
- 스크린숏: (UI 변경이면)

## 마이그레이션
- 새 파일: supabase/migrations/… (없으면 "없음")
- 운영 반영: 머지 시 Supabase Branching

## 건드린 결정
- [ ] D<n> … (없으면 "없음")

## 감사
- [ ] code-review  - [ ] payment-auditor  - [ ] security-auditor
```

PR을 열면 Supabase 프리뷰 브랜치, Vercel 프리뷰, CI(checks·db·e2e), 경로 필터 Claude 리뷰가 돈다. 머지는 사용자가 한다.
