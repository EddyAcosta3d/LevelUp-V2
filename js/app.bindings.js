'use strict';

function bind(){
    // Cualquier botón "pill" con data-route (topnav + acciones derecha)
    $$('.pill[data-route]').forEach(btn => btn.addEventListener('click', () => setActiveRoute(btn.dataset.route)));
    $$('#bottomNav .bottomNav__btn').forEach(btn => btn.addEventListener('click', () => setActiveRoute(btn.dataset.route)));

    $('#btnMenu').addEventListener('click', ()=>{
      if (!isDrawerLayout()) return;
      const isOpen = $('#shell').classList.contains('is-drawer-open');
      isOpen ? closeDrawer() : openDrawer();
    });
    $('#overlay').addEventListener('click', closeDrawer);

    // Mobile: overflow menu for header actions (Recompensas/Estado/Datos/Edición)
    const btnTopMore = $('#btnTopMore');
    const topMoreMenu = $('#topMoreMenu');
    const closeTopMore = ()=>{
      if (!btnTopMore || !topMoreMenu) return;
      topMoreMenu.hidden = true;
      btnTopMore.setAttribute('aria-expanded','false');
    };
    const toggleTopMore = ()=>{
      if (!btnTopMore || !topMoreMenu) return;
      const willOpen = topMoreMenu.hidden;
      topMoreMenu.hidden = !willOpen;
      btnTopMore.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    };
    if (btnTopMore && topMoreMenu){
      btnTopMore.addEventListener('click', (e)=>{ e.stopPropagation(); toggleTopMore(); });
      topMoreMenu.addEventListener('click', (e)=>{
        const item = e.target.closest('[data-proxy-click]');
        if (!item) return;
        const id = item.getAttribute('data-proxy-click');
        const target = id ? document.getElementById(id) : null;
        if (target) target.click();
        closeTopMore();
      });
      document.addEventListener('click', (e)=>{
        if (topMoreMenu.hidden) return;
        if (e.target === btnTopMore) return;
        if (topMoreMenu.contains(e.target)) return;
        closeTopMore();
      });
      window.addEventListener('resize', closeTopMore);
      window.addEventListener('orientationchange', ()=>{ closeTopMore(); closeDrawer(); });
    }

    // Mobile: botón directo a Recompensas (trofeo). Más confiable que el menú "..." en iOS.
    const btnMobileRewards = $('#btnMobileRewards');
    if (btnMobileRewards){
      btnMobileRewards.addEventListener('click', (e)=>{
        e.preventDefault();
        e.stopPropagation();
        setActiveRoute('recompensas');
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
        saveLocal();
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

    // Cofre de recompensas (por ficha):
    // - Si hay recompensas pendientes, abre el modal de level-up para reclamar.
    // - Si no hay pendientes, manda a la pestaña de Recompensas (historial con fecha).
    $('#btnChest')?.addEventListener('click', (e)=>{
      e.preventDefault();
      e.stopPropagation();
      const h = currentHero();
      if (!h) return;
      h.pendingRewards = Array.isArray(h.pendingRewards) ? h.pendingRewards : [];
      if (h.pendingRewards.length){
        openLevelUpModal();
      } else {
        setActiveRoute('recompensas');
      }
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
  };

  if (hero.challengeCompletions[key]){
    const awarded = Number(hero.challengeCompletions[key].points ?? pts);
    delete hero.challengeCompletions[key];

    hero.weekXp = Number(hero.weekXp ?? 0) - awarded;
    if (hero.weekXp < 0) hero.weekXp = 0;

    applyNegativeXp(-awarded);
    toast('Desafío descompletado');
  } else {
    const max = Number(hero.weekXpMax || DEFAULT_WEEK_XP_MAX || 40);
    hero.weekXp = Number(hero.weekXp || 0);
    const remaining = max - hero.weekXp;
    if (remaining <= 0){
      toast('Ya llegaste al máximo de XP semanal...');
      return;
    }
    if (pts > remaining){
      toast(`Solo quedan ${remaining} XP esta semana`);
      return;
    }

    hero.challengeCompletions[key] = { at: Date.now(), points: pts };
    hero.weekXp += pts;
    bumpHeroXp(pts);
    toast('Desafío completado');
  }

  saveLocal(state.data);
  renderChallenges();
});

// --- CRUD: Materias y Desafíos ---
function pointsForDifficulty(diff){
  const d = String(diff || '').toLowerCase();
  if (d === 'easy') return 10;
  if (d === 'medium') return 20;
  if (d === 'hard') return 40;
  return 0;
}

function refreshChallengeUI(){
  ensureChallengeUI();
  renderChallenges();
  renderChallengeDetail();
  updateDataDebug();
}

// Materias modal
function openSubjectsModal(){
  if (state.role !== 'teacher'){ toast('Activa edición para modificar materias'); return; }
  const m = $('#subjectsModal');
  if (!m) return;
  closeAllModals('subjectsModal');
  renderSubjectsModal();
  m.hidden = false;
  setTimeout(()=> $('#inNewSubject')?.focus(), 50);
}
function closeSubjectsModal(){
  const m = $('#subjectsModal');
  if (!m) return;
  m.hidden = true;
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

// Desafío modal
let editingChallengeId = null;

function setChallengeModalDiff(diff){
  const hid = document.getElementById('inChDiff');
  if (hid) hid.value = String(diff||'easy');
  document.querySelectorAll('#chDiffButtons [data-diff]').forEach(b=>{
    b.classList.toggle('is-active', b.dataset.diff === String(diff||'easy'));
  });
  // Update points label
  const pts = document.getElementById('inChPoints');
  if (pts){
    const d = String(diff||'easy');
    pts.value = d==='hard'?40 : d==='medium'?20 : 10;
  }
}
function openChallengeModal(mode='create', ch=null){
  if (state.role !== 'teacher'){ toast('Activa edición para crear/editar desafíos'); return; }
  const m = $('#challengeModal');
  if (!m) return;
  closeAllModals('challengeModal');
  const title = $('#challengeModalTitle');
  if (title) title.textContent = (mode === 'edit') ? 'Editar desafío' : 'Nuevo desafío';
  editingChallengeId = (mode === 'edit' && ch) ? ch.id : null;

  // Populate subject select
  const selSub = $('#inChSubject');
  const subjects = Array.isArray(state.data?.subjects) ? state.data.subjects : [];
  if (selSub){
    selSub.innerHTML = '';
    subjects.forEach(s=>{
      const opt = document.createElement('option');
      opt.value = String(s.id);
      opt.textContent = s.name || 'Materia';
      selSub.appendChild(opt);
    });
  }

  const selDiff = $('#inChDiff');
  const inPts = $('#inChPoints');
  const inTitle = $('#inChTitle');
  const inBody = $('#inChBody');

  const chosenSubject = ch?.subjectId || state.challengeFilter.subjectId || subjects[0]?.id || '';
  if (selSub) selSub.value = String(chosenSubject);

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

  inPts?.addEventListener('input', ()=>{ if (inPts) inPts.dataset.touched = '1'; });

  m.hidden = false;
  setTimeout(()=> inTitle?.focus(), 50);
}

function closeChallengeModal(){
  const m = $('#challengeModal');
  if (!m) return;
  m.hidden = true;
  editingChallengeId = null;
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

async function deleteSelectedChallenge(){
  if (state.role !== 'teacher'){ toast('Activa edición para borrar'); return; }
  const ch = (state.data?.challenges || []).find(x=> x.id === state.selectedChallengeId);
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

// Menú "⋯" para móviles
function openChallengeMoreMenu(){
  const btn = $('#btnChallengeMore');
  const menu = $('#challengeMoreMenu');
  if (!btn || !menu) return;
  if (state.role !== 'teacher'){ return; }

  const ch = (state.data?.challenges || []).find(x => x.id === state.selectedChallengeId);
  menu.innerHTML = '';

  const mk = (label, onClick)=>{
    const it = document.createElement('button');
    it.type = 'button';
    it.className = 'ddItem';
    it.textContent = label;
    it.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); closeChallengeMoreMenu(); onClick(); });
    menu.appendChild(it);
  };

  mk('✎ Editar', ()=>{ if (ch) openChallengeModal('edit', ch); });
  mk('🗑 Eliminar', ()=> deleteSelectedChallenge());

  const r = btn.getBoundingClientRect();
  const pad = 10;
  const w = 220;
  let left = Math.min(Math.max(pad, r.right - w), window.innerWidth - w - pad);
  let top = r.bottom + 10;
  const maxH = Math.min(window.innerHeight * 0.6, 260);
  if (top + maxH > window.innerHeight - pad){ top = Math.max(pad, r.top - 10 - maxH); }
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
  menu.style.maxHeight = `${maxH}px`;
  menu.style.overflow = 'auto';
  menu.hidden = false;
}
function closeChallengeMoreMenu(){
  const menu = $('#challengeMoreMenu');
  if (!menu) return;
  menu.hidden = true;
}

// Bind: Materias/Desafíos
$('#btnManageSubjects')?.addEventListener('click', openSubjectsModal);
$('#btnAddChallenge')?.addEventListener('click', ()=> openChallengeModal('create'));
$('#btnChallengeEdit')?.addEventListener('click', ()=>{
  const ch = (state.data?.challenges || []).find(x => x.id === state.selectedChallengeId);
  if (!ch) return toast('Selecciona un desafío');
  openChallengeModal('edit', ch);
});
$('#btnChallengeDelete')?.addEventListener('click', deleteSelectedChallenge);
$('#btnChallengeMore')?.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); openChallengeMoreMenu(); });

