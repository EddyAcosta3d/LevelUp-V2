'use strict';

/**
 * @module app.main
 * @description Main application initialization and startup logic
 */

// Import all dependencies
import { state, logger } from './modules/core_globals.js';
import { loadData } from './modules/store.js';
import { bind } from './app.bindings.js';
import { setRole } from './modules/app_actions.js';
import { getSession } from './modules/hero_session.js';
import { startAssignmentSync, loadAllAssignmentsIntoState, preloadStudentAssignments } from './modules/realtime_sync.js';


const setActiveRoute = (...args) => {
  if (typeof window.setActiveRoute === 'function') return window.setActiveRoute(...args);
};
const updateDeviceDebug = (...args) => {
  if (typeof window.updateDeviceDebug === 'function') return window.updateDeviceDebug(...args);
};
const syncDetailsUI = (...args) => {
  if (typeof window.syncDetailsUI === 'function') return window.syncDetailsUI(...args);
};
const hideSplash = (...args) => {
  if (typeof window.hideSplash === 'function') return window.hideSplash(...args);
  const splash = document.getElementById('splash');
  if (splash) splash.hidden = true;
};
const toast = (...args) => {
  if (typeof window.toast === 'function') return window.toast(...args);
};

export function updateTopbarHeightVar(){
  try{
    const tb = document.querySelector('.topbar');
    const h = tb ? Math.round(tb.getBoundingClientRect().height) : 0;
    if (h > 0){
      document.documentElement.style.setProperty('--topbar-h', `${h}px`);
    }
  }catch(e){}
}


export async function init(){
    if (window.__LEVELUP_INIT_DONE) return;
    window.__LEVELUP_INIT_DONE = true;
    updateTopbarHeightVar();
    window.addEventListener('resize', updateTopbarHeightVar);

    const urlParams = new URLSearchParams(location.search);
    const DEBUG = urlParams.has('debug');
    // Admin solo por sesión real (cuenta de Eddy)
    // Usar window.__LU_SESSION__ que ya fue parseado sin bloquear en index.html
    const _sess = window.__LU_SESSION__ || getSession();
    const IS_ADMIN = !!(_sess && _sess.isAdmin === true);

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

    // Rol inicial: solo por sesión
    try{
      state.role = IS_ADMIN ? 'teacher' : 'viewer';
      // Agregar clase al body para estilos condicionales
      document.body.classList.toggle('viewer-mode', !IS_ADMIN);
      document.body.classList.toggle('admin-mode', IS_ADMIN);
    }catch(_e){}

    setActiveRoute(state.route);
    updateDeviceDebug();
    syncDetailsUI();

    // Exponer getSession globalmente para que fichas.js pueda usarlo
    window.LevelUp = window.LevelUp || {};
    window.LevelUp.getSession = getSession;

    // CARGAR DATOS PRIMERO (crítico para que los bindings tengan datos disponibles)
    await loadData({forceRemote:false});

    // DESPUÉS de cargar datos: pre-seleccionar el héroe de la sesión
    // IMPORTANTE: debe hacerse ANTES de bind() para que renderHeroList
    // ya encuentre el selectedHeroId correcto en su primera ejecución
    if (_sess && !_sess.isAdmin && _sess.heroId) {
      const heroes = state.data?.heroes || [];
      const sessionHero = heroes.find(h => h.id === _sess.heroId);
      if (sessionHero) {
        state.selectedHeroId = _sess.heroId;
        state.group = sessionHero.group || '2D';
        // Sincronizar el tab de grupo en la UI antes de que bind() renderice
        try {
          document.querySelectorAll('.segmented__btn[data-group]').forEach(btn => {
            const isActive = btn.dataset.group === state.group;
            btn.classList.toggle('is-active', isActive);
            btn.setAttribute('aria-selected', String(isActive));
          });
        } catch(_e) {}
      }
    }

    // ALUMNO: pre-cargar asignaciones de Supabase ANTES del primer render,
    // para que los desafíos asignados aparezcan desbloqueados desde el inicio.
    if (!IS_ADMIN && _sess && _sess.heroId) {
      await preloadStudentAssignments(_sess.heroId);
    }

    // Modo normal: bind siempre (se eliminó modo proyector por URL)
    bind();
    setRole(IS_ADMIN ? 'teacher' : 'viewer');
    syncDetailsUI();

    // Sincronización de asignaciones con Supabase
    if (IS_ADMIN) {
      // Profe: cargar asignaciones de todos los alumnos al arrancar
      loadAllAssignmentsIntoState().then(() => {
        // Re-renderizar si ya había algo en pantalla
        if (typeof window.renderChallenges === 'function') window.renderChallenges();
      }).catch(() => {});
    } else if (_sess && _sess.heroId) {
      // Alumno: polling cada 5s para detectar nuevas asignaciones
      startAssignmentSync(_sess.heroId, () => {
        if (typeof window.renderChallenges === 'function') window.renderChallenges();
      });
    }
  }
  (async()=>{ try{ await init(); } finally { hideSplash(); } })();

	  // iOS Safari: reduce accidental double-tap zoom in non-interactive areas,
	  // while keeping native pinch-to-zoom available for accessibility.
	  export function preventIOSDoubleTapZoom(){
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


let _deferredInstallPrompt = null;

function setupPWAInstallPrompt(){
  const installButtons = Array.from(document.querySelectorAll('[data-install-app="1"]'));
  if (!installButtons.length) return;

  const setButtonsHidden = (hidden)=>{
    installButtons.forEach((btn)=>{ btn.hidden = !!hidden; });
  };

  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  setButtonsHidden(!!isStandalone);

  window.addEventListener('beforeinstallprompt', (e)=>{
    e.preventDefault();
    _deferredInstallPrompt = e;
    setButtonsHidden(false);
  });

  window.addEventListener('appinstalled', ()=>{
    _deferredInstallPrompt = null;
    setButtonsHidden(true);
    try{ window.toast?.('✅ App instalada'); }catch(_e){}
  });

  installButtons.forEach((btn)=>{
    btn.addEventListener('click', async ()=>{
      try{
        if (_deferredInstallPrompt){
          _deferredInstallPrompt.prompt();
          await _deferredInstallPrompt.userChoice;
          _deferredInstallPrompt = null;
          return;
        }
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent || '');
        if (isIOS){
          window.toast?.('En iPhone/iPad: Compartir → Añadir a pantalla de inicio');
        } else {
          window.toast?.('Si no aparece el diálogo, usa el menú del navegador → Instalar app');
        }
      }catch(_e){}
    });
  });
}

function registerServiceWorker(){
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', ()=>{
    navigator.serviceWorker.register('./sw.js').catch((err)=>{
      console.warn('[PWA] No se pudo registrar service worker', err);
    });
  });
}

setupPWAInstallPrompt();
registerServiceWorker();
