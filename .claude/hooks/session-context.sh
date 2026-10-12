#!/usr/bin/env bash
# SessionStart · matcher "startup|resume|compact"
# 세션을 열 때(그리고 압축 뒤) 지금 어디에 있는지 짧게 알려 준다. 일반 stdout은 컨텍스트로 들어간다.
#   - 클라우드(CLAUDE_CODE_REMOTE=true)면 먼저 pnpm install --frozen-lockfile (출력은 stderr로)
#   - 오늘 날짜와 주차(W1 = 2026-10-05 주, MVP 7주), 이번 주 외부 일정·게이트(docs/plan-12w.md)
#   - 브랜치와 브랜치에서 뽑은 명세 ID, docs/plans/<ID>.md의 다음 미완료 작업
#   - docs/features.json 통과 수와 이번 주까지 목표인데 미통과인 항목("phase": "paid" 항목은 빼고 센다)
#   - docs/decisions.md의 open 결정, docs/progress.md 마지막 5줄
#   - 로컬이면 supabase status 요약, 설정 누락 경고
# 출력은 10,000자 상한 아래로 자른다.
# stdin: { source, cwd, … }
HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh source-path=SCRIPTDIR
. "$HOOK_DIR/lib/common.sh"

hook_init || true
cwd="$(hook_get cwd 2>/dev/null)"
[ -z "$cwd" ] && cwd="${CLAUDE_PROJECT_DIR:-$PWD}"
src="$(hook_get source 2>/dev/null)"
root="$(repo_root "$cwd")"

out=""
say() {
  if [ -z "$out" ]; then out="$1"; else out="$out
$1"; fi
}

# ---------- 클라우드 세션 준비 ----------
if [ "${CLAUDE_CODE_REMOTE:-}" = "true" ] && [ "$src" != "compact" ] \
   && [ -f "$root/pnpm-lock.yaml" ] && command -v pnpm >/dev/null 2>&1; then
  if ! (cd "$root" && pnpm install --frozen-lockfile) 1>&2; then
    say "- 경고: 클라우드 세션에서 pnpm install --frozen-lockfile 이 실패했어요."
  fi
fi

say "## SAMEPLZ 세션 컨텍스트 (session-context.sh)"

# ---------- 날짜·주차 ----------
week_info=""
if command -v node >/dev/null 2>&1; then
  week_info="$(node -e '
    const d = new Date();
    const today = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
    const w1 = Date.UTC(2026, 9, 5);                  // W1 월요일 2026-10-05
    const day = 86400000;
    const iso = new Date(today).toISOString().slice(0, 10);
    const w = Math.floor((today - w1) / (7 * day)) + 1;
    const md = (t) => { const x = new Date(t); return String(x.getUTCMonth() + 1).padStart(2, "0") + "/" + String(x.getUTCDate()).padStart(2, "0"); };
    if (w < 1) console.log(iso + "\tW0\t착공 전, W1은 10/05 월요일 시작");
    else if (w > 7) console.log(iso + "\tW" + w + "\tMVP 7주 계획 이후, 출시 주 W7 = 11/16~11/22");
    else { const s = w1 + (w - 1) * 7 * day; console.log(iso + "\tW" + w + "\t" + md(s) + "~" + md(s + 6 * day)); }
  ' 2>/dev/null)"
fi
today="$(printf '%s' "$week_info" | cut -f1)"
week="$(printf '%s' "$week_info" | cut -f2)"
range="$(printf '%s' "$week_info" | cut -f3)"
[ -n "$today" ] && say "- 오늘: $today · 주차: $week · $range"

plan="$root/docs/plan-12w.md"
if [ -n "$week" ] && [ -f "$plan" ]; then
  ext="$(awk -F'|' -v w="$week" '{ g=$2; gsub(/[[:space:]]/, "", g) } g==w { print $5; exit }' "$plan" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//')"
  gate="$(awk -F'|' -v w="$week" '{ g=$2; gsub(/[[:space:]]/, "", g) } g==w { print $7; exit }' "$plan" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//')"
  [ -n "$ext" ] && say "- 이번 주 외부 일정(임계 경로): $(printf '%s' "$ext" | head -c 600)"
  [ -n "$gate" ] && say "- 이번 주 게이트: $(printf '%s' "$gate" | head -c 300)"
fi

