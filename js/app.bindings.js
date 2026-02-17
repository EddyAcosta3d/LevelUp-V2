'use strict';

/**
 * @module app.bindings
 * @description Event bindings and UI orchestration
 */

import { state } from './modules/core_globals.js';
import { loadData } from './modules/store.js';
import { renderAll, handleImportJson, handleExportJson, bumpHeroXp, setRole } from './modules/app_actions.js';
import { renderChallenges, openChallengeModal, saveNewChallenge, closeChallengeModal } from './modules/desafios.js';
import { toggleSubjectDropdown, currentHero } from './modules/fichas.js';
import { bindTiendaEvents } from './modules/tienda.js';
import { saveToGitHub, testGitHubConnection, setGitHubToken, clearGitHubToken } from './modules/github_sync.js';

function safeCall(fn, ...args){
  try{ if (typeof fn === 'function') return fn(...args); }catch(_e){}
  return undefined;
}

function activateRoute(route){
  if (!route) return;
  state.route = route;
  if (typeof window.setActiveRoute === 'function') {
    window.setActiveRoute(route);
    return;
  }
  document.querySelectorAll('.page').forEach(p=>p.classList.toggle('is-active', p.dataset.page===route));
  document.querySelectorAll('.pill[data-route]').forEach(b=>b.classList.toggle('is-active', b.dataset.route===route));
  document.querySelectorAll('#bottomNav .bottomNav__btn').forEach(b=>b.classList.toggle('is-active', b.dataset.route===route));
}

export function bind(){
  document.querySelectorAll('[data-route]').forEach(btn=>{
    // Recompensas has its own toggle handler (go/reverse).
    // Skip generic route binding to avoid double navigation on click.
    if (btn.id === 'btnRecompensas' || btn.id === 'btnMobileRewards') return;
    btn.addEventListener('click', ()=> activateRoute(btn.dataset.route));
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
  });

  document.getElementById('btnReloadRemote')?.addEventListener('click', ()=> loadData({ forceRemote: true }));
  document.getElementById('btnImportJson')?.addEventListener('click', ()=> document.getElementById('fileImport')?.click());
  document.getElementById('btnExportJson')?.addEventListener('click', ()=> safeCall(handleExportJson));

  document.getElementById('fileImport')?.addEventListener('change', async (e)=>{
    const file = e.target?.files?.[0];
    if (file) await handleImportJson(file);
    e.target.value = '';
  });

  // Rewards button - toggle between rewards and previous route
  let previousRoute = 'fichas'; // Default fallback route

  const handleRewardsToggle = ()=> {
    if (state.route === 'recompensas') {
      // If we're already on rewards, go back to previous route
      activateRoute(previousRoute);
    } else {
      // Save current route before switching to rewards
      previousRoute = state.route || 'fichas';
      activateRoute('recompensas');
    }
  };

  document.getElementById('btnRecompensas')?.addEventListener('click', handleRewardsToggle);
  document.getElementById('btnMobileRewards')?.addEventListener('click', handleRewardsToggle);

  // XP buttons - modify hero experience points
  document.getElementById('btnXpP1')?.addEventListener('click', ()=> bumpHeroXp(1));
  document.getElementById('btnXpP5')?.addEventListener('click', ()=> bumpHeroXp(5));
  document.getElementById('btnXpM1')?.addEventListener('click', ()=> bumpHeroXp(-1));
  document.getElementById('btnXpM5')?.addEventListener('click', ()=> bumpHeroXp(-5));

  // Subject dropdown button in Desafíos
  document.getElementById('btnSubject')?.addEventListener('click', ()=> safeCall(toggleSubjectDropdown));

  // Note: Edit mode is now controlled ONLY by ?admin=true URL parameter
  // No manual toggle button - reload page to change modes

  // GitHub configuration and save buttons
  document.getElementById('btnConfigGitHub')?.addEventListener('click', ()=> {
    if (typeof window.openGitHubConfigModal === 'function') {
      window.openGitHubConfigModal();
    }
  });

  document.getElementById('btnSaveToGitHub')?.addEventListener('click', async ()=> {
    const toast = window.toast || ((msg)=> console.log(msg));
    try {
      toast('Guardando en GitHub...');
      const result = await saveToGitHub({
        onProgress: (msg) => toast(msg)
      });
      if (result.success) {
        toast('✅ ' + result.message);
      } else {
        toast('❌ ' + result.message);
      }
    } catch (error) {
      toast('❌ Error al guardar en GitHub');
      console.error(error);
    }
  });

  // Hero management buttons
  bindHeroManagementButtons();

  // Challenge buttons
  bindChallengeButtons();

  // Modal close buttons
  bindModalCloseButtons();

  safeCall(bindTiendaEvents);
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
    if (!state.data.heroes) state.data.heroes = [];

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

    if (state.data.heroes) {
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

    if (typeof window.renderHeroDetail === 'function') {
      window.renderHeroDetail();
    }
  });
}

// ========================================================================
// CHALLENGE BINDINGS
// ========================================================================

function bindChallengeButtons() {
  const toast = window.toast || ((msg) => console.log(msg));

  // Difficulty filter buttons
  const difficultyButtons = ['btnDiffEasy', 'btnDiffMed', 'btnDiffHard'];
  const difficultyMap = {
    'btnDiffEasy': 'easy',
    'btnDiffMed': 'medium',
    'btnDiffHard': 'hard'
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
  document.getElementById('btnAddChallenge')?.addEventListener('click', () => {
    const ok = safeCall(openChallengeModal, 'create');
    if (typeof ok === 'undefined') toast('⚠️ Función openChallengeModal no disponible');
  });

  // Manage Subjects button
  document.getElementById('btnManageSubjects')?.addEventListener('click', () => {
    const modal = document.getElementById('subjectsModal');
    if (modal) {
      if (typeof window.closeAllModals === 'function') {
        window.closeAllModals('subjectsModal');
      }
      modal.hidden = false;

      // Render subjects list
      renderSubjectsList();
    }
  });

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

function bindModalCloseButtons() {
  // Close buttons for various modals
  const modalCloseBtns = [
    { btnId: 'btnCloseRoleModal', modalId: 'roleModal' },
    { btnId: 'btnCloseChallengeModal', modalId: 'challengeModal' },
    { btnId: 'btnCloseHistoryModal', modalId: 'historyModal' },
    { btnId: 'btnCloseSubjects', modalId: 'subjectsModal' }
  ];

  modalCloseBtns.forEach(({ btnId, modalId }) => {
    document.getElementById(btnId)?.addEventListener('click', () => {
      const modal = document.getElementById(modalId);
      if (modal) modal.hidden = true;
    });

    // Also bind backdrop clicks
    const backdrop = document.getElementById(modalId.replace('Modal', 'Backdrop'));
    if (backdrop) {
      backdrop.addEventListener('click', () => {
        const modal = document.getElementById(modalId);
        if (modal) modal.hidden = true;
      });
    }
  });
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
    const difficulty = challenge.difficulty || 'easy';
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
