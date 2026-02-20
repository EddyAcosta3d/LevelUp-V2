'use strict';

// Incrementa SW_VERSION cada vez que haya un cambio importante.
// El navegador detecta el cambio y fuerza la reinstalación.
const SW_VERSION = 'levelup-v2-sw-004';

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
  './css/styles.projector.css',
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
  './js/modules/projector.js',
  './js/modules/supabase_client.js',
  './assets/logo.png',
  './assets/logo_small.png',
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
            .then((res) => { if (res.ok) return cache.put(url, res); })
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

// ─── FETCH ──────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (!/^https?:$/.test(url.protocol)) return;
  const path = url.pathname;

  // HTML y JS: network-first → nunca sirve archivos rotos del caché
  // mientras haya conexión.
  const isHtmlOrJs =
    req.destination === 'document' ||
    path.endsWith('.html') ||
    path.endsWith('.js') ||
    path === '/';

  if (isHtmlOrJs) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(SW_VERSION).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req))   // fallback offline: caché
    );
    return;
  }

  // data.json: network-first con fallback a caché
  if (path.endsWith('/data/data.json') || path === '/data/data.json') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(SW_VERSION).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // CSS, imágenes, assets: cache-first (cambian raramente)
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(SW_VERSION).then((cache) => cache.put(req, copy));
        }
        return res;
      });
    })
  );
});
