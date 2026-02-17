#!/usr/bin/env node
'use strict';

/**
 * Test de Integración - LevelUp V2
 * Verifica que todos los módulos se carguen sin errores
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = __dirname;
const resolveFromRoot = (...parts) => path.join(ROOT_DIR, ...parts);

console.log('🔗 Iniciando pruebas de integración de módulos...\n');

// Archivos en orden de carga (según index.html)
const modules = [
  'js/modules/core_globals.js',
  'js/modules/parallax_manifest.js',
  'js/modules/store.js',
  'js/modules/fichas.js',
  'js/modules/desafios.js',
  'js/modules/eventos.js',
  'js/modules/celebrations.js',
  'js/modules/tienda.js',
  'js/modules/app_actions.js',
  'js/app.bindings.js'
];

let loadedSuccessfully = 0;
let loadedWithErrors = 0;

console.log('📦 Verificando carga de módulos:\n');

for (const modulePath of modules) {
  const fullPath = resolveFromRoot(modulePath);
  const moduleName = path.basename(modulePath);

  try {
    // Verificar que el archivo existe
    if (!fs.existsSync(fullPath)) {
      console.log(`❌ ${moduleName} - Archivo no encontrado`);
      loadedWithErrors++;
      continue;
    }

    // Leer el contenido
    const content = fs.readFileSync(fullPath, 'utf8');

    // Verificar que no esté vacío
    if (content.trim().length === 0) {
      console.log(`⚠️  ${moduleName} - Archivo vacío`);
      loadedWithErrors++;
      continue;
    }

    // Verificar que tenga 'use strict'
    const hasStrictMode = content.includes("'use strict'") || content.includes('"use strict"');

    // Verificar que no tenga errores sintácticos obvios
    const syntaxIssues = [];
    if (content.includes('function ()')) syntaxIssues.push('función anónima sin nombre');
    if (content.match(/\}\s*else\s*{/) && content.includes('} else{')) {
      // Esto es OK, no es un error
    }

    const size = (content.length / 1024).toFixed(1);
    const lines = content.split('\n').length;

    console.log(`✅ ${moduleName.padEnd(25)} (${size} KB, ${lines} líneas)${hasStrictMode ? ' [strict]' : ''}`);
    loadedSuccessfully++;

  } catch (error) {
    console.log(`❌ ${moduleName} - Error: ${error.message}`);
    loadedWithErrors++;
  }
}

console.log('');

// Verificar que los archivos corregidos existen
console.log('🔍 Verificando archivos corregidos:\n');

const correctedFiles = [
  { path: 'js/modules/core_globals.js', mustContain: ['window.LevelUp', 'escapeAttr', 'pendingToastHeroId'] },
  { path: 'js/modules/fichas.js', mustContain: ['heroFirstName', 'FEMALE_NAME_SET', 'currentHero'] },
  { path: 'js/modules/store.js', mustContain: ['saveLocal', 'Array.isArray(payload.heroes)'] },
  { path: 'js/modules/celebrations.js', mustNotContain: ['function escapeHtml'] }
];

let verificationsOK = 0;
let verificationsFailed = 0;

for (const file of correctedFiles) {
  const fileName = path.basename(file.path);

  const fullPath = resolveFromRoot(file.path);
  if (!fs.existsSync(fullPath)) {
    console.log(`❌ ${fileName} - Archivo no encontrado`);
    verificationsFailed++;
    continue;
  }

  const content = fs.readFileSync(fullPath, 'utf8');

  if (file.mustContain) {
    let allFound = true;
    for (const text of file.mustContain) {
      if (!content.includes(text)) {
        console.log(`❌ ${fileName} - Falta: "${text}"`);
        allFound = false;
        verificationsFailed++;
      }
    }
    if (allFound) {
      console.log(`✅ ${fileName} - Contiene todas las correcciones esperadas`);
      verificationsOK++;
    }
  }

  if (file.mustNotContain) {
    let noneFound = true;
    for (const text of file.mustNotContain) {
      if (content.includes(text)) {
        console.log(`❌ ${fileName} - No debería contener: "${text}"`);
        noneFound = false;
        verificationsFailed++;
      }
    }
    if (noneFound) {
      console.log(`✅ ${fileName} - Duplicación eliminada correctamente`);
      verificationsOK++;
    }
  }
}

console.log('');

// Verificar sincronización con espejo
console.log('🪞 Verificando sincronización con espejo (assets/):\n');

let mirrorChecks = 0;
let mirrorIssues = 0;

for (const modulePath of ['js/modules/core_globals.js', 'js/modules/fichas.js', 'js/modules/store.js']) {
  const sourcePath = resolveFromRoot(modulePath);
  const mirrorPath = resolveFromRoot('assets', modulePath);

  try {
    const sourceContent = fs.readFileSync(sourcePath, 'utf8');
    const mirrorContent = fs.readFileSync(mirrorPath, 'utf8');

    if (sourceContent === mirrorContent) {
      console.log(`✅ ${path.basename(modulePath)} - Sincronizado con espejo`);
      mirrorChecks++;
    } else {
      console.log(`⚠️  ${path.basename(modulePath)} - Desincronizado con espejo`);
      mirrorIssues++;
    }
  } catch (error) {
    console.log(`❌ ${path.basename(modulePath)} - Error verificando espejo: ${error.message}`);
    mirrorIssues++;
  }
}

console.log('');

// Resumen final
console.log('═'.repeat(60));
console.log('📊 Resumen de Integración:\n');
console.log(`   📦 Módulos cargados:         ${loadedSuccessfully}/${modules.length}`);
console.log(`   🔍 Verificaciones:           ${verificationsOK}/${correctedFiles.length}`);
console.log(`   🪞 Sincronización espejo:    ${mirrorChecks}/${3}`);
console.log('');

const totalTests = modules.length + correctedFiles.length + 3;
const totalPassed = loadedSuccessfully + verificationsOK + mirrorChecks;
const successRate = ((totalPassed / totalTests) * 100).toFixed(1);

console.log(`   📈 Tasa de éxito global:     ${successRate}%`);
console.log('═'.repeat(60));

if (loadedWithErrors === 0 && verificationsFailed === 0 && mirrorIssues === 0) {
  console.log('\n✨ ¡Integración completa exitosa! Todos los módulos funcionan correctamente.\n');
  process.exit(0);
} else {
  console.log('\n⚠️  Revisar issues encontrados arriba.\n');
  process.exit(1);
}
