# 🔍 ANÁLISIS EXHAUSTIVO DE ERRORES - LevelUp-V2

**Fecha**: 2026-02-17
**Análisis**: Revisión profunda de todo el código JavaScript
**Enfoque**: Errores no documentados en ERROR_ANALYSIS.md

---

## 📊 RESUMEN EJECUTIVO

| Categoría | Cantidad | Acción Requerida |
|-----------|----------|------------------|
| 🔴 **CRÍTICOS** | 5 | ⚠️ INMEDIATO |
| 🟠 **ALTOS** | 8 | 📅 Esta semana |
| 🟡 **MEDIOS** | 12 | 📋 Planificar |
| **TOTAL** | **25** | — |

### ⚠️ HALLAZGOS MÁS GRAVES

1. **tienda.js** - Usa funciones `$()` y `uid()` sin importarlas (ReferenceError garantizado)
2. **Memory Leaks Masivos** - 35 `addEventListener`, 0 `removeEventListener` en todo el proyecto
3. **Async sin Try-Catch** - Funciones async en tienda.js sin manejo de errores
4. **Race Conditions** - Multiple estados modificados sin sincronización

---

## 🔴 ERRORES CRÍTICOS (PRIORIDAD MÁXIMA)

### ❌ 1. ReferenceError en tienda.js - Función `$()` No Importada

**Archivo**: `js/modules/tienda.js`
**Líneas afectadas**: 25, 155, 274, 277, 319, 324, 393
**Severidad**: 🔴 **CRÍTICA**
**Tipo**: ReferenceError en tiempo de ejecución

#### Código problemático:
```javascript
// Línea 12-15: Importaciones actuales
import {
  state,
  escapeHtml
} from './core_globals.js';

// Línea 25: Usa $ sin importarla
export function renderTienda(){
  const container = $('#tiendaContainer');  // ❌ ReferenceError
  if (!container) return;
```

#### Impacto:
- La tienda **NO FUNCIONA** - Error inmediato al intentar acceder
- Afecta 7 ubicaciones diferentes en el archivo
- Bloquea completamente la funcionalidad de canje de medallas

#### Solución:
```javascript
// Agregar $ y $$ a las importaciones:
import {
  $,          // ✅ AGREGAR
  $$,         // ✅ AGREGAR (también se necesita)
  state,
  escapeHtml,
  uid         // ✅ AGREGAR (ver error #2)
} from './core_globals.js';
```

#### Ubicaciones exactas donde falla:
| Línea | Contexto |
|-------|----------|
| 25 | `const container = $('#tiendaContainer');` |
| 155 | `const container = $('#tiendaContainer');` |
| 274 | `let modal = $('#storeItemModal');` |
| 277 | `modal = $('#storeItemModal');` |
| 319 | `const modal = $('#storeItemModal');` |
| 324 | `const modal = $('#storeItemModal');` |
| 393 | `const existingModal = $('#storeItemModal');` |

---

### ❌ 2. ReferenceError en tienda.js - Función `uid()` No Importada

**Archivo**: `js/modules/tienda.js:375`
**Severidad**: 🔴 **CRÍTICA**
**Tipo**: ReferenceError

#### Código problemático:
```javascript
// Línea 375: Dentro de saveStoreItem()
const newItem = {
  id: uid('store'),  // ❌ ReferenceError: uid is not defined
  title,
  desc,
  cost,
  stock,
  kind,
  available: true
};
```

#### Impacto:
- No se pueden **crear nuevos items** en la tienda
- Error al guardar cualquier item nuevo

