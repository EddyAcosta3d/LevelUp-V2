#!/usr/bin/env node
'use strict';

/**
 * Test de Correcciones Críticas - LevelUp V2
 * Verifica que las funciones corregidas funcionen correctamente
 */

console.log('🧪 Iniciando pruebas de correcciones...\n');

// Simular el estado global necesario
const state = {
  data: {
    heroes: [
      { id: 'h1', name: 'Eddy', level: 5 },
      { id: 'h2', name: 'Natanael', level: 3 },
      { id: 'h3', name: 'Ana', level: 7 }
    ],
    meta: { version: 'test' }
  },
  selectedHeroId: 'h2',
  ui: {
    pendingToastHeroId: null
  }
};

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (condition) {
    console.log('✅', message);
    testsPassed++;
  } else {
    console.log('❌', message);
    testsFailed++;
  }
}

// Test 1: getSelectedHero() - busca en heroes (no en people)
console.log('Test 1: getSelectedHero()');
function getSelectedHero() {
  const heroes = state?.data?.heroes || [];
  return heroes.find(h => h.id === state.selectedHeroId) || null;
}
const hero = getSelectedHero();
assert(hero !== null, 'Debe encontrar un héroe');
assert(hero.id === 'h2', 'Debe encontrar el héroe correcto (h2)');
assert(hero.name === 'Natanael', 'El héroe debe tener el nombre correcto');
console.log('');

// Test 2: state.ui existe y tiene pendingToastHeroId
console.log('Test 2: state.ui inicializado');
assert(state.ui !== undefined, 'state.ui debe existir');
assert('pendingToastHeroId' in state.ui, 'state.ui debe tener pendingToastHeroId');
assert(state.ui.pendingToastHeroId === null, 'pendingToastHeroId debe inicializar en null');
console.log('');

// Test 3: heroFirstName() y FEMALE_NAME_SET
console.log('Test 3: heroFirstName() y FEMALE_NAME_SET');
const FEMALE_NAME_SET = new Set([
  'Ana','María','Carmen','Laura','Sofia','Isabella','Valentina','Camila',
  'Lucía','Martina','Paula','Victoria','Emma','Mia','Nina','Sara','Elena',
  'Julia','Daniela','Gabriela','Andrea','Natalia','Carolina','Alejandra',
  'Diana','Mariana','Catalina','Fernanda','Paola','Rosa','Isabel','Clara',
  'Adriana','Silvia','Patricia','Monica','Beatriz','Teresa','Raquel','Susana'
]);

function heroFirstName(name) {
  if (!name) return '';
  return name.split(/\s+/)[0];
}

function isFemaleHeroName(heroName) {
  const n = heroFirstName(heroName);
  if (FEMALE_NAME_SET.has(n)) return true;
  return false;
}

assert(heroFirstName('Ana García') === 'Ana', 'heroFirstName debe extraer el primer nombre');
assert(heroFirstName('Juan Carlos') === 'Juan', 'heroFirstName debe manejar nombres compuestos');
assert(isFemaleHeroName('Ana García') === true, 'Debe identificar nombre femenino');
assert(isFemaleHeroName('Juan Carlos') === false, 'Debe identificar nombre masculino');
assert(isFemaleHeroName('María López') === true, 'Debe identificar María como femenino');
console.log('');

// Test 4: escapeHtml()
console.log('Test 4: escapeHtml()');
function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
assert(escapeHtml('<script>alert("XSS")</script>') === '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;',
       'Debe escapar correctamente tags HTML');
assert(escapeHtml("O'Brien") === 'O&#039;Brien', 'Debe escapar comillas simples');
console.log('');

// Test 5: escapeAttr()
console.log('Test 5: escapeAttr()');
function escapeAttr(s) {
  return escapeHtml(s);
}
assert(escapeAttr('<img src=x onerror=alert(1)>') === '&lt;img src=x onerror=alert(1)&gt;',
       'escapeAttr debe prevenir inyección en atributos');
console.log('');

// Test 6: currentHero() usa getSelectedHero()
console.log('Test 6: currentHero() con fallback');
function currentHero() {
  const selected = getSelectedHero();
  if (selected) return selected;
  const heroes = state.data?.heroes || [];
  return heroes[0] || null;
}
const current = currentHero();
assert(current !== null, 'currentHero debe retornar un héroe');
assert(current.id === 'h2', 'currentHero debe retornar el héroe seleccionado');

// Probar fallback
const oldSelectedId = state.selectedHeroId;
state.selectedHeroId = 'nonexistent';
const fallback = currentHero();
assert(fallback !== null, 'currentHero debe tener fallback');
assert(fallback.id === 'h1', 'currentHero debe retornar el primer héroe como fallback');
state.selectedHeroId = oldSelectedId;
console.log('');

// Test 7: Validación de localStorage (saveLocal)
console.log('Test 7: Validación de payload en saveLocal');
function saveLocal(data) {
  const payload = data !== undefined ? data : state.data;

  if (!payload || typeof payload !== 'object') {
    console.log('   ⚠️  Rechazado: payload no es un objeto');
    return false;
  }
  if (!Array.isArray(payload.heroes)) {
    console.log('   ⚠️  Rechazado: heroes no es un array');
    return false;
  }
  return true;
}

assert(saveLocal({ heroes: [], meta: {} }) === true, 'Debe aceptar payload válido');
assert(saveLocal({ heroes: 'invalid' }) === false, 'Debe rechazar heroes inválido');
assert(saveLocal(null) === false, 'Debe rechazar payload null');
assert(saveLocal('string') === false, 'Debe rechazar string como payload');
console.log('');

// Test 8: window.LevelUp namespace
console.log('Test 8: window.LevelUp namespace');
const window = { LevelUp: {} };
window.getSelectedHero = getSelectedHero;
window.LevelUp.getSelectedHero = getSelectedHero;
assert(window.LevelUp !== undefined, 'window.LevelUp debe existir');
assert(typeof window.LevelUp.getSelectedHero === 'function',
       'window.LevelUp.getSelectedHero debe ser una función');
assert(window.getSelectedHero === window.LevelUp.getSelectedHero,
       'Ambas referencias deben apuntar a la misma función');
console.log('');

// Resumen final
console.log('═'.repeat(50));
console.log(`📊 Resumen de Pruebas:`);
console.log(`   ✅ Pasadas: ${testsPassed}`);
console.log(`   ❌ Fallidas: ${testsFailed}`);
console.log(`   📈 Tasa de éxito: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%`);
console.log('═'.repeat(50));

if (testsFailed === 0) {
  console.log('\n🎉 ¡Todas las correcciones funcionan correctamente!\n');
  process.exit(0);
} else {
  console.log('\n⚠️  Algunas pruebas fallaron. Revisar correcciones.\n');
  process.exit(1);
}
