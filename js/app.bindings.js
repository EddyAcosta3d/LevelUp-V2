'use strict';

/**
 * @module app.bindings
 * @description Event bindings and UI orchestration
 */

import { state, ROUTE, DIFFICULTY } from './modules/core_globals.js?v=LevelUP_V2_01.00';
import { loadData } from './modules/store.js?v=LevelUP_V2_01.00';
import { renderAll, handleImportJson, handleExportJson, handleExportCsv, bumpHeroXp, setRole } from './modules/app_actions.js?v=LevelUP_V2_01.00';
import { renderChallenges, openChallengeModal, saveNewChallenge, closeChallengeModal } from './modules/desafios.js?v=LevelUP_V2_01.00';
import { toggleSubjectDropdown, currentHero, renderHeroDetail } from './modules/fichas.js?v=LevelUP_V2_01.00';
import { ensureLazySection, getLazySectionModule } from './modules/lazy_sections.js';
import { saveToGitHub, testGitHubConnection, setGitHubToken, clearGitHubToken } from './modules/github_sync.js';
import { initStudentActions } from './modules/student_actions.js';
import { getSession } from './modules/hero_session.js';

function safeCall(fn, ...args){
  try{ if (typeof fn === 'function') return fn(...args); }catch(_e){}
  return undefined;
}

/**
 * Actualiza el indicador de estado del último guardado en GitHub
 * dentro del dropdown de Datos.
 * @param {{ ok: boolean, savedAt?: Date, error?: string }} status
 */
function _updateGitHubSaveStatus({ ok, savedAt, error } = {}) {
  const statusEl = document.getElementById('githubSaveStatus');
  const btnDatos = document.getElementById('btnDatos');
  if (!statusEl) return;

  if (ok && savedAt) {
    const timeStr = savedAt.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    statusEl.textContent = `✅ Guardado a las ${timeStr}`;
    statusEl.className = 'menuitem menuitem--status menuitem--status-ok';
    btnDatos?.classList.remove('has-save-error');
  } else {
    const msg = error || 'Error al guardar';
    // Truncate long messages for the status line (full message was shown in toast)
    statusEl.textContent = `⚠️ ${msg.length > 80 ? msg.slice(0, 77) + '…' : msg}`;
    statusEl.className = 'menuitem menuitem--status menuitem--status-error';
    btnDatos?.classList.add('has-save-error');
  }
  statusEl.hidden = false;
}

async function activateRoute(route){
  if (!route) return;

  if (route === ROUTE.EVENTOS || route === ROUTE.TIENDA) {
    try {
      const mod = await ensureLazySection(route);
      if (route === ROUTE.TIENDA && typeof mod?.bindTiendaEvents === 'function') {
        mod.bindTiendaEvents();
      }
    } catch (_e) {
      safeCall(window.toast, '⚠️ No se pudo cargar esta sección');
    }
  }

  state.route = route;
  if (typeof window.setActiveRoute === 'function') {
    window.setActiveRoute(route);
  } else {
    document.querySelectorAll('.page').forEach(p=>p.classList.toggle('is-active', p.dataset.page===route));
    document.querySelectorAll('.pill[data-route]').forEach(b=>b.classList.toggle('is-active', b.dataset.route===route));
    document.querySelectorAll('#bottomNav .bottomNav__btn').forEach(b=>b.classList.toggle('is-active', b.dataset.route===route));
  }

  if (route === ROUTE.EVENTOS) {
    const eventosModule = getLazySectionModule(ROUTE.EVENTOS);
    if (typeof eventosModule?.renderEvents === 'function') safeCall(eventosModule.renderEvents);
  }
  if (route === ROUTE.TIENDA) {
    const tiendaModule = getLazySectionModule(ROUTE.TIENDA);
    if (typeof tiendaModule?.renderTienda === 'function') safeCall(tiendaModule.renderTienda);
  }
}

