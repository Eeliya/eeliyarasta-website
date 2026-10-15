#!/usr/bin/env bash
# Write mockups into sandbox/mocks/ in one step, then confirm the mock server sees them.
# Usage: echo <base64 tar.gz of .svelte files> | bash sandbox/mock-push.sh [--rm name1,name2]
#   --rm   optional, comma-separated mock names (without .svelte) to delete first
# Mocks stay local (git-ignored). Deletes are limited to sandbox/mocks/.
set -euo pipefail
t() { date +%s%3N; }
dir="$(cd "$(dirname "$0")" && pwd)/mocks"
mkdir -p "$dir" && cd "$dir"
rm_list=""
[ "${1:-}" = "--rm" ] && rm_list="${2:-}"

a=$(t)
if [ -n "$rm_list" ]; then
  IFS=',' read -ra names <<< "$rm_list"
  for n in "${names[@]}"; do rm -f -- "$(basename -- "$n" .svelte).svelte"; done
fi
b=$(t)
written=$(base64 -d | tar xzv)
c=$(t)
list=$(curl -s --max-time 3 "localhost:${MOCK_PORT:-5199}/__mocks/list" || true)
missing=""
for f in $written; do
  n="${f%.svelte}"
  case "$list" in *"$n"*) ;; *) missing="$missing $n" ;; esac
done
d=$(t)

echo "wrote: $(echo $written | xargs)"
[ -n "$rm_list" ] && echo "deleted: $rm_list"
if [ -z "$list" ]; then echo "server: not running (start it with npm run mock:serve)"
elif [ -n "$missing" ]; then echo "server: missing$missing"
else echo "server: all listed"; fi
echo "delete=$((b-a))ms write=$((c-b))ms check=$((d-c))ms total=$((d-a))ms"
