  function renderPeopleTable(){
    const box = $('#peopleTable');
    const heroes = state.data?.heroes || [];
    box.innerHTML = '';
    const header = document.createElement('div');
    header.className = 'tr th';
    header.innerHTML = '<div>Nombre</div><div>Nivel</div><div>Rol</div><div>XP</div>';
    box.appendChild(header);

    heroes.forEach(h=>{
      const tr = document.createElement('div');
      tr.className = 'tr';
      tr.innerHTML = `
        <div>${escapeHtml(h.name || '—')}</div>
        <div>${escapeHtml(String(h.level ?? '—'))}</div>
        <div>${escapeHtml((h.role && h.role.trim()) ? h.role : '—')}</div>
        <div>${escapeHtml(String((h.xp ?? 0) + '/' + (h.xpMax ?? 100)))}</div>
      `;
      box.appendChild(tr);
    });
  }

  function renderAll(){
    const safe = (name, fn) => {
      try { fn(); }
      catch (err) {
        console.error(`[render:${name}]`, err);
        toast(`⚠️ Error en ${name}`);
      }
    };

    safe('Fichas (lista)', renderHeroList);
    safe('Fichas (detalle)', renderHeroDetail);
    safe('Desafíos', renderChallenges);
    safe('Eventos', renderEvents);
    safe('Personas', renderPeopleTable);
    safe('Datos', updateDataDebug);
  }

  // Modo público: SOLO VER (sin PIN, sin edición dentro de la app)
function setRole(nextRole){
    state.role = nextRole;
    try{ document.documentElement.classList.toggle('is-edit', state.role === 'teacher'); }catch(_e){}
    updateEditButton();
    applyFichaLock();
    updateDataDebug();
    // Re-render lists so action buttons (editar/borrar) appear immediately on load
    try{ if (typeof renderChallenges === 'function') renderChallenges(); }catch(e){}
    try{ if (typeof renderChallengeDetail === 'function') renderChallengeDetail(); }catch(e){}
    try{ if (typeof renderEvents === 'function') renderEvents(); }catch(e){}
    toast(state.role === 'teacher' ? 'Edición activada' : 'Modo solo ver');
  }

  function bumpHeroXp(delta){
    const hero = currentHero();
    if (!hero) return;

    hero.xp = Number(hero.xp ?? 0) + Number(delta || 0);
    hero.xpMax = Number(hero.xpMax ?? 100);
    hero.level = Number(hero.level ?? 1);
    hero.pendingRewards = Array.isArray(hero.pendingRewards) ? hero.pendingRewards : [];
    hero.rewardsHistory = Array.isArray(hero.rewardsHistory) ? hero.rewardsHistory : [];

    // clamp low
    if (hero.xp < 0) hero.xp = 0;

    // Level-up loop (in case someone adds lots of XP)
    let leveledUp = false;
    while (hero.xpMax > 0 && hero.xp >= hero.xpMax){
      hero.xp -= hero.xpMax;
      hero.level += 1;
      leveledUp = true;
      hero.pendingRewards.push({ level: hero.level, createdAt: Date.now() });
    }

    saveLocal(state.data);
    if (state.dataSource === 'remote') state.dataSource = 'local';
    updateDataDebug();
    renderHeroList();
    renderHeroDetail();

    if (leveledUp){
      // Open celebration modal for the most recent pending reward
      openLevelUpModal();
    }
  }

  // Import / Export (para tu flujo offline con iPad)
  async function handleImportJson(file){
    try{
      const text = await file.text();
      const data = JSON.parse(text);
      data.meta = data.meta || {};
      data.meta.updatedAt = data.meta.updatedAt || new Date().toISOString();

      state.data = normalizeData(data);
      state.dataSource = 'local';
      saveLocal(state.data);

      updateDataDebug();
      renderAll();
      toast(`JSON importado: ${file.name}`);
    }catch(err){
      console.error(err);
      toast('Error al importar JSON');
    }
  }

  function handleExportJson(){
    const data = state.data || demoData();
    data.meta = data.meta || {};
    data.meta.updatedAt = new Date().toISOString();

    const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const d = new Date();
    const pad = (n)=>String(n).padStart(2,'0');
    const fname = `LevelUp_backup_${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}.json`;
    a.download = fname;
    a.click();
    URL.revokeObjectURL(a.href);
    toast('Exportado JSON');
  }
  // Bind
  
  // --- Level Up Modal + reward claiming ---
  state.ui = state.ui || {};
  state.ui.levelUpOpen = false;
  state.ui.pendingToastHeroId = null;
  state.ui.claimingReward = false;

  // --- helpers: hero art (prefer parallax foreground layer) ---
  function _slugify(str){
    try{
      return String(str||'')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}+/gu,'')
        .replace(/[^a-z0-9]+/g,'_')
        .replace(/^_+|_+$/g,'');
    }catch(e){
      return String(str||'').trim().toLowerCase().replace(/\s+/g,'_');
    }
  }

  function _uniqueUrls(arr){
    const out = [];
    const seen = new Set();
    (arr||[]).forEach(u=>{
      if (!u) return;
      const key = String(u);
      if (seen.has(key)) return;
      seen.add(key);
      out.push(key);
    });
    return out;
  }

  function resolveHeroArtUrls(hero){
    const urls = [];
    if (!hero) return urls;

    // 1) Explicit fields (highest priority)
    if (hero.levelUpFg) urls.push(hero.levelUpFg);
    if (hero.levelUpArt) urls.push(hero.levelUpArt);

    // 2) Prefer full character renders in assets/personajes/<Name>.png (more "victory screen" than close-up FG)
    const rawName = hero.assetName || hero.assetKey || hero.name || hero.id || '';
    const safeName = (typeof sanitizeFileName === 'function')
      ? sanitizeFileName(rawName)
      : _slugify(rawName);
    if (safeName){
      urls.push(`assets/personajes/${safeName}.png`);
      urls.push(`assets/personajes/${safeName}.jpg`);
      urls.push(`assets/personajes/${safeName}.jpeg`);
      // Also allow "Name 2D" style keys if you ever add them later
      urls.push(`assets/personajes/${safeName}_full.png`);
    }

    // 3) Parallax convention: assets/parallax/<slug>_fg.png (usually a close-up / mid-shot)
    const key = hero.assetKey || hero.slug || _slugify(hero.name || hero.id || '');
    if (key){
      urls.push(`assets/parallax/${key}_fg.png`);
      urls.push(`assets/parallax/${key}_mid.png`);
      urls.push(`assets/parallax/${key}_bg.png`);
    }

    // 4) Fallbacks: photo fields
    if (hero.fg) urls.push(hero.fg);
    if (hero.foreground) urls.push(hero.foreground);
    if (hero.photo) urls.push(hero.photo);
    if (hero.photoSrc) urls.push(hero.photoSrc);

    return _uniqueUrls(urls);
  }


