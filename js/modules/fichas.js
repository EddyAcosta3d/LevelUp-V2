  function renderHeroList(){
    const list = $('#heroList');
    list.innerHTML = '';
    const heroes = (state.data?.heroes || []).filter(h => (h.group || '2D') === state.group);

    if (!heroes.length){
      list.innerHTML = '<div class="muted" style="padding:10px 6px;">No hay personajes.</div>';
      return;
    }
    if (!state.selectedHeroId || !heroes.some(h => h.id === state.selectedHeroId)){
      state.selectedHeroId = heroes[0].id;
    }

    heroes.forEach(hero => {
      const btn = document.createElement('button');
      btn.className = 'heroCard' + (hero.id === state.selectedHeroId ? ' is-active' : '');
      btn.dataset.heroId = hero.id;
      const xp = Number(hero.xp ?? 0);
      const xpMax = Number(hero.xpMax ?? 100);
      const pct = xpMax > 0 ? Math.max(0, Math.min(100, (xp / xpMax) * 100)) : 0;
      btn.innerHTML = `
        <div class="heroCard__row">
          <div>
            <div class="heroCard__name">${escapeHtml(hero.name || 'Nuevo héroe')}</div>
            <div class="heroCard__meta">${escapeHtml(heroLabel(hero))}</div>
          </div>
          <div class="heroCard__badge">XP ${xp}/${xpMax}</div>
        </div>
        <div class="heroCard__progress">
          <div class="heroCard__fill" style="width:${pct}%"></div>
        </div>
      `;
      btn.addEventListener('click', ()=>{
        state.selectedHeroId = hero.id;
        renderHeroList();
        renderHeroDetail();

        // IMPORTANT: Refresh the current page so per-hero state (challenge completions, rewards, events eligibility)
        // updates immediately when you switch heroes.
        if (state.route === 'desafios') {
          renderChallenges();
        } else if (state.route === 'recompensas') {
          renderRewards();
        } else if (state.route === 'eventos') {
          renderEvents();
        }

        // Ensure hero-specific chest badge updates as well
        updateChestUI(currentHero());

        if (isDrawerLayout()) closeDrawer();
      });
      list.appendChild(btn);
    });
  }

  function currentHero(){
    const heroes = state.data?.heroes || [];
    return heroes.find(h => h.id === state.selectedHeroId) || heroes[0] || null;
  }

  function renderStats(hero){
  const box = $('#statsBox');
  if (!box) return;
  hero.stats = hero.stats && typeof hero.stats === 'object' ? hero.stats : {};
  const order = [
    { key:'int', label:'INT' },
    { key:'sab', label:'SAB' },
    { key:'car', label:'CAR' },
    { key:'res', label:'RES' },
    { key:'cre', label:'CRE' },
  ];
  const maxVal = 20;

  box.innerHTML = '';
  order.forEach((s)=>{
    const key = s.key;
    const label = s.label;
    const val = Math.max(0, Math.min(maxVal, Number(hero.stats[key] ?? 0)));

    const row = document.createElement('div');
    row.className = 'statLine';
      const segs = Array.from({length:maxVal}, (_,i)=> {
        const isOn = i < val;
        return `<span class="statSeg ${isOn ? 'on' : ''}"></span>`;
      }).join('');

    row.innerHTML = `
      <div class="statBadge badge">${label}</div>
      <div class="statMeter" aria-label="Ajustar ${label}">
        <div class="statSegs" data-key="${key}">${segs}</div>
        <input class="statRange" type="range" min="0" max="${maxVal}" step="1" value="${val}" />
      </div>
      <div class="statNum" data-key="${key}">${val}</div>
    `;

    const range = row.querySelector('.statRange');
      range.addEventListener('input', ()=>{
        let v = Math.max(0, Math.min(maxVal, Number(range.value || 0)));
      hero.stats[key] = v;
      // mantener también la versión en mayúsculas para compatibilidad
      const upKey = key.toUpperCase();
      hero.stats[upKey] = v;

      const numEl = row.querySelector('.statNum');
      if(numEl){
        numEl.textContent = String(v);
        // tiny "pop" feedback
        numEl.classList.remove('is-pop');
        void numEl.offsetWidth;
        numEl.classList.add('is-pop');
        setTimeout(()=> numEl.classList.remove('is-pop'), 220);
      }

      const segWrap = row.querySelector('.statSegs');
      if(segWrap){
        const children = segWrap.children;
        for(let i=0;i<children.length;i++){
          children[i].classList.toggle('on', i < v);
        }
      }

      saveData();
      updateHeroListUI();
      updateHeroHeaderUI();
    });

    box.appendChild(row);
  });
}

  function stripDiacritics(str){
    try{ return String(str).normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }catch(_){ return String(str); }
  }

  function buildAssetCandidates(heroName){
    const base = String(heroName || '').trim();
    if (!base) return [];

    const raw = base;
    const noAcc = stripDiacritics(base);
    const lower = noAcc.toLowerCase();
    const slug = lower.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

    const stems = [raw, noAcc, lower, slug].filter(Boolean);
    // GitHub Pages is case-sensitive; try common upper/lowercase extensions too.
    const exts = ['png','PNG','jpg','JPG','jpeg','JPEG','webp','WEBP'];
    const folders = ['assets/personajes', 'assets'];
    const out = [];
    for (const stem of stems){
      for (const ext of exts){
        for (const folder of folders){
          out.push(`${folder}/${stem}.${ext}`);
        }
      }
    }
    // de-duplicate while preserving order
    return Array.from(new Set(out));
  }

  function tryLoadAutoAvatar(heroName, heroObj, mountEl){
    const candidates = buildAssetCandidates(heroName);
    if (!candidates.length || !mountEl) return;

    let idx = 0;
    const probe = new Image();
    const tryNext = () => {
      if (idx >= candidates.length) return;
      const src = candidates[idx++];
      probe.onload = () => {
        // cache the resolved asset path on the hero so it persists in exports/backups
        if (heroObj && !heroObj.photoSrc && !heroObj.photo && !heroObj.img && !heroObj.image){
          heroObj.photoSrc = src;
          // ensure default fit exists
          heroObj.photoFit = heroObj.photoFit || { x:50, y:50, scale:1 };
          saveLocal(state.data);
          if (state.dataSource === 'remote') state.dataSource = 'local';
          updateDataDebug();
        }
        const img = document.createElement('img');
        img.src = src;
        img.alt = heroName;
        img.loading = 'lazy';
        mountEl.replaceChildren(img);
        // Apply fit if available
        applyPhotoFit(img, heroObj);
      };
      probe.onerror = () => tryNext();
      probe.src = src;
    };
    tryNext();
  }

  
  function applyPhotoFit(imgEl, heroObj){
    if (!imgEl) return;
    const fit = (heroObj && heroObj.photoFit) ? heroObj.photoFit : null;
    const x = fit && Number.isFinite(Number(fit.x)) ? Number(fit.x) : 50;
    const y = fit && Number.isFinite(Number(fit.y)) ? Number(fit.y) : 50;
    const scale = fit && Number.isFinite(Number(fit.scale)) ? Number(fit.scale) : 1;

    imgEl.style.objectFit = 'cover';
    imgEl.style.objectPosition = `${x}% ${y}%`;
    imgEl.style.transformOrigin = 'center';
    imgEl.style.transform = `scale(${scale})`;
  }

