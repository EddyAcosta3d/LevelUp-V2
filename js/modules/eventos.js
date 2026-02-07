  // --- Image helpers (supports .jpg/.png swaps and folder swaps: /eventos/ <-> /jefes/) ---
  function _eventImageCandidates(src){
    if (!src || typeof src !== 'string') return [];
    const out = [];
    const add = (s) => { if (s && !out.includes(s)) out.push(s); };
    add(src);

    // Extension swaps (including .webp)
    const extSwaps = [
      [/\.jpg$/i, '.png'], [/\.jpg$/i, '.webp'],
      [/\.png$/i, '.jpg'], [/\.png$/i, '.webp'],
      [/\.webp$/i, '.png'], [/\.webp$/i, '.jpg']
    ];
    extSwaps.forEach(([re, rep]) => { if (re.test(src)) add(src.replace(re, rep)); });

    // Folder swaps
    if (src.includes('/eventos/')) add(src.replace('/eventos/', '/jefes/'));
    if (src.includes('/jefes/')) add(src.replace('/jefes/', '/eventos/'));
    if (src.includes('/bosses/')) add(src.replace('/bosses/', '/jefes/'));
    if (src.includes('/jefes/')) add(src.replace('/jefes/', '/bosses/'));

    // Combine folder+ext swaps
    out.slice().forEach(s => {
      extSwaps.forEach(([re, rep]) => { if (re.test(s)) add(s.replace(re, rep)); });
    });

    return out;
  }

  function _setEventBgImage(el, preferredSrc){
    if (!el) return;
    const candidates = _eventImageCandidates(preferredSrc);
    if (!candidates.length){
      el.style.backgroundImage = '';
      return;
    }

    let i = 0;
    const tryNext = () => {
      const src = candidates[i];
      const img = new Image();
      img.onload = () => { el.style.backgroundImage = `url(${src})`; };
      img.onerror = () => {
        i += 1;
        if (i < candidates.length) tryNext();
        else el.style.backgroundImage = '';
      };
      img.src = src;
    };
    tryNext();
  }

  function openEventModal(eventId){
    const modal = $('#eventModal');
    if (!modal) return;
    closeAllModals('eventModal');

    const hero = currentHero();
    const ev = (state.data?.events || []).find(e=>e.id === eventId);
    if (!ev) return;

    const unlocked = isEventUnlocked(ev);
    const eligible = hero ? isHeroEligibleForEvent(hero, ev) : false;

    const kindLabel = ev.kind === 'boss' ? 'JEFE' : 'EVENTO';
    const stateLabel = unlocked ? (eligible ? 'LISTO' : 'DESBLOQ.') : 'BLOQUEADO';
    const eligLabel = unlocked ? (eligible ? 'ELEGIBLE' : 'NO ELEGIBLE') : '—';

    const titleEl = $('#eventModalTitle');
    if (titleEl) titleEl.textContent = unlocked ? (ev.title || 'Evento') : '?????';

    const kindEl = $('#eventModalKind');
    if (kindEl) kindEl.textContent = kindLabel;

    const statePill = $('#eventModalState');
    if (statePill) statePill.textContent = stateLabel;
    const eligPill = $('#eventModalElig');
    if (eligPill) eligPill.textContent = eligLabel;

    const stamp = $('#eventModalStamp');
    if (stamp) stamp.textContent = unlocked ? (ev.title || kindLabel) : '?????';


    const subtitleEl = $('#eventModalSubtitle');
    if (subtitleEl){
      // Single line hint: unlock requirement while locked; eligibility requirement once unlocked
      subtitleEl.textContent = unlocked
        ? (ev.eligibility?.label || 'Cumple los requisitos para retarlo.')
        : (ev.unlock?.label || 'Requisito para desbloquear');
    }

    const img = $('#eventModalImg');
    if (img){
      img.classList.toggle('is-locked', !unlocked);
      const src = unlocked ? ev.image : ev.lockedImage;
      _setEventBgImage(img, src);
    }

    // --- Requirements + progress meters ---
    const unlockText = $('#eventModalUnlockText');
    const unlockMini = $('#eventModalUnlockMini');
    const unlockMeter = $('#eventModalUnlockMeter');
    const eligReq = $('#eventModalReq');
    const eligMini = $('#eventModalEligMini');
    const eligMeter = $('#eventModalEligMeter');

    // Defaults
    if (unlockText) unlockText.textContent = (ev.unlock?.label || '—');
    if (eligReq) eligReq.textContent = (ev.eligibility?.label || '—');
    if (unlockMini) unlockMini.textContent = '';
    if (eligMini) eligMini.textContent = '';
    if (unlockMeter) unlockMeter.style.width = '0%';
    if (eligMeter) eligMeter.style.width = '0%';

    // Unlock progress
    try{
      const info = (typeof getEventUnlockProgress === 'function') ? getEventUnlockProgress(ev) : null;
      if (info){
        if (unlockMini) unlockMini.textContent = info.text;
        if (unlockMeter) unlockMeter.style.width = `${info.pct}%`;
      }else{
        // Fallback legacy behavior
        const u = ev.unlock || {};
        const ut = String(u.type||'').trim();
        if (ut === 'completions_total' || ut==='challengesCompleted' || ut==='completionsTotal'){
          const need = Number(u.count||0);
          const cur = totalCompletedAcrossHeroes();
          const pct = need <= 0 ? 100 : Math.max(0, Math.min(100, Math.round((cur/need)*100)));
          if (unlockMini) unlockMini.textContent = `${cur} / ${need} desafíos completados (global)`;
          if (unlockMeter) unlockMeter.style.width = `${pct}%`;
        }
      }
      if (unlocked){
        if (unlockMeter) unlockMeter.style.width = '100%';
        if (unlockMini) unlockMini.textContent = unlockMini.textContent || 'Desbloqueado';
      }
    }catch(e){ /* ignore */ }

    // Eligibility progress (current hero)
    try{
      const r = ev.eligibility || {};
      const rt = String(r.type||'').trim();
      if (rt === 'level' || rt==='minLevel'){
        const need = Number(r.min ?? r.level ?? 1);
        const cur = Number(hero?.level||1);
        const pct = need <= 0 ? 100 : Math.max(0, Math.min(100, Math.round((cur/need)*100)));
        if (eligMini) eligMini.textContent = `Tu nivel: ${cur} / ${need}`;
        if (eligMeter) eligMeter.style.width = `${pct}%`;
      }
      if (rt === 'completions_hero' || rt==='challengesCompletedHero'){
        const need = Number(r.count||0);
        const cur = countCompletedForHero(hero);
        const pct = need <= 0 ? 100 : Math.max(0, Math.min(100, Math.round((cur/need)*100)));
        if (eligMini) eligMini.textContent = `Tú: ${cur} / ${need} desafíos completados`;
        if (eligMeter) eligMeter.style.width = `${pct}%`;
      }
      if (rt === 'difficultyCompleted'){
        const need = Number(r.count||1);
        const diff = normalizeDifficulty(r.difficulty);
        const cur = countCompletedForHeroByDifficulty(hero, diff);
        const pct = need <= 0 ? 100 : Math.max(0, Math.min(100, Math.round((cur/need)*100)));
        if (eligMini) eligMini.textContent = `${diff.toUpperCase()}: ${cur} / ${need}`;
        if (eligMeter) eligMeter.style.width = `${pct}%`;
      }
      if (unlocked && eligible){
        if (eligMeter) eligMeter.style.width = '100%';
        if (eligMini) eligMini.textContent = eligMini.textContent || 'Listo para retar';
      }
    }catch(e){ /* ignore */ }

    const btnFight = $('#btnEventFight');
    if (btnFight){
      btnFight.disabled = !(unlocked && eligible);
      btnFight.textContent = unlocked ? (eligible ? '⚔️ Retar' : 'No elegible') : 'Bloqueado';
    }

    const btnToggleUnlock = $('#btnEventToggleUnlock');
    if (btnToggleUnlock){
      btnToggleUnlock.disabled = false;
      btnToggleUnlock.textContent = unlocked ? 'Bloquear' : 'Desbloquear';
      btnToggleUnlock.dataset.eventId = eventId;
    }

    // Bind fight button (one-time per modal open)
    if (btnFight){
      btnFight.onclick = ()=>{
        if (!(unlocked && eligible)) return;
        toast(`⚔️ ${hero?.name || 'Héroe'} reta a ${ev.title || 'este jefe'}!`);
        modal.hidden = true;
      };
    }

    // Bind toggle-unlock button (teacher only)
    if (btnToggleUnlock){
      btnToggleUnlock.onclick = ()=>{
        ev.unlocked = !isEventUnlocked(ev);
        saveLocal(state.data);
        if (state.dataSource === 'remote') state.dataSource = 'local';
        renderEvents();
        openEventModal(eventId);
        toast(ev.unlocked ? 'Evento desbloqueado' : 'Evento bloqueado');
      };
    }

    modal.hidden = false;
  }

  let _eventTabsBound = false;
  function ensureEventTabs(){
    const wrap = $('#eventTabs');
    if (!wrap || _eventTabsBound) return;
    _eventTabsBound = true;
    wrap.addEventListener('click', (e)=>{
      const btn = e.target.closest('button[data-event-tab]');
      if (!btn) return;
      const tab = btn.getAttribute('data-event-tab');
      state.eventsTab = tab || 'boss';
      renderEvents();
    });
  }
  function renderEvents(){
    const grid = $('#eventGrid');
    if (!grid) return;

    ensureEventTabs();

    const tab = (state.eventsTab || 'boss');
    // Header simplificado: sin título/subtítulo (solo tabs)

    const tabsWrap = $('#eventTabs');
    if (tabsWrap){
      tabsWrap.querySelectorAll('button[data-event-tab]').forEach(b=>{
        b.classList.toggle('is-active', b.getAttribute('data-event-tab') === tab);
      });
    }

    grid.innerHTML = '';

    const hero = currentHero();
    const evs = Array.isArray(state.data?.events) ? state.data.events : [];
    const list = evs.filter(ev => (ev.kind || 'event') === tab);

    if (!list.length){
      grid.innerHTML = `<div class="muted">Sin ${(tab === 'boss') ? 'jefes' : 'eventos'}.</div>`;
      return;
    }

    // Responsive mockup v2:
    // - vertical cards
    // - top pills for kind/state
    // - locked silhouette feel
    // - single requirement line (unlock or eligibility)
    list.forEach(ev=>{
      const unlocked = isEventUnlocked(ev);
      const eligible = hero ? isHeroEligibleForEvent(hero, ev) : false;

      const div = document.createElement('button');
      div.type = 'button';
      div.className = 'evCard' + (unlocked ? ' is-unlocked' : ' is-locked') + (eligible ? ' is-eligible' : '');

      // Pills removed from cards (design simplification). Keep labels only for internal logic if needed later.
      const kindLabel = (ev.kind === 'boss') ? 'JEFE' : 'EVENTO';
      const stateLabel = unlocked ? (eligible ? 'LISTO' : 'DESBLOQ.') : 'BLOQUEADO';
      const titleText = unlocked ? (ev.title || (ev.kind === 'boss' ? 'Jefe' : 'Evento')) : '?????';
      const reqText = unlocked ? (ev.eligibility?.label || 'Cumple los requisitos para retarlo.')
                               : (ev.unlock?.label || 'Requisito para desbloquear');

      
      div.innerHTML = `
        <div class="evCard__media">
          <div class="evCard__img" aria-hidden="true"></div>
          <div class="evCard__overlay" aria-hidden="true"></div>

          <div class="evCard__titleOnArt" aria-hidden="true">
            <div class="evCard__title">${escapeHtml(titleText)}</div>
            <div class="evCard__chev">›</div>
          </div>
        </div>

        <div class="evCard__req">
          <div class="evReqIcon" aria-hidden="true">!</div>
          <div class="evReqText">${escapeHtml(reqText)}</div>
        </div>
      `;


      const img = div.querySelector('.evCard__img');
      if (img){
        const src = unlocked ? ev.image : ev.lockedImage;
        _setEventBgImage(img, src);
      }
      div.addEventListener('click', ()=> openEventModal(ev.id));
      grid.appendChild(div);
    });
  }

  // ------------------------------------------------------------
  // Boss unlock celebration overlay (full-screen)
  // ------------------------------------------------------------
  function _getBossUnlockOverlayEl(){
    return document.getElementById('bossUnlockOverlay');
  }

  function _ensureBossUnlockOverlayBindings(){
    const ov = _getBossUnlockOverlayEl();
    if (!ov || ov.__bound) return;
    ov.__bound = true;

    const close = ()=>{
      try{ ov.hidden = true; document.documentElement.classList.remove('is-boss-unlock'); }catch(_e){}
    };
    const go = ()=>{
      close();
      try{ state.eventsTab = 'boss'; }catch(_e){}
      try{ if (typeof setActiveRoute === 'function') setActiveRoute('eventos'); }catch(_e){}
      try{ if (typeof renderEvents === 'function') renderEvents(); }catch(_e){}
      // Jump to top so the grid is visible immediately
      try{ window.scrollTo({ top: 0, behavior: 'smooth' }); }catch(_e){ try{ window.scrollTo(0,0); }catch(__){} }
    };

    // click anywhere on overlay to go
    ov.addEventListener('click', (e)=>{
      const btn = e.target && e.target.closest ? e.target.closest('[data-boss-unlock-go]') : null;
      const closer = e.target && e.target.closest ? e.target.closest('[data-boss-unlock-close]') : null;
      if (btn) return go();
      if (closer) return close();
      // default: go
      go();
    });
  }

  function showBossUnlockOverlay(ev){
    const ov = _getBossUnlockOverlayEl();
    if (!ov) return;
    _ensureBossUnlockOverlayBindings();

    // Si hay una celebración (desafío completado) encima, la cerramos para que el jefe se vea.
    try{
      const big = document.getElementById('bigRewardOverlay');
      if (big){
        big.classList.remove('is-visible');
        big.style.display = 'none';
      }
    }catch(_e){}

    // Fill UI
    const title = ov.querySelector('[data-boss-unlock-title]');
    const sub = ov.querySelector('[data-boss-unlock-sub]');
    const img = ov.querySelector('[data-boss-unlock-img]');

    const kind = (ev && ev.kind === 'boss') ? 'JEFE' : 'EVENTO';
    const t = (ev && ev.title) ? ev.title : kind;
    if (title) title.textContent = `¡Un nuevo ${kind.toLowerCase()} apareció!`;
    if (sub) sub.textContent = t;

    // Si estamos usando la variante por imagen completa (arte ya con texto),
    // NO sobreescribimos el background-image definido en CSS.
    const useFullImage = ov.classList && ov.classList.contains('bossUnlock--img');
    if (!useFullImage){
      // Use unlocked image if available; fallback to lockedImage
      const src = (ev && ev.image) ? ev.image : (ev && ev.lockedImage ? ev.lockedImage : '');
      if (img){
        img.style.backgroundImage = src ? `url(${src})` : '';
      }
    } else {
      // Limpieza por si alguna vez se asignó inline en otra variante
      if (img) img.style.backgroundImage = '';
    }


    // Play SFX (may be blocked until user gesture; we attempt to unlock on first gesture)
    try{
      const a = window.__bossUnlockSfx ? window.__bossUnlockSfx : (typeof Audio !== 'undefined' ? new Audio('assets/sfx/challenger_approaching.mp3') : null);
      if (a){
        window.__bossUnlockSfx = a;
        try{ a.pause(); a.currentTime = 0; }catch(_e){}
        const p = a.play();
        if (p && typeof p.catch === 'function') p.catch(()=>{});
      }
    }catch(_e){}

    // Show
    try{ ov.hidden = false; document.documentElement.classList.add('is-boss-unlock'); }catch(_e){}
  }

  // Global checker called from renderAll()
  function checkBossUnlockOverlay(){
    try{
      const list = Array.isArray(state.data?.events) ? state.data.events : [];
      if (!list.length) return;

      // Create storage the first time (avoid popups on initial load)
      if (!window.__bossUnlockPrev){
        window.__bossUnlockPrev = {};
        list.forEach(ev=>{
          if (ev && (ev.kind === 'boss')){
            window.__bossUnlockPrev[String(ev.id)] = !!isEventUnlocked(ev);
          }
        });
        window.__bossUnlockInitDone = true;
        return;
      }

      // If overlay is already showing, don't trigger again right now
      const ov = _getBossUnlockOverlayEl();
      if (ov && !ov.hidden) return;

      // Find newly unlocked bosses
      for (const ev of list){
        if (!ev || ev.kind !== 'boss') continue;
        const id = String(ev.id);
        const prev = !!window.__bossUnlockPrev[id];
        const now = !!isEventUnlocked(ev);
        if (!prev && now){
          window.__bossUnlockPrev[id] = true;
          showBossUnlockOverlay(ev);
          break;
        }
        window.__bossUnlockPrev[id] = now;
      }
    }catch(_e){}
  }


  // ------------------------------------------------------------
  // Boss unlock sound (pre-unlocked on first user gesture)
  // ------------------------------------------------------------
  (function(){
    const SFX_SRC = 'assets/sfx/challenger_approaching.mp3';
    function ensureBossSfx(){
      try{
        if (window.__bossUnlockSfx) return window.__bossUnlockSfx;
        const a = new Audio(SFX_SRC);
        a.preload = 'auto';
        a.volume = 0.9;
        window.__bossUnlockSfx = a;
        return a;
      }catch(_e){ return null; }
    }

    // Try to "unlock" audio playback on mobile browsers
    function unlockAudioOnce(){
      try{
        const a = ensureBossSfx();
        if (!a) return;
        // tiny play/pause to satisfy gesture requirement
        const p = a.play();
        if (p && typeof p.then === 'function'){
          p.then(()=>{ try{ a.pause(); a.currentTime = 0; }catch(_e){} }).catch(()=>{});
        } else {
          try{ a.pause(); a.currentTime = 0; }catch(_e){}
        }
      }catch(_e){}
    }

    if (!window.__bossUnlockSfxBound){
      window.__bossUnlockSfxBound = true;
      document.addEventListener('pointerdown', unlockAudioOnce, { once: true, passive: true });
      document.addEventListener('touchstart', unlockAudioOnce, { once: true, passive: true });
      document.addEventListener('keydown', unlockAudioOnce, { once: true });
    }
  })();


  // Expose helpers (called from app_actions.js)
  try{ window.checkBossUnlockOverlay = checkBossUnlockOverlay; }catch(_e){}
  try{ window.showBossUnlockOverlay = showBossUnlockOverlay; }catch(_e){}
