#!/usr/bin/env bash
# PreToolUse · matcher "Bash"
# 권한 규칙은 명령을 쓴 그대로만 매칭한다(`git -C . push`는 `Bash(git push *)`에 안 걸림).
# 이 훅이 형태가 다른 위험 명령을 보완해서 막는다.
#   deny(exit 2 + stderr): 운영 ref 포함, --prod, supabase db push(--dry-run 제외),
#                          supabase db reset + --linked/--db-url, supabase --db-url,
#                          supabase migration repair, supabase projects delete,
#                          psql + DROP/TRUNCATE, curl|wget … | sh, rm 재귀+강제, git push 강제
#   ask(JSON permissionDecision "ask"): 모든 형태의 git push
# stdin: { tool_name: "Bash", tool_input: { command, ... }, cwd }
HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh source-path=SCRIPTDIR
. "$HOOK_DIR/lib/common.sh"

hook_init || exit 0

if ! cmd="$(hook_get tool_input.command)"; then
  echo "guard-bash: 훅 입력을 읽지 못해 검사를 건너뛰었어요(node 또는 jq 필요)." >&2
  exit 1
fi
[ -z "$cmd" ] && exit 0

cwd="$(hook_get cwd)"
[ -z "$cwd" ] && cwd="$PWD"
root="$(repo_root "$cwd")"

# 줄바꿈·탭·역슬래시(줄 이음)를 공백으로, 소문자로. 판정 전용 사본.
# shellcheck disable=SC1003  # '\\' is a literal backslash for tr, not a quote escape
lc="$(printf '%s' "$cmd" | LC_ALL=C tr '\n\t\\' '   ' | LC_ALL=C tr '[:upper:]' '[:lower:]')"

# ---------- 명령 전체에 대한 검사 ----------

# 운영 project ref (.claude/prod-ref.txt 의 '#' 아닌 첫 줄)
prod_ref=""
if [ -f "$root/.claude/prod-ref.txt" ]; then
  prod_ref="$(awk '!/^[[:space:]]*#/ && NF { print $1; exit }' "$root/.claude/prod-ref.txt" | LC_ALL=C tr '[:upper:]' '[:lower:]')"
fi
re_ref='^[a-z0-9]{10,40}$'
if [ -n "$prod_ref" ] && [[ $prod_ref =~ $re_ref ]]; then
  case "$lc" in
    *"$prod_ref"*) deny_tool "명령에 운영 Supabase project ref가 들어 있어요. 운영 DB는 에이전트가 건드리지 않아요. 필요하면 사용자가 직접 실행하세요." ;;
  esac
fi

re_prod='(^|[[:space:]])--prod([[:space:]=]|$)'
if [[ $lc =~ $re_prod ]]; then
  deny_tool "--prod 배포·작업은 막혀 있어요. 운영 배포는 main 머지로만 해요."
fi

re_pipe_sh='(curl|wget)[^|]*[|][[:space:]]*(sudo[[:space:]]+)?(env[[:space:]]+)?(ba|z|da|k)?sh([^[:alnum:]_]|$)'
re_subst_sh='(^|[^[:alnum:]_])(ba|z|da|k)?sh[[:space:]]+(-c[[:space:]]+)?.?[$<][(][[:space:]]*(curl|wget)'
if [[ $lc =~ $re_pipe_sh ]] || [[ $lc =~ $re_subst_sh ]]; then
  deny_tool "내려받은 스크립트를 셸로 바로 실행하는 명령(curl|sh)은 막혀 있어요. 스크립트를 먼저 내려받아 검토하세요."
fi

re_psql='(^|[^[:alnum:]_])psql([^[:alnum:]_]|$)'
re_ddl='(^|[^[:alnum:]_])(drop|truncate)([^[:alnum:]_]|$)'
if [[ $lc =~ $re_psql ]] && [[ $lc =~ $re_ddl ]]; then
  deny_tool "psql로 DROP/TRUNCATE를 보내는 명령은 막혀 있어요. 스키마 변경은 새 마이그레이션으로 하세요."
fi

# ---------- 세그먼트(; & | ` ( ) { } 로 나눈 단위)별 검사 ----------
# shellcheck disable=SC2020  # intentional: map each separator char to a newline
segments="$(printf '%s' "$lc" | LC_ALL=C tr ';&|`(){}' '\n\n\n\n\n\n\n\n')"

