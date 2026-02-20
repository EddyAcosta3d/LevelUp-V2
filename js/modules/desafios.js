'use strict';

/**
 * @module desafios
 * @description Challenge/mission management and rendering
 *
 * PUBLIC EXPORTS:
 * - renderChallenges, openChallengeModal, closeChallengeModal
 * - saveNewChallenge, deleteSelectedChallenge
 */

// Import dependencies
import {
  $,
  $$,
  state,
  escapeHtml,
  normalizeDifficulty,
  isChallengeDone,
  getFilteredChallenges
} from './core_globals.js';

import {
  saveLocal
} from './store.js';

import {
  upsertHeroAssignment,
  deleteHeroAssignment
} from './supabase_client.js';

import {
  currentHero,
  ensureChallengeUI,
  difficultyLabel
} from './fichas.js';

function getChallengeContextHero(){
  // Contexto principal: héroe actualmente seleccionado.
  const hero = currentHero();
  if (hero) return hero;

  // Fallback defensivo: en sesión admin sin selección previa,
  // tomar el primer héroe del grupo actual para habilitar asignación.
  const heroes = Array.isArray(state.data?.heroes) ? state.data.heroes : [];
  const inGroup = heroes.filter(h => String(h.group || '2D') === String(state.group || '2D'));
  return inGroup[0] || heroes[0] || null;
}

function isChallengeUnlockedForHero(hero, challengeId){
  if (!hero) return false;
  const assigned = hero.assignedChallenges;
  // Regla actual: por defecto NO está asignado hasta que el profe lo habilita.
  if (!Array.isArray(assigned)) return false;
  return assigned.includes(String(challengeId));
}

