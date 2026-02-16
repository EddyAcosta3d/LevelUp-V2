'use strict';

/**
 * @module app.bindings
 * @description Event bindings and UI orchestration
 */

import { state } from './modules/core_globals.js';
import { loadData } from './modules/store.js';
import { renderAll, handleImportJson, handleExportJson, bumpHeroXp, setRole } from './modules/app_actions.js';
import { bindTiendaEvents } from './modules/tienda.js';
import { saveToGitHub, testGitHubConnection, setGitHubToken, clearGitHubToken } from './modules/github_sync.js';

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

  // Rewards button - toggle between rewards and previous route
  let previousRoute = 'fichas'; // Default fallback route

  const handleRewardsToggle = ()=> {
    if (state.route === 'recompensas') {
      // If we're already on rewards, go back to previous route
      activateRoute(previousRoute);
    } else {
      // Save current route before switching to rewards
      previousRoute = state.route || 'fichas';
      activateRoute('recompensas');
    }
  };

  document.getElementById('btnRecompensas')?.addEventListener('click', handleRewardsToggle);
  document.getElementById('btnMobileRewards')?.addEventListener('click', handleRewardsToggle);

  // XP buttons - modify hero experience points
  document.getElementById('btnXpP1')?.addEventListener('click', ()=> bumpHeroXp(1));
  document.getElementById('btnXpP5')?.addEventListener('click', ()=> bumpHeroXp(5));
  document.getElementById('btnXpM1')?.addEventListener('click', ()=> bumpHeroXp(-1));
  document.getElementById('btnXpM5')?.addEventListener('click', ()=> bumpHeroXp(-5));

  // Edit mode toggle button
  document.getElementById('btnEdicion')?.addEventListener('click', ()=> {
    const nextRole = state.role === 'teacher' ? 'viewer' : 'teacher';
    setRole(nextRole);
  });

  // GitHub configuration and save buttons
  document.getElementById('btnConfigGitHub')?.addEventListener('click', ()=> {
    if (typeof window.openGitHubConfigModal === 'function') {
      window.openGitHubConfigModal();
    }
  });

  document.getElementById('btnSaveToGitHub')?.addEventListener('click', async ()=> {
    const toast = window.toast || ((msg)=> console.log(msg));
    try {
      toast('Guardando en GitHub...');
      const result = await saveToGitHub({
        onProgress: (msg) => toast(msg)
      });
      if (result.success) {
        toast('✅ ' + result.message);
      } else {
        toast('❌ ' + result.message);
      }
    } catch (error) {
      toast('❌ Error al guardar en GitHub');
      console.error(error);
    }
  });

  safeCall(bindTiendaEvents);
  safeCall(renderAll);
}
