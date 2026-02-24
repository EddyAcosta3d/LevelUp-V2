#!/usr/bin/env bash
set -euo pipefail

printf '\n[1/6] Mirror sync\n'
python scripts/mirror_sync.py sync

printf '\n[2/6] Mirror consistency check\n'
python scripts/mirror_sync.py check

printf '\n[3/6] Integration test\n'
node scripts/tests/test_integration.js

printf '\n[4/6] Corrections test\n'
node scripts/tests/test_corrections.js

printf '\n[5/6] Buttons audit\n'
node scripts/tests/test_all_buttons.js

printf '\n[6/6] Critical button bindings\n'
node scripts/tests/test_button_bindings.js

printf '\nQuality gate passed.\n'