export function renderChallenges(){
    // Ensure default filters: one subject + easy difficulty
    const subjectsAll = Array.isArray(state.data?.subjects) ? state.data.subjects : [];
    if (!state.challengeFilter) state.challengeFilter = { subjectId: null, diff: 'easy' };
    if (!state.challengeFilter.diff) state.challengeFilter.diff = 'easy';
    if (!state.challengeFilter.subjectId && subjectsAll.length) state.challengeFilter.subjectId = subjectsAll[0].id;

  ensureChallengeUI(renderChallenges);

  const list = $('#challengeList');
  if (!list) return;
  list.innerHTML = '';

  const hero = getChallengeContextHero();

  // --- Level-up medal hint (near end of level) ---
  try{
    const hint = $('#medalGateHint');
    if (hint){
      const xp = Number(hero?.xp ?? 0);
      const xpMax = Number(hero?.xpMax ?? 100);
      const near = xpMax > 0 && xp >= (xpMax * 0.80);
      if (!hero || !near){
        hint.hidden = true;
      } else {
        if (typeof hero.levelStartAt !== 'number' || !isFinite(hero.levelStartAt)) hero.levelStartAt = Date.now();
        const since = Number(hero.levelStartAt || 0);
        const comp = (hero.challengeCompletions && typeof hero.challengeCompletions==='object') ? hero.challengeCompletions : {};
        const chList = Array.isArray(state.data?.challenges) ? state.data.challenges : [];
        const byId = new Map(chList.map(c=>[String(c.id), c]));
        let total=0, hasMed=false, hasHard=false;
        for (const cid in comp){
          const at = Number(comp[cid]?.at || 0);
          if (!at || at < since) continue;
          const ch = byId.get(String(cid));
          if (!ch) continue;
          total++;
          const d = String(ch.difficulty||'').toLowerCase();
          if (d==='medium') hasMed = true;
          if (d==='hard') hasHard = true;
        }
        const needTotal = Math.max(0, 3-total);
        const needM = !hasMed;
        const needH = !hasHard;
        const ok = (total>=3 && hasMed && hasHard);
        if (ok){
          hint.innerHTML = `🎖️ <span class="ok"><b>Medalla por subir de nivel:</b> lista.</span> (En este nivel ya hiciste <b>${total}</b> desafíos con <b>1 Medio</b> y <b>1 Difícil</b>.)`;
        } else {
          const parts = [];
          if (needTotal) parts.push(`<b>${needTotal}</b> desafío${needTotal===1?'':'s'} más`);
          if (needM) parts.push(`<b>1 Medio</b>`);
          if (needH) parts.push(`<b>1 Difícil</b>`);
          hint.innerHTML = `🎖️ <span class="warn"><b>Para ganar medalla al subir de nivel</b></span> te falta: ${parts.join(' y ')}.`;
        }
        hint.hidden = false;
      }
    }
  }catch(_e){}

  const filtered = getFilteredChallenges();

  // --- Progress UI (counts + bar) ---
  try{
    const total = filtered.length;
    const doneN = filtered.reduce((acc, ch)=> acc + (isChallengeDone(hero, ch.id) ? 1 : 0), 0);
    const pct = total ? Math.round((doneN / total) * 100) : 0;

    const chips = $('#chProgressChips');
    const fill  = $('#chProgressFill');
    const txt   = $('#chProgressText');

    if (chips){
      const pending = Math.max(0, total - doneN);
      const xpTotal = filtered.reduce((acc, ch)=> acc + Number(ch.points ?? 0), 0);
      const xpDone  = filtered.reduce((acc, ch)=> acc + (isChallengeDone(hero, ch.id) ? Number(ch.points ?? 0) : 0), 0);
      chips.innerHTML = `
        <div class="chProgItem"><span class="chProgIcon">✅</span><span class="chProgText"><b>${escapeHtml(String(doneN))}/${escapeHtml(String(total))}</b> completados</span></div>
        <div class="chProgItem"><span class="chProgIcon">⭐</span><span class="chProgText"><b>${escapeHtml(String(xpDone))}/${escapeHtml(String(xpTotal))}</b> XP</span></div>
        <div class="chProgItem"><span class="chProgIcon">⏳</span><span class="chProgText"><b>${escapeHtml(String(pending))}</b> pendientes</span></div>
      `;
    }
    if (fill){ fill.style.width = `${pct}%`; }
    if (txt){ txt.textContent = total ? `Progreso en esta vista: ${doneN}/${total} (${pct}%)` : 'No hay desafíos en este filtro.'; }
  }catch(e){ /* ignore */ }

  if (!filtered.length){
    list.innerHTML = '<div class="muted">Sin desafíos.</div>';
    state.selectedChallengeId = null;
    renderChallengeDetail();
    return;
  }

  if (!state.selectedChallengeId || !filtered.some(c=>c.id === state.selectedChallengeId)){
    state.selectedChallengeId = filtered[0].id;
  }

  // Render: pendientes primero, luego completados
  const sorted = [...filtered].sort((a,b)=>{
    const ad = isChallengeDone(hero, a.id) ? 1 : 0;
    const bd = isChallengeDone(hero, b.id) ? 1 : 0;
    if (ad !== bd) return ad - bd;
    return String(a.title||'').localeCompare(String(b.title||''));
  });

  sorted.forEach(ch=>{
    const done = isChallengeDone(hero, ch.id);
    const unlocked = isChallengeUnlockedForHero(hero, ch.id);
    const item = document.createElement('div');
    item.className = 'challengeItem' + (done ? ' is-done' : '') + (state.selectedChallengeId===ch.id ? ' is-selected' : '');
    item.dataset.diff = String(ch.difficulty || '').toLowerCase();
    // usado para acciones delegadas (editar/eliminar)
    item.dataset.cid = String(ch.id);
    item.style.cursor = 'pointer';

    const subj = ch.subject || (state.data?.subjects || []).find(s=>s.id === ch.subjectId)?.name || '—';
    const diffLabel = difficultyLabel(ch.difficulty);
    const pts = Number(ch.points ?? 0);

    // Si ya estás filtrando por materia, evitar títulos redundantes tipo "Tecnología: ..."
    const stripSubjectPrefix = (title, subjectName)=>{
      const t = String(title || '').trim();
      const s = String(subjectName || '').trim();
      if (!t || !s) return t;
      const re = new RegExp('^' + s.replace(/[.*+?^${}()|[\\]\\]/g,'\\$&') + '\\s*[:\\-–—]\\s*','i');
      return t.replace(re,'').trim() || t;
    };
    const displayTitle = stripSubjectPrefix(ch.title, subj) || 'Desafío';

    const canEdit = document.documentElement.classList.contains('is-edit');
    item.innerHTML = `
      <div class="challengeRow">
        <div class="challengeName">${escapeHtml(displayTitle)}</div>
        <div class="challengeMetaRow">
          <span class="chPill chPill--${escapeHtml(String(ch.difficulty||'').toLowerCase())}"><span class="i">⚡</span>${escapeHtml(diffLabel)}</span>
          <span class="chPill chPill--xp"><span class="i">⭐</span>${escapeHtml(String(pts))} XP</span>
          ${!canEdit && !unlocked ? `<span class="chPill"><span class="i">🔒</span>Bloqueado</span>` : ''}
          ${canEdit ? `
            <div class="chItemActions" data-edit-only="1">
              <button class="chIconBtn" type="button" data-act="edit" title="Editar" aria-label="Editar">✎</button>
              <button class="chIconBtn chIconBtn--danger" type="button" data-act="del" title="Eliminar" aria-label="Eliminar">🗑</button>
            </div>
          ` : ''}
        </div>
      </div>
    `;

    // Acciones por-item (solo profesor)
    if (canEdit){
      const bEdit = item.querySelector('[data-act="edit"]');
      const bDel  = item.querySelector('[data-act="del"]');
      bEdit?.addEventListener('click', (e)=>{
        e.preventDefault(); e.stopPropagation();
        state.selectedChallengeId = ch.id;
        try{ if (typeof openChallengeModal === 'function') openChallengeModal('edit', ch); }catch(_e){}
      });
      bDel?.addEventListener('click', async (e)=>{
        e.preventDefault(); e.stopPropagation();
        state.selectedChallengeId = ch.id;
        try{ if (typeof deleteSelectedChallenge === 'function') await deleteSelectedChallenge(); }catch(_e){}
      });
    }

    item.addEventListener('click', ()=>{
      state.selectedChallengeId = ch.id;
      renderChallengeDetail();
      document.dispatchEvent(new CustomEvent('challengeSelected', {
        detail: { challengeId: state.selectedChallengeId }
      }));
      // update selected state without rerendering whole list later
      $$('#challengeList .challengeItem').forEach(el=> el.classList.toggle('is-selected', el === item));
    });

    list.appendChild(item);
  });

  renderChallengeDetail();
  document.dispatchEvent(new CustomEvent('challengeSelected', {
    detail: { challengeId: state.selectedChallengeId }
  }));
}


