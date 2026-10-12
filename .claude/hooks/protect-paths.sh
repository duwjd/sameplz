#!/usr/bin/env bash
# PreToolUse · matcher "Edit|Write"
# 보호 경로 편집을 막는다. 막을 때: 이유를 stderr에 쓰고 exit 2(도구 호출 차단). 통과: exit 0.
#
# stdin: { tool_name, tool_input: { file_path, ... }, cwd, agent_type? }
# 막는 것:
#   - .env, .env.*            (env.example 제외; 저장소 안팎 모두)
#   - .git/ 내부, pnpm-lock.yaml
#   - 하네스 자체: .claude/settings.json, .claude/settings.local.json, .claude/hooks/**,
#                  .claude/prod-ref.txt, .mcp.json
#   - src/types/database.types.ts (supabase gen types 산출물)
#   - supabase/migrations/*.sql 중 origin/main에 이미 있는 파일(적용된 마이그레이션)
#   - agent_type=spec-planner: docs/plans/, docs/specs/ 밖 쓰기
#   - agent_type=읽기 전용 리뷰어(db-migration-reviewer, security-auditor, payment-auditor,
#                code-reviewer, ui-verifier): 모든 쓰기
HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh source-path=SCRIPTDIR
. "$HOOK_DIR/lib/common.sh"

hook_init || exit 0

if ! file_path="$(hook_get tool_input.file_path)"; then
  echo "protect-paths: 훅 입력을 읽지 못해 검사를 건너뛰었어요(node 또는 jq 필요)." >&2
  exit 1
fi
[ -z "$file_path" ] && exit 0

cwd="$(hook_get cwd)"
[ -z "$cwd" ] && cwd="$PWD"
agent_type="$(hook_get agent_type)"

# 1) .env 계열 — 저장소 밖이어도 막는다
base="${file_path##*/}"
case "$base" in
  env.example) ;;
  .env|.env.*)
    deny_tool "$file_path: .env 파일은 편집할 수 없어요. 값은 사용자가 직접 넣어요. 새 변수 이름은 env.example에 추가하세요." ;;
esac

root="$(repo_root "$cwd")"
rel="$(rel_path "$root" "$file_path" "$cwd")"

# 2) 서브에이전트 쓰기 범위 (저장소 밖 쓰기 포함)
case "$agent_type" in
  spec-planner|*:spec-planner)
    case "$rel" in
      docs/plans/*|docs/specs/*) ;;
      *) deny_tool "spec-planner는 docs/plans/와 docs/specs/에만 쓸 수 있어요 (요청 경로: $file_path)." ;;
    esac ;;
  db-migration-reviewer|security-auditor|payment-auditor|code-reviewer|ui-verifier|\
  *:db-migration-reviewer|*:security-auditor|*:payment-auditor|*:code-reviewer|*:ui-verifier)
    deny_tool "$agent_type 는 읽기 전용 리뷰어예요. 고칠 내용은 보고서로 돌려주세요 (요청 경로: $file_path)." ;;
esac

# 저장소 밖 경로는 권한 시스템에 맡긴다
[ -z "$rel" ] && exit 0

# 3) 고정 보호 경로
case "$rel" in
  .git|.git/*|*/.git|*/.git/*)
    deny_tool "$rel: .git 내부는 편집할 수 없어요. git 명령을 쓰세요." ;;
  pnpm-lock.yaml|*/pnpm-lock.yaml)
    deny_tool "$rel: 잠금 파일은 pnpm add/remove/install로만 바뀌어요." ;;
  .claude/settings.json|.claude/settings.local.json)
    deny_tool "$rel: 하네스 권한·훅 설정은 사용자가 직접 고쳐요. 바꿀 내용을 제안만 하세요." ;;
  .claude/hooks/*)
    deny_tool "$rel: 훅 스크립트는 사용자가 직접 고쳐요. 바꿀 내용을 제안만 하세요." ;;
  .claude/prod-ref.txt|.mcp.json)
    deny_tool "$rel: 운영 ref와 MCP 서버 목록은 사용자가 직접 고쳐요." ;;
  src/types/database.types.ts)
    deny_tool "$rel: 생성 파일이에요. 'supabase gen types typescript --local > src/types/database.types.ts'로 다시 만드세요." ;;
esac

# 4) 이미 적용된 마이그레이션 (origin/main에 있는 파일)
case "$rel" in
  supabase/migrations/*.sql)
    if git -C "$root" cat-file -e "origin/main:$rel" 2>/dev/null; then
      deny_tool "$rel 은 이미 origin/main에 있는(적용된) 마이그레이션이에요. 고치지 말고 'supabase migration new <name>'으로 새 마이그레이션을 만드세요."
    fi ;;
esac

exit 0
