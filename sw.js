'use strict';

// Incrementa SW_VERSION cada vez que haya un cambio importante.
// El navegador detecta el cambio y fuerza la reinstalación.
const SW_VERSION = 'levelup-v2-sw-014';

function shouldCacheResponse(res){
  return !!res && res.ok && res.status === 200 && res.type !== 'opaque' && res.type !== 'opaqueredirect';
}

function safeCachePut(request, res){
  if (!shouldCacheResponse(res)) return;
  caches.open(SW_VERSION)
    .then((cache) => cache.put(request, res))
    .catch(() => {});
}

const APP_SHELL = [
  './',
  './index.html',
  './login.html',
  './manifest.webmanifest',
  './css/styles.base.css',
  './css/styles.challenges.css',
  './css/styles.levelup.css',
  './css/styles.mobile.css',
  './css/styles.splash.css',
  './css/styles.tienda.css',
  './css/styles.celebrations.css',
  './css/styles.viewmode.css',
  './js/splash.js',
  './js/modules/ui_shell.js',
  './js/modules/parallax_manifest.js',
  './js/app.main.js',
  './js/app.bindings.js',
  './js/modules/core_globals.js',
  './js/modules/store.js',
  './js/modules/app_actions.js',
  './js/modules/fichas.js',
  './js/modules/desafios.js',
  './js/modules/eventos.js',
  './js/modules/tienda.js',
  './js/modules/celebrations.js',
  './js/modules/hero_session.js',
  './js/modules/student_actions.js',
  './js/modules/github_sync.js',
  './js/modules/supabase_client.js',
  './js/config.js',
  './assets/logo.png',
  './assets/logo_small.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './data/data.json'
];

// ─── INSTALL ────────────────────────────────────────────────────────────────
// Promise.allSettled: si un archivo falla no aborta la instalación completa.
// cache: 'reload' evita leer el caché HTTP anterior al precachear.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SW_VERSION).then((cache) => {
      return Promise.allSettled(
        APP_SHELL.map((url) =>
          fetch(new Request(url, { cache: 'reload' }))
            .then((res) => { if (shouldCacheResponse(res)) return cache.put(url, res); })
            .catch(() => {})   // ignora silenciosamente archivos no disponibles
        )
      );
    }).then(() => self.skipWaiting())   // toma control de inmediato
  );
});

// ─── ACTIVATE ───────────────────────────────────────────────────────────────
// Borra todos los cachés anteriores para que no sirvan archivos rotos.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== SW_VERSION).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

// Race a fetch against a timeout so network-first handlers never hang forever.
// 5 s is enough for a slow campus WiFi; cached fallback kicks in after that.
function fetchOrTimeout(req, ms = 5000) {
  return Promise.race([
    fetch(req),
    new Promise((_, reject) => setTimeout(() => reject(new Error('sw-timeout')), ms))
  ]);
}

// ─── FETCH ──────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  if (req.headers.has('range')) return;

  const url = new URL(req.url);
  if (!/^https?:$/.test(url.protocol)) return;
  const path = url.pathname;

  // Supabase API/Auth/Storage: siempre red (sin caché) para evitar
  // estado stale en asignaciones, sesiones y evidencias.
  const isSupabaseApi =
    url.hostname.endsWith('supabase.co') &&
    (path.startsWith('/rest/v1/') || path.startsWith('/auth/v1/') || path.startsWith('/storage/v1/'));

  if (isSupabaseApi) {
    event.respondWith(fetch(req));
    return;
  }

  // HTML y JS: network-first → nunca sirve archivos rotos del caché
  // mientras haya conexión.
  const isHtmlOrJs =
    req.destination === 'document' ||
    path.endsWith('.html') ||
    path.endsWith('.js') ||
    path === '/';

  if (isHtmlOrJs) {
    event.respondWith(
      fetchOrTimeout(req)
        .then((res) => {
          safeCachePut(req, res.clone());
          return res;
        })
        .catch(async () => {
          return (
            (await caches.match(req, { ignoreSearch: true })) ||
            (await caches.match('./index.html')) ||
            (await caches.match('./login.html'))
          );
        })
    );
    return;
  }

  // CSS: network-first para que cambios visuales se reflejen sin depender
  // de cache-busting manual en cada release.
  if (path.endsWith('.css')) {
    event.respondWith(
      fetchOrTimeout(req)
        .then((res) => {
          safeCachePut(req, res.clone());
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // data.json: network-first con fallback a caché
  if (path.endsWith('/data/data.json') || path === '/data/data.json') {
    event.respondWith(
      fetchOrTimeout(req)
        .then((res) => {
          safeCachePut(req, res.clone());
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Google Fonts: cache-first permitiendo respuestas opaque (CORS).
  const isGoogleFont =
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com';

  if (isGoogleFont) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          if (res && (res.ok || res.type === 'opaque')) {
            caches.open(SW_VERSION).then((cache) => cache.put(req, res.clone())).catch(() => {});
          }
          return res;
        });
      })
    );
    return;
  }

  // Todas las imágenes del mismo origen: network-first para que, al reemplazar
  // archivos en el repo con la misma ruta, se refresquen en cualquier dispositivo.
  const isSameOriginImage = url.origin === self.location.origin && req.destination === 'image';

  if (isSameOriginImage) {
    event.respondWith(
      fetchOrTimeout(req)
        .then((res) => {
          safeCachePut(req, res.clone());
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Otros assets estáticos: cache-first
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        safeCachePut(req, res.clone());
        return res;
      });
    })
  );
});