export function bind(){
  // Exponer renderChallenges globalmente para que realtime_sync pueda usarla
  window.renderChallenges = renderChallenges;

  document.querySelectorAll('.segmented__btn[data-group]').forEach((btn)=>{
    const isActive = String(btn.dataset.group || '').trim() === String(state.group || '2D');
    btn.classList.toggle('is-active', isActive);
    btn.setAttribute('aria-selected', String(isActive));
  });

  document.querySelectorAll('[data-route]').forEach(btn=>{
    // Recompensas has its own toggle handler (go/reverse).
    // Skip generic route binding to avoid double navigation on click.
    if (btn.id === 'btnRecompensas' || btn.id === 'btnMobileRewards') return;
    btn.addEventListener('click', ()=> { void activateRoute(btn.dataset.route); });
  });

  document.getElementById('btnMenu')?.addEventListener('click', ()=> safeCall(window.openDrawer));
  document.getElementById('overlay')?.addEventListener('click', ()=> safeCall(window.closeDrawer));

  document.getElementById('btnDebugPanel')?.addEventListener('click', ()=> safeCall(window.toggleDetails));

  document.getElementById('btnDatos')?.addEventListener('click', (e)=>{
    e.preventDefault();
    safeCall(window.toggleDatos);
  });

  document.addEventListener('click', (e)=>{
    const inDropdown = e.target && e.target.closest && e.target.closest('.dropdown');
    if (!inDropdown) safeCall(window.closeDatos);
    if (!inDropdown) {
      const challengeDd = document.getElementById('btnChallengeAdminMenu')?.closest('.dropdown');
      if (challengeDd) challengeDd.classList.remove('is-open');
      document.getElementById('btnChallengeAdminMenu')?.setAttribute('aria-expanded', 'false');
    }
  });

  document.getElementById('btnChallengeAdminMenu')?.addEventListener('click', (e)=>{
    e.preventDefault();
    const dd = document.getElementById('btnChallengeAdminMenu')?.closest('.dropdown');
    if (!dd) return;
    const next = !dd.classList.contains('is-open');
    dd.classList.toggle('is-open', next);
    document.getElementById('btnChallengeAdminMenu')?.setAttribute('aria-expanded', String(next));
  });

  document.getElementById('btnReloadRemote')?.addEventListener('click', ()=> loadData({ forceRemote: true, renderAll }));
  document.getElementById('btnAdminPanel')?.addEventListener('click', ()=> {
    window.location.href = 'admin_panel.html';
  });
  document.getElementById('btnImportJson')?.addEventListener('click', ()=> document.getElementById('fileImport')?.click());
  document.getElementById('btnExportJson')?.addEventListener('click', ()=> safeCall(handleExportJson));
  document.getElementById('btnExportCsv')?.addEventListener('click', ()=> safeCall(handleExportCsv));

  document.getElementById('fileImport')?.addEventListener('change', async (e)=>{
    const file = e.target?.files?.[0];
    if (file) await handleImportJson(file);
    e.target.value = '';
  });

  // Rewards button - toggle between rewards and previous route
  let previousRoute = ROUTE.FICHAS; // Default fallback route

  const handleRewardsToggle = ()=> {
    if (state.route === ROUTE.RECOMPENSAS) {
      // If we're already on rewards, go back to previous route
      void activateRoute(previousRoute);
    } else {
      // Save current route before switching to rewards
      previousRoute = state.route || ROUTE.FICHAS;
      void activateRoute(ROUTE.RECOMPENSAS);
    }
  };

  document.getElementById('btnRecompensas')?.addEventListener('click', handleRewardsToggle);
  document.getElementById('btnMobileRewards')?.addEventListener('click', handleRewardsToggle);

  // XP buttons - modify hero experience points
  document.getElementById('btnXpP1')?.addEventListener('click', ()=> bumpHeroXp(1));
  document.getElementById('btnXpP5')?.addEventListener('click', ()=> bumpHeroXp(5));
  document.getElementById('btnXpM1')?.addEventListener('click', ()=> bumpHeroXp(-1));
  document.getElementById('btnXpM5')?.addEventListener('click', ()=> bumpHeroXp(-5));

  // Quick activity chips (+Participación/+Trabajos/+Tareas)
  document.querySelectorAll('#actChips [data-xp]').forEach((btn)=>{
    btn.addEventListener('click', ()=>{
      const delta = Number(btn.dataset.xp || 0);
      if (!Number.isFinite(delta) || delta === 0) return;
      bumpHeroXp(delta, { source: 'activity' });
    });
  });

  // Group segmented control (2D/3D)
  document.querySelectorAll('.segmented__btn[data-group]').forEach((btn)=>{
    btn.addEventListener('click', ()=>{
      // En student-mode el selector está oculto por CSS.
      // Si el control está visible, permitir cambiar de grupo.
      if (document.body.classList.contains('student-mode')) return;

      const nextGroup = String(btn.dataset.group || '').trim();
      if (!nextGroup || state.group === nextGroup) return;

      state.group = nextGroup;

      document.querySelectorAll('.segmented__btn[data-group]').forEach((other)=>{
        const isActive = other === btn;
        other.classList.toggle('is-active', isActive);
        other.setAttribute('aria-selected', String(isActive));
      });

      safeCall(renderAll);
    });
  });

  // Subject dropdown button in Desafíos
  document.getElementById('btnSubject')?.addEventListener('click', ()=> safeCall(toggleSubjectDropdown));

  // Edit mode is controlled by authenticated admin session only (cuenta Eddy).
  // No manual toggle button.

  // GitHub configuration and save buttons
  document.getElementById('btnConfigGitHub')?.addEventListener('click', ()=> {
    if (typeof window.openGitHubConfigModal === 'function') {
      window.openGitHubConfigModal();
    }
  });

  document.getElementById('btnSaveToGitHub')?.addEventListener('click', async ()=> {
    const toast = window.toast || ((msg)=> console.log(msg));
    const btn = document.getElementById('btnSaveToGitHub');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Guardando…'; }
    try {
      const result = await saveToGitHub({
        onProgress: (msg) => toast(msg)
      });
      if (result.success) {
        toast('✅ ' + result.message);
        _updateGitHubSaveStatus({ ok: true, savedAt: new Date() });
      } else {
        toast('❌ ' + result.message);
        _updateGitHubSaveStatus({ ok: false, error: result.message });
      }
    } catch (error) {
      toast('❌ Error al guardar en GitHub');
      _updateGitHubSaveStatus({ ok: false, error: error?.message || 'Error desconocido' });
      console.error(error);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '💾 Guardar a GitHub'; }
    }
  });

  // Hero management buttons
  bindHeroManagementButtons();

  // Challenge buttons
  bindChallengeButtons();

  // Modal close buttons
  bindModalCloseButtons();

  safeCall(renderAll);
}

