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
      img.style.backgroundImage = unlocked && ev.image ? `url(${ev.image})` : (ev.lockedImage ? `url(${ev.lockedImage})` : '');
    }

    const btnFight = $('#btnEventFight');
    if (btnFight){
      btnFight.disabled = !(unlocked && eligible);
      btnFight.textContent = unlocked ? (eligible ? '⚔️ Retar' : 'No elegible') : 'Bloqueado';
    }

    const btnToggleUnlock = $('#btnEventToggleUnlock');
    if (btnToggleUnlock){
      btnToggleUnlock.disabled = (state.role !== 'teacher');
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
        img.style.backgroundImage = unlocked && ev.image ? `url(${ev.image})` : (ev.lockedImage ? `url(${ev.lockedImage})` : '');
      }
      div.addEventListener('click', ()=> openEventModal(ev.id));
      grid.appendChild(div);
    });
  }