re_db_push='(^|[^[:alnum:]_-])db[[:space:]]+push([^[:alnum:]_-]|$)'
re_db_reset='(^|[^[:alnum:]_-])db[[:space:]]+reset([^[:alnum:]_-]|$)'
re_linked='(^|[[:space:]])--linked([[:space:]=]|$)'
re_db_url='(^|[[:space:]])--db-url([[:space:]=]|$)'
re_dry='(^|[[:space:]])--dry-run([[:space:]=]|$)'
re_repair='(^|[^[:alnum:]_-])migration[[:space:]]+repair([^[:alnum:]_-]|$)'
re_proj_del='(^|[^[:alnum:]_-])projects[[:space:]]+delete([^[:alnum:]_-]|$)'

git_push=0
while IFS= read -r seg; do
  [ -z "$seg" ] && continue
  words=()
  read -r -a words <<< "$seg"
  n=${#words[@]}
  [ "$n" -eq 0 ] && continue

  # --- supabase CLI (supabase, npx supabase, pnpm exec supabase …) ---
  has_supabase=0
  i=0
  while [ "$i" -lt "$n" ]; do
    [ "${words[$i]##*/}" = "supabase" ] && { has_supabase=1; break; }
    i=$((i + 1))
  done
  if [ "$has_supabase" -eq 1 ]; then
    if [[ $seg =~ $re_db_push ]] && ! [[ $seg =~ $re_dry ]]; then
      deny_tool "supabase db push는 --dry-run만 허용돼요. 운영 반영은 PR 머지(Supabase Branching)로 해요."
    fi
    if [[ $seg =~ $re_db_reset ]] && { [[ $seg =~ $re_linked ]] || [[ $seg =~ $re_db_url ]]; }; then
      deny_tool "원격 DB를 reset하는 명령(db reset --linked/--db-url)은 막혀 있어요. 로컬 'supabase db reset'만 써요."
    fi
    if [[ $seg =~ $re_db_url ]]; then
      deny_tool "supabase --db-url은 원격 DB를 직접 가리키고 비밀번호가 기록에 남아요. 로컬 스택을 쓰세요."
    fi
    if [[ $seg =~ $re_repair ]]; then
      deny_tool "supabase migration repair는 마이그레이션 이력을 다시 써요. 사용자가 직접 판단해 실행하세요."
    fi
    if [[ $seg =~ $re_proj_del ]]; then
      deny_tool "supabase projects delete는 막혀 있어요."
    fi
  fi

  # --- 첫 실행 명령 찾기 (환경 변수 대입·래퍼 건너뛰기) ---
  i=0
  while [ "$i" -lt "$n" ]; do
    w="${words[$i]}"
    case "$w" in
      \$|*=*|sudo|command|exec|time|nohup|xargs|env|builtin|then|do|else|if|while|!) i=$((i + 1)) ;;
      *) break ;;
    esac
  done
  [ "$i" -ge "$n" ] && continue
  prog="${words[$i]##*/}"

  case "$prog" in
    rm)
      rec=0; force=0
      j=$((i + 1))
      while [ "$j" -lt "$n" ]; do
        a="${words[$j]}"
        case "$a" in
          --) break ;;
          --recursive) rec=1 ;;
          --force) force=1 ;;
          --*) ;;
          -*)
            case "$a" in *r*) rec=1 ;; esac
            case "$a" in *f*) force=1 ;; esac ;;
        esac
        j=$((j + 1))
      done
      if [ "$rec" -eq 1 ] && [ "$force" -eq 1 ]; then
        deny_tool "rm 재귀+강제 삭제는 막혀 있어요. 지울 경로를 사용자에게 알려 직접 지우게 하세요."
      fi ;;
    git)
      # git 전역 옵션 건너뛰고 하위 명령 찾기 (-C <dir>, -c <k=v>, --git-dir=…, …)
      j=$((i + 1))
      while [ "$j" -lt "$n" ]; do
        a="${words[$j]}"
        case "$a" in
          -C|-c|--git-dir|--work-tree|--namespace|--exec-path|--config-env) j=$((j + 2)) ;;
          -*) j=$((j + 1)) ;;
          *) break ;;
        esac
      done
      if [ "$j" -lt "$n" ] && [ "${words[$j]}" = "push" ]; then
        k=$((j + 1))
        while [ "$k" -lt "$n" ]; do
          a="${words[$k]}"
          case "$a" in
            --force|--force=*|--force-with-lease|--force-with-lease=*|--force-if-includes|+*)
              deny_tool "강제 push는 막혀 있어요." ;;
            --*) ;;
            -*f*) deny_tool "강제 push(-f)는 막혀 있어요." ;;
          esac
          k=$((k + 1))
        done
        git_push=1
      fi ;;
  esac
done <<EOF
$segments
EOF

if [ "$git_push" -eq 1 ]; then
  ask_tool "git push는 사용자 확인이 필요해요. 브랜치와 원격을 확인하세요."
fi

exit 0
