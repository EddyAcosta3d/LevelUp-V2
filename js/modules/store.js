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
      const res = await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } finally {
      clearTimeout(t);
    }
  }

  async function loadData({forceRemote=false} = {}){
    if (forceRemote){
      try{
        const d = await fetchRemote();
        state.data = normalizeData(d); state.dataSource = 'remote'; state.loadedFrom = 'remote';
        saveLocal(state.data);
        toast('Cargado desde GitHub');
        updateDataDebug(); renderAll();
        return;
      }catch(e){
        toast('No se pudo cargar GitHub. Usando copia local.');
      }
    }else{
      try{
        const d = await fetchRemote();
        state.data = normalizeData(d); state.dataSource = 'remote'; state.loadedFrom = 'remote';
        saveLocal(state.data);
        updateDataDebug(); renderAll();
        return;
      }catch(e){}
    }

    const local = loadLocal();
    if (local){
      state.data = normalizeData(local); state.dataSource = 'local'; state.loadedFrom = 'local';
      updateDataDebug(); renderAll();
      return;
    }

    state.data = normalizeData(demoData()); state.dataSource = 'demo'; state.loadedFrom = 'demo';
    updateDataDebug(); renderAll();
  }

  // Render helpers
  function escapeHtml(s){
    return String(s ?? '')
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'",'&#039;');
  }

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
  }catch(err){
    console.warn('saveData() wrapper failed', err);
  }
}

// Ensure legacy helpers are globally reachable (some browsers/extensions can change scoping)
try{ window.saveData = saveData; }catch(_){ }

