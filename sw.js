'use strict';

const SW_VERSION = 'levelup-v2-sw-001';
const APP_SHELL = [
  './',
  './index.html',
  './login.html',
  './manifest.webmanifest',
  './css/styles.base.css?v=LevelUP_V2_00.069',
  './css/styles.challenges.css?v=LevelUP_V2_00.069',
  './css/styles.levelup.css?v=LevelUP_V2_00.069',
  './css/styles.mobile.css?v=LevelUP_V2_00.069',
  './js/app.main.js?v=LevelUP_V2_00.070',
  './js/app.bindings.js',
  './js/modules/core_globals.js',
  './js/modules/store.js',
  './assets/logo.png',
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
