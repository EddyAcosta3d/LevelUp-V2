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

    $('#eventModalTitle').textContent = unlocked ? (ev.title || 'Evento') : '?????';
    $('#eventModalReq').textContent = unlocked ? (ev.eligibility?.label || '') : (ev.unlock?.label || 'Requisito');
    $('#eventModalKind').textContent = ev.kind === 'boss' ? 'JEFE' : 'EVENTO';

    const img = $('#eventModalImg');
    if (img){
      img.classList.toggle('is-locked', !unlocked);
      const src = unlocked ? ev.image : ev.lockedImage;
      _setEventBgImage(img, src);
    }

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

  function renderEvents(){
    const grid = $('#eventGrid');
    if (!grid) return;
    grid.innerHTML = '';

    const hero = currentHero();
    const evs = Array.isArray(state.data?.events) ? state.data.events : [];
    if (!evs.length){
      grid.innerHTML = '<div class="muted">Sin eventos.</div>';
      return;
    }

    evs.forEach(ev=>{
      const unlocked = isEventUnlocked(ev);
      const eligible = hero ? isHeroEligibleForEvent(hero, ev) : false;
      const div = document.createElement('button');
      div.type = 'button';
      div.className = 'eventCard' + (unlocked ? ' is-unlocked' : ' is-locked') + (eligible ? ' is-eligible' : '');
      div.innerHTML = `
        <div class="eventCard__img"></div>
        <div class="eventCard__meta">
          <div class="eventCard__name">${escapeHtml(unlocked ? (ev.title||'Evento') : '?????')}</div>
          <div class="eventCard__req">${escapeHtml(unlocked ? (ev.eligibility?.label||'') : (ev.unlock?.label||'Requisito'))}</div>
        </div>
      `;
      const img = div.querySelector('.eventCard__img');
      if (img){
        img.classList.toggle('is-locked', !unlocked);
        const src = unlocked ? ev.image : ev.lockedImage;
        _setEventBgImage(img, src);
      }
      div.addEventListener('click', ()=> openEventModal(ev.id));
      grid.appendChild(div);
    });
  }

