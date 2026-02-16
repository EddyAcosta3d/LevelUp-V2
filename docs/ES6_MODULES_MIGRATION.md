# Migración a ES6 Modules - Plan de Ejecución

**Fecha**: 2026-02-16
**Objetivo**: Convertir código de global scope a módulos ES6 encapsulados

---

## 🎯 Objetivos

1. **Eliminar global scope pollution** (900+ líneas expuestas)
2. **Habilitar tree-shaking** para builds optimizados
3. **Mejorar testabilidad** (imports específicos)
4. **Prevenir colisiones de nombres**
5. **Documentar dependencias explícitas**

---

## 📊 Análisis de Dependencias

### Grafo de Dependencias Actual

```
core_globals.js (Base)
    ├─→ store.js
    ├─→ celebrations.js
    ├─→ fichas.js
    ├─→ desafios.js
    ├─→ eventos.js
    ├─→ tienda.js
    ├─→ app_actions.js
    └─→ app.bindings.js (Top-level)
```

### Orden de Conversión (Bottom-up)

1. ✅ `core_globals.js` - Fundacional (0 dependencias internas)
2. ✅ `store.js` - Depende solo de core_globals
3. ✅ `celebrations.js` - Depende solo de core_globals
4. ✅ `fichas.js` - Depende de core_globals + store
5. ✅ `desafios.js` - Depende de core_globals
6. ✅ `eventos.js` - Depende de core_globals
7. ✅ `tienda.js` - Depende de core_globals
8. ✅ `app_actions.js` - Depende de todos
9. ✅ `app.bindings.js` - Orquestador (depende de todos)

---

## 🔧 Estrategia de Conversión

### Fase 1: Preparación (1 archivo piloto)

**Archivo Piloto**: `store.js` (pequeño, 149 líneas, dependencias claras)

**Pasos**:
1. Identificar funciones exportadas actualmente
2. Agregar `export` statements
3. Convertir referencias a `state` en imports
4. Probar aisladamente

### Fase 2: Core (2 archivos críticos)

**Archivos**: `core_globals.js`, `celebrations.js`

**Desafíos**:
- core_globals tiene 900 líneas
- Muchas funciones exportadas (30+)
- Estado global `state` debe ser exportado/importado

**Solución**:
```javascript
// core_globals.js
export const state = { /* ... */ };
export function getSelectedHero() { /* ... */ }
export function escapeHtml(s) { /* ... */ }
// ... 30+ exports
```

### Fase 3: Módulos de Dominio (5 archivos)

**Archivos**: `fichas.js`, `desafios.js`, `eventos.js`, `tienda.js`, `app_actions.js`

**Patrón**:
```javascript
// Antes
function renderHeroList() { /* usa state global */ }
window.renderHeroList = renderHeroList;

// Después
import { state, escapeHtml } from './core_globals.js';
export function renderHeroList() { /* usa state importado */ }
```

### Fase 4: Orquestación (1 archivo)

**Archivo**: `app.bindings.js`

**Tarea**: Importar todos los módulos y conectar event listeners

---

## 📝 Patrón de Conversión

### Template para Cada Módulo

```javascript
'use strict';

// ========================================
// IMPORTS
// ========================================
import {
  state,
  escapeHtml,
  getSelectedHero
} from './core_globals.js';

import {
  saveLocal,
  loadLocal
} from './store.js';

// ========================================
// PRIVATE FUNCTIONS (no exportadas)
// ========================================
function _helperFunction() {
  // Solo visible dentro del módulo
}

// ========================================
// PUBLIC API (exportadas)
// ========================================
export function renderHeroList() {
  // Función pública
}

export function updateHero(heroId, changes) {
  // Función pública
}

// ========================================
// DEFAULT EXPORT (opcional)
// ========================================
export default {
  renderHeroList,
  updateHero
};
```

---

## 🔍 Checklist por Archivo

### ✅ core_globals.js
- [ ] Exportar `state`
- [ ] Exportar todas las funciones globales (30+)
- [ ] Mantener `window.LevelUp` para compatibilidad
- [ ] Documentar exports en comentario header

