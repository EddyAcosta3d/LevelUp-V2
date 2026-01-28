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

  // “Edición” sin PIN aún (solo demo)
  function setRole(nextRole){
    state.role = nextRole;
    try{ document.documentElement.classList.toggle('is-edit', state.role === 'teacher'); }catch(_e){}
    updateEditButton();
    applyFichaLock();
    updateDataDebug();
    renderChallengeDetail();
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
  
  // --- Photo Fit Editor (encuadre + zoom) ---
  state.ui = state.ui || {};
  state.ui.photoEditOpen = false;

  function openPhotoModal(){
    const hero = currentHero();
    if (!hero) return;
    const modal = $('#photoModal');
    if (!modal) return;

    closeAllModals('photoModal');

    // Ensure fit defaults
    hero.photoFit = hero.photoFit || { x:50, y:50, scale:1 };

    // Ensure we have a source
    const src = hero.photo || hero.img || hero.image || hero.photoSrc || '';
    if (!src){
      // no image yet -> open picker
      const file = $('#fileHeroPhoto');
      file && (file.value='');
      file && file.click();
      return;
    }

    const previewBox = $('#photoPreviewBox');

    // Match the real avatar frame size so the encuadre is 1:1 with what se verá
    const frame = $('#avatarFrame');
    if (frame && previewBox){
      const r = frame.getBoundingClientRect();
      // fallback in case width is 0 (hidden)
      const w = Math.max(220, Math.round(r.width || 280));
      const h = Math.max(240, Math.round(r.height || 320));
      previewBox.style.setProperty('--photoPreviewW', w + 'px');
      previewBox.style.setProperty('--photoPreviewH', h + 'px');
    }
    previewBox.replaceChildren();
    const img = document.createElement('img');
    img.id = 'photoPreviewImg';
    img.setAttribute('draggable','false');
    img.draggable = false;
    img.addEventListener('dragstart', (e)=>{ e.preventDefault(); });
    img.src = src;
    img.alt = 'Previsualización';
    img.loading = 'eager';
    previewBox.appendChild(img);
    applyPhotoFit(img, hero);

    const zoom = $('#photoZoom');
    zoom.value = String(hero.photoFit.scale ?? 1);

    // drag to pan
    let dragging = false;
    let startX = 0, startY = 0;
    let startFit = null;

    const onDown = (e)=>{
      dragging = true;
      previewBox.setPointerCapture(e.pointerId);
      startX = e.clientX;
      startY = e.clientY;
      startFit = { x: hero.photoFit.x, y: hero.photoFit.y, scale: hero.photoFit.scale };
    };
    const onMove = (e)=>{
      if (!dragging) return;
      const rect = previewBox.getBoundingClientRect();
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const nx = startFit.x - (dx / rect.width) * 100;
      const ny = startFit.y - (dy / rect.height) * 100;
      hero.photoFit.x = Math.max(0, Math.min(100, nx));
      hero.photoFit.y = Math.max(0, Math.min(100, ny));
      applyPhotoFit(img, hero);
      // update labels
      const lbl = $('#photoPosLabel');
      if (lbl) lbl.textContent = `${Math.round(hero.photoFit.x)}% · ${Math.round(hero.photoFit.y)}%`;
    };
    const onUp = ()=>{ dragging = false; };

    // bind listeners (overwrite previous)
    previewBox.onpointerdown = onDown;
    previewBox.onpointermove = onMove;
    previewBox.onpointerup = onUp;
    previewBox.onpointercancel = onUp;

    // zoom slider
    zoom.oninput = ()=>{
      hero.photoFit.scale = Number(zoom.value || 1);
      applyPhotoFit(img, hero);
      const zlbl = $('#photoZoomLabel');
      if (zlbl) zlbl.textContent = `${Math.round(hero.photoFit.scale*100)}%`;
    };

    // reset
    $('#btnPhotoReset')?.addEventListener('click', ()=>{
      hero.photoFit = { x:50, y:50, scale:1 };
      zoom.value = '1';
      applyPhotoFit(img, hero);
      const lbl = $('#photoPosLabel');
      if (lbl) lbl.textContent = `50% · 50%`;
      const zlbl = $('#photoZoomLabel');
      if (zlbl) zlbl.textContent = `100%`;
    }, { once:true });

    // change image (optional)
    $('#btnPhotoChange')?.addEventListener('click', ()=>{
      const file = $('#fileHeroPhoto');
      if (!file) return;
      file.value = '';
      file.click();
    }, { once:true });

    // save
    $('#btnPhotoSave')?.addEventListener('click', ()=>{
      saveLocal(state.data);
      if (state.dataSource === 'remote') state.dataSource = 'local';
      updateDataDebug();
      closePhotoModal();
      renderHeroDetail();
      renderHeroList();
      toast('Foto guardada.');
    }, { once:true });

    $('#btnPhotoCancel')?.addEventListener('click', ()=>{
      // Do not revert fit (simple). If you want revert, we'd need snapshot. Keep simple.
      closePhotoModal();
      renderHeroDetail();
    }, { once:true });

    modal.hidden = false;
    state.ui.photoEditOpen = true;

    // Update labels
    const lbl = $('#photoPosLabel');
    if (lbl) lbl.textContent = `${Math.round(hero.photoFit.x)}% · ${Math.round(hero.photoFit.y)}%`;
    const zlbl = $('#photoZoomLabel');
    if (zlbl) zlbl.textContent = `${Math.round((hero.photoFit.scale||1)*100)}%`;
  }

  function closePhotoModal(){
    const modal = $('#photoModal');
    if (!modal) return;
    modal.hidden = true;
    state.ui.photoEditOpen = false;
  }


  // --- Level Up Modal + reward claiming ---
  state.ui.levelUpOpen = false;
  state.ui.pendingToastHeroId = null;
  state.ui.claimingReward = false;

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

    $('#levelUpHeroName').textContent = hero.name || '(sin nombre)';
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

    // Mini notification while pending
    toast('🎁 Tienes una recompensa por reclamar');
  }

  function closeLevelUpModal(){
    const modal = $('#levelUpModal');
    if (!modal) return;
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
      statKeys.forEach(k=>{
        const lowKey = k.toLowerCase();
        // IMPORTANT: UI uses lowercase keys; prefer them to avoid desync issues.
        const curVal = Number((hero.stats?.[lowKey] ?? hero.stats?.[k] ?? 0));

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'rewardPick rewardPick--stat';
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
      { id:'weekMax+10', icon:'📈', title:'+10 al límite semanal', desc:'Aumenta el máximo de XP semanal.' },
      { id:'token+1', icon:'🪙', title:'+1 comodín', desc:'Un comodín para canjear después.' },
      { id:'perk', icon:'✨', title:'Privilegio en clase', desc:'Un privilegio acordado contigo.' }
    ];

    opts.forEach(o=>{
      const div = document.createElement('button');
      div.type = 'button';
      div.className = 'rewardPick';
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
        resolve(val);
      };
      okBtn.onclick = ()=> cleanup(true);
      cancelBtn.onclick = ()=> cleanup(false);
      modal.hidden = false;
    });
  }