// Back-compat helper: some parts of the app still call this name.
// We prefer returning FG first (resolveHeroArtUrls already does).
function _heroArtCandidates(hero){
  return resolveHeroArtUrls(hero);
}

  function setBgWithFallback(el, urls){
    if (!el) return;
    const list = _uniqueUrls(urls);
    if (!list.length){
      el.style.backgroundImage = '';
      el.classList.remove('has-art');
      return;
    }
    let i = 0;
    const tryLoad = ()=>{
      if (i >= list.length){
        el.style.backgroundImage = '';
        el.classList.remove('has-art');
        return;
      }
      const url = list[i];
      const img = new Image();
      img.onload = ()=>{
        el.style.backgroundImage = `url('${url}')`;
        el.classList.add('has-art');
      };
      img.onerror = ()=>{ i++; tryLoad(); };
      img.src = url;
    };
    tryLoad();
  }

  function getNextPendingReward(hero){
    const list = Array.isArray(hero.pendingRewards) ? hero.pendingRewards : [];
    if (!list.length) return null;
    // Pick the oldest pending (FIFO)
    return list[0];
  }

  function openLevelUpModal(){
    const hero = currentHero();
    if (!hero) return;
    const pending = getNextPendingReward(hero);
    if (!pending) return;

    const modal = $('#levelUpModal');
    if (!modal) return;

    closeAllModals('levelUpModal');

    // Fill header
    $('#levelUpHeroName').textContent = hero.name || '(sin nombre)';

    // Hero art: prefer parallax foreground (the layer that includes the character).
    const artEl = $('#levelUpHeroArt');
    if (artEl){
      const urls = _heroArtCandidates(hero);
      if (urls.length){
        // Use shared helper to set background-image with fallback candidates.
        // (Older code referenced _setBgWithFallback; keep call site aligned.)
        setBgWithFallback(artEl, urls);
        artEl.classList.remove('is-empty');
      } else {
        artEl.style.backgroundImage = '';
        artEl.classList.add('is-empty');
      }
    }
    const numEl = $('#levelUpNum');
    if (numEl){
      // Animate number
      numEl.classList.remove('is-anim');
      const target = Number(pending.level || hero.level || 1);
      const start = Math.max(1, target - 1);
      const t0 = performance.now();
      const dur = 520;

      const tick = (t)=>{
        const k = Math.min(1, (t - t0)/dur);
        const val = Math.round(start + (target-start)*k);
        numEl.textContent = String(val);
        if (k < 1) requestAnimationFrame(tick);
        else {
          numEl.textContent = String(target);
          // pop animation
          requestAnimationFrame(()=> numEl.classList.add('is-anim'));
        }
      };
      requestAnimationFrame(tick);
    }

    renderRewardPickGrid('main');
    modal.hidden = false;
    modal.classList.add('is-open');
    state.ui.levelUpOpen = true;

    // Persona-like entrance animation (re-trigger every time)
    const card = modal.querySelector('.modal__card--levelup');
    if (card){
      card.classList.remove('lvlAnim');
      void card.offsetWidth; // force reflow
      card.classList.add('lvlAnim');
    }

    // Stagger reward cards (more "Persona" motion).
    const picks = Array.from(modal.querySelectorAll('.rewardPick'));
    if (picks.length){
      picks.forEach((el, i)=>{
        el.classList.remove('lvlRewardIn');
        // ensure we can re-trigger even if modal opened twice in a row
        void el.offsetWidth;
        el.style.animationDelay = (0.22 + i * 0.06).toFixed(2) + 's';
        el.classList.add('lvlRewardIn');
      });
    }

    // Mini notification while pending
    toast('🎁 Tienes una recompensa por reclamar');
  }

  function closeLevelUpModal(){
    const modal = $('#levelUpModal');
    if (!modal) return;
    // If there are pending rewards, do not allow closing.
    try{
      const hero = currentHero();
      const hasPending = !!(hero && Array.isArray(hero.pendingRewards) && hero.pendingRewards.length);
      if (hasPending){
        // shake feedback
        const card = modal.querySelector('.modal__card--levelup');
        if (card){
          card.classList.remove('lvlShake');
          void card.offsetWidth;
          card.classList.add('lvlShake');
        }
        toast('🎁 Elige una recompensa para continuar');
        return;
      }
    }catch(_e){}

    modal.hidden = true;
    modal.classList.remove('is-open');
    state.ui.levelUpOpen = false;
  }

  function renderRewardPickGrid(mode){
    const hero = currentHero();
    if (!hero) return;
    const pending = getNextPendingReward(hero);
    const grid = $('#rewardPickGrid');
    if (!grid) return;

    grid.innerHTML = '';

    if (mode === 'stat'){
      // Header row: title + back
      const head = document.createElement('div');
      head.className = 'levelUpStatHead';
      head.innerHTML = `
        <div class="levelUpStatHead__title">Elige una stat</div>
        <button class="pill pill--small pill--ghost" type="button" id="btnLevelUpBack">← Volver</button>
      `;
      grid.appendChild(head);

      const backBtn = head.querySelector('#btnLevelUpBack');
      backBtn?.addEventListener('click', ()=> renderRewardPickGrid('main'));

      const statKeys = ['INT','SAB','CAR','RES','CRE'];
      statKeys.forEach((k, idx)=>{
        const lowKey = k.toLowerCase();
        // IMPORTANT: UI uses lowercase keys; prefer them to avoid desync issues.
        const curVal = Number((hero.stats?.[lowKey] ?? hero.stats?.[k] ?? 0));

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'rewardPick rewardPick--stat';
        // Stagger reveal animation
        btn.style.animationDelay = `${idx * 60}ms`;
        btn.innerHTML = `
          <div class="rewardPick__title">${k}</div>
          <div class="rewardPick__meta"><span class="badge badge--mini">${curVal}</span><span class="rewardPick__plus">+1</span></div>
        `;
        btn.addEventListener('click', ()=>{
          hero.stats = hero.stats && typeof hero.stats === 'object' ? hero.stats : {};
          // Prefer lowercase to match what is rendered.
          const current = Number((hero.stats[lowKey] ?? hero.stats[k] ?? 0));
          const next = Math.min(20, current + 1);
          // Mantener sincronizadas llaves mayúsculas y minúsculas (UI usa minúsculas)
          hero.stats[k] = next;
          hero.stats[lowKey] = next;

          claimPendingReward({
            rewardId: 'stat+1',
            title: `+1 ${k}`,
            badge: '+1 stat'
          });
        });
        grid.appendChild(btn);
      });
      return;
    }

    // main rewards
    const opts = [
      { id:'stat+1', icon:'⚡', title:'+1 a una estadística', desc:'Elige una stat para subir en +1.' },
      // Reemplazo del “límite semanal” (los desafíos ya no tienen tope)
      { id:'xp+10', icon:'⭐', title:'+10 XP', desc:'Un empujón extra en tu barra de XP.' },
      { id:'token+1', icon:'🪙', title:'+1 comodín', desc:'Un comodín para canjear después.' },
      { id:'perk', icon:'✨', title:'Privilegio en clase', desc:'Un privilegio acordado contigo.' }
    ];

    opts.forEach((o, idx)=>{
      const div = document.createElement('button');
      div.type = 'button';
      div.className = 'rewardPick';
      // Stagger reveal animation
      div.style.animationDelay = `${idx * 70}ms`;
      div.innerHTML = `
        <div class="rewardPick__row">
          <div class="rewardPick__icon" aria-hidden="true">${escapeHtml(o.icon)}</div>
          <div class="rewardPick__main">
            <div class="rewardPick__title">${escapeHtml(o.title)}</div>
            <div class="rewardPick__desc">${escapeHtml(o.desc)}</div>
          </div>
        </div>
      `;
      div.addEventListener('click', ()=>{
        if (!pending) return;

        if (o.id === 'stat+1'){
          renderRewardPickGrid('stat');
          return;
        }

        if (o.id === 'xp+10'){
          // Suma XP sin detonar otro nivel inmediato (evita cadena de modales).
          const xpMax = Number(hero.xpMax ?? 100);
          const cur = Number(hero.xp ?? 0);
          const safeCap = Math.max(0, xpMax - 1);
          const add = Math.max(0, Math.min(10, safeCap - cur));
          if (add > 0){
            hero.xp = cur + add;
            hero.totalXp = Number(hero.totalXp ?? 0) + add;
            saveData();
            renderAll();
          }
          claimPendingReward({
            rewardId: 'xp+10',
            title: `+${add} XP`,
            badge: '+XP'
          });
          return;
        }

        if (o.id === 'weekMax+10'){
          hero.weekXpMax = Number(hero.weekXpMax ?? DEFAULT_WEEK_XP_MAX) + 10;
        }else if (o.id === 'token+1'){
          hero.tokens = Number(hero.tokens ?? 0) + 1;
        }else if (o.id === 'perk'){
          // just record it; we can later add a field for details
        }

        claimPendingReward({ rewardId: o.id, title: o.title, badge: o.id });
      });

      grid.appendChild(div);
    });
  }

  function claimPendingReward({rewardId, title, badge}){
    const hero = currentHero();
    if (!hero) return;

    // Guard: prevent double-claim / multiple handlers firing
    if (state.ui.claimingReward) return;
    state.ui.claimingReward = true;

    // Disable UI immediately
    const grid = $('#rewardPickGrid');
    if (grid){
      grid.classList.add('is-claiming');
      grid.querySelectorAll('button').forEach(b=>{ b.disabled = true; });
    }

    // Close the modal right away so you can't chain-claim quickly
    closeLevelUpModal();

    try{
      hero.pendingRewards = Array.isArray(hero.pendingRewards) ? hero.pendingRewards : [];
      const pending = hero.pendingRewards.shift(); // FIFO
      if (!pending) return;

      hero.rewardsHistory = Array.isArray(hero.rewardsHistory) ? hero.rewardsHistory : [];
      hero.rewardsHistory.push({
        level: pending.level,
        rewardId,
        title,
        badge,
        date: new Date().toISOString()
      });

      saveLocal(state.data);
      if (state.dataSource === 'remote') state.dataSource = 'local';
      updateDataDebug();
      renderAll();

      toast('✅ Recompensa reclamada');

      // If more pending rewards remain, just nudge (do not auto-open)
      if (hero.pendingRewards.length){
        setTimeout(()=> toast('🎁 Te falta reclamar otra recompensa'), 650);
      }
    } finally {
      state.ui.claimingReward = false;
      if (grid){
        grid.classList.remove('is-claiming');
        grid.querySelectorAll('button').forEach(b=>{ b.disabled = false; });
      }
    }
  }

  // --- Confirm modal (replaces browser confirm) ---
  function openConfirmModal({title='Confirmar', message='¿Seguro?', okText='Aceptar', cancelText='Cancelar'}){
    return new Promise((resolve)=>{
      const modal = $('#confirmModal');
      if (!modal){ resolve(window.confirm(message)); return; }
	      closeAllModals('confirmModal');
      try{ document.body.classList.add('is-modal-open'); }catch(e){}
      $('#confirmTitle').textContent = title;
      const msgEl = $('#confirmMessage');
      if (msgEl){
        msgEl.textContent = message || '';
        msgEl.style.display = message ? '' : 'none';
      }
      const okBtn = $('#btnConfirmOk');
      const cancelBtn = $('#btnConfirmCancel');
      okBtn.textContent = okText;
      cancelBtn.textContent = cancelText;

      const cleanup = (val)=>{
        okBtn.onclick = null;
        cancelBtn.onclick = null;
        modal.hidden = true;
        try{ if (typeof syncModalOpenState==='function') syncModalOpenState(); }catch(e){}
        resolve(val);
      };
      okBtn.onclick = ()=> cleanup(true);
      cancelBtn.onclick = ()=> cleanup(false);
      modal.hidden = false;
      try{ if (typeof syncModalOpenState==='function') syncModalOpenState(); }catch(e){}
    });
  }