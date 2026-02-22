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

import { getHeroAssignments, getAllHeroAssignments } from './supabase_client.js';
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
const PENDING_MUTATION_TTL_MS = 5000;

function _pendingKey(heroId, challengeId) {
  return `${String(heroId)}::${String(challengeId)}`;
}

function _cleanupExpiredPendingMutations(now = Date.now()) {
  for (const [key, value] of _pendingAssignmentMutations.entries()) {
    if (!value || Number(value.expiresAt || 0) <= now) {
      _pendingAssignmentMutations.delete(key);
    }
  }
}

function _applyPendingMutations(heroId, remoteIds) {
  const base = new Set((Array.isArray(remoteIds) ? remoteIds : []).map(x => String(x)));
  const now = Date.now();
  _cleanupExpiredPendingMutations(now);

  for (const [key, value] of _pendingAssignmentMutations.entries()) {
    const [hId, chId] = key.split('::');
    if (String(hId) !== String(heroId)) continue;
    if (!value || Number(value.expiresAt || 0) <= now) continue;
    if (value.assigning) base.add(String(chId));
    else base.delete(String(chId));
  }

  return Array.from(base);
}

export function markAssignmentMutationPending(heroId, challengeId, assigning) {
  _pendingAssignmentMutations.set(_pendingKey(heroId, challengeId), {
    assigning: !!assigning,
    expiresAt: Date.now() + PENDING_MUTATION_TTL_MS
  });
}

export function clearAssignmentMutationPending(heroId, challengeId) {
  _pendingAssignmentMutations.delete(_pendingKey(heroId, challengeId));
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
      const rows = await getAllHeroAssignments();
      if (!Array.isArray(rows)) return;

      const byHero = {};
      rows.forEach(({ hero_id, challenge_id }) => {
        const heroId = String(hero_id || '');
        if (!heroId) return;
        if (!byHero[heroId]) byHero[heroId] = [];
        byHero[heroId].push(String(challenge_id));
      });

      const heroes = state.data?.heroes || [];
      heroes.forEach(hero => {
        byHero[hero.id] = _applyPendingMutations(hero.id, byHero[hero.id] || []);
      });

      const snapshot = JSON.stringify(
        Object.keys(byHero)
          .sort()
          .map(heroId => [heroId, byHero[heroId].slice().sort()])
      );
      if (snapshot === _lastAllSnapshot) return;
      _lastAllSnapshot = snapshot;

      heroes.forEach(hero => {
        hero.assignedChallenges = _applyPendingMutations(hero.id, Array.isArray(byHero[hero.id]) ? byHero[hero.id] : []);
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
    const rows = await getAllHeroAssignments();
    if (!Array.isArray(rows)) return;

    const heroes = state.data?.heroes || [];

    // Agrupar por hero_id
    const byHero = {};
    rows.forEach(({ hero_id, challenge_id }) => {
      if (!byHero[hero_id]) byHero[hero_id] = [];
      byHero[hero_id].push(String(challenge_id));
    });

    // Supabase es la fuente de verdad: si un héroe no tiene filas,
    // su lista debe quedar vacía (desafíos bloqueados).
    heroes.forEach(hero => {
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
