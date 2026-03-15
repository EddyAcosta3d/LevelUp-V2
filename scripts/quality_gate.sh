#!/usr/bin/env bash
set -euo pipefail

printf '\n[1/4] Check required files exist\n'
required_files=(
  "index.html"
  "css/styles.base.css"
  "js/app.js"
  "js/app.main.js"
  "js/app.bindings.js"
  "js/modules/core_globals.js"
  "js/modules/fichas.js"
  "js/modules/tienda.js"
  "js/modules/eventos.js"
  "js/modules/desafios.js"
)
for f in "${required_files[@]}"; do
  if [ ! -f "$f" ]; then
    printf "MISSING: %s\n" "$f"
    exit 1
  fi
done
printf 'All required files present.\n'

before_diff_file="$(mktemp)"
after_diff_file="$(mktemp)"
cleanup() {
  rm -f "$before_diff_file" "$after_diff_file"
}
trap cleanup EXIT

git diff --name-only | sort > "$before_diff_file"

printf '\n[2/4] Mirror sync + integrity check\n'
python scripts/mirror_sync.py sync
python scripts/mirror_sync.py check

printf '\n[3/4] Verify sync/check did not introduce new drift\n'
git diff --name-only | sort > "$after_diff_file"
new_drift="$(comm -13 "$before_diff_file" "$after_diff_file")"
if [ -n "$new_drift" ]; then
  printf 'Mirror drift detected after sync/check. Commit synchronized files:\n%s\n' "$new_drift"
  git --no-pager diff --stat -- $new_drift
  exit 1
fi

printf '\n[4/4] JS syntax check\n'
node --input-type=module < /dev/null
while IFS= read -r f; do
  node --check "$f" && printf 'OK: %s\n' "$f"
done < <(find js -type f -name '*.js' | sort)

printf '\nQuality gate passed.\n'
