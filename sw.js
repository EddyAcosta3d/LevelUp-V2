'use strict';

const SW_VERSION = 'levelup-v2-sw-002';
const APP_SHELL = [
  './',
  './index.html',
  './login.html',
  './manifest.webmanifest',
  './css/styles.base.css?v=LevelUP_V2_00.069',
  './css/styles.challenges.css?v=LevelUP_V2_00.069',
  './css/styles.levelup.css?v=LevelUP_V2_00.069',
  './css/styles.mobile.css?v=LevelUP_V2_00.069',
  './css/styles.splash.css?v=LevelUP_V2_00.069',
  './css/styles.tienda.css?v=LevelUP_V2_00.069',
  './css/styles.celebrations.css?v=LevelUP_V2_00.069',
  './css/styles.viewmode.css?v=LevelUP_V2_00.069',
  './css/styles.projector.css?v=LevelUP_V2_00.069',
  './js/app.main.js?v=LevelUP_V2_00.070',
  './js/app.bindings.js?v=LevelUP_V2_00.070',
  './js/splash.js?v=LevelUP_V2_00.070',
  './js/modules/core_globals.js?v=LevelUP_V2_00.070',
  './js/modules/store.js?v=LevelUP_V2_00.070',
  './js/modules/ui_shell.js?v=LevelUP_V2_00.070',
  './js/modules/parallax_manifest.js?v=LevelUP_V2_00.070',
  './js/modules/app_actions.js?v=LevelUP_V2_00.070',
  './js/modules/fichas.js?v=LevelUP_V2_00.070',
  './js/modules/desafios.js?v=LevelUP_V2_00.070',
  './js/modules/eventos.js?v=LevelUP_V2_00.070',
  './js/modules/tienda.js?v=LevelUP_V2_00.070',
  './js/modules/celebrations.js?v=LevelUP_V2_00.070',
  './js/modules/hero_session.js?v=LevelUP_V2_00.070',
  './js/modules/student_actions.js?v=LevelUP_V2_00.070',
  './js/modules/github_sync.js?v=LevelUP_V2_00.070',
  './js/modules/projector.js?v=LevelUP_V2_00.070',
  './js/modules/supabase_client.js?v=LevelUP_V2_00.070',
  './assets/logo.png',
  './assets/logo_small.png',
  './data/data.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SW_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== SW_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Datos dinámicos: network-first con fallback a caché
  if (url.pathname.endsWith('/data/data.json') || url.pathname === '/data/data.json') {
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

  // App shell/assets: cache-first
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(SW_VERSION).then((cache) => cache.put(req, copy));
        return res;
      });
    })
  );
});
