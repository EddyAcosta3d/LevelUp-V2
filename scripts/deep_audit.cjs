#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const JS_ROOT = path.join(ROOT, 'js');
const INDEX = path.join(ROOT, 'index.html');

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function walkJs(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkJs(full, files);
    else if (entry.isFile() && entry.name.endsWith('.js')) files.push(full);
  }
  return files;
}

const jsFiles = walkJs(JS_ROOT);
const jsTextByFile = new Map(jsFiles.map((file) => [file, read(file)]));
const allJs = [...jsTextByFile.values()].join('\n');

const html = read(INDEX);
const ids = [...html.matchAll(/\bid\s*=\s*"([^"]+)"/g)].map((m) => m[1]);

const orphanIds = ids.filter((id) => !allJs.includes(id));

const declaredFunctions = [];
for (const [file, text] of jsTextByFile.entries()) {
  for (const match of text.matchAll(/function\s+([A-Za-z_$][\w$]*)\s*\(/g)) {
    declaredFunctions.push({ name: match[1], file: path.relative(ROOT, file) });
  }
}

const wordCounts = new Map();
for (const token of allJs.match(/\b[A-Za-z_$][\w$]*\b/g) || []) {
  wordCounts.set(token, (wordCounts.get(token) || 0) + 1);
}

const singleUseFunctions = declaredFunctions
  .filter(({ name }) => (wordCounts.get(name) || 0) === 1)
  .map(({ name, file }) => ({ name, file }))
  .sort((a, b) => a.name.localeCompare(b.name));

const exportedFns = [];
for (const [file, text] of jsTextByFile.entries()) {
  for (const match of text.matchAll(/export\s+function\s+([A-Za-z_$][\w$]*)\s*\(/g)) {
    exportedFns.push({ name: match[1], file: path.relative(ROOT, file) });
  }
}

const unreferencedExports = exportedFns.filter(({ name }) => (wordCounts.get(name) || 0) === 1);

console.log('🔎 Auditoría estática profunda\n');
console.log(`Archivos JS analizados: ${jsFiles.length}`);
console.log(`IDs en index.html: ${ids.length}`);
console.log(`IDs no referenciados desde JS: ${orphanIds.length}`);
for (const id of orphanIds) console.log(`  - ${id}`);

console.log(`\nFunciones declaradas: ${declaredFunctions.length}`);
console.log(`Funciones con única referencia textual: ${singleUseFunctions.length}`);
for (const entry of singleUseFunctions) {
  console.log(`  - ${entry.name} (${entry.file})`);
}

console.log(`\nExports detectados: ${exportedFns.length}`);
console.log(`Exports sin referencias adicionales: ${unreferencedExports.length}`);
for (const entry of unreferencedExports) {
  console.log(`  - ${entry.name} (${entry.file})`);
}
