#!/usr/bin/env bash
# PostToolUse · matcher "Edit|Write"
# 방금 편집한 파일을 정리하고, Claude가 알아야 할 것을 additionalContext로 돌려준다.
#   - *.ts *.tsx *.js *.jsx *.mjs *.cjs *.css *.md *.json → prettier --write
#   - *.ts *.tsx *.js *.jsx *.mjs *.cjs                    → eslint --fix, 남은 오류는 컨텍스트로
#   - supabase/migrations/*.sql → "db reset → gen types → test db" 상기
#   - src/ 파일이 src/data/secrets.ts 밖에서 원문 테이블을 참조 → 경고
# 앱이 아직 스캐폴드되지 않았으면(node_modules 없음) 포매터는 조용히 건너뛴다.
# 출력: {"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"…"}} (exit 0)
# stdin: { tool_name, tool_input: { file_path, … }, tool_response, cwd }
HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh source-path=SCRIPTDIR
. "$HOOK_DIR/lib/common.sh"

hook_init || exit 0
file_path="$(hook_get tool_input.file_path)" || exit 0
[ -z "$file_path" ] && exit 0
cwd="$(hook_get cwd)"
[ -z "$cwd" ] && cwd="$PWD"

root="$(repo_root "$cwd")"
rel="$(rel_path "$root" "$file_path" "$cwd")"
[ -z "$rel" ] && exit 0
abs="$root/$rel"
[ -f "$abs" ] || exit 0

notes=""
add_note() {
  if [ -z "$notes" ]; then notes="$1"; else notes="$notes
$1"; fi
}

errf="$(mktemp "${TMPDIR:-/tmp}/sameplz-fmt.XXXXXX")"
# shellcheck disable=SC2064
trap "rm -f '$HOOK_INPUT_FILE' '$errf'" EXIT

fmt=0; lint=0
case "$rel" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs) fmt=1; lint=1 ;;
  *.css|*.md|*.json) fmt=1 ;;
esac

prettier="$root/node_modules/.bin/prettier"
eslint="$root/node_modules/.bin/eslint"

if [ "$fmt" -eq 1 ] && [ -x "$prettier" ]; then
  if ! (cd "$root" && "$prettier" --write -- "$abs") >/dev/null 2>"$errf"; then
    add_note "prettier가 $rel 을(를) 정리하지 못했어요:
$(head -n 20 "$errf")"
  fi
fi

if [ "$lint" -eq 1 ] && [ -x "$eslint" ]; then
  if ! out="$(cd "$root" && "$eslint" --fix -- "$abs" 2>&1)"; then
    add_note "eslint --fix 뒤에도 남은 문제 ($rel):
$(printf '%s\n' "$out" | head -n 30)"
  fi
fi

case "$rel" in
  supabase/migrations/*.sql)
    add_note "마이그레이션을 바꿨어요. 순서: supabase db reset → supabase gen types typescript --local > src/types/database.types.ts → supabase test db. 새 테이블이면 같은 파일에서 RLS 켜기·정책·인덱스, 정책마다 pgTAP(supabase/tests/)." ;;
esac

case "$rel" in
  src/data/secrets.ts) ;;
  src/*)
    if grep -Eq 'recipe_version_secrets|play_prompts' "$abs" 2>/dev/null; then
      add_note "경고(hidden-content): $rel 이 원문 테이블(recipe_version_secrets / play_prompts)을 참조해요. 원문 select는 src/data/secrets.ts 안에서만 해요. .claude/rules/hidden-content.md 를 따르세요."
    fi ;;
esac

[ -z "$notes" ] && exit 0

notes="$(printf '%s' "$notes" | head -c 9000)"
if q="$(printf '%s' "$notes" | json_quote)"; then
  printf '{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":%s}}\n' "$q"
  exit 0
fi
# JSON 도구가 없으면: PostToolUse exit 2는 stderr를 Claude에게 보여 준다(도구는 이미 실행됨).
printf '%s\n' "$notes" >&2
exit 2
