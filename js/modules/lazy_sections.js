'use strict';

/**
 * @module lazy_sections
 * @description Lazy-load route modules that are not needed for first paint.
 */

const loaders = {
  eventos: () => import('./eventos.js'),
  tienda: () => import('./tienda.js')
};

const loadedModules = new Map();
const pendingLoads = new Map();

export function getLazySectionModule(route){
  return loadedModules.get(String(route || '')) || null;
}

export function ensureLazySection(route){
  const key = String(route || '');
  const loader = loaders[key];
  if (!loader) return Promise.resolve(null);
  if (loadedModules.has(key)) return Promise.resolve(loadedModules.get(key));
  if (pendingLoads.has(key)) return pendingLoads.get(key);

  const promise = loader()
    .then((mod) => {
      loadedModules.set(key, mod);
      pendingLoads.delete(key);
      return mod;
    })
    .catch((err) => {
      pendingLoads.delete(key);
      throw err;
    });

  pendingLoads.set(key, promise);
  return promise;
}

