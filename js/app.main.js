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
	  preventIOSDoubleTapZoom();

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

	  // iOS Safari: prevent accidental double-tap zoom inside the app UI.
	  // Note: This also disables pinch-to-zoom while the app is open.
	  function preventIOSDoubleTapZoom(){
	    const ua = navigator.userAgent || '';
	    const isIOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && 'ontouchend' in document);
	    if (!isIOS) return;

	    // Prevent double-tap zoom
	    let lastTouchEnd = 0;
	    document.addEventListener('touchend', (e)=>{
	      const now = Date.now();
	      if (now - lastTouchEnd <= 300){
	        e.preventDefault();
	      }
	      lastTouchEnd = now;
	    }, { passive: false });

	    // Reduce the chance of text selection/callout triggering zoom-ish behaviors
	    try{
	      document.documentElement.style.webkitTextSizeAdjust = '100%';
	      document.documentElement.style.webkitTouchCallout = 'none';
	    }catch(_e){}
	  }

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
