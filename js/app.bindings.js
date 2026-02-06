'use strict';

function bind(){
  if (window.__LEVELUP_BINDINGS_DONE) return;
  window.__LEVELUP_BINDINGS_DONE = true;
    // Cualquier botón "pill" con data-route (topnav + acciones derecha)
    // EXCEPTO Recompensas: ahí queremos comportamiento tipo "switch" (ir y volver).
    $$('.pill[data-route]').forEach(btn => {
      if (btn && btn.id === 'btnRecompensas') return;
      btn.addEventListener('click', () => setActiveRoute(btn.dataset.route));
    });
    $$('#bottomNav .bottomNav__btn').forEach(btn => btn.addEventListener('click', () => setActiveRoute(btn.dataset.route)));

    $('#btnMenu').addEventListener('click', ()=>{
      if (!isDrawerLayout()) return;
      const isOpen = $('#shell').classList.contains('is-drawer-open');
      isOpen ? closeDrawer() : openDrawer();
    });
    $('#overlay').addEventListener('click', closeDrawer);

    // Recompensas como "switch":
    // - 1er click: abre Recompensas
    // - 2o click: regresa a la pestaña donde estabas
    function toggleRewardsRoute(){
      const current = state.route || 'fichas';
      if (current !== 'recompensas'){
        state._routeBeforeRewards = current;
        setActiveRoute('recompensas');
      }else{
        setActiveRoute(state._routeBeforeRewards || 'fichas');
      }
    }

    const btnRecompensas = $('#btnRecompensas');
    if (btnRecompensas){
      btnRecompensas.addEventListener('click', (e)=>{
        e.preventDefault();
        e.stopPropagation();
        toggleRewardsRoute();
      });
    }

    // Mobile: botón directo a Recompensas (trofeo). Más confiable que el menú "..." en iOS.
    const btnMobileRewards = $('#btnMobileRewards');
    if (btnMobileRewards){
      btnMobileRewards.addEventListener('click', (e)=>{
        e.preventDefault();
        e.stopPropagation();
        toggleRewardsRoute();
        closeDrawer();
      });
    }

    $$('.segmented__btn').forEach(b=>{
      b.addEventListener('click', ()=>{
        $$('.segmented__btn').forEach(x=>x.classList.remove('is-active'));
        b.classList.add('is-active');
        state.group = b.dataset.group || '2D';
        renderHeroList();
        renderHeroDetail();
      });
    });

    // Crear héroe nuevo (sin modal): se agrega a la lista del grupo actual y se abre la ficha
    const btnNuevoHeroe = $('#btnNuevoHeroe');
    if (btnNuevoHeroe){
      btnNuevoHeroe.addEventListener('click', ()=>{
        state.data = state.data || { heroes: [] };
        state.data.heroes = Array.isArray(state.data.heroes) ? state.data.heroes : [];
        const h = makeBlankHero(state.group || '2D');
        state.data.heroes.push(h);
        state.selectedHeroId = h.id;
        saveLocal(state.data);
        renderAll();
        requestAnimationFrame(()=>{
          const nameEl = document.getElementById('inNombre');
          if (nameEl) nameEl.focus();
          const card = document.querySelector(`[data-hero-id="${h.id}"]`);
          if (card){
            try{ card.scrollIntoView({block:'center', behavior:'smooth'}); }catch(_e){}
            card.classList.add('flash');
            setTimeout(()=>card.classList.remove('flash'), 650);
          }
        });
      });
    }

    // Datos dropdown
    $('#btnDatos').addEventListener('click', (e)=>{ e.stopPropagation(); toggleDatos(); });
    document.addEventListener('click', ()=> closeDatos());
    $('#menuDatos').addEventListener('click', (e)=> e.stopPropagation());

    $('#btnReloadRemote').addEventListener('click', async ()=>{
      closeDatos();
      await loadData({forceRemote:true});
    });

    $('#btnImportJson').addEventListener('click', ()=>{
      closeDatos();
      $('#fileJson').value = '';
      $('#fileJson').click();
    });
    $('#fileJson').addEventListener('change', (e)=>{
      const f = e.target.files && e.target.files[0];
      if (f) handleImportJson(f);
    });

    $('#btnExportJson').addEventListener('click', ()=>{
      closeDatos();
      handleExportJson();
    });

    $('#btnResetLocal').addEventListener('click', ()=>{
      closeDatos();
      clearLocal();
      toast('Copia local borrada');
      loadData({forceRemote:false});
    });

    // Role (sin PIN)
    $('#btnEdicion').addEventListener('click', ()=>{
      setRole(state.role === 'viewer' ? 'teacher' : 'viewer');
    });

// --- Desafíos UI ---
const btnSubject = $('#btnSubject');
const subjectMenu = $('#subjectMenu');
if (btnSubject && subjectMenu){
  btnSubject.addEventListener('click', (e)=>{
    e.preventDefault(); e.stopPropagation();
    toggleSubjectDropdown();
  });
  subjectMenu.addEventListener('click', (e)=> e.stopPropagation());
  document.addEventListener('click', ()=> closeSubjectDropdown());
  document.addEventListener('keydown', (e)=>{ if (e.key === 'Escape') closeSubjectDropdown(); });
}

// Difficulty filter pills
$$('#diffPills [data-diff]').forEach(b=>{
  b.addEventListener('click', ()=>{
    const diff = b.dataset.diff;
    state.challengeFilter.diff = diff;
    $$('#diffPills [data-diff]').forEach(x=> x.classList.toggle('is-active', state.challengeFilter.diff === x.dataset.diff));
    renderChallenges();
  });
});

// Completar / descompletar desafío (reversión real)
$('#btnChallengeComplete')?.addEventListener('click', ()=>{
  const hero = currentHero();
  const ch = (state.data?.challenges || []).find(x => x.id === state.selectedChallengeId);
  if (!hero || !ch) return;

  hero.challengeCompletions = (hero.challengeCompletions && typeof hero.challengeCompletions === 'object') ? hero.challengeCompletions : {};
  const key = String(ch.id);
  const pts = Number(ch.points ?? 0);

  const applyNegativeXp = (deltaNeg)=>{
    hero.xp = Number(hero.xp ?? 0) + Number(deltaNeg || 0);
    hero.xpMax = Number(hero.xpMax ?? 100);
    hero.level = Number(hero.level ?? 1);

    while (hero.xp < 0 && hero.level > 1){
      hero.level -= 1;
      hero.xp += hero.xpMax;
    }
    if (hero.xp < 0) hero.xp = 0;

    hero.pendingRewards = Array.isArray(hero.pendingRewards) ? hero.pendingRewards : [];
    hero.rewardsHistory = Array.isArray(hero.rewardsHistory) ? hero.rewardsHistory : [];
    hero.pendingRewards = hero.pendingRewards.filter(r => Number(r.level||0) <= hero.level);
    hero.rewardsHistory = hero.rewardsHistory.filter(r => Number(r.level||0) <= hero.level);

    saveLocal(state.data);
    if (state.dataSource === 'remote') state.dataSource = 'local';
    updateDataDebug();
    renderHeroList();
    renderHeroDetail();
    try{ renderChallenges(); }catch(e){}
    try{ renderChallengeDetail(); }catch(e){}
  };

  if (hero.challengeCompletions[key]){
    const awarded = Number(hero.challengeCompletions[key].points ?? pts);
    delete hero.challengeCompletions[key];

    // Remove from historial (si se desmarca, ya no debe quedar registrado)
    hero.challengeHistory = Array.isArray(hero.challengeHistory) ? hero.challengeHistory : [];
    hero.challengeHistory = hero.challengeHistory.filter(h => String(h.challengeId) !== String(key));

    applyNegativeXp(-awarded);
    toast('Desafío descompletado');
  } else {

    const mult = Math.max(1, Number(hero.nextChallengeMultiplier || 1));
    const awarded = pts * mult;
    if (mult > 1) {
      hero.nextChallengeMultiplier = 1;
    }

    hero.challengeCompletions[key] = { at: Date.now(), points: awarded };

    // Add to historial (solo una vez mientras siga marcado)
    hero.challengeHistory = Array.isArray(hero.challengeHistory) ? hero.challengeHistory : [];
    if (!hero.challengeHistory.some(h => String(h.challengeId) === String(key))){
      const subjId = ch.subjectId ?? ch.subject ?? ch.subject_id;
      const subjObj = (state.data?.subjects || []).find(s => String(s.id) === String(subjId));
      hero.challengeHistory.push({
        challengeId: String(key),
        subjectId: subjId != null ? String(subjId) : '',
        subject: subjObj?.name || subjObj?.title || String(ch.subjectName || ch.subject || ''),
        difficulty: String(ch.difficulty || ''),
        name: String(ch.title || ch.name || 'Desafío'),
        at: Date.now()
      });
    }
    // Los desafíos NO consumen límite semanal. El límite semanal es solo para actividades pequeñas.
    if (String(ch.difficulty||'').toLowerCase() === 'hard') {
      hero.medals = (Number(hero.medals) || 0) + 1;
    }
    bumpHeroXp(awarded, { source: 'challenge' }); // ✅ Agregar source para activar celebraciones
    toast(mult > 1 ? 'Desafío completado (x2 XP)' : 'Desafío completado');
  }

  saveLocal(state.data);
  renderChallenges();
  renderChallengeDetail();
});

// --- CRUD: Materias y Desafíos ---
function pointsForDifficulty(diff){
  const normalized = normalizeDifficulty(diff);
  return POINTS_BY_DIFFICULTY[normalized] || 0;
}

function refreshChallengeUI(){
  ensureChallengeUI();
  renderChallenges();
  renderChallengeDetail();
  updateDataDebug();
}

// Materias modal
function openSubjectsModal(){  const m = $('#subjectsModal');
  if (!m) return;
  // Cierra dropdowns/controles que puedan quedar por encima del modal
  try{ document.activeElement && document.activeElement.blur(); }catch(e){}
  try{ if (typeof closeSubjectDropdown === 'function') closeSubjectDropdown(); }catch(e){}
  try{ document.body.classList.add('is-modal-open'); }catch(e){}
  closeAllModals('subjectsModal');
  renderSubjectsModal();
  m.hidden = false;
  try{ if (typeof syncModalOpenState==='function') syncModalOpenState(); }catch(e){}
  setTimeout(()=> $('#inNewSubject')?.focus(), 50);
}
function closeSubjectsModal(){
  const m = $('#subjectsModal');
  if (!m) return;
  m.hidden = true;
  try{ if (typeof syncModalOpenState==='function') syncModalOpenState(); }catch(e){}
}
function renderSubjectsModal(){
  const box = $('#subjectsList');
  if (!box) return;
  box.innerHTML = '';
  const subjects = Array.isArray(state.data?.subjects) ? state.data.subjects : [];
  subjects.forEach(sub=>{
    const row = document.createElement('div');
    row.className = 'subjectRow';
    row.innerHTML = `
      <div class="subjectRow__name">${escapeHtml(sub.name || 'Materia')}</div>
      <div class="subjectRow__actions">
        <button class="pill pill--small pill--ghost" type="button" data-act="rename">Renombrar</button>
        <button class="pill pill--small pill--danger" type="button" data-act="delete">Eliminar</button>
      </div>
    `;
    row.querySelector('[data-act="rename"]').addEventListener('click', async ()=>{
      const next = prompt('Nuevo nombre de la materia:', sub.name || '');
      if (!next) return;
      sub.name = String(next).trim();
      // Update denormalized subject names inside challenges (optional but keeps titles nice)
      (state.data?.challenges || []).forEach(c=>{ if (String(c.subjectId) === String(sub.id)) c.subject = sub.name; });
      saveLocal(state.data);
      renderSubjectsModal();
      refreshChallengeUI();
      toast('Materia actualizada');
    });
    row.querySelector('[data-act="delete"]').addEventListener('click', async ()=>{
      const ok = await openConfirmModal({ title:'Eliminar materia', message:`Se eliminará "${sub.name}" y sus desafíos.`, okText:'Eliminar', cancelText:'Cancelar' });
      if (!ok) return;
      state.data.subjects = subjects.filter(s=> String(s.id) !== String(sub.id));
      state.data.challenges = (state.data?.challenges || []).filter(c=> String(c.subjectId) !== String(sub.id));
      // Fix filter
      if (state.challengeFilter.subjectId && String(state.challengeFilter.subjectId) === String(sub.id)){
        state.challengeFilter.subjectId = state.data.subjects[0]?.id || null;
      }
      saveLocal(state.data);
      renderSubjectsModal();
      refreshChallengeUI();
      toast('Materia eliminada');
    });
    box.appendChild(row);
  });
}

// Historial de desafíos completados
function openHistoryModal(){
  const m = $('#historyModal');
  if (!m) return;
  try{ document.activeElement && document.activeElement.blur(); }catch(e){}
  try{ document.body.classList.add('is-modal-open'); }catch(e){}
  closeAllModals('historyModal');
  renderHistoryModal();
  m.hidden = false;
  try{ if (typeof syncModalOpenState==='function') syncModalOpenState(); }catch(e){}
}
function closeHistoryModal(){
  const m = $('#historyModal');
  if (!m) return;
  m.hidden = true;
  try{ if (typeof syncModalOpenState==='function') syncModalOpenState(); }catch(e){}
}
function renderHistoryModal(){
  const title = $('#historyModalTitle');
  const list = $('#historyList');
  const empty = $('#historyEmpty');
  if (!list) return;

  const hero = (typeof getSelectedHero==='function') ? getSelectedHero() : null;
  const heroName = hero?.name || 'Personaje';
  if (title) title.textContent = `Historial de desafíos — ${heroName}`;

  const items = Array.isArray(hero?.challengeHistory) ? hero.challengeHistory.slice() : [];
  items.sort((a,b)=> (Number(b.at||0) - Number(a.at||0)));

  list.innerHTML = '';
  if (empty) empty.hidden = items.length !== 0;

  items.forEach(it=>{
    const subject = it.subject || it.subjectName || '';
    const diff = String(it.difficulty||'').toLowerCase();
    const diffLabel = diff==='hard' ? 'Difícil' : (diff==='medium' ? 'Medio' : 'Fácil');
    const name = it.name || it.title || 'Desafío';
    const d = new Date(Number(it.at||0));
    const dateStr = isNaN(d.getTime()) ? '' : `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;

    const row = document.createElement('div');
    row.className = 'historyRow';
    row.innerHTML = `
      <div class="historyCell historyCell--subj">${escapeHtml(subject)}</div>
      <div class="historyCell historyCell--diff">${escapeHtml(diffLabel)}</div>
      <div class="historyCell historyCell--name">${escapeHtml(name)}</div>
      <div class="historyCell historyCell--date">${escapeHtml(dateStr)}</div>
    `;
    list.appendChild(row);
  });
}

// expose
window.openHistoryModal = openHistoryModal;
window.closeHistoryModal = closeHistoryModal;

// Desafío modal
let editingChallengeId = null;

function setChallengeModalDiff(diff){
  const d = String(diff||'easy').toLowerCase();
  const hid = document.getElementById('inChDiff');
  if (hid) hid.value = d;

  // Visual state on difficulty buttons
  const group = document.getElementById('inChDiffPick');
  if (group){
    // atributo extra para CSS (más robusto que solo class)
    group.dataset.active = d;
    group.querySelectorAll('[data-diff]').forEach(b=>{
      const isOn = String(b.dataset.diff||'').toLowerCase() === d;
      b.classList.toggle('is-active', isOn);
      b.setAttribute('aria-pressed', isOn ? 'true' : 'false');
    });
  }

  // Default points per difficulty (only if user hasn't touched it)
  const pts = document.getElementById('inChPoints');
  if (pts && !pts.dataset.touched){
    pts.value = d==='hard'?40 : d==='medium'?20 : 10;
  }
}


// --- Challenge modal subject dropdown (custom, matches main Materia dropdown) ---
function closeChModalSubjectDropdown(){
  const dd = document.getElementById('chModalSubjectDropdown');
  if (dd) dd.classList.remove('is-open');
}
function toggleChModalSubjectDropdown(){
  const dd = document.getElementById('chModalSubjectDropdown');
  if (!dd) return;
  dd.classList.toggle('is-open');
}
function ensureChModalSubjectDropdown(subjects){
  const dd = document.getElementById('chModalSubjectDropdown');
  const btn = document.getElementById('btnChModalSubject');
  const menu = document.getElementById('chModalSubjectMenu');
  const hid = document.getElementById('inChSubject');
  if (!dd || !btn || !menu || !hid) return;

  // Populate menu
  menu.innerHTML = '';
  (subjects||[]).forEach(s=>{
    const it = document.createElement('button');
    it.type = 'button';
    it.className = 'ddItem';
    it.dataset.subjectId = String(s.id);
    it.textContent = s.name || 'Materia';
    it.addEventListener('click', (e)=>{
      e.preventDefault(); e.stopPropagation();
      hid.value = String(s.id);
      btn.textContent = (it.textContent + ' ▾');
      closeChModalSubjectDropdown();
    });
    menu.appendChild(it);
  });

  // Bind open/close once
  if (!ensureChModalSubjectDropdown._bound){
    btn.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); toggleChModalSubjectDropdown(); });
    menu.addEventListener('click', (e)=> e.stopPropagation());
    document.addEventListener('click', ()=> closeChModalSubjectDropdown());
    document.addEventListener('keydown', (e)=>{ if (e.key === 'Escape') closeChModalSubjectDropdown(); });
    ensureChModalSubjectDropdown._bound = true;
  }
}

function openChallengeModal(mode='create', ch=null){  const m = $('#challengeModal');
  if (!m) return;
  // Cierra dropdowns/controles abiertos (evita que se queden encima del modal)
  try{ document.activeElement && document.activeElement.blur(); }catch(e){}
  try{ if (typeof closeSubjectDropdown === 'function') closeSubjectDropdown(); }catch(e){}
  try{ document.body.classList.add('is-modal-open'); }catch(e){}
  // Evita overlays encimados (ej. menú de materias abierto detrás del modal)
  closeAllModals('challengeModal');
  const title = $('#challengeModalTitle');
  if (title) title.textContent = (mode === 'edit') ? 'Editar desafío' : 'Nuevo desafío';
  editingChallengeId = (mode === 'edit' && ch) ? ch.id : null;

  // Populate subject dropdown (custom)
  const subjects = Array.isArray(state.data?.subjects) ? state.data.subjects : [];
  ensureChModalSubjectDropdown(subjects);
  const selSub = $('#inChSubject');
  const btnSub = $('#btnChModalSubject');

  const selDiff = $('#inChDiff');
  const inPts = $('#inChPoints');
  const inTitle = $('#inChTitle');
  const inBody = $('#inChBody');

  const chosenSubject = ch?.subjectId || state.challengeFilter.subjectId || subjects[0]?.id || '';
  if (selSub) selSub.value = String(chosenSubject);
  if (btnSub){
    const activeName = subjects.find(s=>String(s.id)===String(chosenSubject))?.name || 'Materia';
    btnSub.textContent = (activeName + ' ▾');
  }

  // Bind difficulty buttons (once)
  if (!openChallengeModal._bound){
    document.querySelectorAll('#inChDiffPick [data-diff]').forEach(b=>{
      b.addEventListener('click', ()=> setChallengeModalDiff(b.dataset.diff));
    });
    openChallengeModal._bound = true;
  }

  const chosenDiff = String(ch?.difficulty || state.challengeFilter.diff || 'easy').toLowerCase();
  if (selDiff) selDiff.value = chosenDiff;
  setChallengeModalDiff(chosenDiff);

  // If editing and points were set manually, keep them
  if (inPts) inPts.value = String(ch?.points ?? pointsForDifficulty(chosenDiff));
  if (inTitle) inTitle.value = String(ch?.title || '');
  if (inBody) inBody.value = String(ch?.body || '');

  inPts?.addEventListener('input', ()=>{ if (inPts) inPts.dataset.touched = '1'; });

  m.hidden = false;
  try{ if (typeof syncModalOpenState==='function') syncModalOpenState(); }catch(e){}
  setTimeout(()=> inTitle?.focus(), 50);
}

function closeChallengeModal(){
  const m = $('#challengeModal');
  if (!m) return;
  m.hidden = true;
  editingChallengeId = null;
  try{ if (typeof syncModalOpenState==='function') syncModalOpenState(); }catch(e){}
  const inPts = $('#inChPoints');
  if (inPts) delete inPts.dataset.touched;
}

async function saveChallengeFromModal(){
  const selSub = $('#inChSubject');
  const selDiff = $('#inChDiff');
  const inPts = $('#inChPoints');
  const inTitle = $('#inChTitle');
  const inBody = $('#inChBody');
  if (!selSub || !selDiff || !inPts || !inTitle || !inBody) return;

  const subjectId = String(selSub.value || '');
  const subjName = (state.data?.subjects || []).find(s=> String(s.id) === String(subjectId))?.name || 'Materia';
  const difficulty = String(selDiff.value || 'easy').toLowerCase();
  const points = Math.max(0, Number(inPts.value || 0));
  const title = String(inTitle.value || '').trim();
  const body = String(inBody.value || '').trim();
  if (!title){ toast('Ponle un título al desafío'); return; }

  state.data.challenges = Array.isArray(state.data?.challenges) ? state.data.challenges : [];

  if (editingChallengeId){
    const ch = state.data.challenges.find(x=> String(x.id) === String(editingChallengeId));
    if (!ch) return;
    ch.subjectId = subjectId;
    ch.subject = subjName;
    ch.difficulty = difficulty;
    ch.points = points;
    ch.title = title;
    ch.body = body;
    toast('Desafío actualizado');
  } else {
    const newCh = { id: uid('c'), subjectId, subject: subjName, difficulty, points, title, body };
    state.data.challenges.unshift(newCh);
    state.selectedChallengeId = newCh.id;
    toast('Desafío creado');
  }

  saveLocal(state.data);
  if (state.dataSource === 'remote') state.dataSource = 'local';
  closeChallengeModal();
  // Por defecto, filtra a la materia del desafío guardado
  state.challengeFilter.subjectId = subjectId;
  ensureChallengeUI();
  renderChallenges();
  renderChallengeDetail();
}

async function deleteSelectedChallenge(){  const ch = (state.data?.challenges || []).find(x=> x.id === state.selectedChallengeId);
  if (!ch) return;
  const ok = await openConfirmModal({ title:'Eliminar desafío', message:`Eliminar "${ch.title}"?`, okText:'Eliminar', cancelText:'Cancelar' });
  if (!ok) return;
  state.data.challenges = (state.data?.challenges || []).filter(x=> x.id !== ch.id);
  state.selectedChallengeId = null;
  saveLocal(state.data);
  renderChallenges();
  renderChallengeDetail();
  toast('Desafío eliminado');
}

// Bind: Materias/Desafíos
$('#btnManageSubjects')?.addEventListener('click', openSubjectsModal);
$('#btnHistory')?.addEventListener('click', openHistoryModal);
$('#btnAddChallenge')?.addEventListener('click', ()=> openChallengeModal('create'));


// Modal: materias
$('#btnCloseSubjects')?.addEventListener('click', closeSubjectsModal);
$('#subjectsBackdrop')?.addEventListener('click', closeSubjectsModal);

// Modal: historial
$('#btnCloseHistoryModal')?.addEventListener('click', closeHistoryModal);
$('#historyBackdrop')?.addEventListener('click', closeHistoryModal);
$('#btnAddSubject')?.addEventListener('click', ()=>{  const inp = $('#inNewSubject');
  const name = String(inp?.value || '').trim();
  if (!name) return;
  state.data.subjects = Array.isArray(state.data.subjects) ? state.data.subjects : [];
  state.data.subjects.push({ id: uid('sub'), name });
  inp.value = '';
  saveLocal(state.data);
  renderSubjectsModal();
  refreshChallengeUI();
});
$('#inNewSubject')?.addEventListener('keydown', (e)=>{ if (e.key === 'Enter'){ e.preventDefault(); $('#btnAddSubject')?.click(); }});

// Modal: desafío
$('#btnCloseChallengeModal')?.addEventListener('click', closeChallengeModal);
$('#challengeBackdrop')?.addEventListener('click', closeChallengeModal);
$('#btnCancelChallenge')?.addEventListener('click', closeChallengeModal);
$('#btnSaveChallenge')?.addEventListener('click', saveChallengeFromModal);

// Acciones dentro de cada tarjeta de desafío (delegado, para que no se rompa al re-render)
// Nota: los botones de editar/borrar están dentro de .challengeItem y usan data-act="edit"/"del".
(function bindChallengeCardActions(){
  const list = document.getElementById('challengeList');
  if (!list) return;
  if (list.dataset.boundActs === '1') return;
  list.dataset.boundActs = '1';
  list.addEventListener('click', async (e)=>{
    const btn = e.target && e.target.closest ? e.target.closest('button[data-act]') : null;
    if (!btn) return;
    const act = String(btn.getAttribute('data-act')||'');
    if (act !== 'edit' && act !== 'del') return;
    e.preventDefault();
    e.stopPropagation();

    const card = btn.closest ? btn.closest('.challengeItem') : null;
    const cid = card?.dataset?.cid;
    if (!cid) return;
    state.selectedChallengeId = cid;

    if (act === 'edit'){
      const ch = (state.data?.challenges || []).find(x=> String(x.id) === String(cid));
      if (ch) openChallengeModal('edit', ch);
      return;
    }
    await deleteSelectedChallenge();
  });
})();

    $('#btnDebugPanel').addEventListener('click', toggleDetails);

    $('#inRol').addEventListener('click', openRoleModal);
    $('#inRol').addEventListener('keydown', (e)=>{
      if (e.key === 'Enter' || e.key === ' '){
        e.preventDefault();
        openRoleModal();
      }
    });
    $('#btnCloseRoleModal').addEventListener('click', closeRoleModal);
    $$('[data-close-role-modal]').forEach(el=> el.addEventListener('click', closeRoleModal));

    // --- Bind de campos de ficha (Nombre/Edad/Descripción/Meta/etc.) ---
    // Antes faltaba el wiring y por eso "Nombre" no actualizaba la ficha.
    let heroSaveTimer = null;
    const scheduleHeroSave = (immediate=false)=>{
      const commit = ()=>{
        saveLocal(state.data);
        if (state.dataSource === 'remote') state.dataSource = 'local';
        updateDataDebug();
      };
      if (immediate){ commit(); return; }
      clearTimeout(heroSaveTimer);
      heroSaveTimer = setTimeout(commit, 220);
    };

    const bindHeroField = (sel, applyFn, {rerenderList=false, updateHeader=false}={})=>{
      const el = document.querySelector(sel);
      if (!el) return;
      const handler = ()=>{
        const h = currentHero();
        if (!h) return;
        try{ applyFn(el, h); }catch(_e){}
        if (updateHeader){
          const t = document.getElementById('heroName');
          if (t) t.textContent = (h.name || 'NUEVO HÉROE').toUpperCase();
        }
        scheduleHeroSave(false);
        if (rerenderList) renderHeroList();
      };
      el.addEventListener('input', handler);
      el.addEventListener('change', handler);
      // Para que al salir se "limpie" espacios
      el.addEventListener('blur', ()=>{
        const h = currentHero();
        if (!h) return;
        if (sel === '#inNombre'){
          const v = String(el.value || '').trim();
          el.value = v;
          h.name = v;
          const t = document.getElementById('heroName');
          if (t) t.textContent = (h.name || 'NUEVO HÉROE').toUpperCase();
          renderHeroList();
          scheduleHeroSave(true);
        }
      });
    };

    bindHeroField('#inNombre', (el,h)=>{ h.name = String(el.value || ''); }, {rerenderList:true, updateHeader:true});
    bindHeroField('#inEdad', (el,h)=>{ h.age = el.value === '' ? '' : Number(el.value); });
    bindHeroField('#txtDesc', (el,h)=>{ h.desc = String(el.value || ''); });
    bindHeroField('#txtMeta', (el,h)=>{ h.goal = String(el.value || ''); });


    // Level Up modal backdrop
    $('#levelUpBackdrop')?.addEventListener('click', closeLevelUpModal);
    $('#btnLevelUpClose')?.addEventListener('click', closeLevelUpModal);

    // Confirm modal backdrop
    $('#confirmBackdrop')?.addEventListener('click', ()=>{ const b=$('#btnConfirmCancel'); if(b) b.click(); });

    // XP demo
    $('#btnXpM5').addEventListener('click', ()=> bumpHeroXp(-5));
    $('#btnXpM1').addEventListener('click', ()=> bumpHeroXp(-1));
    $('#btnXpP1').addEventListener('click', ()=> bumpHeroXp(+1));
    $('#btnXpP5').addEventListener('click', ()=> bumpHeroXp(+5));
    $$('.chipRow [data-xp]').forEach(b=>{
      b.addEventListener('click', ()=>{
        const xp = Number(b.dataset.xp || 0);
        if (!xp) return;

        // Weekly-capped XP ("Actividades pequeñas")
        if (b.closest('#actChips')){
          const h = currentHero();
          if (!h) return;

          const max = Number(h.weekXpMax || DEFAULT_WEEK_XP_MAX || 40);
          h.weekXp = Number(h.weekXp || 0);
          const remaining = max - h.weekXp;
          if (remaining <= 0){
            toast('Ya llegaste al máximo de XP semanal...');
            renderHeroDetail(h);
            return;
          }
          const gain = Math.min(xp, remaining);
          h.weekXp += gain;
          bumpHeroXp(gain);
          return;
        }

        bumpHeroXp(xp);
      });
    });

    window.addEventListener('resize', ()=>{
      updateDeviceDebug();
      if (!isDrawerLayout()) closeDrawer();
      syncDetailsUI();
    });

    document.addEventListener('keydown', (e)=>{
      if (e.key === 'Escape'){
        closeDrawer();
        closeDatos();
        closeRoleModal();
        const cancel = $('#btnConfirmCancel');
        if (cancel) cancel.click();
      }
    });

    // UI helpers
    if (typeof initTopMoreMenu === 'function') initTopMoreMenu();
    const resetBtn = $('#btnWeekReset');
    resetBtn?.addEventListener('click', async (e)=>{
      e.preventDefault();
      e.stopPropagation();
      const h = currentHero();
      if (!h) return;
      const ok = await openConfirmModal({title:'Reiniciar XP semanal', message:'¿Reiniciar la XP semanal de este héroe?', okText:'Reiniciar', cancelText:'Cancelar'});
      if (!ok) return;
      h.weekXp = 0;
      if (!h.weekXpMax) h.weekXpMax = DEFAULT_WEEK_XP_MAX;
      saveLocal(state.data);
      if (state.dataSource === 'remote') state.dataSource = 'local';
      updateDataDebug();
      renderHeroDetail(h);
      toast('XP semanal reiniciada.');
    });

    // Eliminar héroe (icono de bote de basura en la tarjeta de foto)
    const btnEliminar = $('#btnEliminar') || $('#heroDeleteBtn');
    btnEliminar?.addEventListener('click', async (e)=>{
      e.preventDefault();
      e.stopPropagation();
      const h = currentHero();
      if (!h) return;

      const ok = await openConfirmModal({
        title: `Eliminar ficha: ${h.name || '—'}`,
        message: '',
        okText: 'Eliminar',
        cancelText: 'Cancelar'
      });
      if (!ok) return;

      state.data.heroes = (state.data.heroes || []).filter(x => x.id !== h.id);
      if (state.selectedHeroId === h.id){
        const next = state.data.heroes[0];
        state.selectedHeroId = next ? next.id : null;
      }
      saveLocal(state.data);
      if (state.dataSource === 'remote') state.dataSource = 'local';
      updateDataDebug();
      renderAll();
      toast('Ficha eliminada');
    });

    // Nota: Fotos se gestionan en /assets y en el JSON. No hay carga/edición dentro de la app.

    wireAutoGrow(document);
  
    // Exponer acciones para handlers que viven en otros módulos (desafios.js)
    try{
      window.openChallengeModal = openChallengeModal;
      window.deleteSelectedChallenge = deleteSelectedChallenge;
      window.openSubjectsModal = openSubjectsModal;
      window.openChallengeModalCreate = () => openChallengeModal('create', null);
    }catch(_e){}
}

  
  // Splash intro
  const SPLASH_MIN_MS = 1400;
  const splashStart = Date.now();
  function hideSplash(){
    const el = document.getElementById('splash');
    if (!el) return;
    const elapsed = Date.now() - splashStart;
    const wait = Math.max(0, SPLASH_MIN_MS - elapsed);
    window.setTimeout(()=>{
      el.classList.add('is-hide');
      window.setTimeout(()=>{ try{ el.remove(); }catch(e){} }, 600);
    }, wait);
  }
