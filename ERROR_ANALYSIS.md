# Reporte de Análisis de Errores - LevelUp-V2

**Fecha**: 2026-02-16
**Análisis**: Revisión completa del código fuente

---

## 🔴 ERRORES CRÍTICOS (Prioridad 1)

### 1. Funciones No Definidas - `heroFirstName()` y `FEMALE_NAME_SET`
**Archivo**: `js/modules/fichas.js:157-159`
**Severidad**: CRÍTICA
**Tipo**: ReferenceError en tiempo de ejecución

```javascript
const n = heroFirstName(heroName);
if (FEMALE_NAME_SET.has(n)) return true;
```

**Problema**:
- La función `heroFirstName()` no está definida en ningún módulo
- La constante `FEMALE_NAME_SET` no existe

**Impacto**: La aplicación lanzará un `ReferenceError` cuando se llame a `isFemaleHeroName()`

**Solución Recomendada**:
```javascript
// Agregar en core_globals.js o crear un módulo de utilidades
function heroFirstName(fullName) {
  return fullName.split(' ')[0];
}

const FEMALE_NAME_SET = new Set([
  'Ana', 'María', 'Carmen', 'Laura', 'Sofia',
  // ... agregar nombres femeninos esperados
]);
```

---

### 2. Propiedad `state.ui` No Inicializada
**Archivo**: `js/modules/fichas.js:493`
**Severidad**: CRÍTICA
**Tipo**: TypeError en tiempo de ejecución

```javascript
if (state.ui.pendingToastHeroId !== hero.id){
```

**Problema**: El objeto `state.ui` nunca se inicializa en `core_globals.js`

**Impacto**: Error "Cannot read property 'pendingToastHeroId' of undefined"

**Solución**:
```javascript
// En core_globals.js, línea 288-299
const state = {
  route: 'fichas',
  role: 'viewer',
  selectedHeroId: null,
  selectedEventId: null,
  selectedChallengeId: null,
  dataSource: 'none',
  data: null,
  ui: {  // AGREGAR ESTA LÍNEA
    pendingToastHeroId: null
  }
};
```

---

### 3. Bug en `getSelectedHero()` - Búsqueda en Propiedad Incorrecta
**Archivo**: `js/modules/core_globals.js:308`
**Severidad**: ALTA
**Tipo**: Error lógico

```javascript
const people = state?.data?.people || [];  // INCORRECTO
return people.find(p => p.id === state.selectedHeroId);
```

**Problema**: Busca en `state.data.people` pero la propiedad correcta es `state.data.heroes`

**Impacto**: La función siempre retorna `null`, haciendo que falle la selección de héroes

**Solución**:
```javascript
const heroes = state?.data?.heroes || [];  // CORRECTO
return heroes.find(h => h.id === state.selectedHeroId);
```

---

## 🟠 ERRORES DE ALTA PRIORIDAD (Prioridad 2)

### 4. Funciones Duplicadas - `escapeHtml()`
**Archivos**:
- `js/modules/core_globals.js:337-344`
- `js/modules/celebrations.js:6-13`

**Problema**: Misma función definida en dos lugares

**Riesgo**: Si se actualiza una versión para arreglar una vulnerabilidad XSS, la otra permanece vulnerable

**Solución**: Eliminar la función local en `celebrations.js` y usar la global

---

### 5. Funciones Duplicadas - `normalizeDifficulty()`
**Archivos**:
- `js/modules/core_globals.js:415-422`
- `js/modules/fichas.js:644-649` (como `difficultyLabel()`)
- Otras ubicaciones

**Problema**: Lógica de normalización de dificultad repetida

**Solución**: Usar solo `normalizeDifficulty()` de `core_globals.js`

---

### 6. Funciones Duplicadas - `getSelectedHero()` vs `currentHero()`
**Archivos**:
- `js/modules/core_globals.js:307-309`
- `js/modules/fichas.js:71-73`

**Problema**: Dos funciones hacen lo mismo con nombres diferentes

**Solución**: Consolidar en una sola función

---

## 🟡 VULNERABILIDADES DE SEGURIDAD

### 7. XSS - Escapado Incompleto de Atributos HTML
**Archivo**: `js/modules/fichas.js:34`

```javascript
<div class="heroCard" data-hero-name="${hero.name}" ...>
```

**Problema**: El atributo `data-hero-name` no escapa comillas dobles

**Riesgo**: Inyección de atributos si `hero.name` contiene comillas

