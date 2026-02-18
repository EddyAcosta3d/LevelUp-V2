'use strict';

/**
 * @module eventos
 * @description Event and boss management
 *
 * PUBLIC EXPORTS:
 * - renderEvents, toggleEventTab
 */

// Import dependencies
import {
  state,
  escapeHtml,
  isEventUnlocked,
  getEventUnlockProgress,
  isHeroEligibleForEvent,
  totalCompletedAcrossHeroes,
  countCompletedForHero,
  countCompletedForHeroByDifficulty,
  normalizeDifficulty,
  closeAllModals,
  $,
  $$
} from './core_globals.js';

import { saveLocal } from './store.js';
import { currentHero } from './fichas.js';

const DEFAULT_BOSS_QUIZ = [
  {
    question: '¿Qué debes hacer primero al enfrentar un problema difícil?',
    options: [
      'Rendirte rápido',
      'Analizar la situación con calma',
      'Culpar a alguien más',
      'Ignorarlo'
    ],
    correctIndex: 1
  },
  {
    question: 'Si trabajas en equipo para vencer a un jefe, ¿qué ayuda más?',
    options: [
      'No escuchar a nadie',
      'Cooperar y comunicar ideas',
      'Hacer todo solo',
      'Discutir sin parar'
    ],
    correctIndex: 1
  },
  {
    question: '¿Qué actitud te da más oportunidad de ganar?',
    options: [
      'Constancia y aprendizaje',
      'Miedo y bloqueo',
      'Desorden total',
      'Evitar intentarlo'
    ],
    correctIndex: 0
  }
];

    // --- Image helpers (1 intento + placeholder; sin swaps para evitar spam de 404) ---
  const EVT_PH_LOCKED_3x4   = './assets/placeholders/placeholder_locked_3x4.webp';
  const EVT_PH_UNLOCKED_3x4 = './assets/placeholders/placeholder_unlocked_3x4.webp';
  const EVT_PH_LOCKED_16x9  = './assets/placeholders/placeholder_locked_16x9.webp';
  const EVT_PH_UNLOCKED_16x9= './assets/placeholders/placeholder_unlocked_16x9.webp';

  function _pickEventPlaceholder({ locked=false, modal=false } = {}){
    if (locked){
      return modal ? EVT_PH_LOCKED_16x9 : EVT_PH_LOCKED_3x4;
    }
    return modal ? EVT_PH_UNLOCKED_16x9 : EVT_PH_UNLOCKED_3x4;
  }

  function _setEventBgImage(el, preferredSrc, opts={}){
    if (!el) return;

    const modal = !!opts.modal;
    const locked = !!opts.locked;

    const placeholder = _pickEventPlaceholder({ locked, modal });
    const src = (preferredSrc && typeof preferredSrc === 'string' && preferredSrc.trim()) ? preferredSrc.trim() : placeholder;

    const apply = (s)=>{ el.style.backgroundImage = `url('${s}')`; };

    // Si el src ya es placeholder, aplicar directo
    if (src === placeholder){
      apply(placeholder);
      return;
    }

    // 1 solo intento: si falla -> placeholder
    const img = new Image();
    img.onload = ()=> apply(src);
    img.onerror = ()=> apply(placeholder);
    img.src = src;
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
      _setEventBgImage(img, src, { locked: !unlocked, modal: true });
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
      btnFight.textContent = unlocked ? (eligible ? '⚔️ Pelear' : 'No elegible') : 'Bloqueado';
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
        if (String(ev?.kind || '') === 'boss'){
          openBossBattleModal(ev, hero);
          modal.hidden = true;
          return;
        }
        toast(`⚔️ ${hero?.name || 'Héroe'} reta a ${ev.title || 'este evento'}!`);
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


  function _getBattleQuestions(ev){
    const custom = Array.isArray(ev?.battleQuestions) ? ev.battleQuestions : [];
    const src = custom.length ? custom : DEFAULT_BOSS_QUIZ;
    return src
      .map((q)=>({
        question: String(q?.question || '').trim(),
        options: Array.isArray(q?.options) ? q.options.map(o=>String(o ?? '')) : [],
        correctIndex: Number(q?.correctIndex ?? -1)
      }))
      .filter((q)=> q.question && q.options.length === 4 && q.correctIndex >= 0 && q.correctIndex < 4);
  }

  function openBossBattleModal(ev, hero){
    const modal = $('#bossBattleModal');
    if (!modal) return;

    const titleEl = $('#bossBattleTitle');
    const questionEl = $('#bossBattleQuestion');
    const optionsEl = $('#bossBattleOptions');
    const nextBtn = $('#btnBossBattleNext');
    const closeBtn = $('#btnBossBattleClose');
    const counterEl = $('#bossBattleCounter');
    const healthFillEl = $('#bossBattleHealthFill');
    const sceneBgEl = $('#bossBattleSceneBg');
    const jefeImg = $('#bossBattleJefe');

    const questions = _getBattleQuestions(ev);
    if (!questions.length){
      toast('Este jefe aún no tiene preguntas configuradas.');
      return;
    }

    // Validar que haya al menos 1 pregunta de conocimiento general y 1 de materia
    const hasGeneral = questions.some(q => String(q.category || '').toLowerCase() === 'general');
    const hasSubject = questions.some(q => {
      const cat = String(q.category || '').toLowerCase();
      return cat && cat !== 'general';
    });

    if (!hasGeneral || !hasSubject){
      console.warn('⚠️ El jefe debería tener al menos 1 pregunta de conocimiento general y 1 de materia');
    }

    const bossName = String(ev?.title || 'Jefe final');
    if (titleEl) titleEl.textContent = `⚔️ ${hero?.name || 'Héroe'} vs ${bossName}`;

    // Cargar battleSprites (fondo y jefe)
    const sprites = ev?.battleSprites || {};

    if (sceneBgEl && sprites.bg){
      sceneBgEl.style.backgroundImage = `url('${sprites.bg}')`;
    } else if (sceneBgEl){
      // Fallback: usar imagen de desbloqueo
      sceneBgEl.style.backgroundImage = `url('${ev?.image || ev?.lockedImage || ''}')`;
    }

    if (jefeImg && sprites.idle){
      jefeImg.src = sprites.idle;
      jefeImg.className = 'bossBattle__jefe bossBattle__jefe--idle';
    }

    // Estado de la batalla
    let index = 0;
    let answered = false;
    let correctCount = 0;
    const totalQuestions = questions.length;

    // Función para cambiar estado del jefe
    const setJefeState = (state)=>{
      if (!jefeImg || !sprites[state]) return;
      jefeImg.src = sprites[state];
      jefeImg.className = `bossBattle__jefe bossBattle__jefe--${state}`;

      // Volver a idle después de la animación
      if (state === 'mock' || state === 'hit'){
        setTimeout(()=>{
          if (sprites.idle){
            jefeImg.src = sprites.idle;
            jefeImg.className = 'bossBattle__jefe bossBattle__jefe--idle';
          }
        }, 1500);
      }
    };

    // Función para actualizar barra de vida
    const updateHealth = ()=>{
      if (!healthFillEl) return;
      const healthPercent = Math.max(0, 100 - (correctCount / totalQuestions) * 100);
      healthFillEl.style.width = `${healthPercent}%`;
    };

    // Función para actualizar contador
    const updateCounter = ()=>{
      if (!counterEl) return;
      counterEl.textContent = `Pregunta ${index + 1}/${totalQuestions}`;
    };

    const renderQuestion = ()=>{
      const current = questions[index];
      answered = false;

      updateCounter();

      if (questionEl) questionEl.textContent = current.question;

      if (nextBtn){
        nextBtn.disabled = true;
        const isLastQuestion = index >= questions.length - 1;
        nextBtn.textContent = isLastQuestion ? 'Finalizar duelo ⚔️' : 'Siguiente pregunta →';
      }

      if (!optionsEl) return;
      optionsEl.innerHTML = '';

      current.options.forEach((option, optIndex)=>{
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'bossBattle__option';
        btn.textContent = option;

        btn.addEventListener('click', ()=>{
          if (answered) return;
          answered = true;

          const isCorrect = optIndex === current.correctIndex;
          btn.classList.add(isCorrect ? 'is-correct' : 'is-incorrect');

          if (isCorrect){
            correctCount++;
            updateHealth();
            setJefeState('hit');
          } else {
            setJefeState('mock');
          }

          if (!isCorrect){
            const rightBtn = optionsEl.querySelector(`[data-opt-index="${current.correctIndex}"]`);
            if (rightBtn) rightBtn.classList.add('is-correct');
          }

          optionsEl.querySelectorAll('.bossBattle__option').forEach((el)=>{
            el.disabled = true;
          });

          if (nextBtn) nextBtn.disabled = false;
        });

        btn.dataset.optIndex = String(optIndex);
        optionsEl.appendChild(btn);
      });
    };

    // Sistema de recompensas al terminar
    const finalizeBattle = ()=>{
      const percentage = (correctCount / totalQuestions) * 100;
      const isPerfect = correctCount === totalQuestions;
      const isVictory = percentage >= 50;

      let medalsEarned = 0;
      let xpEarned = 0;
      let message = '';

      if (isPerfect){
        // Victoria perfecta
        medalsEarned = 3;
        xpEarned = 50;
        message = `🏆 ¡VICTORIA PERFECTA! ${correctCount}/${totalQuestions} correctas\n\n+${medalsEarned} medallas 🏅\n+${xpEarned} XP ⭐`;

        if (typeof window.showBigReward === 'function'){
          window.showBigReward({
            title: '¡VICTORIA PERFECTA!',
            subtitle: `Has derrotado a ${bossName}`,
            icon: '🏆',
            duration: 3000
          });
        }
      } else if (isVictory){
        // Victoria normal
        medalsEarned = 1;
        xpEarned = 20;
        message = `🥈 ¡Victoria! ${correctCount}/${totalQuestions} correctas\n\n+${medalsEarned} medalla 🏅\n+${xpEarned} XP ⭐`;
      } else {
        // Derrota
        xpEarned = 5;
        message = `💀 Derrota... ${correctCount}/${totalQuestions} correctas\n\n${bossName}: "¡Vuelve cuando sepas más!"\n\n+${xpEarned} XP por participar`;
      }

      // Otorgar recompensas
      if (hero && medalsEarned > 0){
        hero.medals = Number(hero.medals ?? 0) + medalsEarned;
      }

      if (hero && xpEarned > 0){
        hero.xp = Number(hero.xp ?? 0) + xpEarned;
        // Verificar si sube de nivel
        if (typeof window.bumpHeroXp === 'function'){
          window.bumpHeroXp(0); // Trigger level up check
        }
      }

      // Guardar cambios
      if (typeof window.saveLocal === 'function'){
        window.saveLocal(state.data);
      }

      // Marcar jefe como derrotado si es victoria
      if (isVictory && hero){
        if (!hero.defeatedBosses) hero.defeatedBosses = [];
        if (!hero.defeatedBosses.includes(ev.id)){
          hero.defeatedBosses.push(ev.id);
        }
      }

      modal.hidden = true;
      toast(message);

      // Refrescar UI
      if (typeof window.renderAll === 'function'){
        window.renderAll();
      }
    };

    if (nextBtn){
      nextBtn.onclick = ()=>{
        if (!answered) return;

        if (index >= questions.length - 1){
          finalizeBattle();
          return;
        }

        index += 1;
        renderQuestion();
      };
    }

    if (closeBtn){
      closeBtn.onclick = ()=>{
        modal.hidden = true;
        toast('Batalla cancelada');
      };
    }

    modal.onclick = (e)=>{
      if (e.target === modal || e.target?.classList?.contains('bossBattle__shade')){
        if (window.confirm('¿Seguro que quieres abandonar la batalla?')){
          modal.hidden = true;
          toast('Batalla cancelada');
        }
      }
    };

    // Inicializar batalla
    updateHealth();
    renderQuestion();
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
  export function renderEvents(){
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
        _setEventBgImage(img, src, { locked: !unlocked, modal: false });
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
      const targetId = String(ov.dataset.eventId || '').trim();
      const targetKind = String(ov.dataset.eventKind || 'boss').trim() || 'boss';
      close();
      try{ state.eventsTab = targetKind === 'event' ? 'event' : 'boss'; }catch(_e){}
      try{ if (typeof setActiveRoute === 'function') setActiveRoute('eventos'); }catch(_e){}
      try{ if (typeof renderEvents === 'function') renderEvents(); }catch(_e){}
      if (targetId){
        try{ openEventModal(targetId); }catch(_e){}
      }
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
    try{
      ov.dataset.eventId = String(ev?.id || '');
      ov.dataset.eventKind = String(ev?.kind || 'boss');
    }catch(_e){}

    const isPortraitViewport = (()=>{
      // Forzamos criterio por aspecto real del viewport para evitar falsos negativos
      // de matchMedia en algunos webviews/navegadores embebidos.
      try{
        const vw = Number(window.visualViewport?.width || window.innerWidth || 0);
        const vh = Number(window.visualViewport?.height || window.innerHeight || 0);
        return vh >= vw;
      }catch(_e){}
      return false;
    })();

    const resolveVerticalCelebrationSrc = ()=>{
      const direct = (ev && ev.celebrationImage) ? String(ev.celebrationImage) : '';
      if (direct) return direct;

      const id = String(ev?.id || '').toLowerCase();
      const title = String(ev?.title || '').toLowerCase();
      const key = [id, title].join(' ');
      if (/loquito/.test(key)) return 'assets/celebrations/loquito_challenger_vertical.png';
      if (/garbanzo/.test(key)) return 'assets/celebrations/garbanzo_challenger_vertical.png';
      if (/guardia/.test(key)) return 'assets/celebrations/guardia_challenger_vertical.png';
      if (/prefecto/.test(key)) return 'assets/celebrations/prefecto_challenger_vertical.png';
      return '';
    };

    const resolveHorizontalCelebrationSrc = ()=>{
      const direct = (ev && ev.celebrationImageHorizontal) ? String(ev.celebrationImageHorizontal) : '';
      if (direct) return direct;

      const vertical = resolveVerticalCelebrationSrc();
      if (vertical){
        const derived = vertical.replace(/_vertical\.png$/i, '.webp');
        if (derived !== vertical) return derived;
      }

      const id = String(ev?.id || '').toLowerCase();
      const title = String(ev?.title || '').toLowerCase();
      const key = [id, title].join(' ');
      if (/loquito/.test(key)) return 'assets/celebrations/loquito_challenger.webp';
      if (/garbanzo/.test(key)) return 'assets/celebrations/garbanzo_challenger.webp';
      if (/guardia/.test(key)) return 'assets/celebrations/guardia_challenger.webp';
      if (/prefecto/.test(key)) return 'assets/celebrations/prefecto_challenger.webp';
      return '';
    };

    // Si estamos usando la variante por imagen completa (arte ya con texto):
    // - vertical: prioriza celebrationImage (arte vertical challenger)
    // - horizontal: prioriza image (arte modal horizontal)
    const useFullImage = ov.classList && ov.classList.contains('bossUnlock--img');
    if (!useFullImage){
      // Use unlocked image if available; fallback to lockedImage
      const src = (ev && ev.image) ? ev.image : (ev && ev.lockedImage ? ev.lockedImage : '');
      if (img){
        img.style.backgroundImage = src ? `url(${src})` : '';
      }
    } else {
      const verticalSrc = resolveVerticalCelebrationSrc();
      const horizontalSrc = resolveHorizontalCelebrationSrc();
      const src = isPortraitViewport
        ? (verticalSrc || horizontalSrc || (ev && ev.image ? ev.image : ''))
        : (horizontalSrc || verticalSrc || (ev && ev.image ? ev.image : ''));
      if (img){
        img.style.backgroundImage = src ? `url(${src})` : '';
        if (src && /\/assets\/celebrations\//.test(src)){
          img.setAttribute('data-boss-art', 'vertical');
        } else {
          img.setAttribute('data-boss-art', 'default');
        }
      }
      try{ ov.classList.toggle('bossUnlock--portraitArt', !!isPortraitViewport); }catch(_e){}
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

        // If this boss wasn't tracked yet (e.g. data loaded after init),
        // just record its current state — don't treat it as "newly unlocked".
        if (!(id in window.__bossUnlockPrev)){
          window.__bossUnlockPrev[id] = !!isEventUnlocked(ev);
          continue;
        }

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

    // Pre-create the Audio element on first user gesture so it's ready
    // when showBossUnlockOverlay actually needs to play it.
    // NOTE: We intentionally do NOT call .play() here — doing so caused
    // audible sound on some iOS devices despite setting volume to 0.
    function preloadAudioOnce(){
      try{ ensureBossSfx(); }catch(_e){}
    }

    if (!window.__bossUnlockSfxBound){
      window.__bossUnlockSfxBound = true;
      document.addEventListener('pointerdown', preloadAudioOnce, { once: true, passive: true });
      document.addEventListener('touchstart', preloadAudioOnce, { once: true, passive: true });
    }
  })();


  // Expose helpers (called from app_actions.js)
  try{ window.checkBossUnlockOverlay = checkBossUnlockOverlay; }catch(_e){}
  try{ window.showBossUnlockOverlay = showBossUnlockOverlay; }catch(_e){}
