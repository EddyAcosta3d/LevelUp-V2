# Auditoría técnica — Modal de subida de nivel (LevelUp)

## Alcance revisado

- Estructura del modal: `assets/index.html`.
- Lógica de apertura/cierre/render/claim: `assets/js/modules/app_actions.js`.
- Eventos de binding del modal: `assets/js/app.bindings.js`.
- Estilos del modal y legado acumulado: `assets/css/styles.base.css`.
- Consistencia fuente↔espejo: `scripts/mirror_sync.py check`.

---

## Qué partes **sí** están funcionando y conviene mantener

1. **Flujo de recompensa pendiente (FIFO) sólido**
   - `getNextPendingReward()` toma la primera recompensa pendiente.
   - `claimPendingReward()` hace `shift()` y registra histórico con metadatos (nivel, tipo, fecha, stat auto, bonus).
   - Resultado: flujo consistente y predecible para varios level-ups acumulados.

2. **Bloqueo de cierre cuando hay recompensa pendiente**
   - `closeLevelUpModal()` evita cerrar por backdrop mientras haya pendiente (salvo `force=true`).
   - Esto protege de estados “subí de nivel pero no reclamé”.

3. **Separación de modos de elección clara**
   - `renderLevelUpChoices(mode)` cubre:
     - `autoStat` (obligatorio de nivel)
     - `statExtra` (recompensa opcional)
     - `main` (4 recompensas principales)
   - El diseño de flujo es correcto para guiar al usuario sin ambigüedad.

4. **Guardas anti doble click/doble claim**
   - `state.ui.claimingReward` + deshabilitado de botones evita reclamos duplicados.

5. **UX visual principal (cinemática + número animado) útil**
   - Animación del nivel y delayed reveal (`cine-done`) aporta feedback de progresión.

---

## Qué partes están desalineadas o sobran (candidatas a quitar)

### A) Selectores JS heredados que ya no existen en el DOM actual

1. En `openLevelUpModal()`, se intenta resetear scroll con `.modal__body--levelup`, pero el markup actual usa `.luBody` / `#levelUpScrollArea`.
   - Efecto: no rompe, pero nunca aplica el reset real de scroll.

2. Se busca `.modal__card--levelup` para animaciones de entrada/shake, pero el card actual es `.luCard`.
   - Efecto: animaciones pueden no dispararse en la versión actual.

3. En bindings existe listener para `#btnLevelUpClose`, pero ese botón no existe en el HTML del modal.
   - Efecto: código muerto (no funcional), ruido de mantenimiento.

### B) CSS legacy muy grande y duplicado

`styles.base.css` contiene múltiples “eras” del modal LevelUp:
- Bloques antiguos para `.modal__card--levelup`.
- Bloques reset nuevos para `.luModal`, `.luCard`, `.luBody`.
- Varias reglas repetidas con distinto enfoque (pre y post refactor visual).

Impacto:
- Aumenta complejidad de depurar.
- Mayor riesgo de conflictos por cascada.
- Hace difícil saber qué regla está realmente activa.

### C) Divergencia fuente↔espejo (riesgo alto)

`python scripts/mirror_sync.py check` reporta diferencias entre raíz (`/js`, `/css`, `/index.html`) y `assets/*`.

Impacto:
- Se puede arreglar algo en una capa y romperse en la otra.
- Dificulta analizar “qué código corre realmente” según entorno de build/hosting.

---

## Recomendación de limpieza (orden sugerido)

### Fase 1 (rápida, bajo riesgo)

1. Normalizar selectores JS al DOM actual (`lu*`):
   - `.modal__body--levelup` → `#levelUpScrollArea` (o `.luBody`)
   - `.modal__card--levelup` → `.luCard`
2. Eliminar listener de `#btnLevelUpClose` si no habrá botón real.
3. Añadir un test/manual-check simple: abrir modal 3 veces seguidas y verificar:
   - scroll inicia arriba,
   - animación entra siempre,
   - no se puede cerrar sin reclamar.

### Fase 2 (reducción de CSS)

1. Consolidar estilos del modal en un único bloque “vigente” (lu*).
2. Eliminar reglas antiguas de `.modal__card--levelup` que ya no tengan uso.
3. Documentar un comentario de frontera en CSS: `/* LEVELUP CURRENT API: luModal/luCard/luBody/... */`.

### Fase 3 (consistencia repo)

1. Definir una sola fuente efectiva (raíz o assets).
2. Ejecutar sync en la dirección correcta y bloquear drift en CI con `mirror_sync.py check`.

---

## Lista de “podas” concretas que hoy ya se pueden hacer

- Código muerto de binding: `#btnLevelUpClose`.
- Selectores JS legacy (`.modal__body--levelup`, `.modal__card--levelup`) en la ruta lu*.
- Bloques CSS legacy de `.modal__card--levelup` una vez verificado que no quedan referencias en HTML/JS activos.

---

## Resultado esperado tras la mejora

- Menos líneas “históricas” y menor costo de mantenimiento.
- Modal más predecible (sin selectores fantasmas).
- Menos probabilidad de regresiones visuales por cascada CSS.
- Mejor base para futuras mejoras de UX (p. ej. accesibilidad/focus trapping).
