'use strict';

/**
 * @module realtime_sync
 * @description Sincronización en tiempo real de asignaciones de desafíos.
 *
 * Usa polling cada POLL_INTERVAL_MS contra Supabase (tabla hero_assignments).
 * Cuando detecta cambios en las asignaciones del héroe activo, actualiza el
 * estado local y llama al callback proporcionado (típicamente renderChallenges).
 *
 * USO:
 *   startAssignmentSync('h_2d_3', () => renderChallenges());
 *   stopAssignmentSync(); // al logout o unmount
 */

import { getHeroAssignments } from './supabase_client.js';
import { state } from './core_globals.js';
import { saveLocal } from './store.js';

const POLL_INTERVAL_MS = 1200;

let _pollTimer = null;
let _pollAllTimer = null;
let _lastSnapshot = null; // JSON stringificado de asignaciones, para detectar cambios
let _lastAllSnapshot = null;
let _warnedStudentSync = false;
let _warnedTeacherSync = false;
const _pendingAssignmentMutations = new Map();

function _mutationKey(heroId, challengeId){
  return `${String(heroId || '')}::${String(challengeId || '')}`;
}

export function markAssignmentMutationPending(heroId, challengeId, assigning){
  if (!heroId || !challengeId) return;
  _pendingAssignmentMutations.set(_mutationKey(heroId, challengeId), !!assigning);
}

export function clearAssignmentMutationPending(heroId, challengeId){
  if (!heroId || !challengeId) return;
  _pendingAssignmentMutations.delete(_mutationKey(heroId, challengeId));
}

function _applyPendingMutations(heroId, challengeIds){
  const effective = new Set((Array.isArray(challengeIds) ? challengeIds : []).map(x => String(x)));
  const prefix = `${String(heroId || '')}::`;

  _pendingAssignmentMutations.forEach((assigning, key) => {
    if (!key.startsWith(prefix)) return;
    const challengeId = key.slice(prefix.length);
    if (!challengeId) return;
    if (assigning) effective.add(challengeId);
    else effective.delete(challengeId);
  });

  return Array.from(effective);
}

// ============================================
// Sync para ALUMNO — solo carga su propio héroe
// ============================================

export function startAssignmentSync(heroId, onUpdate) {
  if (_pollTimer) return; // ya corriendo

  async function poll() {
    try {
      const challengeIds = await getHeroAssignments(heroId);
      const effectiveIds = _applyPendingMutations(heroId, challengeIds);
      const snapshot = JSON.stringify(effectiveIds.slice().sort());

      if (snapshot !== _lastSnapshot) {
        _lastSnapshot = snapshot;

        // Actualizar el héroe en state.data
        const heroes = state.data?.heroes || [];
        const hero = heroes.find(h => h.id === heroId);
        if (hero) {
          hero.assignedChallenges = effectiveIds;
          saveLocal(state.data);
          if (typeof onUpdate === 'function') onUpdate();
        }
      }
    } catch (e) {
      if (!_warnedStudentSync) {
        _warnedStudentSync = true;
        console.warn('[Sync alumno] No se pudo leer asignaciones.', e?.message || e);
      }
    }
  }

  // Primera llamada inmediata para que el alumno vea asignaciones al abrir la app
  poll();
  _pollTimer = setInterval(poll, POLL_INTERVAL_MS);
}

export function stopAssignmentSync() {
  if (_pollTimer) {
    clearInterval(_pollTimer);
    _pollTimer = null;
  }
  _lastSnapshot = null;
}

