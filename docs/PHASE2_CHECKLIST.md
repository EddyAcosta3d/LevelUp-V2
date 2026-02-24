# Fase 2 — Hardening de acceso y sesión

Objetivo: reducir riesgo de escalación por manipulación de `sessionStorage` y asegurar que el rol admin solo exista con condiciones estrictas.

## Cambios implementados
- Se elimina el bypass por URL (`?admin` / `?mode`) en `index.html`.
- `hero_session.getSession()` ahora valida:
  - estructura básica de sesión,
  - expiración (8h),
  - consistencia `email` de sesión vs `email` del JWT (si existe claim),
  - recomputo de `isAdmin` con condición estricta (`heroId=admin` + `email=eddy@levelup.mx`).
- Sesiones imposibles de admin se invalidan automáticamente.

## Pruebas rápidas (manuales)
1. Login normal alumno → no debe ver controles admin.
2. Login admin real (Eddy) → sí debe ver controles admin.
3. Abrir `index.html?admin=1` sin sesión → debe redirigir a `login.html`.
4. Si se manipula `sessionStorage` para `isAdmin=true` con otro correo, la sesión debe invalidarse.

## Validación CLI mínima
```bash
python scripts/mirror_sync.py sync
python scripts/mirror_sync.py check
node scripts/tests/test_integration.js
node scripts/tests/test_corrections.js
node scripts/tests/test_all_buttons.js
node scripts/tests/test_button_bindings.js
```