// ========================================================================
// HERO MANAGEMENT BINDINGS
// ========================================================================

function bindHeroManagementButtons() {
  const toast = window.toast || ((msg) => console.log(msg));
  const { makeId, makeBlankHero } = window;

  // New Hero button
  document.getElementById('btnNuevoHeroe')?.addEventListener('click', () => {
    // Ensure data structure exists
    if (!state.data) state.data = {};
    if (!Array.isArray(state.data.heroes)) state.data.heroes = [];

    const newHero = makeBlankHero ? makeBlankHero() : {
      id: 'hero_' + Date.now(),
      name: 'Nuevo héroe',
      age: 13,
      level: 1,
      xp: 0,
      xpMax: 100,
      stats: { int: 0, sab: 0, car: 0, res: 0, cre: 0 },
      medals: 0,
      group: state.group || '2D',
      challengeCompletions: {},
      pendingRewards: [],
      rewardsHistory: []
    };

    state.data.heroes.push(newHero);
    state.selectedHeroId = newHero.id;

    if (typeof window.saveLocal === 'function') {
      window.saveLocal(state.data);
    }

    toast('Nuevo héroe creado');

    if (typeof window.renderAll === 'function') {
      window.renderAll();
    }
  });

  // Delete Hero button
  document.getElementById('btnEliminar')?.addEventListener('click', async () => {
    const hero = currentHero();
    if (!hero) {
      toast('No hay héroe seleccionado');
      return;
    }

    const confirmed = window.openConfirmModal ?
      await window.openConfirmModal({
        title: 'Eliminar héroe',
        message: `¿Seguro que quieres eliminar a ${hero.name}?`,
        okText: 'Eliminar',
        cancelText: 'Cancelar'
      }) : confirm(`¿Seguro que quieres eliminar a ${hero.name}?`);

    if (!confirmed) return;

    // Ensure data structure exists
    if (state.data && Array.isArray(state.data.heroes)) {
      state.data.heroes = state.data.heroes.filter(h => h.id !== hero.id);

      // Select first remaining hero
      if (state.data.heroes.length > 0) {
        state.selectedHeroId = state.data.heroes[0].id;
      } else {
        state.selectedHeroId = null;
      }

      if (typeof window.saveLocal === 'function') {
        window.saveLocal(state.data);
      }

      toast(`${hero.name} eliminado`);

      if (typeof window.renderAll === 'function') {
        window.renderAll();
      }
    }
  });

  // Hero info fields — save changes back to state.data on blur/change
  const _bindHeroField = (id, applyFn) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', () => {
      const hero = currentHero();
      if (!hero) return;
      applyFn(hero, el.value);
      if (typeof window.saveLocal === 'function') window.saveLocal(state.data);
      if (typeof window.renderHeroList === 'function') window.renderHeroList();
    });
  };
  _bindHeroField('inNombre', (hero, v) => { hero.name = v.trim(); });
  _bindHeroField('inEdad',   (hero, v) => { const n = parseInt(v, 10); if (!isNaN(n)) hero.age = n; });
  _bindHeroField('txtDesc',  (hero, v) => { hero.desc = v; });
  _bindHeroField('txtMeta',  (hero, v) => { hero.goal = v; });

  // Weekly XP Reset button
  document.getElementById('btnWeekReset')?.addEventListener('click', () => {
    const hero = currentHero();
    if (!hero) {
      toast('No hay héroe seleccionado');
      return;
    }

    hero.weekXp = 0;

    if (typeof window.saveLocal === 'function') {
      window.saveLocal(state.data);
    }

    toast('XP semanal reiniciado');

    if (typeof renderHeroDetail === 'function') {
      renderHeroDetail(hero);
    } else if (typeof window.renderHeroDetail === 'function') {
      window.renderHeroDetail(hero);
    }
  });
}