**Solución**:
```javascript
data-hero-name="${escapeHtml(hero.name).replace(/"/g, '&quot;')}"
```

---

### 8. Validación Insuficiente de localStorage
**Archivo**: `js/modules/store.js:6`

**Problema**: No hay validación de estructura antes de guardar en `localStorage`

**Riesgo**: Datos malformados pueden corromper el almacenamiento

**Solución**: Agregar validación de esquema antes de `JSON.stringify()`

---

## 🔵 PROBLEMAS DE CALIDAD DE CÓDIGO

### 9. Manejo de Errores Silencioso
**Archivo**: `js/modules/app_actions.js:23-43`

```javascript
safe('Tienda', ()=> { if (typeof renderTienda === 'function') renderTienda(); });
```

**Problema**: Los errores se suprimen sin retroalimentación al usuario

**Impacto**: Dificulta la depuración y el usuario no sabe por qué falló una acción

---

### 10. Contaminación del Scope Global
**Archivo**: `js/app.bindings.js:791-797`

```javascript
window.openChallengeModal = openChallengeModal;
window.deleteSelectedChallenge = deleteSelectedChallenge;
window.goToHeroEvents = goToHeroEvents;
// ... más asignaciones globales
```

**Problema**: Múltiples funciones en el objeto `window` sin namespace

**Riesgo**: Colisiones de nombres con scripts de terceros

**Solución**:
```javascript
window.LevelUp = {
  openChallengeModal,
  deleteSelectedChallenge,
  goToHeroEvents,
  // ...
};
```

---

### 11. Condición de Carrera en Carga de Parallax
**Archivo**: `js/modules/fichas.js:263-264`

```javascript
const __reqId = (scene.__reqId = (scene.__reqId || 0) + 1);
```

**Problema**: Se genera un token anti-race pero nunca se verifica al aplicar estilos

**Riesgo**: Si el usuario cambia rápidamente de héroe, la precarga antigua puede completarse después de seleccionar un nuevo héroe

---

### 12. Dependencia de Manifest Hardcodeado
**Archivo**: `js/modules/parallax_manifest.js`

**Problema**: Nombres de héroes hardcodeados en el manifest

**Riesgo**: Si cambian los nombres en `data.json`, las imágenes parallax no cargarán

**Solución**: Generar el manifest dinámicamente desde `data.json`

---

## 📊 RESUMEN DE ERRORES

| Severidad | Cantidad | Requiere Acción Inmediata |
|-----------|----------|---------------------------|
| 🔴 Crítica | 3 | ✅ SÍ |
| 🟠 Alta | 3 | ✅ SÍ |
| 🟡 Seguridad | 2 | ⚠️ Recomendado |
| 🔵 Calidad | 4 | ⏱️ Planificar |

**Total de problemas identificados**: 12 categorías principales

---

## ✅ PLAN DE ACCIÓN RECOMENDADO

### Fase 1 - Correcciones Críticas (Inmediato)
1. ✅ Definir `heroFirstName()` y `FEMALE_NAME_SET`
2. ✅ Inicializar `state.ui` en `core_globals.js`
3. ✅ Corregir `getSelectedHero()` para buscar en `heroes` no en `people`

### Fase 2 - Alta Prioridad (Esta semana)
4. ✅ Consolidar funciones duplicadas (`escapeHtml`, `normalizeDifficulty`)
5. ✅ Agregar manejo de errores con retroalimentación al usuario
6. ✅ Validar existencia de funciones críticas

### Fase 3 - Seguridad (Próxima semana)
7. ✅ Mejorar escapado de atributos HTML
8. ✅ Agregar validación de esquema para localStorage
9. ✅ Namespace global para funciones públicas

### Fase 4 - Calidad (Siguiente sprint)
10. ✅ Implementar verificación de race condition en parallax
11. ✅ Generar manifest dinámicamente
12. ✅ Agregar tests unitarios para funciones críticas

---

## 🔧 ARCHIVOS QUE REQUIEREN MODIFICACIÓN

1. `js/modules/core_globals.js` - 3 correcciones
2. `js/modules/fichas.js` - 4 correcciones
3. `js/modules/celebrations.js` - 1 eliminación
4. `js/modules/store.js` - 1 mejora
5. `js/app.bindings.js` - 1 refactor
6. `js/modules/parallax_manifest.js` - 1 refactor

---

**Análisis completado por**: Claude Code
**Herramientas utilizadas**: Análisis estático de código, revisión manual
**Próximos pasos**: Revisar este reporte y priorizar las correcciones