export function startAllAssignmentsSync(onUpdate) {
  if (_pollAllTimer) return;

  async function pollAll() {
    try {
      const heroes = state.data?.heroes || [];
      const heroIds = heroes.map(h => String(h.id || '')).filter(Boolean);
      if (!heroIds.length) return;

      // Leer asignaciones por héroe evita inconsistencias de RLS/SELECT global.
      const settled = await Promise.allSettled(heroIds.map(heroId => getHeroAssignments(heroId)));
      const byHero = {};
      settled.forEach((res, idx) => {
        const heroId = heroIds[idx];
        if (res.status !== 'fulfilled') return;
        byHero[heroId] = Array.isArray(res.value) ? res.value.map(x => String(x)) : [];
      });

      const snapshot = JSON.stringify(
        heroIds
          .sort()
          .map(heroId => {
            const hero = heroes.find(h => String(h.id) === heroId);
            const base = Object.prototype.hasOwnProperty.call(byHero, heroId)
              ? byHero[heroId]
              : (Array.isArray(hero?.assignedChallenges) ? hero.assignedChallenges : []);
            return [heroId, base.slice().sort()];
          })
      );
      if (snapshot === _lastAllSnapshot) return;
      _lastAllSnapshot = snapshot;

      heroes.forEach(hero => {
        if (!Object.prototype.hasOwnProperty.call(byHero, hero.id)) return;
        hero.assignedChallenges = _applyPendingMutations(
          hero.id,
          Array.isArray(byHero[hero.id]) ? byHero[hero.id] : []
        );
      });
      saveLocal(state.data);
      if (typeof onUpdate === 'function') onUpdate();
    } catch (e) {
      if (!_warnedTeacherSync) {
        _warnedTeacherSync = true;
        console.warn('[Sync profe] No se pudo leer hero_assignments. Revisa RLS/credenciales.', e?.message || e);
      }
    }
  }

  pollAll();
  _pollAllTimer = setInterval(pollAll, POLL_INTERVAL_MS);
}

export function stopAllAssignmentsSync() {
  if (_pollAllTimer) {
    clearInterval(_pollAllTimer);
    _pollAllTimer = null;
  }
  _lastAllSnapshot = null;
}

// ============================================
// Carga inicial para ALUMNO — antes del primer render
// Evita que el alumno vea "bloqueado" hasta que llega el primer poll
// ============================================

export async function preloadStudentAssignments(heroId) {
  try {
    const challengeIds = await getHeroAssignments(heroId);
    const heroes = state.data?.heroes || [];
    const hero = heroes.find(h => h.id === heroId);
    if (hero) {
      hero.assignedChallenges = _applyPendingMutations(heroId, challengeIds);
      saveLocal(state.data);
    }
  } catch(_e) {
    // Fallo silencioso — usará los datos locales
  }
}

// ============================================
// Carga inicial — para el profe al abrir la app
// Merge de Supabase → state.data (todos los héroes)
// ============================================

export async function loadAllAssignmentsIntoState() {
  try {
    const heroes = state.data?.heroes || [];
    const heroIds = heroes.map(h => String(h.id || '')).filter(Boolean);
    if (!heroIds.length) return;

    const byHero = {};
    const settled = await Promise.allSettled(heroIds.map(heroId => getHeroAssignments(heroId)));
    settled.forEach((res, idx) => {
      if (res.status !== 'fulfilled') return;
      const heroId = heroIds[idx];
      byHero[heroId] = Array.isArray(res.value) ? res.value.map(x => String(x)) : [];
    });

    // Supabase es la fuente de verdad: si un héroe no tiene filas,
    // su lista debe quedar vacía (desafíos bloqueados), pero solo
    // cuando logramos leer ese héroe en esta ronda.
    heroes.forEach(hero => {
      if (!Object.prototype.hasOwnProperty.call(byHero, hero.id)) return;
      hero.assignedChallenges = _applyPendingMutations(hero.id, Array.isArray(byHero[hero.id]) ? byHero[hero.id] : []);
    });

    saveLocal(state.data);
  } catch (e) {
    if (!_warnedTeacherSync) {
      _warnedTeacherSync = true;
      console.warn('[Sync inicial profe] Falló carga de hero_assignments. Se mantienen datos locales.', e?.message || e);
    }
  }
}
