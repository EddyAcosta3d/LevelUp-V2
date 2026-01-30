'use strict';

async function init(){
    const DEBUG = new URLSearchParams(location.search).has('debug');
    // Captura errores para que en iPhone no se sienta "se rompió" sin pista
    window.addEventListener('error', (ev)=>{
      try{
        const msg = (ev && ev.message) ? String(ev.message) : 'Error';
        toast(DEBUG ? `⚠️ ${msg}` : '⚠️ Ocurrió un error. Recarga la página.');
      }catch(e){}
    });
    window.addEventListener('unhandledrejection', (ev)=>{
      try{
        const msg = (ev && ev.reason) ? String(ev.reason) : 'Promesa rechazada';
        toast(DEBUG ? `⚠️ ${msg}` : '⚠️ Ocurrió un error. Recarga la página.');
      }catch(e){}
    });

    bind();

    // Rol inicial: edición habilitada (sin bloqueos)
    try{ state.role='teacher'; }catch(_e){}
    setActiveRoute(state.route);
    updateDeviceDebug();
    syncDetailsUI();
    await loadData({forceRemote:false});
    setRole('teacher');
    syncDetailsUI();
  }
  (async()=>{ try{ await init(); } finally { hideSplash(); } })();

  // ---- Generic modal close (backdrops) + Event modal close ----
  document.addEventListener('click', (e)=>{
    const closer = e.target && e.target.closest ? e.target.closest('[data-close]') : null;
    if (closer){
      const id = closer.getAttribute('data-close');
      const m = id ? document.getElementById(id) : null;
      if (m) m.hidden = true;
    }

    // Allow closing by tapping/clicking the backdrop even if it isn't a <button>.
    // This makes "click outside" work reliably across modals.
    const backdrop = e.target && e.target.classList && e.target.classList.contains('modal__backdrop') ? e.target : null;
    if (backdrop){
      const id = backdrop.getAttribute('data-close');
      const m = id ? document.getElementById(id) : (backdrop.closest ? backdrop.closest('.modal') : null);
      if (m) m.hidden = true;
    }
  });

  (function(){
    const btn = document.getElementById('btnEventClose');
    if (btn) btn.addEventListener('click', ()=>{ const m=document.getElementById('eventModal'); if(m) m.hidden=true; });
  })();
