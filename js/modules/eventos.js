  // --- Image helpers (supports .jpg/.png swaps and folder swaps: /eventos/ <-> /jefes/) ---
  function _eventImageCandidates(src){
    if (!src || typeof src !== 'string') return [];
    const out = [];
    const add = (s) => { if (s && !out.includes(s)) out.push(s); };
    add(src);

    // Extension swaps
    if (/\.jpg$/i.test(src)) add(src.replace(/\.jpg$/i, '.png'));
    if (/\.png$/i.test(src)) add(src.replace(/\.png$/i, '.jpg'));

    // Folder swaps
    if (src.includes('/eventos/')) add(src.replace('/eventos/', '/jefes/'));
    if (src.includes('/jefes/')) add(src.replace('/jefes/', '/eventos/'));

    // Combine folder+ext swaps
    out.slice().forEach(s => {
      if (/\.jpg$/i.test(s)) add(s.replace(/\.jpg$/i, '.png'));
      if (/\.png$/i.test(s)) add(s.replace(/\.png$/i, '.jpg'));
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
