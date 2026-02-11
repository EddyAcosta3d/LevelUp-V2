'use strict';

function updateTopbarHeightVar(){
  try{
    const tb = document.querySelector('.topbar');
    const h = tb ? Math.round(tb.getBoundingClientRect().height) : 0;
    if (h > 0){
      document.documentElement.style.setProperty('--topbar-h', `${h}px`);
    }
  }catch(e){}
}


async function init(){
    if (window.__LEVELUP_INIT_DONE) return;
    window.__LEVELUP_INIT_DONE = true;
    updateTopbarHeightVar();
    window.addEventListener('resize', updateTopbarHeightVar);
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

    // Configuración inicial (antes de cargar datos)
    preventIOSDoubleTapZoom();

    // Rol inicial: edición habilitada (sin bloqueos)
    try{ state.role='teacher'; }catch(_e){}
    setActiveRoute(state.route);
    updateDeviceDebug();
    syncDetailsUI();
    
    // CARGAR DATOS PRIMERO (crítico para que los bindings tengan datos disponibles)
    await loadData({forceRemote:false});
    
    // DESPUÉS hacer bindings (cuando ya hay datos)
    bind();
    
    setRole('teacher');
    syncDetailsUI();
  }
  (async()=>{ try{ await init(); } finally { hideSplash(); } })();

	  // iOS Safari: reduce accidental double-tap zoom in non-interactive areas,
	  // while keeping native pinch-to-zoom available for accessibility.
	  function preventIOSDoubleTapZoom(){
	    const ua = navigator.userAgent || '';
	    const isIOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && 'ontouchend' in document);
	    if (!isIOS) return;

	    // Prevent double-tap zoom, but allow rapid taps on buttons/links
	    // so the bottom nav and other interactive elements stay responsive.
	    let lastTouchEnd = 0;
	    document.addEventListener('touchend', (e)=>{
	      if (e.touches && e.touches.length > 1) return;
	      const now = Date.now();
	      if (now - lastTouchEnd <= 300){
	        const t = e.target;
	        const isInteractive = t && t.closest && t.closest('button, a, [data-route], .bottomNav__btn, .pill, input, textarea, select');
	        if (!isInteractive) e.preventDefault();
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
