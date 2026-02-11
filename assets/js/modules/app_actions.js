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
    safe('Tienda', ()=> { if (typeof renderTienda === 'function') renderTienda(); });
    safe('Datos', updateDataDebug);

    // Celebración global: si se desbloquea un JEFE en cualquier momento,
    // mostramos un overlay a pantalla completa y luego mandamos a la pestaña de Jefes.
    safe('Boss Unlock Overlay', ()=>{
      if (typeof checkBossUnlockOverlay === 'function') checkBossUnlockOverlay();
    });
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


  function bumpHeroXp(delta, opts={}){
    const hero = currentHero();
    if (!hero) return;

    // Apply one-time XP multiplier (only for challenge awards)
    let multiplierUsed = 1;
    try{
      const src = opts && typeof opts === 'object' ? opts.source : null;
      const mult = Number(hero.nextChallengeMultiplier ?? 1);
      if (src === 'challenge' && delta > 0 && mult > 1){
        multiplierUsed = mult;
        delta = delta * mult;
        hero.nextChallengeMultiplier = 1;
      }
    }catch(_e){}

    const originalDelta = delta;
    hero.xp = Number(hero.xp ?? 0) + Number(delta || 0);
    hero.xpMax = Number(hero.xpMax ?? 100);
    hero.level = Number(hero.level ?? 1);
    hero.pendingRewards = Array.isArray(hero.pendingRewards) ? hero.pendingRewards : [];
    hero.rewardsHistory = Array.isArray(hero.rewardsHistory) ? hero.rewardsHistory : [];

    // per-level tracking timestamp (used for bonus medal + stat options)
    if (typeof hero.levelStartAt !== 'number' || !isFinite(hero.levelStartAt)){
      // initialize to "now" so we don't accidentally count old completions as this level
      hero.levelStartAt = Date.now();
    }

    if (hero.xp < 0) hero.xp = 0;

    const computeLevelCtx = ()=>{
      const since = Number(hero.levelStartAt || 0);
      const comp = (hero.challengeCompletions && typeof hero.challengeCompletions==='object') ? hero.challengeCompletions : {};
      const chList = Array.isArray(state.data?.challenges) ? state.data.challenges : [];
      const byId = new Map(chList.map(c=>[String(c.id), c]));

      let total=0, hasMed=false, hasHard=false;
      const subjCount = new Map();

      for (const cid in comp){
        const rec = comp[cid];
        const at = Number(rec?.at || 0);
        if (!at || at < since) continue;
        const ch = byId.get(String(cid));
        if (!ch) continue;
        total += 1;
        const d = String(ch.difficulty||'').toLowerCase();
        if (d === 'medium') hasMed = true;
        if (d === 'hard') hasHard = true;
        const sid = String(ch.subjectId || ch.subject || '');
        if (sid){ subjCount.set(sid, (subjCount.get(sid)||0) + 1); }
      }

      const eligible = (total >= 3 && hasMed && hasHard);

      // Determine top subjects by number of challenges in this level
      let maxN = 0;
      subjCount.forEach(v=>{ if (v>maxN) maxN=v; });
      const topSubjectIds = [];
      subjCount.forEach((v,k)=>{ if (v===maxN && v>0) topSubjectIds.push(k); });

      // subjectId -> linked stats (fallback heuristic)
      const subjects = Array.isArray(state.data?.subjects) ? state.data.subjects : [];
      const subjById = new Map(subjects.map(s=>[String(s.id), s]));
      const guessStats = (name)=>{
        const n = String(name||'').toLowerCase();
        if (/(mat|mate|matem)/.test(n)) return ['INT'];
        if (/(tec|tecnolog)/.test(n)) return ['INT','CRE'];
        if (/(art|arte|diseñ|disen)/.test(n)) return ['CRE'];
        if (/(españ|espan|lect|redac|leng)/.test(n)) return ['SAB'];
        if (/(ingl|english)/.test(n)) return ['CAR'];
        if (/(tutor|civ|conviv)/.test(n)) return ['CAR','SAB'];
        return ['SAB'];
      };
      const normStat = (k)=>{
        const u = String(k||'').toUpperCase();
        return (u==='INT'||u==='SAB'||u==='CAR'||u==='RES'||u==='CRE') ? u : null;
      };

      const allowed = new Set();
      topSubjectIds.forEach(sid=>{
        const subj = subjById.get(String(sid));
        const linked = Array.isArray(subj?.linkedStats) ? subj.linkedStats : guessStats(subj?.name);
        linked.forEach(x=>{ const nk = normStat(x); if (nk) allowed.add(nk); });
      });

      // Fallback: if none detected, allow all
      if (!allowed.size){ ['INT','SAB','CAR','RES','CRE'].forEach(x=>allowed.add(x)); }

      return {
        eligibleForLevelMedal: eligible,
        totalChallenges: total,
        needTotal: Math.max(0, 3-total),
        needMedium: !hasMed,
        needHard: !hasHard,
        allowedStats: Array.from(allowed)
      };
    };

    // Level-up loop (in case someone adds lots of XP)
    let leveledUp = false;
    while (hero.xpMax > 0 && hero.xp >= hero.xpMax){
      // Capture context for the level we are finishing
      const ctx = computeLevelCtx();

      hero.xp -= hero.xpMax;
      hero.level += 1;
      leveledUp = true;

      // Bonus medal for this level (requires >=3 challenges AND at least 1 medium + 1 hard)
      let bonusMedal = false;
      if (ctx.eligibleForLevelMedal){
        hero.medals = Number(hero.medals ?? 0) + 1;
        bonusMedal = true;
      }

      hero.pendingRewards.push({
        level: hero.level,
        createdAt: Date.now(),
        autoStat: {
          required: true,
          applied: false,
          chosen: null,
          options: ctx.allowedStats
        },
        bonusMedal
      });

      // reset per-level window for the NEW level
      hero.levelStartAt = Date.now();
    }

    saveLocal(state.data);
    if (state.dataSource === 'remote') state.dataSource = 'local';
    updateDataDebug();
    renderHeroList();
    renderHeroDetail();

    // CELEBRACIONES VISUALES
    if (delta > 0 && opts.source === 'challenge') {
      // Celebración al completar desafío
      const celebTitle = multiplierUsed > 1 
        ? `¡${multiplierUsed}x XP!` 
        : '¡Desafío Completado!';
      
      if (typeof showBigReward === 'function') {
        showBigReward({
          title: celebTitle,
          subtitle: `+${Math.round(originalDelta)} XP`,
          icon: multiplierUsed > 1 ? '⚡' : '⭐',
          duration: 2000
        });
      }
      
      // Animar barra de XP
      if (typeof animateXpBar === 'function') {
        setTimeout(() => animateXpBar(hero.id), 100);
      }
    }

    if (leveledUp){
      // Extra celebración por subir de nivel
      setTimeout(() => {
        if (typeof showConfetti === 'function') {
          showConfetti();
        }
        openLevelUpModal();
      }, delta > 0 && opts.source === 'challenge' ? 2200 : 0);
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
// Parallax-only art resolver (bg/mid/fg). We no longer use assets/personajes.
const key = (hero && (hero.assetKey || hero.slug || hero.name)) ? String(hero.assetKey || hero.slug || hero.name) : '';
const slug = key.trim().toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_\-]/g,'');
const exts = ['png','PNG','jpg','JPG','jpeg','JPEG','webp','WEBP'];
const urls = [];
for (const ext of exts){
  urls.push(`assets/parallax/${slug}_bg.${ext}`);
  urls.push(`assets/parallax/${slug}_mid.${ext}`);
  urls.push(`assets/parallax/${slug}_fg.${ext}`);
}
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
    const reqId = String(Date.now()) + Math.random().toString(16).slice(2);
    el.dataset.luBgReq = reqId;
    // Clear old art immediately so we never flash the previous hero while loading.
    el.style.backgroundImage = '';
    el.classList.remove('has-art');
    if (!list.length){
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
        if (el.dataset.luBgReq !== reqId) return;
        el.style.backgroundImage = `url('${url}')`;
        el.classList.add('has-art');
      };
      img.onerror = ()=>{
        if (el.dataset.luBgReq !== reqId) return;
        i++;
        tryLoad();
      };
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

    // Cinematic (opción 2): primero el cambio de nivel en primer plano,
    // después aparece el área de recompensas.
    try{ if (state.ui.levelUpCineT) clearTimeout(state.ui.levelUpCineT); }catch(_e){}
    modal.classList.add('is-cine');
    modal.classList.remove('cine-done');

    closeAllModals('levelUpModal');

    // (sin nombre del personaje en el modal)

  // Background (parallax BG solamente).
  const stageBg = $('#levelUpStageBg');
  const heroArt = $('#levelUpHeroArt');
  if (stageBg){
    const key = (hero && (hero.assetKey || hero.slug || hero.name)) ? String(hero.assetKey || hero.slug || hero.name) : '';
    const slug = key.trim().toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_\-]/g,'');
    const exts = ['png','PNG','jpg','JPG','jpeg','JPEG','webp','WEBP'];
    const bgUrls = [];
    for (const ext of exts){
      bgUrls.push(`assets/parallax/${slug}_bg.${ext}`);
    }
    setBgWithFallback(stageBg, bgUrls);
  }

  if (heroArt){
    const artUrls = _uniqueUrls([
      hero.photo,
      hero.img,
      hero.image,
      hero.photoSrc,
      ...resolveHeroArtUrls(hero).filter(u=> /_fg\./i.test(String(u))),
      ...resolveHeroArtUrls(hero)
    ]);
    setBgWithFallback(heroArt, artUrls);
  }

  const numEl = $('#levelUpNum');
    if (numEl){
      // Animate number
      numEl.classList.remove('is-anim');
      const target = Number(pending.level || hero.level || 1);
      const start = Math.max(1, target - 1);
      const t0 = performance.now();
      const dur = 1500;

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

    renderLevelUpChoices('main');
    modal.hidden = false;
    modal.classList.add('is-open');
    try{ document.body.classList.add('levelup-priority'); }catch(_e){}

    // Reveal rewards after the cinematic beat
    state.ui.levelUpCineT = setTimeout(()=>{
      try{ modal.classList.add('cine-done'); }catch(_e){}
    }, 1600);
    // Mobile: always start at the top of the modal (iOS Safari may keep scroll position)
    try{
      const body = modal.querySelector('#levelUpScrollArea');
      if (body) body.scrollTop = 0;
      const card = modal.querySelector('.luCard');
      if (card){ card.setAttribute('tabindex','-1'); card.focus({preventScroll:true}); }
    }catch(_e){}

    try{ modal.style.pointerEvents = 'auto'; }catch(_e){}
    state.ui.levelUpOpen = true;
    try{ document.body.classList.add('is-levelup-open'); }catch(_e){}

    // Persona-like entrance animation (re-trigger every time)
    const card = modal.querySelector('.luCard');
    if (card){
      card.classList.remove('lvlAnim');
      void card.offsetWidth; // force reflow
      card.classList.add('lvlAnim');
    }

    // Stagger reward cards (more "Persona" motion).
    const picks = Array.from(modal.querySelectorAll('.levelupChoicesSimple .pill'));
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

  function closeLevelUpModal(force=false){
    const modal = $('#levelUpModal');
    if (!modal) return;

    try{ if (state.ui.levelUpCineT) clearTimeout(state.ui.levelUpCineT); }catch(_e){}
    state.ui.levelUpCineT = null;
    // If there are pending rewards, do not allow closing.
    try{
      const hero = currentHero();
      const hasPending = !!(hero && Array.isArray(hero.pendingRewards) && hero.pendingRewards.length);
      if (hasPending && !force && !state.ui.claimingReward){
        // shake feedback
        const card = modal.querySelector('.luCard');
        if (card){
          card.classList.remove('lvlShake');
          void card.offsetWidth;
          card.classList.add('lvlShake');
        }
        toast('🎁 Elige una recompensa para continuar');
        return;
      }
    }catch(_e){}

    try{ modal.style.pointerEvents = 'none'; }catch(_e){}
    modal.classList.remove('is-open');
    try{ document.body.classList.remove('levelup-priority'); }catch(_e){}
    try{ document.body.classList.remove('is-levelup-open'); }catch(_e){}
    state.ui.levelUpOpen = false;
    // Wait for exit transition/animation so clicks can't slip through.
    setTimeout(()=>{
      try{ modal.hidden = true; }catch(_e){}
      // reset for next open
      try{ modal.classList.remove('is-cine','cine-done'); }catch(_e){}
      try{ modal.style.pointerEvents = ''; }catch(_e){}
    }, 220);
  }

  function renderLevelUpChoices(mode){
    const hero = currentHero();
    if (!hero) return;
    const pending = getNextPendingReward(hero);
    const grid = $('#levelUpChoices');
    const scrollArea = $('#levelUpScrollArea');
    if (!grid) return;

    grid.innerHTML = '';
    if (!pending) return;

    const auto = pending.autoStat;
    const needsAuto = !!(auto && auto.required && !auto.applied);

    if (needsAuto && mode !== 'autoStat'){
      mode = 'autoStat';
    }

    if (scrollArea){
      const rightSideModes = ['autoStat', 'main', 'statExtra'];
      scrollArea.classList.toggle('luBody--statPick', rightSideModes.includes(mode));
    }

    grid.dataset.mode = mode;

    const statKeysAll = ['INT','SAB','CAR','RES','CRE'];
    const statOptions = Array.isArray(auto?.options) && auto.options.length
      ? auto.options.map(x=>String(x).toUpperCase()).filter(x=>statKeysAll.includes(x))
      : statKeysAll;

    const incStat = (k, amount)=>{
      const key = String(k||'').toUpperCase();
      const low = key.toLowerCase();
      hero.stats = hero.stats && typeof hero.stats === 'object' ? hero.stats : {};
      const cur = Number(hero.stats[low] ?? hero.stats[key] ?? 0);
      const nxt = Math.min(20, cur + Number(amount||0));
      hero.stats[key] = nxt;
      hero.stats[low] = nxt;
      return {cur, nxt};
    };

    if (mode === 'autoStat'){
      const head = document.createElement('div');
      head.className = 'levelUpStatHead';
      head.innerHTML = `
        <div class="levelUpStatHead__title">Elige una stat para subir +1</div>
      `;
      grid.appendChild(head);

      const wrap = document.createElement('div');
      wrap.className = 'levelUpStatsList';
      grid.appendChild(wrap);

      statOptions.forEach((k)=>{
        const lowKey = k.toLowerCase();
        const curVal = Number((hero.stats?.[lowKey] ?? hero.stats?.[k] ?? 0));
        const pct = Math.max(0, Math.min(100, (curVal / 20) * 100));

        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'levelUpStatRow';
        row.setAttribute('aria-label', `Subir ${k} de ${curVal} a ${Math.min(20, curVal + 1)}`);

        const name = document.createElement('div');
        name.className = 'levelUpStatRow__name';
        name.textContent = k;

        const meter = document.createElement('div');
        meter.className = 'levelUpStatRow__meter';
        meter.innerHTML = `<span class="levelUpStatRow__track"><span class="levelUpStatRow__fill" style="width:${pct}%"></span></span>`;

        const valueWrap = document.createElement('div');
        valueWrap.className = 'levelUpStatRow__right';
        valueWrap.innerHTML = `
          <span class="levelUpStatRow__value">${curVal}</span>
          <span class="levelUpStatRow__gain">+1</span>
        `;

        row.addEventListener('click', ()=>{
          incStat(k, 1);
          pending.autoStat.applied = true;
          pending.autoStat.chosen = k;
          saveData();
          renderAll();
          toast(`+1 ${k} aplicado. Ahora elige tu recompensa`);
          renderLevelUpChoices('main');
        });

        row.appendChild(name);
        row.appendChild(meter);
        row.appendChild(valueWrap);
        wrap.appendChild(row);
      });
      return;
    }

    if (mode === 'statExtra'){
      const header = document.createElement('div');
      header.style.display = 'flex';
      header.style.gap = '10px';
      header.style.alignItems = 'center';
      header.style.justifyContent = 'space-between';
      header.innerHTML = '<div class="small muted">Elige una stat extra</div>';
      const backBtn = document.createElement('button');
      backBtn.type = 'button';
      backBtn.className = 'pill pill--small pill--ghost';
      backBtn.textContent = '← Volver';
      backBtn.addEventListener('click', ()=> renderLevelUpChoices('main'));
      header.appendChild(backBtn);
      grid.appendChild(header);

      const wrap2 = document.createElement('div');
      wrap2.className = 'levelupChoicesSimple';
      grid.appendChild(wrap2);

      statKeysAll.forEach((k)=>{
        const lowKey = k.toLowerCase();
        const curVal = Number((hero.stats?.[lowKey] ?? hero.stats?.[k] ?? 0));
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'pill';
        btn.textContent = `${k} +1 (Actual: ${curVal})`;
        btn.addEventListener('click', ()=>{
          incStat(k, 1);
          claimPendingReward({
            rewardId: 'stat+1',
            title: `+1 ${k}`,
            badge: '+1 stat'
          });
        });
        wrap2.appendChild(btn);
      });
      return;
    }

    
    // --- main rewards ---
    const rewardsHead = document.createElement('div');
    rewardsHead.className = 'levelUpStatHead';
    rewardsHead.innerHTML = '<div class="levelUpStatHead__title">Elige tu recompensa</div>';
    grid.appendChild(rewardsHead);

    const opts = [
      { id:'stat+1', kind:'stat', title:'+1 stat extra' },
      { id:'xp+30', kind:'xp', title:'+30 XP' },
      { id:'medal+1', kind:'medal', title:'+1 medalla' },
      { id:'doubleNext', kind:'x2', title:'Doble XP' }
    ];

    const wrap = document.createElement('div');
    wrap.className = 'levelUpStatsList levelUpStatsList--rewards';
    grid.appendChild(wrap);

    opts.forEach((o)=>{
      const div = document.createElement('button');
      div.type = 'button';
      div.className = 'levelUpStatRow levelUpRewardRow';
      const rewardMeta = {
        'stat+1': { label: 'STAT', value: '+1', detail: 'Mejora extra' },
        'xp+30': { label: 'XP', value: '+30', detail: 'Sin subir de nivel' },
        'medal+1': { label: 'MED', value: '+1', detail: 'Medalla instantánea' },
        'doubleNext': { label: 'x2', value: 'NEXT', detail: 'Próximo desafío' }
      }[o.id] || { label: 'BONUS', value: '+', detail: '' };

      div.innerHTML = `
        <span class="levelUpStatRow__name">${rewardMeta.label}</span>
        <span class="levelUpRewardRow__titleWrap">
          <span class="levelUpRewardRow__title">${o.title}</span>
          <span class="levelUpRewardRow__detail">${rewardMeta.detail}</span>
        </span>
        <span class="levelUpRewardRow__right">
          <span class="levelUpRewardRow__value">${rewardMeta.value}</span>
        </span>
      `;

      div.addEventListener('click', ()=>{
        if (o.id === 'stat+1'){
          renderLevelUpChoices('statExtra');
          return;
        }

        if (o.id === 'xp+30'){
          const xpMax = Number(hero.xpMax ?? 100);
          const cur = Number(hero.xp ?? 0);
          // Allow at least 5 XP even near level-up (capped at xpMax - 1 to prevent accidental level-up)
          const safeCap = Math.max(0, xpMax - 1);
          const add = Math.max(5, Math.min(30, safeCap - cur));
          // If hero is so close that even 5 XP would level up, clamp to safeCap - cur (min 1)
          const finalAdd = Math.max(1, Math.min(add, safeCap - cur));
          if (finalAdd > 0){
            hero.xp = cur + finalAdd;
            hero.totalXp = Number(hero.totalXp ?? 0) + finalAdd;
            saveData();
            renderAll();
          }
          claimPendingReward({ rewardId:'xp+30', title:`+${finalAdd} XP`, badge:'+XP' });
          return;
        }

        if (o.id === 'medal+1'){
          hero.medals = Number(hero.medals ?? 0) + 1;
          saveData();
          renderAll();
          claimPendingReward({ rewardId:'medal+1', title:'+1 medalla', badge:'+Medalla' });
          return;
        }

        if (o.id === 'doubleNext'){
          hero.nextChallengeMultiplier = 2;
          saveData();
          renderAll();
          claimPendingReward({ rewardId:'doubleNext', title:'Doble XP (siguiente desafío)', badge:'x2 XP' });
          return;
        }
      });

      wrap.appendChild(div);
    });
}

  function claimPendingReward({rewardId, title, badge}){
    const hero = currentHero();
    if (!hero) return;

    // Guard: prevent double-claim / multiple handlers firing
    if (state.ui.claimingReward) return;
    state.ui.claimingReward = true;

    // Disable UI immediately
    const grid = $('#levelUpChoices');
    if (grid){
      grid.classList.add('is-claiming');
      if (typeof uiLock === 'function') uiLock(grid, true, { selector: 'button' });
      else grid.querySelectorAll('button').forEach(b=>{ b.disabled = true; });
    }

    // Close the modal right away so you can't chain-claim quickly
    closeLevelUpModal(true);

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
        autoStatChosen: pending?.autoStat?.chosen || null,
        bonusMedal: !!pending?.bonusMedal,
        date: new Date().toISOString()
      });

      saveLocal(state.data);
      if (state.dataSource === 'remote') state.dataSource = 'local';
      updateDataDebug();
      renderAll();

      // Sync inline "Reclamar" button visibility immediately (even if current tab doesn't re-render)
      try{
        const btn = document.getElementById('btnClaimPendingInline');
        const badgeEl = document.getElementById('pendingRewardCountInline');
        const n = Array.isArray(hero?.pendingRewards) ? hero.pendingRewards.filter(p=>p && Number.isFinite(Number(p.level??p)) && Number(p.level??p)>=2 && Number(p.level??p)<=Number(hero.level||0)).length : 0;
        if (btn) btn.hidden = !(n > 0);
        if (badgeEl){
          badgeEl.hidden = !(n > 0);
          if (n > 0) badgeEl.textContent = String(n);
        }
      }catch(_e){}


      toast('✅ Recompensa reclamada');

      // If more pending rewards remain, just nudge (do not auto-open)
      if (hero.pendingRewards.length){
        setTimeout(()=> toast('🎁 Te falta reclamar otra recompensa'), 650);
      }
    } finally {
      state.ui.claimingReward = false;
      if (grid){
        grid.classList.remove('is-claiming');
        if (typeof uiLock === 'function') uiLock(grid, false, { selector: 'button' });
        else grid.querySelectorAll('button').forEach(b=>{ b.disabled = false; });
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
