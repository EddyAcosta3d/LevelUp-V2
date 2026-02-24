# Testing scripts

Para mantener la raíz del repo limpia, los scripts de prueba manual quedaron en `scripts/tests/`.

## Scripts disponibles

- `scripts/tests/test_integration.js`
- `scripts/tests/test_corrections.js`
- `scripts/tests/test_all_buttons.js`
- `scripts/tests/test_button_bindings.js`

## Ejecución rápida

```bash
node scripts/tests/test_integration.js
node scripts/tests/test_corrections.js
node scripts/tests/test_all_buttons.js
node scripts/tests/test_button_bindings.js
```
Checklist operativo de estabilización: `docs/PHASE1_CHECKLIST.md`.
Checklist de hardening de acceso/sesión: `docs/PHASE2_CHECKLIST.md`.
Checklist de reducción de complejidad/bindings: `docs/PHASE3_CHECKLIST.md`.
Checklist de prevención automática (CI/gate): `docs/PHASE4_CHECKLIST.md`.