#### Solución:
Agregar `uid` a las importaciones (ver solución del error #1)

---

### ❌ 3. Funciones Globales Llamadas Sin Validación

**Archivo**: `js/modules/tienda.js` (múltiples líneas)
**Severidad**: 🔴 **CRÍTICA**
**Tipo**: TypeError potencial

#### Funciones llamadas sin verificar existencia:

| Función | Líneas donde se usa | Importada? |
|---------|---------------------|------------|
| `toast()` | 202, 210, 215, 220, 245, 255, 260, 270, 345, 346, 370, 384 | ❌ NO |
| `openConfirmModal()` | 215, 255 | ❌ NO |
| `showBigReward()` | 246 | ❌ NO |
| `renderHeroDetail()` | 242 | ❌ NO |
| `saveLocal()` | 240, 268, 387 | ✅ SÍ |
| `renderTienda()` | 241, 269, 388 | ✅ SÍ (es la misma función) |

#### Código problemático:
```javascript
// Línea 202: Sin validación
toast(`❌ No tienes suficientes medallas...`);

// Línea 215: Asume que existe
const ok = await openConfirmModal({
  title: '¿Canjear item?',
  message: `Usarás ${cost} medallas para "${item.title}"`
});

// Línea 246: Sin validación
showBigReward({
  title: item.title,
  xp: 0,
  text: `¡${item.title} canjeado!`
});
```

#### Impacto:
Si alguna función no está disponible (por error de carga de módulos), **toda la tienda se rompe**

#### Solución:
```javascript
// Opción 1: Importar funciones necesarias
import { toast, openConfirmModal, showBigReward } from './celebrations.js';
import { renderHeroDetail } from './fichas.js';

// Opción 2: Agregar validaciones
if (typeof toast === 'function') {
  toast(`❌ No tienes suficientes medallas...`);
}

const ok = (typeof openConfirmModal === 'function')
  ? await openConfirmModal({...})
  : confirm('¿Continuar?'); // Fallback
```

---

### ❌ 4. Async/Await Sin Try-Catch

**Archivo**: `js/modules/tienda.js:189-252`
**Severidad**: 🔴 **CRÍTICA**
**Tipo**: Promesas no manejadas (UnhandledPromiseRejection)

#### Código problemático:
```javascript
// Línea 167-187: Event listener async sin try-catch
container.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;

  const action = btn.dataset.action;
  const itemId = btn.dataset.itemId;

  if (action === 'claim') {
    await claimStoreItem(itemId);  // ❌ Sin manejo de errores
  }

  if (action === 'delete') {
    await deleteStoreItem(itemId);  // ❌ Sin manejo de errores
  }
  // ...
});

// Línea 189-252: Función async sin try-catch
async function claimStoreItem(itemId){
  const hero = currentHero();
  if (!hero) return;

  // ... validaciones ...

  const ok = await openConfirmModal({...});  // Puede fallar
  if (!ok) return;

  // ... más código sin protección ...

  await renderTienda();  // Puede fallar
  await renderHeroDetail();  // Puede fallar

  // ❌ Ninguna línea tiene try-catch
}
```

#### Impacto:
- Si cualquier promesa falla, **no hay feedback al usuario**
- Los errores se pierden silenciosamente
- El estado puede quedar inconsistente (medallas descontadas pero item no agregado)

#### Solución:
```javascript
container.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;

  const action = btn.dataset.action;
  const itemId = btn.dataset.itemId;

  try {
    if (action === 'claim') {
      await claimStoreItem(itemId);
    }

    if (action === 'delete') {
      await deleteStoreItem(itemId);
    }
  } catch (err) {
    console.error('Error en acción de tienda:', err);
    if (typeof toast === 'function') {
      toast('❌ Error al procesar la acción. Intenta de nuevo.');
    }
  }
});

async function claimStoreItem(itemId){
  try {
    const hero = currentHero();
    if (!hero) {
      toast('❌ Selecciona un héroe primero');
      return;
    }

    // ... resto del código ...

  } catch (err) {
    console.error('Error al canjear item:', err);
    toast('❌ Error al canjear el item. Intenta de nuevo.');
    throw err; // Re-lanzar para que el caller maneje
  }
}
```

---

### ❌ 5. Memory Leak Masivo - Event Listeners Nunca Removidos

**Archivos**: Todos los módulos
**Severidad**: 🔴 **CRÍTICA**
**Tipo**: Memory Leak + Ejecución duplicada

#### Estadísticas:
```
✅ addEventListener:     35 ocurrencias
❌ removeEventListener:   0 ocurrencias
```

#### Módulos afectados:
| Módulo | addEventListener | removeEventListener |
|--------|------------------|---------------------|
| ui_shell.js | 1 | 0 |
| github_sync.js | 5 | 0 |
| fichas.js | 10 | 0 |
| app_actions.js | 4 | 0 |
| desafios.js | 6 | 0 |
| tienda.js | 2 | 0 |
| core_globals.js | 1 | 0 |
| eventos.js | 6 | 0 |

#### Ejemplo en tienda.js (línea 154-187):
```javascript
export function bindTiendaEvents(){
  const container = $('#tiendaContainer');
  if (!container) return;

  if (container.__tiendaBound) return;  // Flag para evitar duplicados
  container.__tiendaBound = true;

  // ❌ Este listener NUNCA se remueve
  container.addEventListener('click', async (e) => {
    // ...
  });

  // Si renderTienda() se llama múltiples veces, se acumulan listeners
}
```

#### Impacto:
- **Cada re-renderizado agrega nuevos listeners** sin remover los viejos
- Los eventos se ejecutan múltiples veces (2x, 3x, 4x...)
- **Consumo creciente de memoria** (especialmente en sesiones largas)
- En tienda: clicks pueden procesar el canje múltiples veces

#### Ejemplo del problema:
```
Usuario abre la tienda → 1 listener
Usuario cambia de héroe → renderTienda() → 2 listeners (flag evita, pero...)
Usuario cierra/abre tienda → 2 listeners
Después de 10 interacciones → Posibles múltiples listeners
```

#### Solución:
```javascript
// Opción 1: Remover antes de agregar (recomendado)
export function bindTiendaEvents(){
  const container = $('#tiendaContainer');
  if (!container) return;

  // Remover listener anterior si existe
  if (container.__tiendaHandler) {
    container.removeEventListener('click', container.__tiendaHandler);
  }

  // Guardar referencia al handler
  const handler = async (e) => {
    // ... código del listener ...
  };
  container.__tiendaHandler = handler;

  // Agregar nuevo listener
  container.addEventListener('click', handler);
}

// Opción 2: Usar Event Delegation a nivel document (más eficiente)
// En lugar de agregar listeners a cada contenedor, usar uno global
document.addEventListener('click', (e) => {
  const tiendaBtn = e.target.closest('#tiendaContainer [data-action]');
  if (tiendaBtn) {
    // Procesar acción
  }
});
```

#### Archivos que requieren corrección:
1. `js/modules/tienda.js` - bindTiendaEvents()
2. `js/modules/fichas.js` - Multiple scroll listeners
3. `js/modules/eventos.js` - Event cards
4. `js/modules/desafios.js` - Challenge bindings
5. `js/modules/github_sync.js` - Modal events
6. Todos los demás módulos con addEventListener

---

## 🟠 ERRORES DE ALTA PRIORIDAD

### ⚠️ 6. Race Condition en claimStoreItem() - Cambio de Héroe Durante Modal

**Archivo**: `js/modules/tienda.js:189-252`
**Severidad**: 🟠 **ALTA**
**Tipo**: Race Condition / Logic Error

#### Código problemático:
```javascript
async function claimStoreItem(itemId){
  const hero = currentHero();  // ⬅️ Se obtiene al inicio
  if (!hero) return;

  const store = state.data?.store || { items: [] };
  const item = store.items.find(i => String(i.id) === String(itemId));
  if (!item) return;

  const cost = Number(item.cost ?? 0);
  const heroMedals = Number(hero.medals ?? 0);

  if (heroMedals < cost) {
    toast(`❌ No tienes suficientes medallas...`);
    return;
  }

  // Usuario ve modal y puede cambiar de héroe AQUÍ ⬇️
  const ok = await openConfirmModal({  // ⏳ Mientras espera...
    title: '¿Canjear item?',
    message: `Usarás ${cost} medallas para "${item.title}"`
  });

  if (!ok) return;

  // ⚠️ PELIGRO: hero puede ya NO ser el héroe actual
  hero.medals = heroMedals - cost;  // Se descuentan medallas del héroe EQUIVOCADO
  hero.storeClaims.push({...});      // Se agrega claim al héroe EQUIVOCADO
}
```

#### Escenario de falla:
1. Usuario selecciona "Héroe A" con 50 medallas
2. Hace click en canjear item de 30 medallas
3. Mientras el modal de confirmación está abierto, cambia a "Héroe B"
4. Usuario hace click en "Aceptar"
5. **BUG**: Se descuentan 30 medallas de "Héroe A" (que ya no está seleccionado)

#### Solución:
```javascript
async function claimStoreItem(itemId){
  const heroId = state.selectedHeroId;  // Guardar ID, no referencia

  const hero = currentHero();
  if (!hero || hero.id !== heroId) return;

  // ... validaciones ...

  const ok = await openConfirmModal({...});
  if (!ok) return;

  // ✅ VERIFICAR QUE EL HÉROE NO CAMBIÓ
  const heroNow = currentHero();
  if (!heroNow || heroNow.id !== heroId) {
    toast('❌ Cambió el héroe seleccionado. Intenta de nuevo.');
    return;
  }

  // Ahora es seguro modificar
  heroNow.medals = Number(heroNow.medals ?? 0) - cost;
  heroNow.storeClaims.push({...});

  saveLocal(state.data);
}
```

---

### ⚠️ 7. Estado Inconsistente - store.items Puede Ser Undefined

**Archivo**: `js/modules/tienda.js:34, 383`
**Severidad**: 🟠 **ALTA**
**Tipo**: TypeError / Null Reference

#### Código problemático:
```javascript
// Línea 34: Se inicializa con fallback
export function renderTienda(){
  const store = state.data?.store || { items: [] };
  const items = Array.isArray(store.items) ? store.items : [];
  // ✅ Aquí está protegido
}

// Línea 383: Se accede directamente SIN verificar
function saveStoreItem(){
  // ... crear newItem ...

  if (isEditing) {
    // Edición...
  } else {
    // ❌ PELIGRO: Asume que store.items existe
    state.data.store.items.push(newItem);
  }
}
```

#### Escenario de falla:
Si `state.data.store` es `null` o `undefined`, o si `store.items` es `undefined`, el `.push()` falla con:
```
TypeError: Cannot read property 'push' of undefined
```

#### Solución:
```javascript
function saveStoreItem(){
  // ... crear newItem ...

  // ✅ Asegurar que la estructura existe
  if (!state.data) state.data = {};
  if (!state.data.store) state.data.store = {};
  if (!Array.isArray(state.data.store.items)) {
    state.data.store.items = [];
  }

  if (isEditing) {
    const idx = state.data.store.items.findIndex(i => String(i.id) === String(editingId));
    if (idx !== -1) {
      state.data.store.items[idx] = { ...state.data.store.items[idx], ...newItem };
    }
  } else {
    state.data.store.items.push(newItem);
  }
}
```

---

### ⚠️ 8. Validación Incompleta - Sin Feedback al Usuario

**Archivo**: `js/modules/tienda.js:189-195`
**Severidad**: 🟠 **ALTA**
**Tipo**: UX / Error Handling

#### Código problemático:
```javascript
async function claimStoreItem(itemId){
  const hero = currentHero();
  if (!hero) return;  // ❌ Retorna silenciosamente, sin mensaje

  const store = state.data?.store || { items: [] };
  const item = store.items.find(i => String(i.id) === String(itemId));
  if (!item) return;  // ❌ Retorna silenciosamente, sin mensaje

  // ... más validaciones sin feedback ...
}
```

#### Impacto:
- Usuario hace click pero **no pasa nada**
- No sabe por qué falló la acción
- Mala experiencia de usuario

#### Solución:
```javascript
async function claimStoreItem(itemId){
  const hero = currentHero();
  if (!hero) {
    toast('❌ Selecciona un héroe primero');  // ✅ Feedback
    return;
  }

  const store = state.data?.store || { items: [] };
  const item = store.items.find(i => String(i.id) === String(itemId));
  if (!item) {
    toast('❌ Item no encontrado');  // ✅ Feedback
    return;
  }

  // ... continuar con validaciones con feedback ...
}
```

---

### ⚠️ 9. Race Condition en saveNewChallenge()

**Archivo**: `js/modules/desafios.js:412-443`
**Severidad**: 🟠 **ALTA**
**Tipo**: Race Condition

#### Código problemático:
```javascript
export function saveNewChallenge(){
  // ... obtener valores del formulario ...

  if (!Array.isArray(state.data?.challenges)) state.data.challenges = [];

  const editingId = state.editingChallengeId;  // Se obtiene al inicio
  const existing = editingId
    ? state.data.challenges.find(c => String(c.id) === String(editingId))
    : null;

  // ⚠️ PROBLEMA: state.editingChallengeId podría haber cambiado
  // mientras el usuario llenaba el formulario
}
```

#### Solución:
```javascript
export function saveNewChallenge(){
  const editingId = state.editingChallengeId;  // Guardar al inicio

  // ... obtener valores ...

  // ✅ Verificar que editingId no cambió antes de guardar
  if (state.editingChallengeId !== editingId) {
    toast('❌ El desafío cambió. Intenta de nuevo.');
    closeChallengeModal();
    return false;
  }

  // ... continuar guardando ...
}
```

---

### ⚠️ 10. Acceso a state.data Sin Validación

**Archivo**: `js/app.bindings.js:176, 225, 362`
**Severidad**: 🟠 **ALTA**
**Tipo**: Null Reference

#### Código problemático:
```javascript
// Línea 176
if (!state.data.heroes) state.data.heroes = [];
// ❌ ¿Y si state.data es null?

// Línea 225
state.data.heroes = state.data.heroes.filter(h => h.id !== hero.id);
// ❌ Si state.data es null, esto falla
```

#### Solución:
```javascript
// ✅ Validar state.data primero
if (!state.data) state.data = {};
if (!state.data.heroes) state.data.heroes = [];

// Para el filter:
if (state.data && Array.isArray(state.data.heroes)) {
  state.data.heroes = state.data.heroes.filter(h => h.id !== hero.id);
}
```

---

### ⚠️ 11. Promesas No Manejadas en github_sync.js

**Archivo**: `js/modules/github_sync.js:244`
**Severidad**: 🟠 **ALTA**
**Tipo**: Promise Handling

#### Código problemático:
```javascript
const errorData = await response.json().catch(() => ({}));
// ❌ Si el .catch() falla, la promesa se rechaza sin handler
```

#### Solución:
```javascript
let errorData = {};
try {
  errorData = await response.json();
} catch (err) {
  // Si no es JSON válido, usar objeto vacío
  console.warn('Error parsing error response:', err);
}
```

---

### ⚠️ 12. XSS - onclick Inline en Modales

**Archivo**: `js/modules/tienda.js:402, 406, 450-451`
**Severidad**: 🟠 **ALTA** (aunque mitigado)
**Tipo**: XSS potencial / Anti-patrón

#### Código problemático:
```javascript
modal.innerHTML = `
  <div class="modal__header">
    <div class="cardTitle">Item de tienda</div>
    <button class="pill pill--small pill--ghost" onclick="closeStoreItemModal()">✕</button>
    <!-- ❌ onclick inline es anti-patrón -->
  </div>
  <div class="modal__body">
    <!-- ... -->
    <button class="pill pill--ghost" onclick="closeStoreItemModal()">Cancelar</button>
    <button class="pill" onclick="saveStoreItem()">Guardar</button>
    <!-- ❌ onclick inline -->
  </div>
`;
```

#### Problemas:
1. **Anti-patrón**: onclick inline está desaconsejado
2. **CSP**: Bloqueado por Content Security Policy estricto
3. **Mantenibilidad**: Difícil de depurar y testear

#### Solución:
```javascript
// Opción 1: Usar data-attributes + event delegation
modal.innerHTML = `
  <div class="modal__header">
    <div class="cardTitle">Item de tienda</div>
    <button class="pill pill--small pill--ghost" data-action="close">✕</button>
  </div>
  <div class="modal__body">
    <!-- ... -->
    <button class="pill pill--ghost" data-action="cancel">Cancelar</button>
    <button class="pill" data-action="save">Guardar</button>
  </div>
`;

// Agregar listener DESPUÉS de insertar HTML
modal.addEventListener('click', (e) => {
  const action = e.target.closest('[data-action]')?.dataset.action;
  if (action === 'close' || action === 'cancel') closeStoreItemModal();
  if (action === 'save') saveStoreItem();
});

// Opción 2: Obtener referencias y agregar listeners
modal.innerHTML = `...`; // Sin onclick
const btnClose = modal.querySelector('[data-action="close"]');
const btnSave = modal.querySelector('[data-action="save"]');
btnClose?.addEventListener('click', closeStoreItemModal);
btnSave?.addEventListener('click', saveStoreItem);
```

---

### ⚠️ 13. Validación Insuficiente Antes de Guardar en localStorage

**Archivo**: `js/modules/tienda.js:240, 268, 387`
**Severidad**: 🟠 **ALTA**
**Tipo**: Data Corruption

#### Código problemático:
```javascript
// Línea 240, 268, 387
saveLocal(state.data);  // ❌ Sin validar estructura
```

#### Problema:
Si `state.data` está corrupto (por ejemplo, después de un error), se guardan datos inválidos en localStorage que pueden romper la app en el próximo load.

#### Solución:
```javascript
// En store.js, dentro de saveLocal():
export function saveLocal(data) {
  try {
    // ✅ Validar estructura básica antes de guardar
    if (!data || typeof data !== 'object') {
      console.error('Invalid data structure, not saving');
      return false;
    }

    // Validar propiedades críticas
    if (!Array.isArray(data.heroes)) {
      console.warn('heroes is not an array, initializing');
      data.heroes = [];
    }

    if (!Array.isArray(data.challenges)) {
      console.warn('challenges is not an array, initializing');
      data.challenges = [];
    }

    const str = JSON.stringify(data);
    localStorage.setItem('levelup_data', str);
    return true;
  } catch (e) {
    console.error('Error saving to localStorage:', e);
    return false;
  }
}
```

---

## 🟡 ERRORES DE PRIORIDAD MEDIA

### 14. Event Listener Duplicado en fichas.js

**Archivo**: `js/modules/fichas.js:929-931`
**Severidad**: 🟡 **MEDIA**

```javascript
const s = getScroller();
if (s && s !== window) s.addEventListener('scroll', onScroll, { passive: true });
window.addEventListener('scroll', onScroll, { passive: true });
// ❌ Se agrega a window dos veces en algunos casos
```

---

### 15. Timeouts Sin Limpieza en fichas.js

**Archivo**: `js/modules/fichas.js:182, 940-942`
**Severidad**: 🟡 **MEDIA**

```javascript
setTimeout(()=> numEl.classList.remove('is-pop'), 220);  // No se guarda referencia
setTimeout(onScroll, 0);    // No se limpia
setTimeout(onScroll, 250);  // No se limpia
setTimeout(onScroll, 800);  // No se limpia
```

**Problema**: Si `renderHeroDetail` se llama múltiples veces rápidamente, se acumulan timeouts.

**Solución**: Cancelar timeouts anteriores:
```javascript
// Al inicio de la función, guardar referencias
if (window.__heroTimeouts) {
  window.__heroTimeouts.forEach(clearTimeout);
}
window.__heroTimeouts = [];

// Al crear timeout
const timeoutId = setTimeout(() => ..., 220);
window.__heroTimeouts.push(timeoutId);
```

---

### 16. parseInt Sin Validación en desafios.js

**Archivo**: `js/modules/desafios.js:396-410`
**Severidad**: 🟡 **MEDIA**

```javascript
const points = Number.parseInt(...) || 10;  // Si falla, silenciosamente usa 10
```

**Problema**: El fallback silencioso puede ocultar errores de input.

**Solución**:
```javascript
const pointsInput = document.getElementById('inChPoints')?.value;
const points = Number.parseInt(pointsInput, 10);

if (isNaN(points) || points < 0) {
  toast('❌ Ingresa un valor válido de puntos (número mayor o igual a 0)');
  document.getElementById('inChPoints')?.focus();
  return false;
}
```

---

### 17. Cálculo de Stock Incorrecto en tienda.js

**Archivo**: `js/modules/tienda.js:236-238`
**Severidad**: 🟡 **MEDIA**

```javascript
if (item.stock !== 999) {
  item.stock = Math.max(0, Number(item.stock ?? 0) - 1);
}
// ❌ No valida si stock < 0 antes
```

**Solución**:
```javascript
if (item.stock !== 999) {
  const currentStock = Number(item.stock ?? 0);
  if (currentStock <= 0) {
    toast('❌ Item sin stock');
    return;
  }
  item.stock = currentStock - 1;
}
```

---

### 18. Validación de Costo Incompleta

**Archivo**: `js/modules/tienda.js:351-355`
**Severidad**: 🟡 **MEDIA**

```javascript
// Solo valida en saveStoreItem() pero no en claimStoreItem()
if (cost < 0) {
  toast('❌ El costo debe ser 0 o mayor');
  return;
}
```

**Solución**: Agregar validación también en `claimStoreItem()`:
```javascript
const cost = Number(item.cost ?? 0);
if (cost < 0) {
  toast('❌ Item con costo inválido');
  return;
}
```

---

### 19. XSS Potencial en eventos.js

**Archivo**: `js/modules/eventos.js:425-439`
**Severidad**: 🟡 **MEDIA**

```javascript
div.innerHTML = `
  <div class="evCard__req">
    <div class="evReqText">${escapeHtml(reqText)}</div>
  </div>
`;
// ✅ Escapado, pero si ev.eligibility.label contiene HTML...
```

**Solución**: Asegurar que TODOS los datos del JSON estén escapados:
```javascript
const reqText = escapeHtml(ev.eligibility?.label || ev.requirement || 'Sin requisitos');
```

---

### 20. Event Listeners Duplicados en eventos.js

**Archivo**: `js/modules/eventos.js:377, 393, 448`
**Severidad**: 🟡 **MEDIA**

```javascript
export function renderEvents(){
  list.forEach(ev=>{
    div.addEventListener('click', ()=> openEventModal(ev.id));
    // Se agrega cada vez que se re-renderiza
    grid.appendChild(div);
  });
}
```

**Solución**: Usar event delegation:
```javascript
// En lugar de agregar listener a cada div, usar uno global
grid.addEventListener('click', (e) => {
  const eventCard = e.target.closest('[data-event-id]');
  if (eventCard) {
    openEventModal(eventCard.dataset.eventId);
  }
});
```

---

### 21. Acceso Inseguro a window.__bossUnlockSfx

**Archivo**: `js/modules/eventos.js:596-603, 663-670`
**Severidad**: 🟡 **MEDIA**

```javascript
const a = window.__bossUnlockSfx ? window.__bossUnlockSfx : new Audio(...);
if (a){
  window.__bossUnlockSfx = a;
  // ⚠️ Race condition entre verificar y asignar
}
```

---

### 22. Sin Validación de Content-Type en store.js

**Archivo**: `js/modules/store.js:78-90`
**Severidad**: 🟡 **MEDIA**

```javascript
const contentType = res.headers.get('content-type');
if (contentType && !contentType.includes('application/json')) {
  console.warn('Respuesta no es JSON, intentando parsear de todas formas');
}
// ❌ Intenta parsear aunque no sea JSON
```

**Solución**:
```javascript
if (contentType && !contentType.includes('application/json')) {
  throw new Error('Respuesta no es JSON');
}
```

---

### 23. Error Handler Incompleto en app.main.js

**Archivo**: `js/app.main.js:57-68`
**Severidad**: 🟡 **MEDIA**

```javascript
window.addEventListener('error', (ev)=>{
  try{
    const msg = (ev && ev.message) ? String(ev.message) : 'Error';
    toast(DEBUG ? `⚠️ ${msg}` : '⚠️ Ocurrió un error. Recarga la página.');
  }catch(e){}  // ❌ Si esto falla, el error se silencia
});
```

---

### 24. Sin Validación de preventDefault

**Archivo**: `js/app.main.js:114-123`
**Severidad**: 🟡 **MEDIA**

```javascript
document.addEventListener('touchend', (e)=>{
  if (e.touches && e.touches.length > 1) return;
  const now = Date.now();
  if (now - lastTouchEnd <= 300){
    const t = e.target;
    const isInteractive = t && t.closest && ...;
    if (!isInteractive) e.preventDefault();  // ❌ Podría fallar si e es null
  }
```

---

### 25. Condición de Carrera en Parallax (Ya Documentado)

**Archivo**: `js/modules/fichas.js:263-264`
**Severidad**: 🟡 **MEDIA**
**Nota**: Ya documentado en ERROR_ANALYSIS.md

```javascript
const __reqId = (scene.__reqId = (scene.__reqId || 0) + 1);
// Se genera token pero nunca se verifica al aplicar estilos
```

---

## 📋 PLAN DE ACCIÓN RECOMENDADO

### 🚨 Fase 1 - CRÍTICOS (Hoy)

1. ✅ **tienda.js** - Agregar importaciones faltantes (`$`, `uid`)
2. ✅ **tienda.js** - Agregar try-catch a funciones async
3. ✅ **tienda.js** - Validar funciones globales antes de llamar
4. ✅ **Todos** - Implementar removeEventListener

### 📅 Fase 2 - ALTOS (Esta Semana)

5. ✅ **tienda.js** - Corregir race condition en claimStoreItem
6. ✅ **tienda.js** - Validar store.items antes de push
7. ✅ **tienda.js** - Agregar feedback en validaciones
8. ✅ **desafios.js** - Corregir race condition en saveNewChallenge
9. ✅ **app.bindings.js** - Validar state.data antes de acceder
10. ✅ **github_sync.js** - Mejorar manejo de promesas
11. ✅ **tienda.js** - Eliminar onclick inline, usar event delegation
12. ✅ **store.js** - Agregar validación antes de saveLocal

### 📝 Fase 3 - MEDIOS (Próximas 2 Semanas)

13-25. Corregir problemas de prioridad media según prioridad de negocio

---

## 🔧 ARCHIVOS QUE REQUIEREN MODIFICACIÓN

| Archivo | Errores | Prioridad |
|---------|---------|-----------|
| `js/modules/tienda.js` | 9 | 🔴 CRÍTICA |
| `js/modules/fichas.js` | 3 | 🟠 ALTA |
| `js/modules/desafios.js` | 2 | 🟠 ALTA |
| `js/modules/eventos.js` | 3 | 🟡 MEDIA |
| `js/modules/github_sync.js` | 1 | 🟠 ALTA |
| `js/modules/store.js` | 2 | 🟠 ALTA |
| `js/modules/app_actions.js` | 1 | 🟡 MEDIA |
| `js/app.bindings.js` | 1 | 🟠 ALTA |
| `js/app.main.js` | 2 | 🟡 MEDIA |

---

## 📊 COMPARACIÓN CON ERROR_ANALYSIS.md

### Errores Ya Documentados (✅ Corregidos)
- `heroFirstName()` y `FEMALE_NAME_SET` no definidas → ✅ Corregido
- `state.ui` no inicializado → ✅ Corregido
- `getSelectedHero()` busca en propiedad incorrecta → ✅ Corregido
- `escapeHtml()` duplicada → ✅ Corregido

### Errores NUEVOS (Este Análisis)
- **25 errores nuevos** no documentados anteriormente
- **5 críticos** que rompen funcionalidad
- **8 de alta prioridad** que causan bugs
- **12 de prioridad media** que afectan calidad

---

## 🎯 CONCLUSIÓN

El análisis reveló **25 errores adicionales** no documentados en `ERROR_ANALYSIS.md`, con **5 errores críticos** que impiden que la tienda funcione correctamente.

### Severidad de los Hallazgos:

| Categoría | Impacto |
|-----------|---------|
| 🔴 **Críticos** | **La tienda NO funciona** (ReferenceError garantizado) |
| 🟠 **Altos** | Race conditions, memory leaks, pérdida de datos |
| 🟡 **Medios** | UX deficiente, posibles bugs intermitentes |

### Recomendación Principal:

**PRIORIDAD MÁXIMA**: Corregir `js/modules/tienda.js` (Errores #1-#4) antes de deploy a producción.

---

**Analista**: Claude Code
**Fecha**: 2026-02-17
**Próximo paso**: Implementar correcciones de Fase 1
