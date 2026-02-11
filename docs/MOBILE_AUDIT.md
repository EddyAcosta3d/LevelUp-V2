# Auditoría móvil (código) — LevelUp V2

Fecha: 2026-02-10

## Alcance revisado
- `index.html` (meta viewport y estructura shell móvil)
- `css/styles.base.css` (layout responsive base)
- `css/styles.mobile.css` (overrides para teléfono)
- `css/styles.challenges.css` (modal de eventos en móvil)
- `js/app.main.js` y `js/modules/ui_shell.js` (comportamiento específico en iOS y breakpoints)

## Qué ya está bien encaminado
1. **Existe una capa móvil dedicada** (`styles.mobile.css`) con ajustes de tamaño táctil, cards, navegación inferior, y variantes por breakpoints chicos (430/380/375).
2. **Se usa safe-area** para notch/home indicator en varias zonas (`env(safe-area-inset-*)`).
3. **La topbar para teléfonos está simplificada**: menú + marca centrada + trofeo, ocultando acciones pesadas en esa vista.
4. **Hay prevención explícita de overflow horizontal** en teléfono y fallback visual para modales/eventos.

## Hallazgos principales y ajustes recomendados

### Prioridad alta

1. **Zoom deshabilitado globalmente (accesibilidad)**
   - Se está enviando `user-scalable=no` en el viewport.
   - Además, en JS hay lógica para bloquear doble-tap en iOS y comentario de que también afecta pinch-to-zoom.
   - **Riesgo:** usuarios con baja visión no pueden ampliar fácilmente.
   - **Ajuste recomendado:** permitir zoom (`user-scalable=yes`, sin `maximum-scale=1`) y mantener solo mitigaciones puntuales donde realmente molesten.

2. **Uso intensivo de `100vh` en modales fullscreen**
   - En modal de eventos se repite `height/max-height: 100vh` en varios breakpoints.
   - **Riesgo:** en iOS/Android con barras dinámicas se puede recortar contenido/acciones.
   - **Ajuste recomendado:** migrar a `100dvh`/`100svh` con fallback progresivo y validar en Safari iOS.

3. **Demasiados `!important` en la capa móvil**
   - `styles.mobile.css` depende fuertemente de overrides con alta especificidad.
   - **Riesgo:** regresiones difíciles de depurar cuando se tocan estilos base.
   - **Ajuste recomendado:** consolidar reglas por componente y reducir conflictos entre `base` y `mobile`.

### Prioridad media

4. **Reglas globales sobre `*` en móvil**
   - Se aplica `-webkit-overflow-scrolling: touch` a todos los elementos.
   - **Riesgo:** costo innecesario y comportamientos raros en contenedores no scrolleables.
   - **Ajuste recomendado:** limitarlo a contenedores de scroll reales (ej. `.pages`, `.dropdown__menu`, modales con overflow).

5. **Header/acciones divididas entre breakpoints 980/640/430**
   - Hay lógica CSS y JS con varios puntos de corte (980, 640, 430) + comportamientos en `ui_shell.js`.
   - **Riesgo:** estados intermedios difíciles (ej. foldables o móviles en landscape grande).
   - **Ajuste recomendado:** definir matriz de breakpoints única y documentada (phone/tablet/desktop).

6. **Escena del héroe muy dominante en teléfonos pequeños**
   - En ≤430px, `.heroScene` usa `height: max(340px, 52svh)` con `max-height: 66svh`.
   - **Riesgo:** en pantallas cortas deja poco espacio para inputs/acciones sin scroll adicional.
   - **Ajuste recomendado:** bajar altura base en equipos pequeños y priorizar contenido editable arriba del pliegue.

### Prioridad baja

7. **Sidebar fuera de pantalla detectado por layout (esperado)**
   - En la inspección de viewport se detectan elementos con coordenadas negativas por drawer cerrado.
   - **Riesgo real:** bajo (comportamiento off-canvas normal), pero conviene vigilar que no genere foco accidental por teclado/lectores.

## Plan corto sugerido (1 sprint)
1. **Accesibilidad primero:** habilitar zoom y ajustar prevención de doble tap para no bloquear pinch global.
2. **Viewport moderno:** reemplazar `100vh` críticos por `100dvh/100svh` (modal de eventos + overlays full screen).
3. **Refactor ligero de CSS móvil:** limpiar `!important` en 2 áreas de alto cambio (header y fichas).
4. **QA móvil dirigida:** iPhone 12/13 mini, iPhone SE, Pixel 7, iPad mini (portrait/landscape).

## Evidencia rápida de ejecución
- Se abrió la app en viewport móvil (390x844) y no se observó overflow horizontal global del documento (`scrollWidth == innerWidth`).
- Los elementos fuera de viewport corresponden al drawer lateral cerrado (comportamiento esperado de menú off-canvas).