// ========================================================================
// CHALLENGE BINDINGS
// ========================================================================

/**
 * Check if all challenges for a subject are completed and award medal
 * @param {Object} hero - The current hero
 * @param {Object} completedChallenge - The challenge that was just completed
 */
function checkSubjectCompletion(hero, completedChallenge) {
  const toast = window.toast || ((msg) => console.log(msg));
  const subjectId = completedChallenge.subjectId;
  if (!subjectId) return;

  // Initialize subject medals tracker
  if (!hero.subjectMedals) hero.subjectMedals = {};

  // Skip if already awarded medal for this subject
  if (hero.subjectMedals[subjectId]) return;

  // Get all challenges for this subject
  const subjectChallenges = (state.data?.challenges || []).filter(
    c => String(c.subjectId) === String(subjectId)
  );

  // If no challenges, return
  if (subjectChallenges.length === 0) return;

  // Check if all are completed
  const allCompleted = subjectChallenges.every(ch => {
    const key = String(ch.id);
    return hero.challengeCompletions && hero.challengeCompletions[key];
  });

  if (allCompleted) {
    // Award medal
    hero.medals = Number(hero.medals ?? 0) + 1;
    hero.subjectMedals[subjectId] = {
      awardedAt: Date.now(),
      subjectName: completedChallenge.subject ||
                   (state.data?.subjects || []).find(s => s.id === subjectId)?.name ||
                   'Materia'
    };

    // Get subject name for toast
    const subjectName = hero.subjectMedals[subjectId].subjectName;
    toast(`🏆 ¡Materia completada! +1 medalla por completar todos los desafíos de ${subjectName}`);

    // Show celebration
    if (typeof window.showBigReward === 'function') {
      window.showBigReward({
        title: '¡Materia Completada!',
        subtitle: `Has completado todos los desafíos de ${subjectName}`,
        icon: '🏆',
        duration: 3000
      });
    }
  }
}