export function renderChallengeDetail(){
  const hintEl = $('#challengeHint');
  const bodyEl = $('#challengeBody');
  const btnComplete = $('#btnChallengeComplete');

  const hero = getChallengeContextHero();
  const ch = (state.data?.challenges || []).find(x => x.id === state.selectedChallengeId);

  const titleEl = $('#challengeDetailTitle');
  const subEl   = $('#challengeDetailSub');
  const badgesEl = $('#challengeDetailBadges');

  const formatBody = (txt)=>{
    const raw = String(txt || '').trim();
    if (!raw) return '<div class="muted">(sin instrucciones)</div>';

    const lines = raw.split(/\r?\n/);
    let html = '';
    let list = [];
    const flushList = ()=>{
      if (!list.length) return;
      html += '<ul class="chBodyList">' + list.map(li=>`<li>${escapeHtml(li)}</li>`).join('') + '</ul>';
      list = [];
    };

    for (const line of lines){
      const t = String(line || '').trim();
      if (!t){
        flushList();
        continue;
      }
      const m = t.match(/^[-•*]\s+(.*)$/);
      if (m){
        list.push(m[1]);
        continue;
      }
      flushList();
      html += `<p class="chBodyP">${escapeHtml(t)}</p>`;
    }
    flushList();
    return html;
  };

  if (!ch){
    if (titleEl) titleEl.textContent = 'Detalle';
    if (subEl) subEl.textContent = 'Selecciona un desafío para ver instrucciones.';
    if (badgesEl) badgesEl.innerHTML = '';
    if (hintEl) hintEl.textContent = 'Selecciona un desafío.';
    if (bodyEl){ bodyEl.hidden = false; bodyEl.innerHTML = ''; }
    if (btnComplete){
      btnComplete.disabled = true;
      btnComplete.classList.remove('is-active','is-done');
      btnComplete.textContent = '⏳ Pendiente';
    }
    // Asegura que el botón no se pierda si el detalle no encuentra un desafío
    if (btnComplete){
      const actionsEl = document.getElementById('challengeDetailActions');
      if (badgesEl) badgesEl.appendChild(btnComplete);
      else if (actionsEl) actionsEl.appendChild(btnComplete);
    }
    return;
  }

  const subj = ch.subject || (state.data?.subjects || []).find(s=>s.id === ch.subjectId)?.name || '—';
  const done = isChallengeDone(hero, ch.id);
  const canEditView = document.documentElement.classList.contains('is-edit');
  const unlocked = isChallengeUnlockedForHero(hero, ch.id);
  // doneAt se guarda internamente, pero no lo mostramos en UI (se veía como un número largo).

  const stripSubjectPrefix = (title, subjectName)=>{
    const t = String(title || '').trim();
    const s = String(subjectName || '').trim();
    if (!t || !s) return t;
    const re = new RegExp('^' + s.replace(/[.*+?^${}()|[\\]\\]/g,'\\$&') + '\\s*[:\\-–—]\\s*','i');
    return t.replace(re,'').trim() || t;
  };
  const displayTitle = stripSubjectPrefix(ch.title, subj) || 'Desafío';

  if (titleEl) titleEl.textContent = displayTitle;
  if (subEl) {
    if (canEditView){
      const heroName = String(hero?.name || 'Sin alumno seleccionado');
      const lockState = unlocked ? 'Desbloqueado' : 'Bloqueado';
      subEl.textContent = `${subj} · Alumno: ${heroName} · Estado: ${lockState}`;
    } else {
      subEl.textContent = '';
    }
  }

  // En el detalle NO repetimos dificultad/XP en la esquina (ya se ven claro en la tarjeta del centro).
  // Aquí solo dejamos el control de estado (Pendiente/Completado) en modo edición, justo en la esquina.
  if (badgesEl){
    badgesEl.innerHTML = '';
    if (btnComplete){
      badgesEl.appendChild(btnComplete);
    }
  }

  if (hintEl){
    hintEl.textContent = '';
  }

  if (bodyEl){
    bodyEl.hidden = false;
    if (!canEditView && !unlocked){
      bodyEl.innerHTML = '<div class="muted">🔒 Este desafío está bloqueado. Pídele a tu profe que te lo asigne para ver las instrucciones.</div>';
    } else {
      bodyEl.innerHTML = (canEditView ? '<div class="chInstrLabel">Instrucciones</div>' : '') + formatBody(ch.body);
    }
  }

  if (btnComplete){
    btnComplete.disabled = !hero;
    btnComplete.classList.toggle('is-active', done);
    btnComplete.classList.toggle('is-done', done);
    btnComplete.textContent = done ? '✅ Completado' : '⏳ Pendiente';
    btnComplete.dataset.state = done ? 'done' : 'pending';
  }

  if (canEditView && hero && badgesEl){
    const assignBtn = document.createElement('button');
    assignBtn.type = 'button';
    assignBtn.className = 'pill pill--ghost challengeAssignBtn';
    assignBtn.textContent = unlocked ? 'Asignado' : 'Asignar';
    assignBtn.setAttribute('aria-pressed', String(unlocked));
    assignBtn.dataset.state = unlocked ? 'assigned' : 'locked';
    assignBtn.classList.toggle('is-active', unlocked);
    assignBtn.title = unlocked
      ? 'Este desafío está desbloqueado para el alumno seleccionado.'
      : 'Este desafío está bloqueado para el alumno seleccionado.';
    assignBtn.addEventListener('click', ()=>{
      const targetHero = getChallengeContextHero();
      if (!targetHero){
        window.toast?.('⚠️ No hay alumno seleccionado');
        return;
      }
      if (!Array.isArray(targetHero.assignedChallenges)) targetHero.assignedChallenges = [];
      const chId = String(ch.id);
      const i = targetHero.assignedChallenges.indexOf(chId);
      let assigning;
      if (i >= 0){
        targetHero.assignedChallenges.splice(i, 1);
        window.toast?.(`🔒 ${targetHero.name || 'Alumno'}: desafío bloqueado`);
        assigning = false;
      } else {
        targetHero.assignedChallenges.push(chId);
        window.toast?.(`🔓 ${targetHero.name || 'Alumno'}: desafío desbloqueado`);
        assigning = true;
      }
      saveLocal(state.data);
      renderChallenges();
      // Sincronizar con Supabase en segundo plano (no bloquea la UI)
      const fn = assigning
        ? upsertHeroAssignment(targetHero.id, chId)
        : deleteHeroAssignment(targetHero.id, chId);
      fn.catch(err => {
        console.warn('[Sync] Error al sincronizar asignación:', err);
        window.toast?.(`⚠️ No se guardó en la nube: ${err.message || 'revisa tu conexión'}`);
      });
    });
    badgesEl.appendChild(assignBtn);
  }

  // Esconde la fila de acciones (ya movimos el botón arriba) para dar más espacio a instrucciones.
  const headRow = document.querySelector('.challengeDetailHead');
  const actions = document.querySelector('.challengeDetailActions');
  if (actions) actions.style.display = 'none';
  if (headRow){
    const hasHint = (hintEl && hintEl.textContent && hintEl.textContent.trim().length);
    headRow.style.display = hasHint ? '' : 'none';
  }
}

