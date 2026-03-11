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
  DATA_SOURCE,
  logger,
  normalizeData,
  normalizeFilter
} from './core_globals.js';

  /**
   * Guarda los datos en localStorage.
   * @param {AppData} [data] - Datos a guardar. Si se omite, usa state.data.
   * @returns {boolean} true si se guardó exitosamente, false en caso de error.
   */
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

  /**
   * Carga los datos guardados en localStorage.
   * @returns {AppData|null} Datos guardados o null si no hay nada o el JSON es inválido.
   */
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

  /**
   * Elimina los datos guardados en localStorage.
   * @returns {void}
   */
  export function clearLocal(){
    try{ localStorage.removeItem(CONFIG.storageKey); }catch(e){}
  }

  /**
   * Obtiene los datos remotos desde data.json con cache-buster y timeout.
   * @returns {Promise<AppData>} Datos remotos parseados.
   * @throws {Error} Si hay error de red, timeout o JSON inválido.
   */
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
  localFirst     = true,
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

    const applyRemoteData = (d, {notify=false} = {})=>{
      const normalized = normalizeData(d);
      const merged = mergeLocalAssignments(normalized, loadLocal());
      state.data = merged; state.dataSource = DATA_SOURCE.REMOTE; state.loadedFrom = DATA_SOURCE.REMOTE;
      normalizeFilter();
      saveLocal(state.data);
      if (notify) _toast?.('Cargado desde GitHub');
      _updateDataDebug?.();
      _renderAll?.();
    };

    const local = loadLocal();
    if (localFirst && local){
      logger.info('Usando datos de copia local (local-first)');
      state.data = normalizeData(local); state.dataSource = DATA_SOURCE.LOCAL; state.loadedFrom = DATA_SOURCE.LOCAL;
      normalizeFilter();
      _updateDataDebug?.();
      _renderAll?.();

      // Refresh remoto en background para no bloquear el primer render.
      fetchRemote()
        .then((d)=>{
          applyRemoteData(d, { notify: forceRemote });
          logger.info('Datos remotos sincronizados en segundo plano');
        })
        .catch((e)=>{
          if (forceRemote) {
            logger.warn('No se pudo sincronizar desde GitHub', e.message);
            _toast?.('No se pudo cargar GitHub. Usando copia local.');
          } else {
            logger.debug('Sync remota en background falló', e.message);
          }
        });
      return;
    }

    try{
      logger.info('Intentando cargar datos desde GitHub...');
      const d = await fetchRemote();
      applyRemoteData(d, { notify: forceRemote });
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

    const localFallback = loadLocal();
    if (localFallback){
      logger.info('Usando datos de copia local');
      state.data = normalizeData(localFallback); state.dataSource = DATA_SOURCE.LOCAL; state.loadedFrom = DATA_SOURCE.LOCAL;
      normalizeFilter();
      _updateDataDebug?.();
      _renderAll?.();
      return;
    }

    logger.warn('No hay datos locales ni remotos, usando datos demo');
    if (_demoData) {
      state.data = normalizeData(_demoData());
      state.dataSource = DATA_SOURCE.DEMO;
      state.loadedFrom = DATA_SOURCE.DEMO;
      normalizeFilter();
      _updateDataDebug?.();
      _renderAll?.();
    }
  }

/**
 * Combina datos remotos con las asignaciones locales de cada héroe.
 * Preserva assignedChallenges del localStorage para no perder asignaciones offline.
 * @param {AppData}      remoteData - Datos frescos del servidor.
 * @param {AppData|null} localData  - Datos guardados en localStorage.
 * @returns {AppData} Datos remotos con assignedChallenges actualizados desde local.
 */
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

  /**
   * Genera una etiqueta legible para un héroe (nombre · rol · nivel).
   * @param {Hero} hero - Héroe a describir.
   * @returns {string} Etiqueta formateada.
   */
  export function heroLabel(hero){
    const role = (hero.role && hero.role.trim()) ? hero.role.trim() : 'Sin rol';
    return `${hero.name || 'Sin nombre'} · ${role} · Nivel ${hero.level ?? 1}`;
  }


// ------------------------------------------------------------------
// Compat layer: some modules still call saveData() (legacy name).
// Keep it as a thin wrapper over saveLocal(state.data).
// ------------------------------------------------------------------
/**
 * Wrapper de compatibilidad. Guarda state.data en localStorage.
 * @deprecated Usar saveLocal(state.data) directamente.
 * @returns {void}
 */
export function saveData(){
  try{
    // state is imported from core_globals
    saveLocal(state.data);
    if (state.dataSource === DATA_SOURCE.REMOTE) state.dataSource = DATA_SOURCE.LOCAL;
  }catch(err){
    console.warn('saveData() wrapper failed', err);
  }
}

// Ensure legacy helpers are globally reachable (some browsers/extensions can change scoping)
// BACKWARD COMPAT: Keep window.* assignments temporarily
try{ window.saveData = saveData; }catch(_){ }
try{ window.saveLocal = saveLocal; }catch(_){ }
try{ window.loadData = loadData; }catch(_){ }