function bindChallengeButtons() {
  const toast = window.toast || ((msg) => console.log(msg));

  // Complete/uncomplete selected challenge
  document.getElementById('btnChallengeComplete')?.addEventListener('click', () => {
    const hero = currentHero();
    const challengeId = String(state.selectedChallengeId || '');
    const challenge = (state.data?.challenges || []).find(c => String(c.id) === challengeId);
    if (!hero || !challenge) {
      toast('Selecciona un desafío');
      return;
    }

    hero.challengeCompletions = (hero.challengeCompletions && typeof hero.challengeCompletions === 'object')
      ? hero.challengeCompletions
      : {};

    const key = String(challenge.id);
    const basePoints = Number(challenge.points ?? 0);
    const isDone = !!hero.challengeCompletions[key];

    if (isDone) {
      const awarded = Number(hero.challengeCompletions[key]?.points ?? basePoints);
      delete hero.challengeCompletions[key];
      bumpHeroXp(-awarded);

      // Remove medal if it was a hard challenge
      const difficulty = String(challenge.difficulty || '').toLowerCase();
      if (difficulty === DIFFICULTY.HARD) {
        hero.medals = Math.max(0, Number(hero.medals ?? 0) - 1);
      }

      toast('Desafío descompletado');
    } else {
      const multiplier = Math.max(1, Number(hero.nextChallengeMultiplier || 1));
      const awarded = basePoints * multiplier;
      hero.challengeCompletions[key] = { at: Date.now(), points: awarded };
      bumpHeroXp(awarded, { source: 'challenge' });

      // Award medal for hard challenges
      const difficulty = String(challenge.difficulty || '').toLowerCase();
      if (difficulty === DIFFICULTY.HARD) {
        hero.medals = Number(hero.medals ?? 0) + 1;
        toast('🏅 ¡Desafío difícil completado! +1 medalla');
      } else {
        toast(multiplier > 1 ? 'Desafío completado (x2 XP)' : 'Desafío completado');
      }

      // Check if all challenges for this subject are completed
      checkSubjectCompletion(hero, challenge);
    }

    if (typeof window.saveLocal === 'function') {
      window.saveLocal(state.data);
    }

    safeCall(renderAll);
  });

  // Difficulty filter buttons
  const difficultyButtons = ['btnDiffEasy', 'btnDiffMed', 'btnDiffHard'];
  const difficultyMap = {
    'btnDiffEasy': DIFFICULTY.EASY,
    'btnDiffMed':  DIFFICULTY.MEDIUM,
    'btnDiffHard': DIFFICULTY.HARD
  };

  difficultyButtons.forEach(btnId => {
    document.getElementById(btnId)?.addEventListener('click', () => {
      const diff = difficultyMap[btnId];
      if (!state.challengeFilter) state.challengeFilter = {};
      state.challengeFilter.diff = diff;
      safeCall(renderChallenges);
    });
  });

  // Add Challenge button
  // Nota: openChallengeModal no retorna valor, así que no se puede usar el retorno
  // de safeCall para detectar si la función estaba disponible. Se verifica directamente.
  const _openAddChallenge = () => {
    if (typeof openChallengeModal !== 'function') {
      toast('⚠️ Función openChallengeModal no disponible');
      return;
    }
    safeCall(openChallengeModal, 'create');
  };
  document.getElementById('btnAddChallenge')?.addEventListener('click', _openAddChallenge);
  document.getElementById('btnAddChallengeMenu')?.addEventListener('click', _openAddChallenge);

  // Manage Subjects button
  const _openManageSubjects = () => {
    const modal = document.getElementById('subjectsModal');
    if (modal) {
      if (typeof window.closeAllModals === 'function') {
        window.closeAllModals('subjectsModal');
      }
      modal.hidden = false;

      // Render subjects list
      renderSubjectsList();
    }
  };
  document.getElementById('btnManageSubjects')?.addEventListener('click', _openManageSubjects);
  document.getElementById('btnManageSubjectsMenu')?.addEventListener('click', _openManageSubjects);

  // Add Subject button (inside subjects modal)
  document.getElementById('btnAddSubject')?.addEventListener('click', () => {
    const input = document.getElementById('inNewSubject');
    if (!input) return;

    const name = input.value.trim();
    if (!name) {
      toast('Ingresa el nombre de la materia');
      return;
    }

    if (!state.data.subjects) state.data.subjects = [];

    const newSubject = {
      id: 'subj_' + Date.now(),
      name: name,
      linkedStats: ['SAB'] // Default
    };

    state.data.subjects.push(newSubject);
    input.value = '';

    if (typeof window.saveLocal === 'function') {
      window.saveLocal(state.data);
    }

    toast(`Materia "${name}" agregada`);
    renderSubjectsList();

    safeCall(renderChallenges);
  });

  // Challenge History button
  document.getElementById('btnHistory')?.addEventListener('click', () => {
    const modal = document.getElementById('historyModal');
    if (modal) {
      if (typeof window.closeAllModals === 'function') {
        window.closeAllModals('historyModal');
      }
      modal.hidden = false;
      renderChallengeHistory();
    }
  });

  // Save Challenge button (inside challenge modal)
  document.getElementById('btnSaveChallenge')?.addEventListener('click', () => {
    safeCall(saveNewChallenge);
  });

  // Cancel Challenge button (inside challenge modal)
  document.getElementById('btnCancelChallenge')?.addEventListener('click', () => {
    safeCall(closeChallengeModal);
  });

  // Reset Local Data button
  document.getElementById('btnResetLocal')?.addEventListener('click', async () => {
    const confirmed = window.openConfirmModal ?
      await window.openConfirmModal({
        title: 'Borrar copia local',
        message: '¿Seguro que quieres borrar todos los datos locales? Se recargará desde GitHub.',
        okText: 'Borrar',
        cancelText: 'Cancelar'
      }) : confirm('¿Seguro que quieres borrar todos los datos locales?');

    if (!confirmed) return;

    try {
      localStorage.removeItem('levelup_data');
      toast('Datos locales borrados. Recargando...');
      setTimeout(() => {
        location.reload();
      }, 1000);
    } catch (error) {
      toast('Error al borrar datos locales');
      console.error(error);
    }
  });
}

