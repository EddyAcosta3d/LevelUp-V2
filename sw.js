'use strict';

// Incrementa SW_VERSION cada vez que haya un cambio importante.
// El navegador detecta el cambio y fuerza la reinstalación.
const SW_VERSION = 'levelup-v2-sw-034';
const IMAGE_FALLBACK = './assets/placeholders/Placeholder_heroes.webp';

function shouldCacheResponse(res){
  return !!res && res.ok && res.status === 200 && res.type !== 'opaque' && res.type !== 'opaqueredirect';
}

function safeCachePut(request, res){
  if (!shouldCacheResponse(res)) return;
  caches.open(SW_VERSION)
    .then((cache) => cache.put(request, res))
    .catch(() => {});
}


function toBypassHttpCacheRequest(req){
  try {
    // Evita que el cache HTTP entregue versiones antiguas cuando hay red.
    return new Request(req, { cache: 'no-store' });
  } catch (_e) {
    return req;
  }
}

const APP_SHELL = [
  './login.html',
  './css/styles.base.css?v=LevelUP_V2_01.00',
  './js/modules/supabase_client.js',
  './js/config.js',
  './assets/logo_full.webp',
  './manifest.webmanifest'
];

// ─── INSTALL ────────────────────────────────────────────────────────────────
// Promise.allSettled: si un archivo falla no aborta la instalación completa.
// cache: 'no-cache' permite revalidar con HTTP cache y evita redescargas completas.
self.addEventListener('install', (event) => {
  const fetchWithTimeout = (url) =>
    Promise.race([
      fetch(new Request(url, { cache: 'no-cache' })),
      new Promise((resolve) => setTimeout(() => resolve(null), 6000))
    ]);

  event.waitUntil(
    caches.open(SW_VERSION).then((cache) => {
      return Promise.allSettled(
        APP_SHELL.map((url) =>
          fetchWithTimeout(url)
            .then((res) => { if (res && shouldCacheResponse(res)) return cache.put(url, res); })
            .catch(() => {})   // ignora silenciosamente archivos no disponibles
        )
      );
    }).then(() => self.skipWaiting())   // toma control de inmediato
  );
});

self.addEventListener('message', (event) => {
  if (event?.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
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
// 8 s balancea rapidez percibida y tolerancia de red antes de caer a caché.
function fetchOrTimeout(req, ms = 8000) {
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
    // No forzamos timeout aquí: en datos móviles variables, cortar a los 15s
    // puede romper inicio de sesión o sincronización aun cuando la red siga viva.
    event.respondWith(fetch(req));
    return;
  }

  // HTML: cache-first + refresh en background para evitar esperas de ~8-10s
  // en datos móviles inestables. Si existe copia en caché, se entrega al instante
  // y se intenta actualizar en segundo plano.
  const isHtml =
    req.destination === 'document' ||
    path.endsWith('.html') ||
    path === '/';

  if (isHtml) {
    event.respondWith(
      caches.match(req, { ignoreSearch: true }).then((cached) => {
        const networkFetch = fetchOrTimeout(toBypassHttpCacheRequest(req), 12000)
          .then((res) => {
            safeCachePut(req, res.clone());
            return res;
          });

        if (cached) {
          event.waitUntil(networkFetch.catch(() => {}));
          return cached;
        }

        // Sin caché: ir a red únicamente, sin fallback a otras páginas.
        return networkFetch;
      })
    );
    return;
  }

  // JS del mismo origen: stale-while-revalidate.
  const isSameOriginJs = url.origin === self.location.origin && path.endsWith('.js');
  if (isSameOriginJs) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const networkPromise = fetchOrTimeout(toBypassHttpCacheRequest(req)).then((res) => {
          safeCachePut(req, res.clone());
          return res;
        });

        if (cached) {
          event.waitUntil(networkPromise.catch(() => {}));
          return cached;
        }

        return networkPromise.catch(() => fetch(req));
      })
    );
    return;
  }

  // CSS: stale-while-revalidate para priorizar velocidad de apertura.
  if (path.endsWith('.css')) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const networkPromise = fetchOrTimeout(toBypassHttpCacheRequest(req))
          .then((res) => {
            safeCachePut(req, res.clone());
            return res;
          });

        if (cached) {
          event.waitUntil(networkPromise.catch(() => {}));
          return cached;
        }
        return networkPromise.catch(() => fetch(req));
      })
    );
    return;
  }

  // data.json: cache-first con revalidación silenciosa
  if (path.endsWith('/data/data.json') || path === '/data/data.json') {
    event.respondWith(
      caches.match(req).then((cached) => {
        const networkPromise = fetchOrTimeout(toBypassHttpCacheRequest(req))
          .then((res) => {
            safeCachePut(req, res.clone());
            return res;
          });

        if (cached) {
          event.waitUntil(networkPromise.catch(() => {}));
          return cached;
        }

        return networkPromise.catch(() => fetch(req));
      })
    );
    return;
  }

  // Google Fonts: cache-first permitiendo respuestas opaque (CORS).
  const isGoogleFont =
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com';

  if (isGoogleFont) {
    const fontCacheKey = req.url;
    event.respondWith(
      caches.match(fontCacheKey).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          if (res && (res.ok || res.type === 'opaque')) {
            caches.open(SW_VERSION).then((cache) => cache.put(fontCacheKey, res.clone())).catch(() => {});
          }
          return res;
        });
      })
    );
    return;
  }

  // Imágenes del mismo origen: cache-first puro.
  const isSameOriginImage = url.origin === self.location.origin && req.destination === 'image';

  if (isSameOriginImage) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetchOrTimeout(req, 12000)
          .then((res) => {
            safeCachePut(req, res.clone());
            return res;
          })
          .catch(async () => {
            const fallback = await caches.match(IMAGE_FALLBACK, { ignoreSearch: true });
            if (fallback) return fallback;
            throw new Error('image-fetch-failed');
          });
      })
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
