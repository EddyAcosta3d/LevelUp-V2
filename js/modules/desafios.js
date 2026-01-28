function renderChallenges(){
    // Ensure default filters: one subject + easy difficulty
    const subjectsAll = Array.isArray(state.data?.subjects) ? state.data.subjects : [];
    if (!state.challengeFilter) state.challengeFilter = { subjectId: null, diff: 'easy' };
    if (!state.challengeFilter.diff) state.challengeFilter.diff = 'easy';
    if (!state.challengeFilter.subjectId && subjectsAll.length) state.challengeFilter.subjectId = subjectsAll[0].id;

  ensureChallengeUI();

  const list = $('#challengeList');
  if (!list) return;
  list.innerHTML = '';

  const hero = currentHero();
  const filtered = getFilteredChallenges();

  if (!filtered.length){
    list.innerHTML = '<div class="muted">Sin desafíos.</div>';
    state.selectedChallengeId = null;
    renderChallengeDetail();
    return;
  }

  if (!state.selectedChallengeId || !filtered.some(c=>c.id === state.selectedChallengeId)){
    state.selectedChallengeId = filtered[0].id;
  }

  filtered.forEach(ch=>{
    const done = isChallengeDone(hero, ch.id);
    const item = document.createElement('div');
    item.className = 'challengeItem' + (done ? ' is-done' : '');
    item.dataset.diff = String(ch.difficulty || '').toLowerCase();
    item.style.cursor = 'pointer';

    const subj = ch.subject || (state.data?.subjects || []).find(s=>s.id === ch.subjectId)?.name || '—';
    const diffLabel = difficultyLabel(ch.difficulty);
    const pts = Number(ch.points ?? 0);

    item.innerHTML = `
      <div class="challengeRow">
        <div class="challengeName">${escapeHtml(ch.title || 'Desafío')}</div>
        <div class="challengeMetaRow">
          <span class="badge badge--diff badge--${escapeHtml(String(ch.difficulty||'').toLowerCase())}">${escapeHtml(diffLabel)}</span>
          <span class="badge badge--pts">${escapeHtml(String(pts))} XP</span>
          ${done ? '<span class="badge badge--done">✔</span>' : ''}
        </div>
      </div>
    `;

    item.addEventListener('click', ()=>{
      state.selectedChallengeId = ch.id;
      renderChallengeDetail();
    });

    list.appendChild(item);
  });

  renderChallengeDetail();
}

function renderChallengeDetail(){
  const hintEl = $('#challengeHint');
  const bodyEl = $('#challengeBody');
  const btnComplete = $('#btnChallengeComplete');
  const btnEdit = $('#btnChallengeEdit');
  const btnDel = $('#btnChallengeDelete');

  const hero = currentHero();
  const ch = (state.data?.challenges || []).find(x => x.id === state.selectedChallengeId);

  if (!ch){
    if (hintEl) hintEl.textContent = 'Selecciona un desafío.';
    if (bodyEl) bodyEl.textContent = '';
    if (btnComplete) btnComplete.disabled = true;
    if (btnEdit) btnEdit.disabled = true;
    if (btnDel) btnDel.disabled = true;
    return;
  }

  const subj = ch.subject || (state.data?.subjects || []).find(s=>s.id === ch.subjectId)?.name || '—';
  const diffLabel = difficultyLabel(ch.difficulty);
  const pts = Number(ch.points ?? 0);
  const done = isChallengeDone(hero, ch.id);
  const doneAt = done ? hero.challengeCompletions[String(ch.id)].at : null;

  if (hintEl){ hintEl.innerHTML = ''; }
  if (bodyEl){
    bodyEl.textContent = ch.body || '(sin instrucciones)';
  }

  if (btnComplete){
    btnComplete.disabled = !hero;
    btnComplete.classList.toggle('is-active', done);
    btnComplete.textContent = done ? '↺ Cancelar' : '✔ Completado';
  }
  if (btnEdit) btnEdit.disabled = (state.role !== 'teacher');
  if (btnDel) btnDel.disabled = (state.role !== 'teacher');
}

  
