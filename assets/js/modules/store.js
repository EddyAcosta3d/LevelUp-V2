'use strict';

/**
 * @module store
 * @description Data persistence layer - localStorage and remote fetch
 *
 * PUBLIC EXPORTS:
 * - saveLocal, loadLocal, clearLocal
 * - fetchRemote, loadData
 * - saveData (legacy compat)
 * - heroLabel (helper)
 */

// Import dependencies from core_globals
import {
  state,
  CONFIG,
  logger,
  normalizeData
} from './core_globals.js';

  // Storage
  export function saveLocal(data){
    try{
      const payload = (data !== undefined) ? data : state.data;

      // Basic validation: ensure payload has required structure
      if (!payload || typeof payload !== 'object') {
        console.error('saveLocal: Invalid payload - not an object');
        return false;
      }
      if (!payload.meta || typeof payload.meta !== 'object') {
        console.warn('saveLocal: Missing or invalid meta object');
      }
      if (!Array.isArray(payload.heroes)) {
        console.error('saveLocal: Invalid payload - heroes must be an array');
        return false;
      }

      if (payload && payload.meta) payload.meta.updatedAt = new Date().toISOString();
      localStorage.setItem(CONFIG.storageKey, JSON.stringify(payload));
      state.hasLocalChanges = true;
      return true;
    }catch(e){
      console.error('saveLocal failed:', e);
      return false;
    }
  }

  export function loadLocal(){
    try{
      const raw = localStorage.getItem(CONFIG.storageKey);
      if (!raw) return null;
      return JSON.parse(raw);
    }catch(e){ return null; }
  }

  export function clearLocal(){
    try{ localStorage.removeItem(CONFIG.storageKey); }catch(e){}
  }

  // Remote fetch timeout
  export async function fetchRemote(){
    const ctrl = new AbortController();
    const t = setTimeout(()=> ctrl.abort(), CONFIG.remoteTimeoutMs);
    try{
      const url = `${CONFIG.remoteUrl}?v=${Date.now()}`; // cache-buster
      const res = await fetch(url, {
        signal: ctrl.signal,
        cache: 'no-store',
        headers: { 'Accept': 'application/json' }
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      // Validar que la respuesta sea JSON
      const contentType = res.headers.get('content-type');
      if (contentType && !contentType.includes('application/json')) {
        console.warn('Respuesta no es JSON, intentando parsear de todas formas');
      }

      const text = await res.text();
      try {
        return JSON.parse(text);
      } catch(parseError) {
        console.error('Error parseando JSON:', parseError);
        throw new Error('JSON inválido en la respuesta');
      }

    } catch(error) {
      // Manejar diferentes tipos de errores
      if (error.name === 'AbortError') {
        throw new Error('Tiempo de espera agotado (3.5s)');
      }
      if (error.message && (error.message.includes('NetworkError') || error.message.includes('Failed to fetch'))) {
        throw new Error('Sin conexión a Internet');
      }
      throw error;
    } finally {
      clearTimeout(t);
    }
  }

  export async function loadData({forceRemote=false} = {}){
    // Note: These functions are expected to be globally available (from app.bindings.js)
    // toast, updateDataDebug, renderAll, demoData
    // We'll keep them as global calls for now (backward compat)

    if (forceRemote){
      try{
        logger.info('Intentando cargar datos desde GitHub...');
        const d = await fetchRemote();
        const normalized = normalizeData(d);
        // Preserve local assignedChallenges so a GitHub reload doesn't wipe
        // assignments that are saved locally but haven't synced yet to Supabase.
        try {
          const local = loadLocal();
          if (local?.heroes) {
            const localByHeroId = new Map(local.heroes.map(h => [h.id, h]));
            normalized.heroes.forEach(hero => {
              const localHero = localByHeroId.get(hero.id);
              if (Array.isArray(localHero?.assignedChallenges) && localHero.assignedChallenges.length > 0) {
                hero.assignedChallenges = localHero.assignedChallenges;
              }
            });
          }
        } catch(_mergeErr) {}
        state.data = normalized; state.dataSource = 'remote'; state.loadedFrom = 'remote';
        saveLocal(state.data);
        if (typeof toast === 'function') toast('Cargado desde GitHub');
        if (typeof updateDataDebug === 'function') updateDataDebug();
        if (typeof renderAll === 'function') renderAll();
        logger.info('Datos cargados desde GitHub correctamente');
        return;
      }catch(e){
        logger.warn('No se pudo cargar desde GitHub', e.message);
        if (typeof toast === 'function') toast('No se pudo cargar GitHub. Usando copia local.');
      }
    }else{
      try{
        logger.info('Intentando cargar datos desde GitHub...');
        const d = await fetchRemote();
        const normalized = normalizeData(d);
        // Preserve local assignedChallenges so a GitHub reload doesn't wipe
        // assignments that are saved locally but haven't synced yet to Supabase.
        try {
          const local = loadLocal();
          if (local?.heroes) {
            const localByHeroId = new Map(local.heroes.map(h => [h.id, h]));
            normalized.heroes.forEach(hero => {
              const localHero = localByHeroId.get(hero.id);
              if (Array.isArray(localHero?.assignedChallenges) && localHero.assignedChallenges.length > 0) {
                hero.assignedChallenges = localHero.assignedChallenges;
              }
            });
          }
        } catch(_mergeErr) {}
        state.data = normalized; state.dataSource = 'remote'; state.loadedFrom = 'remote';
        saveLocal(state.data);
        if (typeof updateDataDebug === 'function') updateDataDebug();
        if (typeof renderAll === 'function') renderAll();
        logger.info('Datos cargados desde GitHub correctamente');
        return;
      }catch(e){
        logger.debug('Carga remota falló, usando copia local', e.message);
      }
    }

    const local = loadLocal();
    if (local){
      logger.info('Usando datos de copia local');
      state.data = normalizeData(local); state.dataSource = 'local'; state.loadedFrom = 'local';
      if (typeof updateDataDebug === 'function') updateDataDebug();
      if (typeof renderAll === 'function') renderAll();
      return;
    }

    logger.warn('No hay datos locales ni remotos, usando datos demo');
    // demoData() is expected to be globally available
    if (typeof demoData === 'function') {
      state.data = normalizeData(demoData());
      state.dataSource = 'demo';
      state.loadedFrom = 'demo';
      if (typeof updateDataDebug === 'function') updateDataDebug();
      if (typeof renderAll === 'function') renderAll();
    }
  }

  // Render helpers
  export function heroLabel(hero){
    const role = (hero.role && hero.role.trim()) ? hero.role.trim() : 'Sin rol';
    return `${hero.name || 'Sin nombre'} · ${role} · Nivel ${hero.level ?? 1}`;
  }


// ------------------------------------------------------------------
// Compat layer: some modules still call saveData() (legacy name).
// Keep it as a thin wrapper over saveLocal(state.data).
// ------------------------------------------------------------------
export function saveData(){
  try{
    // state is imported from core_globals
    saveLocal(state.data);
    if (state.dataSource === 'remote') state.dataSource = 'local';
  }catch(err){
    console.warn('saveData() wrapper failed', err);
  }
}

// Ensure legacy helpers are globally reachable (some browsers/extensions can change scoping)
// BACKWARD COMPAT: Keep window.* assignments temporarily
try{ window.saveData = saveData; }catch(_){ }
try{ window.saveLocal = saveLocal; }catch(_){ }
try{ window.loadData = loadData; }catch(_){ }