# ---------- 브랜치·명세 ----------
branch="$(git -C "$root" rev-parse --abbrev-ref HEAD 2>/dev/null)"
if [ -n "$branch" ]; then
  up="$(printf '%s' "$branch" | LC_ALL=C tr '[:lower:]' '[:upper:]')"
  leaf="${up##*/}"
  leaf="${leaf#WORKTREE-}"
  re_spec='^(HOME|MKT|COL|NF|PRM|AGT|SKL|STOP|PAY|LIB|ORD|PLAY|CRD|UP|SELL|GAL|ACTV|MY|NOTI|PRF|ACC|GUIDE|ADM|SCN|F[1-8])(-[0-9]+)?(-|$)'
  spec=""; item=""
  if [[ $leaf =~ $re_spec ]]; then
    spec="${BASH_REMATCH[1]}"
    item="${BASH_REMATCH[1]}${BASH_REMATCH[2]}"
  fi
  if [ -n "$spec" ]; then
    say "- 브랜치: $branch → 명세 $item (docs/specs/$spec.md)"
    planf="$root/docs/plans/$spec.md"
    if [ -f "$planf" ]; then
      next="$(grep -m1 -E '^[[:space:]]*[-*] \[ \]' "$planf" | sed 's/^[[:space:]]*//')"
      if [ -n "$next" ]; then say "- 다음 작업(docs/plans/$spec.md): $next"; else say "- docs/plans/$spec.md: 미완료 작업 없음"; fi
    else
      say "- 계획 없음: 계획 모드에서 /feature-from-spec $item 로 docs/plans/$spec.md 를 만드세요."
    fi
  else
    say "- 브랜치: $branch (명세 ID 없음. 기능 작업이면 feat/<CODE>-<slug> 브랜치를 쓰세요)"
  fi
fi

# ---------- 기능 목록 ----------
feat="$root/docs/features.json"
if [ -f "$feat" ] && command -v node >/dev/null 2>&1; then
  fsum="$(node -e '
    const f = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
    const all = Array.isArray(f) ? f : (f.features || []);
    const items = all.filter((x) => x && x.phase !== "paid");   // 유료 전환 단계 항목은 MVP 집계에서 뺀다
    const paid = all.length - items.length;
    const wk = parseInt(String(process.argv[2] || "").replace(/^W/, ""), 10);
    const pass = items.filter((x) => x.passes === true).length;
    let line = "- 기능 목록(docs/features.json): " + pass + "/" + items.length + " 통과" +
      (paid ? " (유료 전환 단계 " + paid + "개 제외)" : "");
    if (!Number.isNaN(wk) && wk >= 1) {
      const due = items.filter((x) => x.passes !== true && typeof x.week === "number" && x.week <= wk);
      if (due.length) line += "\n- 이번 주(W" + wk + ")까지 목표인데 미통과 " + due.length + "개: " +
        due.slice(0, 10).map((x) => x.id + "(" + (x.items && x.items[0] ? x.items[0] : x.screen) + ")").join(", ") + (due.length > 10 ? " …" : "");
    }
    console.log(line);
  ' "$feat" "$week" 2>/dev/null)"
  [ -n "$fsum" ] && say "$fsum"
fi

# ---------- 열린 결정 ----------
dec="$root/docs/decisions.md"
if [ -f "$dec" ]; then
  open_dec="$(awk -F'|' '
    { id=$2; gsub(/[[:space:]]/, "", id); st=$6; gsub(/[[:space:]]/, "", st) }
    id ~ /^D[0-9]+$/ && tolower(st) == "open" {
      t=$3; gsub(/^[[:space:]]+|[[:space:]]+$/, "", t)
      dl=$5; gsub(/^[[:space:]]+|[[:space:]]+$/, "", dl)
      printf "  - %s %s (기한 %s)\n", id, t, dl
    }' "$dec")"
  if [ -n "$open_dec" ]; then
    say "- 열린 결정(docs/decisions.md) — 이 결정에 막히는 작업은 멈추고 묻는다:
$open_dec"
  fi
fi

# ---------- 진행 로그 ----------
prog="$root/docs/progress.md"
if [ -f "$prog" ]; then
  last="$(grep -E '^- [0-9]{4}-[0-9]{2}-[0-9]{2} ' "$prog" | tail -n 5)"
  [ -n "$last" ] && say "- 최근 진행(docs/progress.md 로그 마지막 5줄):
$last"
fi

# ---------- 로컬 Supabase ----------
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ] && command -v supabase >/dev/null 2>&1 && [ -f "$root/supabase/config.toml" ]; then
  if (cd "$root" && supabase status >/dev/null 2>&1); then
    say "- 로컬 Supabase: 실행 중"
  else
    say "- 로컬 Supabase: 꺼져 있음 (필요하면 supabase start)"
  fi
fi

# ---------- 설정 경고 ----------
[ -f "$root/package.json" ] || say "- 앱이 아직 없어요(package.json 없음). W1 스캐폴드는 README의 'W1 첫 세션 프롬프트'를 따르세요."
if [ -f "$root/.claude/prod-ref.txt" ]; then
  ref="$(awk '!/^[[:space:]]*#/ && NF { print $1; exit }' "$root/.claude/prod-ref.txt")"
  [ -z "$ref" ] && say "- 경고: .claude/prod-ref.txt 에 운영 project ref가 없어요. guard-bash의 운영 ref 차단이 꺼진 상태예요."
fi
if [ -f "$root/.mcp.json" ] && grep -q '<DEV_PROJECT_REF>' "$root/.mcp.json"; then
  say "- 경고: .mcp.json 의 supabase-dev 서버에 <DEV_PROJECT_REF> 자리표시자가 남아 있어요(사용자가 dev ref로 바꿔야 함)."
fi

printf '%s\n' "$out" | head -c 9500
exit 0