function renderHeroAvatar(hero){
    const box = $('#avatarBox');
    if (!box) return;

    const heroName = hero ? String(hero.name || hero.nombre || '').trim() : '';
    const url = hero ? (hero.photo || hero.img || hero.image || hero.photoSrc || '') : '';

    box.replaceChildren();

    if (url){
      const img = document.createElement('img');
      img.src = String(url);
      img.alt = heroName ? `Foto de ${heroName}` : 'Foto del héroe';
      img.loading = 'lazy';
      box.appendChild(img);
      applyPhotoFit(img, hero);
      return;
    }

    // No custom photo: show placeholder and try auto-load from assets/personajes/<Nombre>.(jpg|png|...)
    box.textContent = 'Sin foto';
    if (heroName) {
      tryLoadAutoAvatar(heroName, hero, box);
    }
  }

  const ROLE_OPTIONS = [
    { id:'analista', name:'Analista', desc:'Observa, detecta patrones y propone mejoras.' },
    { id:'mentor', name:'Mentor', desc:'Acompaña, explica y ayuda a otros a avanzar.' },
    { id:'creador', name:'Creador', desc:'Diseña ideas nuevas, soluciones y proyectos.' },
    { id:'guardian', name:'Guardián', desc:'Cuida el orden, el enfoque y las reglas del equipo.' },
    { id:'explorador', name:'Explorador', desc:'Prueba caminos nuevos y se adapta rápido a los retos.' }
  ];

  function renderRoleOptions(){
    const list = $('#roleList');
    if (!list) return;
    list.innerHTML = '';
    ROLE_OPTIONS.forEach(role=>{
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'roleItem';
      btn.innerHTML = `
        <div class="roleItem__name">${escapeHtml(role.name)}</div>
        <div class="roleItem__desc">${escapeHtml(role.desc)}</div>
      `;
      btn.addEventListener('click', ()=>{
        const hero = currentHero();
        if (!hero) return;
        hero.role = role.name;
        $('#inRol').value = role.name;
        saveLocal(state.data);
        if (state.dataSource === 'remote') state.dataSource = 'local';
        updateDataDebug();
        renderHeroList();
        closeRoleModal();
        toast(`Rol: ${role.name}`);
      });
      list.appendChild(btn);
    });
  }

  function openRoleModal(){
    const modal = $('#roleModal');
    if (!modal) return;
    closeAllModals('roleModal');
    renderRoleOptions();
    modal.hidden = false;
  }
  function closeRoleModal(){
    const modal = $('#roleModal');
    if (!modal) return;
    modal.hidden = true;
  }

  function renderHeroDetail(){
    const hero = currentHero();
    if (!hero) return;

    // Avatar image (optional: add hero.img = "assets/.../file.png" in your JSON)
    renderHeroAvatar(hero);

    $('#heroName').textContent = (hero.name || 'NUEVO HÉROE').toUpperCase();
    $('#inNombre').value = hero.name || '';
    $('#inEdad').value = (hero.age ?? '');
    $('#inRol').value = hero.role || '';

    const tDesc = $('#txtDesc');
    const tMeta = $('#txtMeta');
    tDesc.value = hero.desc || '';
    tMeta.value = hero.goal || '';
    wireAutoGrow(document);
    autoGrowTextarea(tDesc);
    autoGrowTextarea(tMeta);
    const txtBien = $('#txtBien');
    if (txtBien) txtBien.value = hero.goodAt || '';
    const txtMejorar = $('#txtMejorar');
    if (txtMejorar) txtMejorar.value = hero.improve || '';

    renderStats(hero);

    const xp = Number(hero.xp ?? 0);
    const xpMax = Number(hero.xpMax ?? 100);
    const lvl = Number(hero.level ?? 1);
    $('#xpLevel').textContent = `Lvl ${lvl}`;
    $('#xpText').textContent = `· XP ${xp}/${xpMax}`;
    $('#xpFill').style.width = `${xpMax > 0 ? Math.max(0, Math.min(100, (xp/xpMax)*100)) : 0}%`;

    const w = Number(hero.weekXp ?? 0);
    const wMax = Number(hero.weekXpMax ?? DEFAULT_WEEK_XP_MAX);
    $('#weekXp').textContent = `${w}/${wMax} XP`;

    // Disable small-activity chips when weekly cap is reached
    const atMax = w >= wMax;
    $$('#actChips [data-xp]').forEach(b=>{ b.disabled = atMax; });

    renderRewards();

    // Pending reward mini-notification
    hero.pendingRewards = Array.isArray(hero.pendingRewards) ? hero.pendingRewards : [];
    if (hero.pendingRewards.length){
      // show a gentle toast once per selection
      if (state.ui.pendingToastHeroId !== hero.id){
        toast('🎁 Recompensa pendiente por reclamar');
        state.ui.pendingToastHeroId = hero.id;
      }
    }

    // Cofre de recompensas (por ficha)
    updateChestUI(hero);

    // Apply lock state after rendering dynamic controls (stats/chips)
    updateEditButton();
    applyFichaLock();
  }

  // --- Recompensas (general + por héroe) ---
  const REWARD_OPTIONS = [
    // Recompensas al subir de nivel (elige 1)
    { id:'stat+1', kind:'progreso', title:'+1 punto a una estadística', desc:'Elige una stat para aumentar en +1.', details:'INT/SAB/CAR/RES/CRE. Máximo recomendado: 20.' },
    { id:'weekMax+10', kind:'progreso', title:'+10 al límite semanal', desc:'Aumenta el máximo de XP semanal de actividades pequeñas.', details:'Si el límite era 40, pasa a 50 (solo para XP semanal).' },
    { id:'token+1', kind:'comodín', title:'+1 comodín', desc:'Ganas 1 comodín para canjear después.', details:'Úsalo para: reintento de actividad, entregar tarde 1 vez, cambiar respuesta, etc. (tú defines reglas).' },
    { id:'perk', kind:'privilegio', title:'Privilegio en clase', desc:'Elige un privilegio (1 vez).', details:'Ejemplos: elegir equipo, elegir lugar, 5 min extra, pasar al pizarrón con ayuda, escoger temática, etc.' },
    { id:'badge', kind:'coleccionable', title:'Insignia/Título', desc:'Ganas una insignia o título visible en tu historial.', details:'Ej.: “Estratega”, “Apoyo del equipo”, “Constante”, “Creativo”, “Líder”.' },

    // Recompensas generales (catálogo)
    { id:'seat', kind:'privilegio', title:'Elegir asiento', desc:'Puedes elegir tu lugar (1 clase).', details:'Sujeto a reglas del salón y disponibilidad.' },
    { id:'music', kind:'privilegio', title:'Elegir música (1 canción)', desc:'Eliges 1 canción para un momento permitido.', details:'Sin letras explícitas; volumen moderado.' },
    { id:'helper', kind:'privilegio', title:'Asistente del profe', desc:'Ayudas a repartir/recoger material (1 clase).', details:'Ideal para sumar responsabilidad sin afectar la dinámica.' },
    { id:'reroll', kind:'comodín', title:'Reintento', desc:'Reintentar una actividad corta.', details:'Solo una vez; no aplica a exámenes si así lo decides.' },
    { id:'latepass', kind:'comodín', title:'Pase de entrega tardía', desc:'Entregar una tarea tarde sin penalización (1 vez).', details:'Debe avisarse antes del límite.' },
    { id:'hint', kind:'comodín', title:'Pista', desc:'Pedir 1 pista extra en un desafío.', details:'No aplica a actividades de memorización si no quieres.' },
    { id:'xpBoost', kind:'progreso', title:'Bono de XP', desc:'+10 XP extra (una sola vez).', details:'Se agrega a tu XP total; no cuenta para XP semanal.' },
    { id:'teamPick', kind:'privilegio', title:'Elegir equipo/pareja', desc:'Puedes elegir con quién trabajar (1 actividad).', details:'Con respeto; si alguien queda solo, se reacomoda.' },
    { id:'skin', kind:'coleccionable', title:'Skin/estética', desc:'Desbloqueas un estilo visual (marco, color, título).', details:'No da ventaja; solo se ve cool.' },
];

  function formatDateMX(iso){
    try{
      const d = new Date(iso);
      return d.toLocaleDateString('es-MX', { year:'numeric', month:'short', day:'2-digit' });
    }catch(_){ return iso || ''; }
  }

  function renderHeroRewardsList(hero, listEl, emptyEl){
    const hist = Array.isArray(hero.rewardsHistory) ? hero.rewardsHistory : [];
    listEl.innerHTML = '';
    if (!hist.length){
      if (emptyEl) emptyEl.hidden = false;
      return;
    }
    if (emptyEl) emptyEl.hidden = true;

    hist.slice().reverse().forEach(item=>{
      const div = document.createElement('div');
      div.className = 'rewardItem';

      const title = item.title || 'Recompensa';
      const level = (item.level === 0 || item.level) ? String(item.level) : '—';
      const date = item.date ? formatDateMX(item.date) : '—';
      const badge = item.badge || '🏆';

      div.innerHTML =
        '<div class="rewardItem__left">' +
          '<div class="rewardItem__title">' + escapeHtml(title) + '</div>' +
          '<div class="rewardItem__meta">Nivel ' + escapeHtml(level) + ' · ' + escapeHtml(date) + '</div>' +
        '</div>' +
        '<div class="rewardItem__badge">' + escapeHtml(badge) + '</div>';

      listEl.appendChild(div);
    });
  }

  function renderRewards(){
  const listEl = document.querySelector('#rewardsHistoryList');
  const emptyEl = document.querySelector('#rewardsHistoryEmpty');
  const subtitle = document.querySelector('#rewardsHistorySubtitle');
  const genList = document.querySelector('#rewardsGeneralList');

  // Historial del héroe seleccionado (por fecha)
  if(listEl && emptyEl){
    const hero = currentHero();
    if (subtitle) subtitle.textContent = hero ? `Historial de ${hero.name || '—'}` : 'Selecciona un personaje para ver su historial.';
    renderHeroRewardsList(hero || {}, listEl, emptyEl);
  }

  // Columna derecha: catálogo de recompensas (más detallado)
  if(genList){
    genList.innerHTML = '';

    const groups = [
      { key:'progreso', label:'Progreso' },
      { key:'comodín', label:'Comodines' },
      { key:'privilegio', label:'Privilegios' },
      { key:'coleccionable', label:'Coleccionables' },
    ];

    groups.forEach(g=>{
      const items = REWARD_OPTIONS.filter(r => (r.kind||'') === g.key && !['stat+1','weekMax+10','token+1','perk','badge'].includes(r.id));
      if(!items.length) return;

      const h = document.createElement('div');
      h.className = 'rewardsSectionTitle';
      h.textContent = g.label;
      genList.appendChild(h);

      items.forEach(r=>{
        const div = document.createElement('div');
        div.className = 'rewardItem';

        const title = r.title || r.name || r.id;
        const desc  = r.desc  || '';
        const details = r.details || '';

        div.innerHTML =
          '<div class="rewardItem__main">' +
            '<div class="rewardItem__titleRow">' +
              '<div class="rewardItem__title">' + escapeHtml(title) + '</div>' +
              '<div class="rewardItem__kind">' + escapeHtml(g.label) + '</div>' +
            '</div>' +
            (desc ? '<div class="rewardItem__desc">' + escapeHtml(desc) + '</div>' : '') +
            (details ? '<div class="rewardItem__details">' + escapeHtml(details) + '</div>' : '') +
          '</div>';

        genList.appendChild(div);
      });
    });

    // Si por alguna razón no hay nada, muestra fallback
    if(!genList.children.length){
      const p = document.createElement('div');
      p.className = 'muted';
      p.textContent = 'No hay recompensas configuradas todavía.';
      genList.appendChild(p);
    }
  }
}

  
function difficultyLabel(diff){
  const d = String(diff || '').toLowerCase();
  if (d === 'easy') return 'Fácil';
  if (d === 'medium') return 'Medio';
  if (d === 'hard') return 'Difícil';
  return '—';
}


