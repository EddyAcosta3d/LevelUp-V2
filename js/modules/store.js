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
  normalizeData,
  normalizeFilter
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
    }catch(e){
      console.warn('loadLocal: JSON parse failed, discarding corrupted data', e);
      return null;
    }
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

  /**
   * @param {object}   [opts]
   * @param {boolean}  [opts.forceRemote=false] - Muestra toast si la carga remota falla.
   * @param {Function} [opts.toast]             - Función de notificación. Fallback: window.toast.
   * @param {Function} [opts.updateDataDebug]   - Actualiza panel de debug. Fallback: window.updateDataDebug.
   * @param {Function} [opts.renderAll]         - Re-renderiza la UI. Fallback: window.renderAll.
   * @param {Function} [opts.demoData]          - Genera datos demo. Fallback: window.demoData.
   */
  export async function loadData({
    forceRemote    = false,
    toast          = null,
    updateDataDebug = null,
    renderAll      = null,
    demoData       = null,
  } = {}){
    // Resolver callbacks: parámetro explícito → window global → noop
    const _toast           = toast           ?? (typeof window.toast           === 'function' ? window.toast           : null);
    const _updateDataDebug = updateDataDebug ?? (typeof window.updateDataDebug === 'function' ? window.updateDataDebug : null);
    const _renderAll       = renderAll       ?? (typeof window.renderAll       === 'function' ? window.renderAll       : null);
    const _demoData        = demoData        ?? (typeof window.demoData        === 'function' ? window.demoData        : null);

    try{
      logger.info('Intentando cargar datos desde GitHub...');
      const d = await fetchRemote();
      const normalized = normalizeData(d);
      const merged = mergeLocalAssignments(normalized, loadLocal());
      state.data = merged; state.dataSource = 'remote'; state.loadedFrom = 'remote';
      normalizeFilter();
      saveLocal(state.data);
      if (forceRemote) _toast?.('Cargado desde GitHub');
      _updateDataDebug?.();
      _renderAll?.();
      logger.info('Datos cargados desde GitHub correctamente');
      return;
    }catch(e){
      if (forceRemote){
        logger.warn('No se pudo cargar desde GitHub', e.message);
        _toast?.('No se pudo cargar GitHub. Usando copia local.');
      } else {
        logger.debug('Carga remota falló, usando copia local', e.message);
      }
    }

    const local = loadLocal();
    if (local){
      logger.info('Usando datos de copia local');
      state.data = normalizeData(local); state.dataSource = 'local'; state.loadedFrom = 'local';
      normalizeFilter();
      _updateDataDebug?.();
      _renderAll?.();
      return;
    }

    logger.warn('No hay datos locales ni remotos, usando datos demo');
    if (_demoData) {
      state.data = normalizeData(_demoData());
      state.dataSource = 'demo';
      state.loadedFrom = 'demo';
      normalizeFilter();
      _updateDataDebug?.();
      _renderAll?.();
    }
  }

function mergeLocalAssignments(remoteData, localData){
  const remote = normalizeData(remoteData);
  if (!localData || !Array.isArray(localData.heroes)) return remote;

  const localById = new Map(
    localData.heroes
      .filter(h => h && h.id)
      .map(h => [String(h.id), h])
  );

  remote.heroes = (remote.heroes || []).map((hero) => {
    const localHero = localById.get(String(hero.id || ''));
    if (!localHero) return hero;

    const assigned = Array.isArray(localHero.assignedChallenges)
      ? localHero.assignedChallenges.map(x => String(x))
      : null;

    if (!assigned) return hero;
    return {
      ...hero,
      assignedChallenges: assigned
    };
  });

  return remote;
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
