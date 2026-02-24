# Fase 3 — Reducción de complejidad y limpieza de bindings

Objetivo: bajar deuda técnica en UI sin cambiar reglas de negocio, para reducir regresiones al tocar módulos grandes.

## Cambios implementados
- `app.bindings.js`:
  - se extrae `bindModalClose(btnId, modalId)` para centralizar cierres de modales y evitar lógica repetida.
- `eventos.js`:
  - se extrae `bindEventModalActions(...)` para encapsular comportamiento de botones del modal de evento.
  - se agrega `resetAndBindClick(...)` para re-vincular listeners de forma segura al reabrir modal y evitar handlers stale.

## Checklist de verificación manual (rápido)
1. Abrir/cerrar modales: Roles, Desafíos, Historial y Materias.
2. Abrir un evento bloqueado y uno desbloqueado; validar estados del botón pelear.
3. Desbloquear/bloquear evento desde el modal (admin) y confirmar refresh de estado.
4. Iniciar pelea de evento tipo boss y confirmar apertura de modal de batalla.

## Validación CLI mínima
```bash
python scripts/mirror_sync.py sync
python scripts/mirror_sync.py check
node scripts/tests/test_integration.js
node scripts/tests/test_corrections.js
node scripts/tests/test_all_buttons.js
node scripts/tests/test_button_bindings.js
```