// ========================================================================
// MODAL CLOSE BINDINGS
// ========================================================================

function bindModalClose(btnId, modalId) {
  const close = () => {
    const modal = document.getElementById(modalId);
    if (modal) modal.hidden = true;
  };

  document.getElementById(btnId)?.addEventListener('click', close);

  const backdrop = document.getElementById(modalId.replace('Modal', 'Backdrop'));
  backdrop?.addEventListener('click', close);
}

function bindModalCloseButtons() {
  bindModalClose('btnCloseRoleModal', 'roleModal');
  bindModalClose('btnCloseChallengeModal', 'challengeModal');
  bindModalClose('btnCloseHistoryModal', 'historyModal');
  bindModalClose('btnCloseSubjects', 'subjectsModal');
}

// ========================================================================
// HELPER FUNCTIONS
// ========================================================================

function renderSubjectsList() {
  const list = document.getElementById('subjectsList');
  if (!list) return;

  const escapeHtml = window.escapeHtml || ((str) => String(str).replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[m]));

  list.innerHTML = '';

  const subjects = state.data?.subjects || [];
  if (!subjects.length) {
    list.innerHTML = '<div class="muted">No hay materias.</div>';
    return;
  }

  subjects.forEach(subject => {
    const div = document.createElement('div');
    div.className = 'subjectItem';
    div.innerHTML = `
      <span class="subjectItem__name">${escapeHtml(subject.name)}</span>
      <button class="pill pill--small pill--danger" data-delete-subject="${subject.id}">Eliminar</button>
    `;

    // Delete button
    const deleteBtn = div.querySelector('[data-delete-subject]');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', async () => {
        const confirmed = window.openConfirmModal ?
          await window.openConfirmModal({
            title: 'Eliminar materia',
            message: `¿Eliminar "${subject.name}"?`,
            okText: 'Eliminar',
            cancelText: 'Cancelar'
          }) : confirm(`¿Eliminar "${subject.name}"?`);

        if (!confirmed) return;

        state.data.subjects = state.data.subjects.filter(s => s.id !== subject.id);

        if (typeof window.saveLocal === 'function') {
          window.saveLocal(state.data);
        }

        const toast = window.toast || ((msg) => console.log(msg));
        toast(`Materia "${subject.name}" eliminada`);
        renderSubjectsList();

        safeCall(renderChallenges);
      });
    }

    list.appendChild(div);
  });
}

