  // Router
  function setActiveRoute(route){
    state.route = route;
    $$('.page').forEach(p => p.classList.toggle('is-active', p.dataset.page === route));
    $$('.pill[data-route]').forEach(b => b.classList.toggle('is-active', b.dataset.route === route));
    $$('#bottomNav .bottomNav__btn').forEach(b => b.classList.toggle('is-active', b.dataset.route === route));
    const dbgRoute = $('#dbgRoute');
    if (dbgRoute) dbgRoute.textContent = route;
    updateEditButton();
    applyFichaLock();
  }

  
  function isEditEnabled(){ return state.role === 'teacher'; }
  function updateEditButton(){
    const btn = $('#btnEdicion');
    if(!btn) return;
    // Visible (desktop): te permite habilitar edición también para Desafíos/Materias
    const show = true;
    btn.hidden = !show;
    if(isEditEnabled()){
      btn.textContent = '✎ Editar';
      btn.classList.remove('pill--danger');
      btn.classList.add('is-active');
    }else{
      btn.textContent = '🔒 Solo ver';
      btn.classList.add('pill--danger');
      btn.classList.remove('is-active');
    }
  }

  // Locking framework for Fichas (easy to extend: add selectors here)
  const FICHA_LOCK = {
    disableSelectors: [
      '#btnNuevoHeroe',
      '#btnEliminar',
      '#avatarBox',
      '#inNombre',
      '#inEdad',
      '#txtDesc',
      '#txtMeta',
      '#btnXpM5', '#btnXpM1', '#btnXpP1', '#btnXpP5',
      '#actChips button',
      '#btnWeekReset'
    ],
    statsRangeSelector: '#statsBox .statRange',
    statsSegsSelector: '#statsBox .statSegs'
  };

  function applyFichaLock(){
    const locked = !isEditEnabled();
    document.body.classList.toggle('is-view-locked', locked);

    // Inputs/textarea: solo lectura en modo "Solo ver" (sin apagarse visualmente)
    FICHA_LOCK.disableSelectors.forEach(sel => {
      $$(sel).forEach(el => {
        const tag = (el.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea'){
          try { el.readOnly = locked; } catch(e){}
          el.setAttribute('aria-readonly', String(locked));
        } else {
          // Botones u otros controles: deshabilitar (además se ocultan por CSS)
          try { el.disabled = locked; } catch(e){}
          el.setAttribute('aria-disabled', String(locked));
        }
      });
    });

    // Chips de actividades (+2/+5/+10): ocultos por CSS, pero también deshabilitados por seguridad
    $$('#actChips [data-xp]').forEach(b => {
      try { b.disabled = locked; } catch(e){}
      b.setAttribute('aria-disabled', String(locked));
    });

    // Stats: se bloquean (sin cambiar brillo) vía pointer-events en CSS
  }

