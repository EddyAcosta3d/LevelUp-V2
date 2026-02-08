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
      ${canEdit ? `
        <div class="chItemActions" data-edit-only="1">
          <button class="chIconBtn" type="button" data-act="edit" title="Editar" aria-label="Editar">✎</button>
          <button class="chIconBtn chIconBtn--danger" type="button" data-act="del" title="Eliminar" aria-label="Eliminar">🗑</button>
        </div>
      ` : ''}

      <div class="challengeRow">
        <div class="challengeName">${escapeHtml(displayTitle)}</div>
        <div class="challengeMetaRow">
          <span class="chPill chPill--${escapeHtml(String(ch.difficulty||'').toLowerCase())}"><span class="i">⚡</span>${escapeHtml(diffLabel)}</span>
          <span class="chPill chPill--xp"><span class="i">⭐</span>${escapeHtml(String(pts))} XP</span>
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
      // update selected state without rerendering whole list later
      $$('#challengeList .challengeItem').forEach(el=> el.classList.toggle('is-selected', el === item));
    });

    list.appendChild(item);
  });

  renderChallengeDetail();
}


function renderChallengeDetail(){
  const hintEl = $('#challengeHint');
  const bodyEl = $('#challengeBody');
  const btnComplete = $('#btnChallengeComplete');

  const hero = currentHero();
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
    if (bodyEl) bodyEl.innerHTML = '';
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
  const pts = Number(ch.points ?? 0);
  const done = isChallengeDone(hero, ch.id);
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
  if (subEl) subEl.textContent = `${subj}`;

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
    bodyEl.innerHTML = `<div class="chInstrLabel">Instrucciones</div>` + formatBody(ch.body);
  }

  if (btnComplete){
    btnComplete.disabled = !hero;
    btnComplete.classList.toggle('is-active', done);
    btnComplete.classList.toggle('is-done', done);
    btnComplete.textContent = done ? '✅ Completado' : '⏳ Pendiente';
    btnComplete.dataset.state = done ? 'done' : 'pending';
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


  
