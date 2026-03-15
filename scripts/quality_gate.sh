#!/usr/bin/env bash
set -euo pipefail

printf '\n[1/3] Check required files exist\n'
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

printf '\n[2/3] Mirror integrity check\n'
python scripts/mirror_sync.py check

printf '\n[3/3] JS syntax check\n'
node --input-type=module < /dev/null
while IFS= read -r f; do
  node --check "$f" && printf 'OK: %s\n' "$f"
done < <(find js -type f -name '*.js' | sort)

printf '\nQuality gate passed.\n'
