---
name: feature-from-spec
description: SAMEPLZ 화면 코드(HOME, MKT, PRM, PAY, PLAY, LIB…)나 아이템 ID(PAY-03)로 계획을 세우고 TDD로 구현한다. 사용자가 화면 코드를 말하거나 새 기능을 시작할 때 쓴다.
argument-hint: "[SCREEN-CODE]"
---
# 명세에서 기능까지

인자: `$ARGUMENTS` (화면 코드 `PAY`, 아이템 ID `PAY-03`, 또는 기능 묶음 `F3`)

명세 파일 찾기: 인자에서 `-숫자` 꼬리를 떼어 코드를 얻는다(`PAY-03` → `PAY`). 화면 코드면 `docs/specs/<CODE>.md`, `F<n>`이면 `docs/specs/F<n>-*.md`. 아이템 ID가 주어졌으면 그 아이템과 그 아이템에 묶인 요구사항(F#-n)만 범위로 삼는다.

## 1. 읽고 막힘 확인

- `docs/specs/<CODE>.md`와 거기서 가리키는 `docs/specs/F<n>-*.md`
- `docs/decisions.md` — 이 기능이 의존하는 결정(명세의 "열린 질문·결정" 절)이 `open`이면 **멈추고** 사용자에게 어떤 결정이 무엇을 막는지 말한다. 결정 없이 진행할 수 있는 부분만 제안한다.
- `docs/features.json`에서 이 화면 항목과 목표 주

## 2. 계획 (spec-planner)

spec-planner 서브에이전트에 위임한다. 위임 메시지에 명세 ID, 명세 파일 경로, 범위(아이템 ID가 있으면 그것만)를 명시한다(서브에이전트는 대화 기록을 받지 못한다). 결과는 `docs/plans/<CODE>.md`, 틀은 [plan-template.md](plan-template.md).

## 3. 승인 대기

계획 요약(작업 수, 수용 테스트 수, 건드릴 파일, 막힌 결정)을 보여 주고 사용자 승인을 기다린다. 계획 모드라면 Ctrl+G로 고칠 수 있다고 알린다.

## 4. 실패하는 테스트 먼저 (test-writer)

test-writer에 계획 경로와 명세 ID를 넘긴다. 테스트가 올바른 이유로 실패하는지 확인한 뒤 커밋: `tests: <ID> <요약>`.

## 5. 작업 단위로 구현

계획의 체크박스 순서대로. 한 작업이 끝날 때마다 체크하고 커밋한다. 돈은 `.claude/rules/money.md`, 원문은 `.claude/rules/hidden-content.md`를 따른다.

## 6. DB 변경

스키마·함수·정책을 바꾸면 `/supabase-migration` 흐름을 따르고 db-migration-reviewer에 검토를 맡긴다.

## 7. 확인

- `pnpm typecheck`, 관련 테스트(`pnpm exec vitest run <files>`, `supabase test db`, `pnpm exec playwright test e2e/scenarios/<name>.spec.ts`)
- UI를 바꿨으면 ui-verifier에 화면 코드와 아이템·EX 목록을 넘긴다.
- 결제·크레딧이면 payment-auditor, 인증·RLS·업로드·원문이면 security-auditor.

## 8. 기록

- `docs/progress.md` 맨 아래에 한 줄: `- YYYY-MM-DD <ID>: <한 일> · 테스트 <통과/실패> · 다음: <다음 작업>`
- `docs/features.json`에서 수용 기준이 테스트로 통과한 항목만 `"passes": true`. 다른 필드는 고치지 않는다. 항목을 지우지 않는다.
- PR은 `/ship`으로 연다.
