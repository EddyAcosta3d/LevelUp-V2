# Auditoría profunda de código (2026-02-17)

## Alcance
Se auditó la base JS principal (`/js`) y la plantilla principal (`index.html`) buscando:

- Errores de ejecución en scripts de verificación.
- Elementos de UI potencialmente huérfanos (IDs no referenciados por JS).
- Funciones potencialmente muertas/no llamadas.
- Exports no usados en el resto de la app.
- Estado de sincronización fuente ↔ espejo (`assets/`).

## Hallazgos clave

### 1) Script de integración roto por ruta absoluta
- `test_integration.js` usaba la ruta fija `/home/user/LevelUp-V2`, lo que rompía la ejecución fuera de ese entorno.
- Se corrigió para resolver rutas desde `__dirname` y evitar fallos por archivos inexistentes con validación previa.
- Resultado: el test vuelve a ejecutar y validar correctamente los módulos, correcciones y sincronización esperada.

### 2) IDs de `index.html` sin referencia textual en JS (24)
IDs detectados como no referenciados desde `/js`:

- `menuDatos`
- `sidebar`
- `heroNotesOverlay`
- `heroMedalsPill`
- `chSubtitle`
- `roleModalTitle`
- `levelUpBackdrop`
- `levelUpPanel`
- `levelUpTitle`
- `confirmBackdrop`
- `subjectsBackdrop`
- `subjectsTitle`
- `challengeBackdrop`
- `challengeModalTitle`
- `chModalSubjectDropdown`
- `btnChModalSubject`
- `chModalSubjectMenu`
- `inChDiffPick`
- `historyBackdrop`
- `historyModalTitle`
- `fileJson`
- `githubConfigTitle`
- `eventModalUnlockBox`
- `eventModalEligBox`

> Nota: esta señal es heurística; algunos IDs pueden usarse sólo desde CSS o por acceso indirecto.

### 3) Funciones con única referencia textual (potencialmente no llamadas)
Se detectaron 7 funciones con un solo match textual en todo `/js`:

- `_heroArtCandidates` (`js/modules/app_actions.js`)
- `getGitHubStatus` (`js/modules/github_sync.js`)
- `initHeroSceneParallax` (`js/modules/fichas.js`)
- `openSubjectDropdown` (`js/modules/fichas.js`)
- `preloadImage` (`js/modules/fichas.js`)
- `renderPeopleTable` (`js/modules/app_actions.js`)
- `showFallbackAvatar` (`js/modules/fichas.js`)

### 4) Exports no reutilizados en el código
Se detectaron 4 exports sin referencias adicionales:

- `preloadImage` (`js/modules/fichas.js`)
- `showFallbackAvatar` (`js/modules/fichas.js`)
- `openSubjectDropdown` (`js/modules/fichas.js`)
- `getGitHubStatus` (`js/modules/github_sync.js`)

Esto sugiere API pública no consumida o deuda técnica tras refactors.

### 5) Desincronización fuente/espejo
El check oficial de espejo reporta diffs pendientes en:

- `js/app.bindings.js`
- `js/modules/app_actions.js`
- `js/modules/ui_shell.js`

Impacto: riesgo de comportamientos distintos entre raíz y `assets/` si se despliega desde espejo.

### 6) Botones referenciados sin listener y un botón sin binding
Del check existente `test_all_buttons.js`:

- 15 botones referenciados sin listener explícito.
- 1 botón sin binding ni referencia (`btnChModalSubject`).

Esto coincide con parte de los IDs huérfanos detectados.

## Acciones recomendadas (priorizadas)

1. **Alta prioridad:** decidir contrato de despliegue (raíz o `assets/`) y ejecutar `python scripts/mirror_sync.py sync` para eliminar deriva.
2. **Alta prioridad:** revisar `btnChModalSubject` y modales relacionados (`subjects/challenge/history`) para confirmar si quedó código muerto.
3. **Media prioridad:** eliminar exports no usados o consumirlos desde donde corresponda.
4. **Media prioridad:** convertir el check heurístico en reglas de lint/CI (por ejemplo, auditoría de IDs/exports en pipeline).
5. **Baja prioridad:** documentar explícitamente qué IDs son “sólo CSS” para reducir falsos positivos.

## Comandos ejecutados durante la auditoría

```bash
node test_all_buttons.js
node test_button_bindings.js
node test_corrections.js
node test_integration.js
python scripts/mirror_sync.py check
node scripts/deep_audit.cjs
```
