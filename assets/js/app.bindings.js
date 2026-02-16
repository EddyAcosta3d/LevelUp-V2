'use strict';

/**
 * @module app.bindings
 * @description Event bindings and UI orchestration
 */

import { state } from './modules/core_globals.js';
import { loadData } from './modules/store.js';
import { renderAll, handleImportJson, handleExportJson } from './modules/app_actions.js';
import { bindTiendaEvents } from './modules/tienda.js';

function safeCall(fn, ...args){
  try{ if (typeof fn === 'function') return fn(...args); }catch(_e){}
  return undefined;
}

function activateRoute(route){
  if (!route) return;
  state.route = route;
  if (typeof window.setActiveRoute === 'function') {
    window.setActiveRoute(route);
    return;
  }
  document.querySelectorAll('.page').forEach(p=>p.classList.toggle('is-active', p.dataset.page===route));
  document.querySelectorAll('.pill[data-route]').forEach(b=>b.classList.toggle('is-active', b.dataset.route===route));
  document.querySelectorAll('#bottomNav .bottomNav__btn').forEach(b=>b.classList.toggle('is-active', b.dataset.route===route));
}

export function bind(){
  document.querySelectorAll('[data-route]').forEach(btn=>{
    btn.addEventListener('click', ()=> activateRoute(btn.dataset.route));
  });

  document.getElementById('btnMenu')?.addEventListener('click', ()=> safeCall(window.openDrawer));
  document.getElementById('overlay')?.addEventListener('click', ()=> safeCall(window.closeDrawer));

  document.getElementById('btnDebugPanel')?.addEventListener('click', ()=> safeCall(window.toggleDetails));

  document.getElementById('btnDatos')?.addEventListener('click', (e)=>{
    e.preventDefault();
    safeCall(window.toggleDatos);
  });

  document.addEventListener('click', (e)=>{
    const inDropdown = e.target && e.target.closest && e.target.closest('.dropdown');
    if (!inDropdown) safeCall(window.closeDatos);
  });

  document.getElementById('btnReloadRemote')?.addEventListener('click', ()=> loadData({ forceRemote: true }));
  document.getElementById('btnImportJson')?.addEventListener('click', ()=> document.getElementById('fileImport')?.click());
  document.getElementById('btnExportJson')?.addEventListener('click', ()=> safeCall(handleExportJson));

  document.getElementById('fileImport')?.addEventListener('change', async (e)=>{
    const file = e.target?.files?.[0];
    if (file) await handleImportJson(file);
    e.target.value = '';
  });

  document.getElementById('btnRecompensas')?.addEventListener('click', ()=> activateRoute('recompensas'));
  document.getElementById('btnMobileRewards')?.addEventListener('click', ()=> activateRoute('recompensas'));

  safeCall(bindTiendaEvents);
  safeCall(renderAll);
}
