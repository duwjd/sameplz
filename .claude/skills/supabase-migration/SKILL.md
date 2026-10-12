---
name: supabase-migration
description: 스키마·함수·트리거·정책을 바꿀 때 새 마이그레이션을 안전하게 만든다.
---
# 새 마이그레이션 만들기

## 이미 main에 있는 마이그레이션 (고치면 안 되는 파일)

main 대비 바뀐 마이그레이션 파일:

!`git diff --name-only origin/main -- supabase/migrations`

위 목록에 이번 작업이 만든 파일이 아닌 것이 있으면 멈추고 사용자에게 알린다. `origin/main`에 있는 파일은 protect-paths 훅이 편집을 막는다. 위 명령이 실패했다면(`origin/main` 없음) 아직 push 전 저장소이므로 모든 파일이 새 파일이다.

## 순서

1. 이름 정하기: 동사_대상 (`add_orders_and_entitlements`, `create_refund_order_fn`)
2. `supabase migration new <name>` — 새 파일만. 타임스탬프는 CLI가 붙인다.
3. SQL 작성 — [checklist.md](checklist.md)를 위에서부터 확인
   - 새 테이블: 같은 파일에서 `enable row level security`, 정책, 정책 컬럼 인덱스
   - 돈 함수: `private` 스키마, `security definer`, `set search_path = ''`, `revoke execute … from public, anon, authenticated`
   - 원장: UPDATE·DELETE 금지 트리거
4. `supabase db reset` — 로컬 DB를 처음부터 다시 만들고 `seed.sql` 적용. (`--linked`·`--db-url` 금지, 훅이 막는다)
5. `supabase gen types typescript --local > src/types/database.types.ts`
6. pgTAP — 정책·함수마다 `supabase/tests/<area>.test.sql`. 템플릿: `.claude/skills/rls-policy/pgtap-template.sql`
7. `supabase test db`
8. `supabase db lint` (경고 확인)
9. db-migration-reviewer에 검토를 맡긴다. 위임 메시지에 명세 ID와 새 마이그레이션 파일 경로를 적는다.
10. seed가 바뀌어야 하면 `supabase/seed.sql`을 같이 고친다(로컬 `db reset`과 CI가 쓴다).

## 운영 반영

PR의 CI `db` 잡이 깨끗한 로컬 스택에 마이그레이션을 적용해 확인하고, main에 머지하면 `deploy-db` 워크플로가 `production` 환경 승인 뒤 `supabase db push`로 운영에 적용한다(D14, Branching 없음). 에이전트는 `supabase db push`(dry-run 제외)·`supabase link`·`migration repair`를 하지 않는다.