export function openChallengeModal(mode = 'create', challenge = null){
  const modal = document.getElementById('challengeModal');
  if (!modal) return;

  const subjects = Array.isArray(state.data?.subjects) ? state.data.subjects : [];
  const titleEl = document.getElementById('challengeModalTitle');
  const inTitle = document.getElementById('inChTitle');
  const inBody = document.getElementById('inChBody');
  const inPoints = document.getElementById('inChPoints');
  const inSubject = document.getElementById('inChSubject');
  const inDiff = document.getElementById('inChDiff');
  const btnSubject = document.getElementById('btnChModalSubject');
  const subjectMenu = document.getElementById('chModalSubjectMenu');
  const diffPick = document.getElementById('inChDiffPick');

  const editing = mode === 'edit' && challenge;
  state.editingChallengeId = editing ? challenge.id : null;

  if (titleEl) titleEl.textContent = editing ? 'Editar desafío' : 'Nuevo desafío';
  if (inTitle) inTitle.value = editing ? String(challenge.title || '') : '';
  if (inBody) inBody.value = editing ? String(challenge.body || '') : '';
  if (inPoints) inPoints.value = editing ? String(Number(challenge.points ?? 10)) : '10';

  const initialSubjectId = editing
    ? String(challenge.subjectId || '')
    : String(state.challengeFilter?.subjectId || subjects[0]?.id || '');
  if (inSubject) inSubject.value = initialSubjectId;

  const initialDiff = normalizeDifficulty(editing ? challenge.difficulty : state.challengeFilter?.diff || 'easy');
  if (inDiff) inDiff.value = initialDiff;

  const refreshSubjectLabel = ()=>{
    if (!btnSubject) return;
    const selectedId = inSubject?.value;
    const subj = subjects.find(s => String(s.id) === String(selectedId));
    btnSubject.textContent = `${subj?.name || 'Materia'} ▾`;
  };

  if (subjectMenu){
    subjectMenu.innerHTML = subjects.map(s =>
      `<button class="menuitem" type="button" data-id="${escapeHtml(String(s.id))}">${escapeHtml(String(s.name || 'Materia'))}</button>`
    ).join('') || '<div class="menuitem muted">Sin materias</div>';

    subjectMenu.querySelectorAll('[data-id]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        if (inSubject) inSubject.value = btn.dataset.id || '';
        refreshSubjectLabel();
        subjectMenu.classList.remove('is-open');
      });
    });
  }

  btnSubject?.addEventListener('click', ()=> subjectMenu?.classList.toggle('is-open'));
  diffPick?.querySelectorAll('[data-diff]').forEach(btn=>{
    btn.classList.toggle('is-active', btn.dataset.diff === initialDiff);
    btn.addEventListener('click', ()=>{
      const diff = normalizeDifficulty(btn.dataset.diff || 'easy');
      if (inDiff) inDiff.value = diff;
      diffPick.querySelectorAll('[data-diff]').forEach(x=> x.classList.toggle('is-active', x === btn));
    });
  });

  refreshSubjectLabel();
  modal.hidden = false;
}

