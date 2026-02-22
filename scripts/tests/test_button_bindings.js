#!/usr/bin/env node
/**
 * Test para verificar bindings de botones faltantes
 */

const fs = require('fs');
const path = require('path');

// Botones que deben tener event listeners
const EXPECTED_BUTTON_BINDINGS = [
  { id: 'btnXpP1', description: '+1 XP button', handler: 'bumpHeroXp(1)' },
  { id: 'btnXpP5', description: '+5 XP button', handler: 'bumpHeroXp(5)' },
  { id: 'btnXpM1', description: '-1 XP button', handler: 'bumpHeroXp(-1)' },
  { id: 'btnXpM5', description: '-5 XP button', handler: 'bumpHeroXp(-5)' },
  { id: 'btnEdicion', description: 'Edit mode toggle button', handler: 'toggleEditMode()' },
  { id: 'btnConfigGitHub', description: 'Configure GitHub button', handler: 'openGitHubConfigModal()' },
  { id: 'btnSaveToGitHub', description: 'Save to GitHub button', handler: 'saveToGitHub()' },
  { id: 'btnRecompensas', description: 'Rewards button', handler: 'activateRoute("recompensas")' },
  { id: 'btnMobileRewards', description: 'Mobile rewards button', handler: 'activateRoute("recompensas")' }
];

// Leer todos los archivos JS
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const jsDir = path.join(REPO_ROOT, 'js');

function searchInFiles(dir, pattern) {
  const results = [];
  const files = fs.readdirSync(dir, { withFileTypes: true });

  for (const file of files) {
    const fullPath = path.join(dir, file.name);
    if (file.isDirectory()) {
      results.push(...searchInFiles(fullPath, pattern));
    } else if (file.name.endsWith('.js')) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      if (pattern.test(content)) {
        results.push({ file: fullPath, content });
      }
    }
  }
  return results;
}

console.log('🔍 Analizando bindings de botones...\n');

const report = {
  found: [],
  missing: []
};

for (const button of EXPECTED_BUTTON_BINDINGS) {
  const pattern = new RegExp(`['"]${button.id}['"]|getElementById\\(['"]${button.id}['"]\\)|\\$\\(['"]#${button.id}['"]\\)`, 'i');
  const matches = searchInFiles(jsDir, pattern);

  if (matches.length === 0) {
    report.missing.push(button);
    console.log(`❌ ${button.id}: NO VINCULADO`);
  } else {
    // Verificar si tiene addEventListener
    const hasEventListener = matches.some(m =>
      m.content.includes(`${button.id}`)  && m.content.includes('addEventListener')
    );

    if (hasEventListener) {
      report.found.push(button);
      console.log(`✅ ${button.id}: VINCULADO`);
    } else {
      report.missing.push(button);
      console.log(`⚠️  ${button.id}: ENCONTRADO PERO SIN EVENT LISTENER`);
      matches.forEach(m => {
        const filename = path.relative(__dirname, m.file);
        console.log(`   📄 ${filename}`);
      });
    }
  }
}

console.log('\n' + '='.repeat(60));
console.log('RESUMEN:');
console.log(`✅ Vinculados: ${report.found.length}`);
console.log(`❌ Faltantes: ${report.missing.length}`);

if (report.missing.length > 0) {
  console.log('\n⚠️  BOTONES SIN EVENT LISTENERS:');
  report.missing.forEach(btn => {
    console.log(`   - ${btn.id}: ${btn.description}`);
  });
}
