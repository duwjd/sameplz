#!/usr/bin/env bash
# Stop · (matcher 없음)
# 턴을 끝내기 전에 바뀐 코드의 typecheck와 관련 테스트를 돌린다. 실패하면 종료를 막는다.
#   - stop_hook_active == true            → exit 0 (무한 루프 방지; 8연속 차단이면 Claude Code가 무시)
#   - SAMEPLZ_SKIP_STOP_VERIFY=1          → exit 0 (claude -p 자동화용)
#   - package.json 없음(앱 스캐폴드 전)   → exit 0
#   - 바뀐 *.ts *.tsx *.sql 없음          → exit 0
#   - 있으면: typecheck 스크립트, vitest related, (SQL이 바뀌었고 로컬 Supabase가 떠 있으면) supabase test db
# 실패 출력: {"decision":"block","reason":"typecheck/tests failing: <앞 40줄>"} (exit 0)
# stdin: { stop_hook_active, cwd, … }
HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh source-path=SCRIPTDIR
. "$HOOK_DIR/lib/common.sh"

[ "${SAMEPLZ_SKIP_STOP_VERIFY:-}" = "1" ] && exit 0

hook_init || exit 0
active="$(hook_get stop_hook_active)"
[ "$active" = "true" ] && exit 0

cwd="$(hook_get cwd)"
[ -z "$cwd" ] && cwd="$PWD"
root="$(repo_root "$cwd")"

git -C "$root" rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0
[ -f "$root/package.json" ] || exit 0

# 바뀐 파일: staged + unstaged + untracked, 삭제 제외. 경로는 저장소 루트 기준.
ts_files=()
sql_changed=0
while IFS= read -r line; do
  [ -z "$line" ] && continue
  st="${line:0:2}"
  p="${line:3}"
  case "$p" in *" -> "*) p="${p##* -> }" ;; esac
  case "$p" in \"*\") p="${p#\"}"; p="${p%\"}" ;; esac
  case "$st" in *D*) continue ;; esac
  case "$p" in
    *.ts|*.tsx) ts_files+=("$p") ;;
    *.sql) sql_changed=1 ;;
  esac
done <<EOF
$(git -C "$root" -c core.quotepath=off status --porcelain --untracked-files=all 2>/dev/null)
EOF

[ "${#ts_files[@]}" -eq 0 ] && [ "$sql_changed" -eq 0 ] && exit 0

out="$(mktemp "${TMPDIR:-/tmp}/sameplz-stop.XXXXXX")"
# shellcheck disable=SC2064
trap "rm -f '$HOOK_INPUT_FILE' '$out'" EXIT
fail=0

has_script() {
  node -e 'const p = require(process.argv[1]); process.exit(p.scripts && p.scripts[process.argv[2]] ? 0 : 1)' \
    "$root/package.json" "$1" 2>/dev/null
}

run_script() { # run a package.json script with pnpm (fallback npm)
  if command -v pnpm >/dev/null 2>&1; then
    (cd "$root" && pnpm run "$1")
  else
    (cd "$root" && npm run "$1")
  fi
}

# 1) typecheck
if has_script typecheck; then
  {
    echo "\$ pnpm typecheck"
    run_script typecheck
  } >>"$out" 2>&1 || fail=1
fi

# 2) vitest related (바뀐 TS 파일만)
vitest="$root/node_modules/.bin/vitest"
if [ "$fail" -eq 0 ] && [ "${#ts_files[@]}" -gt 0 ] && [ -x "$vitest" ]; then
  {
    echo "\$ vitest related --run ${ts_files[*]}"
    (cd "$root" && "$vitest" related --run --passWithNoTests "${ts_files[@]}")
  } >>"$out" 2>&1 || fail=1
fi

# 3) pgTAP (SQL이 바뀌었고 로컬 Supabase가 실행 중일 때만)
if [ "$fail" -eq 0 ] && [ "$sql_changed" -eq 1 ] && command -v supabase >/dev/null 2>&1 \
   && [ -f "$root/supabase/config.toml" ] \
   && (cd "$root" && supabase status >/dev/null 2>&1); then
  {
    echo "\$ supabase test db"
    (cd "$root" && supabase test db)
  } >>"$out" 2>&1 || fail=1
fi

[ "$fail" -eq 0 ] && exit 0

reason="typecheck/tests failing:
$(grep -v '^[[:space:]]*$' "$out" | head -n 40 | head -c 8000)"
if q="$(printf '%s' "$reason" | json_quote)"; then
  printf '{"decision":"block","reason":%s}\n' "$q"
  exit 0
fi
# JSON 도구가 없으면 exit 2 + stderr (Stop을 막고 stderr를 Claude에게 보낸다)
printf '%s\n' "$reason" >&2
exit 2