// Drawer
  function isDrawerLayout(){ return window.matchMedia('(max-width: 980px)').matches; }
  function closeDrawer(){ $('#shell').classList.remove('is-drawer-open'); $('#overlay').hidden = true; }
  function openDrawer(){ $('#shell').classList.add('is-drawer-open'); $('#overlay').hidden = false; }

  function isDetailsAvailable(){ return window.matchMedia('(min-width: 1181px)').matches; }
  function syncDetailsUI(){
    const shell = $('#shell');
    const btn = $('#btnDebugPanel');
    if (!shell || !btn) return;

    const canShow = isDetailsAvailable();
    if (!canShow){
      state.isDetailsOpen = false;
      shell.classList.remove('is-details-open');
      btn.classList.remove('is-active');
      btn.setAttribute('aria-pressed','false');
      btn.hidden = true;
      return;
    }

    btn.hidden = false;
    shell.classList.toggle('is-details-open', state.isDetailsOpen);
    btn.classList.toggle('is-active', state.isDetailsOpen);
    btn.setAttribute('aria-pressed', String(state.isDetailsOpen));
  }
  function toggleDetails(){
    if (!isDetailsAvailable()) return;
    state.isDetailsOpen = !state.isDetailsOpen;
    syncDetailsUI();
  }

  // Debug
  function updateDeviceDebug(){
    let d = 'desktop';
    if (window.matchMedia('(max-width: 640px)').matches) d = 'mobile';
    else if (window.matchMedia('(max-width: 1180px)').matches) d = 'tablet';
    $('#dbgDevice').textContent = d;
  }

  function updateDataDebug(){
    $('#dbgRole').textContent = state.role;
    const loaded = state.loadedFrom || state.dataSource;
    const label = (loaded === 'remote' && state.hasLocalChanges) ? `${loaded} (cambios locales)` : loaded;
    $('#dbgDataSrc').textContent = label;
    const upd = state.data?.meta?.updatedAt ? new Date(state.data.meta.updatedAt).toLocaleString() : '—';
    $('#dbgUpdated').textContent = upd;
    $('#brandSubtitle').textContent = (state.data?.meta?.app || 'LevelUp');

    // Extra debug: build + conteos
    const subCount = Array.isArray(state.data?.subjects) ? state.data.subjects.length : 0;
    const chCount  = Array.isArray(state.data?.challenges) ? state.data.challenges.length : 0;
    $('#dbgBuild') && ($('#dbgBuild').textContent = BUILD_ID);
    $('#dbgSubCount') && ($('#dbgSubCount').textContent = String(subCount));
    $('#dbgChCount') && ($('#dbgChCount').textContent = String(chCount));
  }

  // Dropdown
  function toggleDatos(open){
    const dd = $('#btnDatos').closest('.dropdown');
    const isOpen = dd.classList.contains('is-open');
    const next = (typeof open === 'boolean') ? open : !isOpen;
    dd.classList.toggle('is-open', next);
    $('#btnDatos').setAttribute('aria-expanded', String(next));
  }
  function closeDatos(){ toggleDatos(false); }
  // Textarea auto-grow (prevents inner scrollbars)
  function autoGrowTextarea(el){
    if (!el) return;
    el.style.height = 'auto';
    // Más compacto: las notas de descripción/meta no deben crecer demasiado.
    el.style.height = Math.max(el.scrollHeight, 56) + 'px';
  }
  function wireAutoGrow(root=document){
    $$('textarea', root).forEach(t => {
      if (t.dataset.autogrow === '1') return;
      t.dataset.autogrow = '1';
      autoGrowTextarea(t);
      t.addEventListener('input', () => autoGrowTextarea(t));
    });
  }

  // Toast
  let toastTimer = null;
  function toast(msg){
    let el = document.getElementById('toast');
    if (!el){
      el = document.createElement('div');
      el.id = 'toast';
      el.style.position = 'fixed';
      el.style.left = '50%';
      el.style.bottom = 'calc(18px + env(safe-area-inset-bottom, 0px))';
      el.style.transform = 'translateX(-50%)';
      el.style.padding = '10px 14px';
      el.style.borderRadius = '999px';
      el.style.background = 'rgba(10,10,10,0.92)';
      el.style.border = '1px solid rgba(0,210,255,0.22)';
      el.style.color = 'rgba(255,255,255,0.92)';
      el.style.boxShadow = '0 14px 40px rgba(0,0,0,0.55)';
      el.style.zIndex = '9999';
      el.style.fontSize = '13px';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = '1';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(()=>{ el.style.opacity = '0'; }, 2200);
  }

// Export all functions for use in other modules
if (typeof window !== 'undefined') {
  window.setActiveRoute = setActiveRoute;
  window.isEditEnabled = isEditEnabled;
  window.updateEditButton = updateEditButton;
  window.applyFichaLock = applyFichaLock;
  window.isDrawerLayout = isDrawerLayout;
  window.closeDrawer = closeDrawer;
  window.openDrawer = openDrawer;
  window.isDetailsAvailable = isDetailsAvailable;
  window.syncDetailsUI = syncDetailsUI;
  window.toggleDetails = toggleDetails;
  window.updateDeviceDebug = updateDeviceDebug;
  window.updateDataDebug = updateDataDebug;
  window.toggleDatos = toggleDatos;
  window.closeDatos = closeDatos;
  window.autoGrowTextarea = autoGrowTextarea;
  window.wireAutoGrow = wireAutoGrow;
  window.toast = toast;
}