export function closeChallengeModal(){
  const modal = document.getElementById('challengeModal');
  if (modal) modal.hidden = true;
}

export function saveNewChallenge(){
  try {
    const title = String(document.getElementById('inChTitle')?.value || '').trim();
    const body = String(document.getElementById('inChBody')?.value || '').trim();
    const pointsInput = document.getElementById('inChPoints')?.value;
    const points = Number.parseInt(pointsInput, 10);
    const subjectId = String(document.getElementById('inChSubject')?.value || '').trim();
    const difficulty = normalizeDifficulty(document.getElementById('inChDiff')?.value || 'easy');

    // Enhanced validations
    if (!title){
      window.toast?.('❌ Ingresa un título para el desafío');
      document.getElementById('inChTitle')?.focus();
      return false;
    }

    if (!subjectId){
      window.toast?.('❌ Selecciona una materia');
      return false;
    }

    if (isNaN(points) || points < 0){
      window.toast?.('❌ Ingresa un valor válido de puntos (número mayor o igual a 0)');
      document.getElementById('inChPoints')?.focus();
      return false;
    }

    // Ensure data structure exists
    if (!state.data) state.data = {};
    if (!Array.isArray(state.data.challenges)) {
      state.data.challenges = [];
    }

    const editingId = state.editingChallengeId;
    const existing = editingId
      ? state.data.challenges.find(c => String(c.id) === String(editingId))
      : null;

    if (existing){
      // Verify that editingId hasn't changed (race condition protection)
      if (state.editingChallengeId !== editingId) {
        window.toast?.('❌ El desafío cambió. Intenta de nuevo.');
        closeChallengeModal();
        return false;
      }

      existing.title = title;
      existing.body = body;
      existing.points = points;
      existing.subjectId = subjectId;
      existing.difficulty = difficulty;
      window.toast?.('✅ Desafío actualizado');
    } else {
      state.data.challenges.push({
        id: 'ch_' + Date.now(),
        title,
        body,
        points,
        subjectId,
        difficulty,
        createdAt: new Date().toISOString()
      });
      window.toast?.(`✅ Desafío "${title}" creado`);
    }

    saveLocal(state.data);
    closeChallengeModal();
    state.editingChallengeId = null;

    if (typeof renderChallenges === 'function') {
      renderChallenges();
    }

    return true;

  } catch (err) {
    console.error('Error al guardar desafío:', err);
    window.toast?.('❌ Error al guardar el desafío. Intenta de nuevo.');
    return false;
  }
}

export async function deleteSelectedChallenge(){
  const id = state.selectedChallengeId;
  if (!id || !Array.isArray(state.data?.challenges)) return false;

  const ch = state.data.challenges.find(x => x.id === id);
  if (!ch) return false;

  const ok = window.openConfirmModal
    ? await window.openConfirmModal({
      title: 'Eliminar desafío',
      message: `¿Seguro que quieres eliminar "${ch.title || 'Desafío'}"?`,
      okText: 'Eliminar',
      cancelText: 'Cancelar'
    })
    : window.confirm(`¿Seguro que quieres eliminar "${ch.title || 'Desafío'}"?`);
  if (!ok) return false;

  state.data.challenges = state.data.challenges.filter(x => x.id !== id);
  state.selectedChallengeId = null;
  saveLocal(state.data);
  window.toast?.('Desafío eliminado');
  renderChallenges();
  return true;
}


  