function ensureChallengeUI(){
  const menu = $('#subjectMenu');
  const btn  = $('#btnSubject');
  const ddWrap = $('#subjectDropdown');
  if (!menu || !btn) return;

  const subjects = state.data?.subjects || [];
  menu.innerHTML = '';

  // Single-subject view: default to first subject
  if (!state.challengeFilter.subjectId && subjects.length){
    state.challengeFilter.subjectId = subjects[0].id;
  }

  const addItem = (label, subjectId)=>{
    const it = document.createElement('button');
    it.type = 'button';
    it.className = 'ddItem';
    it.dataset.subjectId = String(subjectId);
    it.textContent = label;
    it.addEventListener('click', (e)=>{
      e.preventDefault(); e.stopPropagation();
      state.challengeFilter.subjectId = subjectId;
      btn.textContent = (label + ' ▾');
      closeSubjectDropdown();
      renderChallenges();
    });
    menu.appendChild(it);
  };

  subjects.forEach(s=> addItem(s.name || 'Materia', s.id));

  const activeName = subjects.find(s=>String(s.id)===String(state.challengeFilter.subjectId))?.name || 'Materia';
  btn.textContent = (activeName + ' ▾');

  // difficulty pills
  $$('#diffPills [data-diff]').forEach(b=>{
    const diff = b.dataset.diff;
    b.classList.toggle('is-active', state.challengeFilter.diff === diff);
  });

  // Portal-like fixed dropdown (prevents clipping)
  menu.classList.add('is-portal');
  if (ddWrap) ddWrap.classList.add('dropdown--portal');
}

