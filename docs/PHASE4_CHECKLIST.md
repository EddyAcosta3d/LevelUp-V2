# Fase 4 — Prevención automática (CI + quality gate)

Objetivo: detectar desincronizaciones y regresiones antes de merge/deploy.

## Cambios implementados
- Script único de validación: `scripts/quality_gate.sh`.
- Workflow de GitHub Actions: `.github/workflows/quality-gate.yml` para ejecutar el gate en PR y push.

## Gate automático ejecuta
1. `python scripts/mirror_sync.py sync`
2. `python scripts/mirror_sync.py check`
3. `node scripts/tests/test_integration.js`
4. `node scripts/tests/test_corrections.js`
5. `node scripts/tests/test_all_buttons.js`
6. `node scripts/tests/test_button_bindings.js`

## Uso local recomendado (antes de commit)
```bash
bash scripts/quality_gate.sh
```

## Criterio de salida de Fase 4
- Workflow `Quality Gate` en verde en PR.
- Sin diffs de espejo en PR.
- Baseline de tests pasando local y en CI.
