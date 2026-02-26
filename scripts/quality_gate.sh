#!/usr/bin/env bash
set -euo pipefail

printf '\n[1/2] Check required files exist\n'
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

printf '\n[2/2] JS syntax check\n'
node --input-type=module < /dev/null
for f in js/app.js js/app.main.js js/app.bindings.js; do
  node --check "$f" && printf 'OK: %s\n' "$f"
done

printf '\nQuality gate passed.\n'
