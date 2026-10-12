#!/usr/bin/env bash
# 생성 타입이 마이그레이션과 맞는지 확인한다(로컬 스택 기준). 다르면 exit 1.
# 사용: supabase start && supabase db reset && scripts/check-types.sh
set -euo pipefail
root="$(git rev-parse --show-toplevel)"
cd "$root"
out="src/types/database.types.ts"
if [ ! -f "$out" ]; then
  echo "check-types: $out 이 없어요. 'supabase gen types typescript --local > $out' 를 먼저 실행하세요." >&2
  exit 1
fi
supabase gen types typescript --local > "$out"
if ! git diff --exit-code -- "$out"; then
  echo "check-types: $out 이 마이그레이션과 달라요. 재생성한 파일을 커밋하세요." >&2
  exit 1
fi
echo "check-types: OK"