function renderChallengeHistory() {
  const list = document.getElementById('historyList');
  const empty = document.getElementById('historyEmpty');
  if (!list) return;

  const escapeHtml = window.escapeHtml || ((str) => String(str).replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[m]));

  const hero = currentHero();
  if (!hero || !hero.challengeCompletions) {
    if (empty) empty.hidden = false;
    list.innerHTML = '';
    return;
  }

  const completions = Object.entries(hero.challengeCompletions)
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => (b.at || 0) - (a.at || 0)); // Most recent first

  if (!completions.length) {
    if (empty) empty.hidden = false;
    list.innerHTML = '';
    return;
  }

  if (empty) empty.hidden = true;
  list.innerHTML = '';

  const challenges = state.data?.challenges || [];
  const subjects = state.data?.subjects || [];
  const subjectMap = new Map(subjects.map(s => [s.id, s.name]));
  const challengeMap = new Map(challenges.map(c => [c.id, c]));

  completions.forEach(comp => {
    const challenge = challengeMap.get(comp.id);
    if (!challenge) return;

    const subjectName = subjectMap.get(challenge.subjectId) || challenge.subject || '—';
    const difficulty = challenge.difficulty || DIFFICULTY.EASY;
    const date = comp.at ? new Date(comp.at).toLocaleDateString('es-MX') : '—';

    const div = document.createElement('div');
    div.className = 'historyItem';
    div.innerHTML = `
      <div class="historyItem__badge" data-diff="${difficulty}">${escapeHtml(subjectName)}</div>
      <div class="historyItem__title">${escapeHtml(challenge.title || 'Sin título')}</div>
      <div class="historyItem__meta">${date}</div>
    `;
    list.appendChild(div);
  });
}

// ============================================
// STUDENT ACTIONS — Inicializar si hay sesión de alumno
// ============================================
const _studentSession = getSession();
if (_studentSession && !_studentSession.isAdmin) {
  if (document.readyState !== 'loading') {
    setTimeout(() => initStudentActions(), 900);
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => initStudentActions(), 900);
    });
  }
}
