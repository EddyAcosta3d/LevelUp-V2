  // Storage
  function saveLocal(data){
    try{
      const payload = (data !== undefined) ? data : state.data;
      localStorage.setItem(CONFIG.storageKey, JSON.stringify(payload));
      state.hasLocalChanges = true;
      return true;
    }catch(e){
      return false;
    }
  }
  function loadLocal(){
    try{
      const raw = localStorage.getItem(CONFIG.storageKey);
      if (!raw) return null;
      return JSON.parse(raw);
    }catch(e){ return null; }
  }
  function clearLocal(){ try{ localStorage.removeItem(CONFIG.storageKey); }catch(e){} }

  // Remote fetch timeout
  async function fetchRemote(){
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

  async function loadData({forceRemote=false} = {}){
    if (forceRemote){
      try{
        logger.info('Intentando cargar datos desde GitHub...');
        const d = await fetchRemote();
        state.data = normalizeData(d); state.dataSource = 'remote'; state.loadedFrom = 'remote';
        saveLocal(state.data);
        toast('Cargado desde GitHub');
        updateDataDebug(); renderAll();
        logger.info('Datos cargados desde GitHub correctamente');
        return;
      }catch(e){
        logger.warn('No se pudo cargar desde GitHub', e.message);
        toast('No se pudo cargar GitHub. Usando copia local.');
      }
    }else{
      try{
        logger.info('Intentando cargar datos desde GitHub...');
        const d = await fetchRemote();
        state.data = normalizeData(d); state.dataSource = 'remote'; state.loadedFrom = 'remote';
        saveLocal(state.data);
        updateDataDebug(); renderAll();
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
      updateDataDebug(); renderAll();
      return;
    }

    logger.warn('No hay datos locales ni remotos, usando datos demo');
    state.data = normalizeData(demoData()); state.dataSource = 'demo'; state.loadedFrom = 'demo';
    updateDataDebug(); renderAll();
  }

  // Render helpers
  // escapeHtml is defined in core_globals.js (loaded before this file)

  function heroLabel(hero){
    const role = (hero.role && hero.role.trim()) ? hero.role.trim() : 'Sin rol';
    return `${role} · Nivel ${hero.level ?? 1}`;
  }


// ------------------------------------------------------------------
// Compat layer: some modules still call saveData() (legacy name).
// Keep it as a thin wrapper over saveLocal(state.data).
// ------------------------------------------------------------------
function saveData(){
  try{
    // state is defined in core_globals.js (same global scope)
    saveLocal(state.data);
    if (state.dataSource === 'remote') state.dataSource = 'local';
  }catch(err){
    console.warn('saveData() wrapper failed', err);
  }
}

// Ensure legacy helpers are globally reachable (some browsers/extensions can change scoping)
try{ window.saveData = saveData; }catch(_){ }

