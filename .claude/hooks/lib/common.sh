# shellcheck shell=bash
# SAMEPLZ hook helpers. Sourced by .claude/hooks/*.sh, never executed directly.
#
# Portability: must run under bash 3.2 (macOS /bin/bash) and bash 5 (Linux, cloud VM).
#   - no mapfile/readarray, no ${var,,}, no associative arrays, no reliance on `set -u`
#   - no GNU-only flags (timeout, readlink -f, grep -P, sed -i)
# JSON: node is preferred (always present in this Next.js repo), jq is the fallback.
#
# Hook stdin fields used (verified against @anthropic-ai/claude-agent-sdk 0.3.288 types):
#   common     : cwd, hook_event_name, agent_type (inside subagents only)
#   PreToolUse : tool_name, tool_input
#   PostToolUse: tool_name, tool_input, tool_response
#   Stop       : stop_hook_active
#   SessionStart: source ('startup'|'resume'|'clear'|'compact'|'fork')

HOOK_INPUT_FILE=""

# Read the hook's stdin JSON into a temp file (stdin can be large, e.g. Write content).
hook_init() {
  HOOK_INPUT_FILE="$(mktemp "${TMPDIR:-/tmp}/sameplz-hook.XXXXXX")" || return 1
  # shellcheck disable=SC2064  # expand now: we want this exact path removed on exit
  trap "rm -f '$HOOK_INPUT_FILE'" EXIT
  cat > "$HOOK_INPUT_FILE"
}

# hook_get <dot.path>
# Prints the value at the path ('' if missing/null). Objects/arrays print as JSON.
# Returns 3 on unparsable input, 4 when neither node nor jq is available.
hook_get() {
  if command -v node >/dev/null 2>&1; then
    node -e '
      const fs = require("fs");
      let v;
      try { const raw = fs.readFileSync(process.argv[1], "utf8"); v = raw.trim() ? JSON.parse(raw) : {}; }
      catch (e) { process.exit(3); }
      for (const k of process.argv[2].split(".")) { if (v === null || v === undefined) break; v = v[k]; }
      if (v === undefined || v === null) process.exit(0);
      process.stdout.write(typeof v === "object" ? JSON.stringify(v) : String(v));
    ' "$HOOK_INPUT_FILE" "$1"
  elif command -v jq >/dev/null 2>&1; then
    [ -s "$HOOK_INPUT_FILE" ] || return 0
    jq -er --arg p "$1" \
      'getpath($p | split(".")) | if . == null then "" elif type == "object" or type == "array" then tojson else tostring end' \
      "$HOOK_INPUT_FILE" 2>/dev/null
    case $? in 0|1) return 0 ;; *) return 3 ;; esac
  else
    return 4
  fi
}

# json_quote: reads stdin, prints it as a JSON string literal.
json_quote() {
  if command -v node >/dev/null 2>&1; then
    node -e 'process.stdout.write(JSON.stringify(require("fs").readFileSync(0, "utf8")))'
  elif command -v jq >/dev/null 2>&1; then
    jq -Rs .
  else
    return 4
  fi
}

# PreToolUse hard block: reason on stderr, exit 2 (blocks the tool call; stderr goes to Claude).
deny_tool() {
  printf 'SAMEPLZ 하네스 훅이 막았어요: %s\n' "$1" >&2
  exit 2
}

# PreToolUse "ask": show the normal permission prompt with a reason.
ask_tool() {
  local q
  if q="$(printf '%s' "$1" | json_quote)"; then
    printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"ask","permissionDecisionReason":%s}}\n' "$q"
    exit 0
  fi
  deny_tool "$1 (JSON 도구가 없어 확인 대신 막았어요. 사용자가 직접 실행하세요.)"
}

# repo_root <dir>: git toplevel of <dir> (worktree-aware), else $CLAUDE_PROJECT_DIR, else <dir>.
# Note: $CLAUDE_PROJECT_DIR stays at the original checkout inside worktrees, so prefer stdin cwd.
repo_root() {
  local d="${1:-$PWD}" r
  if r="$(git -C "$d" rev-parse --show-toplevel 2>/dev/null)" && [ -n "$r" ]; then
    printf '%s' "$r"; return 0
  fi
  if [ -n "${CLAUDE_PROJECT_DIR:-}" ]; then printf '%s' "$CLAUDE_PROJECT_DIR"; return 0; fi
  printf '%s' "$d"
}

# rel_path <root> <path> <cwd>
# Path relative to <root> with '/' separators, symlinks and '..' resolved.
# Prints '' when the path is outside <root>.
rel_path() {
  if command -v node >/dev/null 2>&1; then
    node -e '
      const path = require("path"), fs = require("fs");
      const [root, p, cwd] = process.argv.slice(1);
      const real = (x) => {            // realpath of the deepest existing ancestor + the rest
        const rest = []; let cur = x;
        for (;;) {
          try { return path.join(fs.realpathSync(cur), ...rest.reverse()); }
          catch (e) { const up = path.dirname(cur); if (up === cur) return x; rest.push(path.basename(cur)); cur = up; }
        }
      };
      const abs = real(path.resolve(cwd || root, p));
      const r = path.relative(real(path.resolve(root)), abs);
      if (r === "" || r.startsWith("..") || path.isAbsolute(r)) process.exit(0);
      process.stdout.write(r.split(path.sep).join("/"));
    ' "$1" "$2" "$3"
    return 0
  fi
  # crude fallback without node
  case "$2" in
    "$1"/*) printf '%s' "${2#"$1"/}" ;;
    /*) printf '' ;;
    *) printf '%s' "${2#./}" ;;
  esac
}

# abs_path <path> <cwd>: absolute form of <path> (no symlink resolution).
abs_path() {
  case "$1" in
    /*) printf '%s' "$1" ;;
    *) printf '%s/%s' "${2:-$PWD}" "${1#./}" ;;
  esac
}