### ✅ store.js
- [ ] Import `state` desde core_globals
- [ ] Export `saveLocal`, `loadLocal`, `fetchRemote`
- [ ] Mantener `CONFIG` como export

### ✅ fichas.js
- [ ] Imports necesarios
- [ ] Export funciones render
- [ ] Export `FEMALE_NAME_SET`, `heroFirstName`

### ✅ desafios.js
- [ ] Import state + helpers
- [ ] Export render functions

### ✅ eventos.js
- [ ] Import state + helpers
- [ ] Export render functions

### ✅ celebrations.js
- [ ] Import escapeHtml (NO redefinir)
- [ ] Export `showBigReward`, `showConfetti`, etc.

### ✅ tienda.js
- [ ] Import state + helpers
- [ ] Export render functions

### ✅ app_actions.js
- [ ] Import TODOS los módulos
- [ ] Export action functions

### ✅ app.bindings.js
- [ ] Import TODOS los módulos
- [ ] Conectar event listeners
- [ ] Export init function

---

## 🌐 Actualizar index.html

### Cambio Crítico

```html
<!-- ANTES -->
<script src="js/modules/core_globals.js"></script>
<script src="js/modules/store.js"></script>
<!-- ... -->

<!-- DESPUÉS -->
<script type="module" src="js/app.main.js"></script>
```

**Nota**: Un solo script module, que importa todo lo demás.

---

## 🧪 Plan de Testing

### Test 1: Syntax Validation
```bash
node --check js/modules/*.js
```

### Test 2: Import Resolution
```bash
node --input-type=module -e "import './js/modules/core_globals.js'"
```

### Test 3: Runtime Testing
- Abrir index.html en navegador
- Verificar console para errores de import
- Probar funcionalidad básica (cambiar héroe, crear desafío)

### Test 4: Integration Tests
```bash
node test_corrections.js
node test_integration.js
```

---

## ⚠️ Riesgos y Mitigaciones

### Riesgo 1: Breaking Changes
**Mitigación**: Mantener `window.*` assignments temporalmente

```javascript
// Compatibilidad transitoria
export function getSelectedHero() { /* ... */ }
window.getSelectedHero = getSelectedHero; // Mantener por ahora
```

### Riesgo 2: Circular Dependencies
**Mitigación**: Revisar grafo, usar lazy imports si necesario

### Riesgo 3: Browser Compatibility
**Mitigación**: ES6 modules soportados en todos los navegadores modernos (Chrome 61+, Firefox 60+, Safari 10.1+)

---

## 📈 Métricas de Éxito

| Métrica | Antes | Meta | Verificación |
|---------|-------|------|--------------|
| Global scope vars | 50+ | 0 | `window.` count |
| Testeable | ❌ | ✅ | Jest setup |
| Bundle size | N/A | -20% | Webpack bundle |
| Import errors | N/A | 0 | Console |
| Tests passing | 42 | 42+ | npm test |

---

## 🚀 Rollout Plan

### Semana 1: Fase 1-2 (Core)
- Día 1-2: core_globals.js
- Día 3: store.js, celebrations.js
- Día 4: Testing + fixes

### Semana 2: Fase 3-4 (Rest)
- Día 1-2: fichas.js, desafios.js, eventos.js
- Día 3: tienda.js, app_actions.js
- Día 4: app.bindings.js
- Día 5: Integration testing + deployment

---

## 📋 Comandos Útiles

```bash
# Verificar imports/exports
grep -r "^export " js/modules/

# Contar funciones en global scope
grep -r "window\." js/modules/ | wc -l

# Verificar sintaxis
find js/modules -name "*.js" -exec node --check {} \;

# Sincronizar espejo
python scripts/mirror_sync.py sync
python scripts/mirror_sync.py check
```

---

## 📚 Referencias

- [MDN: JavaScript modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)
- [V8 Module guide](https://v8.dev/features/modules)
- [ES6 In Depth: Modules](https://hacks.mozilla.org/2015/08/es6-in-depth-modules/)

---

**Status**: Ready to begin
**Next Step**: Start with store.js pilot conversion
