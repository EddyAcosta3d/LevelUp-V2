'use strict';

/**
 * @module realtime_sync
 * @description Sincronización en tiempo real de asignaciones de desafíos.
 *
 * Usa polling contra Supabase (tabla hero_assignments) con intervalos distintos
 * según el rol para no saturar la API:
 *   - Alumno: cada POLL_INTERVAL_STUDENT_MS (10s) — detecta nuevas asignaciones sin saturar la API
 *   - Profe:  cada POLL_INTERVAL_TEACHER_MS  (30s) — ya ve actualizaciones optimistas
 *             inmediatas al asignar; el polling solo confirma el estado remoto.
 *             Usa una sola request por ciclo (in(...) con todos los hero_id) para reducir costo.
 *
 * USO:
 *   startAssignmentSync('h_2d_3', () => renderChallenges());
 *   stopAssignmentSync(); // al logout o unmount
 */

import { getHeroAssignments, getHeroAssignmentsForHeroes } from './supabase_client.js';
import { state } from './core_globals.js';
import { saveLocal } from './store.js';

// Alumno: 10 s — mantiene detección rápida (<10 s) sin saturar Supabase.
const POLL_INTERVAL_STUDENT_MS = 10000;
// Profe: 30 s — cada tick hace una sola petición para todos los héroes.
// Un intervalo algo largo reduce aún más costo de red sin afectar la experiencia,
// porque la UI del profe usa actualizaciones optimistas inmediatas.
const POLL_INTERVAL_TEACHER_MS = 30000;


function getConnectionHints(){
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  return {
    saveData: !!conn?.saveData,
    effectiveType: String(conn?.effectiveType || '').toLowerCase(),
    hidden: typeof document !== 'undefined' ? !!document.hidden : false,
    online: typeof navigator !== 'undefined' ? navigator.onLine !== false : true
  };
}

function getAdaptiveIntervalMs(baseMs, role){
  const hints = getConnectionHints();
  let interval = baseMs;

  // Respeta ahorro de datos y redes lentas móviles.
  if (hints.saveData || hints.effectiveType === 'slow-2g' || hints.effectiveType === '2g') {
    interval = Math.max(interval, role === 'student' ? 25000 : 60000);
  } else if (hints.effectiveType === '3g') {
    interval = Math.max(interval, role === 'student' ? 15000 : 45000);
  }

  // Si la pestaña no está visible, bajar frecuencia evita consumo innecesario.
  if (hints.hidden) interval = Math.max(interval, baseMs * 3);

  // Si está offline, no hace falta insistir tan seguido.
  if (!hints.online) interval = Math.max(interval, 60000);

  return interval;
}

let _pollTimer = null;
let _pollAllTimer = null;
let _studentSyncRunning = false;
let _teacherSyncRunning = false;
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
  if (_studentSyncRunning) return; // ya corriendo
  _studentSyncRunning = true;

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
      // Reset on every successful network call so future errors get logged again
      _warnedStudentSync = false;
    } catch (e) {
      if (!_warnedStudentSync) {
        _warnedStudentSync = true;
        console.warn('[Sync alumno] No se pudo leer asignaciones.', e?.message || e);
      }
    }
  }

  async function pollAndSchedule(){
    await poll();
    if (!_studentSyncRunning) return;
    _pollTimer = setTimeout(pollAndSchedule, getAdaptiveIntervalMs(POLL_INTERVAL_STUDENT_MS, 'student'));
  }

  // Primera llamada inmediata para que el alumno vea asignaciones al abrir la app
  pollAndSchedule();
}

export function stopAssignmentSync() {
  _studentSyncRunning = false;
  if (_pollTimer) {
    clearTimeout(_pollTimer);
    _pollTimer = null;
  }
  _lastSnapshot = null;
  _warnedStudentSync = false; // reset so errors show again on next sync start
}

export function startAllAssignmentsSync(onUpdate) {
  if (_teacherSyncRunning) return;
  _teacherSyncRunning = true;

  async function pollAll() {
    try {
      const heroes = state.data?.heroes || [];
      const heroIds = heroes.map(h => String(h.id || '')).filter(Boolean);
      if (!heroIds.length) return;

      // Una sola lectura para todos los héroes (reduce N requests -> 1 request por ciclo).
      const rows = await getHeroAssignmentsForHeroes(heroIds);
      const byHero = {};
      rows.forEach(row => {
        const heroId = String(row.hero_id || '');
        if (!heroId) return;
        if (!Object.prototype.hasOwnProperty.call(byHero, heroId)) byHero[heroId] = [];
        byHero[heroId].push(String(row.challenge_id));
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
        // Si un héroe no aparece en la respuesta, no lo tocamos para evitar
        // bloquear por error cuando RLS/visibilidad oculta filas en este fetch global.
        if (!Object.prototype.hasOwnProperty.call(byHero, hero.id)) return;
        hero.assignedChallenges = _applyPendingMutations(
          hero.id,
          Array.isArray(byHero[hero.id]) ? byHero[hero.id] : []
        );
      });
      saveLocal(state.data);
      if (typeof onUpdate === 'function') onUpdate();
      // Reset on every successful round so future errors get logged again
      _warnedTeacherSync = false;
    } catch (e) {
      if (!_warnedTeacherSync) {
        _warnedTeacherSync = true;
        console.warn('[Sync profe] No se pudo leer hero_assignments. Revisa RLS/credenciales.', e?.message || e);
      }
    }
  }

  async function pollAllAndSchedule(){
    await pollAll();
    if (!_teacherSyncRunning) return;
    _pollAllTimer = setTimeout(pollAllAndSchedule, getAdaptiveIntervalMs(POLL_INTERVAL_TEACHER_MS, 'teacher'));
  }

  // Profe: diferir primer poll 3 s para no competir con el render inicial.
  _pollAllTimer = setTimeout(pollAllAndSchedule, 3000);
}

export function stopAllAssignmentsSync() {
  _teacherSyncRunning = false;
  if (_pollAllTimer) {
    clearTimeout(_pollAllTimer);
    _pollAllTimer = null;
  }
  _lastAllSnapshot = null;
  _warnedTeacherSync = false; // reset so errors show again on next sync start
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
  } catch(e) {
    // Non-fatal: the app will use locally cached assignments until the next poll
    console.warn('[preload alumno] Falló carga inicial de asignaciones, se usarán datos locales.', e?.message || e);
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

    const rows = await getHeroAssignmentsForHeroes(heroIds);
    const byHero = {};
    rows.forEach(row => {
      const heroId = String(row.hero_id || '');
      if (!heroId) return;
      if (!Object.prototype.hasOwnProperty.call(byHero, heroId)) byHero[heroId] = [];
      byHero[heroId].push(String(row.challenge_id));
    });

    // Supabase es la fuente de verdad: si un héroe no tiene filas,
    // su lista debe quedar vacía (desafíos bloqueados), pero solo
    // cuando logramos leer ese héroe en esta ronda.
    heroes.forEach(hero => {
      // Si un héroe no aparece en la respuesta, no lo tocamos para evitar
      // bloquear por error cuando RLS/visibilidad oculta filas en este fetch global.
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
