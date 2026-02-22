#!/usr/bin/env node
/**
 * Comprehensive button binding test
 */

const fs = require('fs');
const path = require('path');

// All buttons found in index.html
const ALL_BUTTONS = [
  'btnAddChallenge', 'btnAddSubject', 'btnCancelChallenge', 'btnChModalSubject',
  'btnChallengeComplete', 'btnClaimPendingInline', 'btnClearGitHubToken',
  'btnCloseChallengeModal', 'btnCloseGitHubConfig', 'btnCloseHistoryModal',
  'btnCloseRoleModal', 'btnCloseSubjects', 'btnConfigGitHub', 'btnConfirmCancel',
  'btnConfirmOk', 'btnDatos', 'btnDebugPanel', 'btnDiffEasy', 'btnDiffHard',
  'btnDiffMed', 'btnEdicion', 'btnEliminar', 'btnEventClose', 'btnEventFight',
  'btnEventToggleUnlock', 'btnExportJson', 'btnHistory', 'btnImportJson',
  'btnManageSubjects', 'btnMenu', 'btnMobileRewards', 'btnNuevoHeroe',
  'btnRecompensas', 'btnReloadRemote', 'btnResetLocal', 'btnSaveChallenge',
  'btnSaveGitHubToken', 'btnSaveToGitHub', 'btnSubject', 'btnTestGitHub',
  'btnWeekReset', 'btnXpM1', 'btnXpM5', 'btnXpP1', 'btnXpP5'
];

function searchInAllJS(buttonId) {
  const REPO_ROOT = path.resolve(__dirname, '..', '..');
  const jsDir = path.join(REPO_ROOT, 'js');
  let found = false;
  let locations = [];

  function searchDir(dir) {
    const files = fs.readdirSync(dir, { withFileTypes: true });
    for (const file of files) {
      const fullPath = path.join(dir, file.name);
      if (file.isDirectory()) {
        searchDir(fullPath);
      } else if (file.name.endsWith('.js')) {
        const content = fs.readFileSync(fullPath, 'utf-8');

        // Check for addEventListener
        const hasListener = new RegExp(`['"\`]${buttonId}['"\`].*addEventListener`, 'i').test(content) ||
                           new RegExp(`getElementById\\(['"\`]${buttonId}['"\`]\\).*addEventListener`, 'i').test(content) ||
                           new RegExp(`\\$\\(['"\`]#${buttonId}['"\`]\\).*addEventListener`, 'i').test(content);

        // Check for any reference
        const hasReference = new RegExp(`['"\`]${buttonId}['"\`]|getElementById\\(['"\`]${buttonId}['"\`]\\)|\\$\\(['"\`]#${buttonId}['"\`]\\)`, 'i').test(content);

        if (hasListener) {
          found = true;
          locations.push({ file: path.relative(REPO_ROOT, fullPath), hasListener: true });
        } else if (hasReference) {
          locations.push({ file: path.relative(REPO_ROOT, fullPath), hasListener: false });
        }
      }
    }
  }

  searchDir(jsDir);
  return { found, locations };
}

console.log('🔍 AUDITORÍA COMPLETA DE BOTONES\n');
console.log('='.repeat(70));

const results = {
  withListeners: [],
  withoutListeners: [],
  referenced: []
};

for (const btnId of ALL_BUTTONS) {
  const result = searchInAllJS(btnId);

  if (result.found) {
    results.withListeners.push(btnId);
    console.log(`✅ ${btnId}`);
    result.locations.forEach(loc => {
      if (loc.hasListener) {
        console.log(`   📌 ${loc.file}`);
      }
    });
  } else if (result.locations.length > 0) {
    results.referenced.push(btnId);
    console.log(`⚠️  ${btnId} - REFERENCIADO PERO SIN EVENT LISTENER`);
    result.locations.forEach(loc => {
      console.log(`   📄 ${loc.file}`);
    });
  } else {
    results.withoutListeners.push(btnId);
    console.log(`❌ ${btnId} - SIN BINDING NI REFERENCIA`);
  }
}

console.log('\n' + '='.repeat(70));
console.log('📊 RESUMEN:');
console.log(`✅ Con event listener: ${results.withListeners.length}`);
console.log(`⚠️  Referenciados sin listener: ${results.referenced.length}`);
console.log(`❌ Sin binding: ${results.withoutListeners.length}`);

if (results.referenced.length > 0) {
  console.log('\n⚠️  BOTONES REFERENCIADOS SIN EVENT LISTENER:');
  results.referenced.forEach(btn => console.log(`   - ${btn}`));
}

if (results.withoutListeners.length > 0) {
  console.log('\n❌ BOTONES SIN NINGÚN BINDING:');
  results.withoutListeners.forEach(btn => console.log(`   - ${btn}`));
}