function positionSubjectMenu(){
  const btn = $('#btnSubject');
  const menu = $('#subjectMenu');
  if (!btn || !menu) return;

  const r = btn.getBoundingClientRect();
  const pad = 10;
  const desiredW = Math.max(240, Math.round(r.width));
  let left = Math.min(Math.max(pad, r.left), window.innerWidth - desiredW - pad);
  let top = r.bottom + 10;

  const maxH = Math.min(window.innerHeight * 0.6, 360);
  if (top + maxH > window.innerHeight - pad){
    top = Math.max(pad, r.top - 10 - maxH);
  }

  menu.style.position = 'fixed';
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
  menu.style.minWidth = `${desiredW}px`;
  menu.style.maxHeight = `${maxH}px`;
  menu.style.overflow = 'auto';
  menu.style.zIndex = '40050';
}

function openSubjectDropdown(){
  const dd = $('#subjectDropdown');
  if (dd) dd.classList.add('is-open');
  positionSubjectMenu();
}
function closeSubjectDropdown(){
  const dd = $('#subjectDropdown');
  if (dd) dd.classList.remove('is-open');
}
function toggleSubjectDropdown(){
  const dd = $('#subjectDropdown');
  if (!dd) return;
  dd.classList.toggle('is-open');
  if (dd.classList.contains('is-open')) positionSubjectMenu();
}

function getFilteredChallenges(){
  const challenges = Array.isArray(state.data?.challenges) ? state.data.challenges : [];
  const subjects = Array.isArray(state.data?.subjects) ? state.data.subjects : [];
  let sub = state.challengeFilter?.subjectId || null;
  const diff = state.challengeFilter?.diff || null;

  // Single-subject view: if none selected, default to first
  if (!sub && subjects.length){
    sub = subjects[0].id;
    state.challengeFilter.subjectId = sub;
  }

  return challenges.filter(ch=>{
    if (sub && String(ch.subjectId || '') !== String(sub)) return false;
    if (diff && String(ch.difficulty || '') !== diff) return false;
    return true;
  });
}


function isChallengeDone(hero, challengeId){
  if (!hero) return false;
  hero.challengeCompletions = (hero.challengeCompletions && typeof hero.challengeCompletions === 'object') ? hero.challengeCompletions : {};
  return !!hero.challengeCompletions[String(challengeId || '')];
}