// Cierra el menú contextual al tocar fuera
document.addEventListener('click', (e)=>{
  const menu = $('#challengeMoreMenu');
  const btn = $('#btnChallengeMore');
  if (!menu || menu.hidden) return;
  if (menu.contains(e.target) || (btn && btn.contains(e.target))) return;
  closeChallengeMoreMenu();
});

// Modal: materias
$('#btnCloseSubjects')?.addEventListener('click', closeSubjectsModal);
$('#subjectsBackdrop')?.addEventListener('click', closeSubjectsModal);
$('#btnAddSubject')?.addEventListener('click', ()=>{
  if (state.role !== 'teacher') return;
  const inp = $('#inNewSubject');
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
    bindHeroField('#txtBien', (el,h)=>{ h.goodAt = String(el.value || ''); });
    bindHeroField('#txtMejorar', (el,h)=>{ h.improve = String(el.value || ''); });


    // Level Up modal backdrop
    $('#levelUpBackdrop')?.addEventListener('click', closeLevelUpModal);
    $('#btnLevelUpClose')?.addEventListener('click', closeLevelUpModal);

    // Photo / Confirm modals backdrops
    $('#photoBackdrop')?.addEventListener('click', closePhotoModal);
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
        closePhotoModal();
        const cancel = $('#btnConfirmCancel');
        if (cancel) cancel.click();
      }
    });

    // UI helpers
    initTopMoreMenu();
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
      saveLocal();
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

    // Foto de héroe (subir/quitar)
    const photoInput = $('#fileHeroPhoto');
    const openPhotoPicker = () => {
      if (!photoInput) return;
      photoInput.value = '';
      photoInput.click();
    };

    // Icono overlay (hover en desktop / siempre visible en touch)
    const btnFotoOverlay = $('#btnFotoOverlay');
    btnFotoOverlay?.addEventListener('click', (e)=>{
      e.preventDefault();
      e.stopPropagation();
      // openPhotoModal ya abre selector si no hay imagen
      openPhotoModal();
    });

    // En iPad/iPhone también es cómodo que tocar la imagen abra el editor
    const avatarFrame = $('#avatarFrame');
    avatarFrame?.addEventListener('click', (e)=>{
      // evita doble trigger cuando se toca el botón
      if (e.target && (e.target === btnFotoOverlay)) return;
      if (!window.matchMedia('(hover: none)').matches) return; // solo touch
      if (!isEditEnabled()) return;
      openPhotoModal();
    });

    photoInput?.addEventListener('change', async ()=>{
      const h = currentHero();
      if (!h) return;
      const file = photoInput.files && photoInput.files[0];
      if (!file) return;
      try{
        const dataUrl = await readFileAsDataURL(file);
        h.photo = dataUrl;
        h.photoSrc = '';
        h.photoFit = h.photoFit || { x:50, y:50, scale:1 };
        saveLocal(state.data);
        if (state.dataSource === 'remote') state.dataSource = 'local';
        updateDataDebug();
        renderHeroDetail(h);
        renderHeroList();
        // abre editor para encuadrar de inmediato
        openPhotoModal();
      }catch(err){
        console.error(err);
        toast('No se pudo cargar la foto.');
      }
    });

    wireAutoGrow(document);
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
