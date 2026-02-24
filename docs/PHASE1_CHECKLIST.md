# Fase 1 — Checklist de estabilización

Objetivo: evitar regresiones por desincronización raíz/espejo y validar una línea base mínima antes de cualquier feature.

## 1) Fuente única
- Editar únicamente en la raíz (`/css`, `/js`, `/data`, `/index.html`).
- No editar archivos dentro de `assets/` manualmente.

## 2) Sincronización obligatoria
```bash
python scripts/mirror_sync.py sync
python scripts/mirror_sync.py check
```

## 3) Baseline de pruebas
```bash
node scripts/tests/test_integration.js
node scripts/tests/test_corrections.js
node scripts/tests/test_all_buttons.js
node scripts/tests/test_button_bindings.js
```

## 4) Criterio de salida de Fase 1
- `mirror_sync.py check` pasa sin diffs.
- `test_integration.js` pasa al 100%.
- Los demás tests pasan (si hay warnings, documentarlos en el commit/PR).

## 5) Regla pre-commit
Antes de cada commit repetir pasos 2 y 3.
