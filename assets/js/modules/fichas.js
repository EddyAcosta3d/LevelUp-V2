'use strict';

/**
 * @module fichas
 * @description Hero management - list, details, stats, avatar rendering
 *
 * PUBLIC EXPORTS:
 * - renderHeroList, renderHeroDetail, currentHero
 * - renderStats, buildAssetCandidates, renderHeroAvatar
 * - heroFirstName, isFemaleHeroName, FEMALE_NAME_SET
 * - applyHeroSceneLayers, ensureHeroNotesToggle
 * - renderRoleOptions, openRoleModal, closeRoleModal
 * - formatDateMX, difficultyLabel
 */

// Import dependencies
import {
  state,
  escapeHtml,
  getSelectedHero,
  CONFIG
} from './core_globals.js';

import {
  heroLabel,
  saveLocal
} from './store.js';

// Placeholders globales para cuando aún no hay arte definido.
// (Importante: NO inventar rutas por nombre para evitar 404.)
const HERO_FG_PLACEHOLDER = './assets/placeholders/placeholder_unlocked_3x4.webp';
const HERO_BG_PLACEHOLDER = './assets/placeholders/placeholder_unlocked_16x9.webp';
/**
 * Optimized hero selection - updates only what changed
 * Instead of re-rendering everything, just update classes and relevant UI
 */
export function selectHero(heroId) {
  if (state.selectedHeroId === heroId) return; // No change

  const previousId = state.selectedHeroId;
  state.selectedHeroId = heroId;

  // Update hero list - just toggle classes (no re-render)
  const heroList = document.getElementById('heroList');
  if (heroList) {
    const prevBtn = heroList.querySelector(`[data-hero-id="${previousId}"]`);
    const newBtn = heroList.querySelector(`[data-hero-id="${heroId}"]`);

    if (prevBtn) prevBtn.classList.remove('is-active');
    if (newBtn) newBtn.classList.add('is-active');
  }

  // Update hero detail panel only
  renderHeroDetail();

  // Update current route view only if needed
  const routeRenders = {
    'desafios': () => typeof renderChallenges === 'function' && renderChallenges(),
    'recompensas': () => typeof renderRewards === 'function' && renderRewards(),
    'eventos': () => typeof renderEvents === 'function' && renderEvents(),
    'tienda': () => typeof renderTienda === 'function' && renderTienda()
  };

  const renderFn = routeRenders[state.route];
  if (renderFn) renderFn();

  // Close drawer on mobile
  if (typeof isDrawerLayout === 'function' && isDrawerLayout()) {
    if (typeof closeDrawer === 'function') closeDrawer();
  }
}

  export function renderHeroList(){
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

      // Build parallax thumbnail path (solo si existe en manifest; si no, placeholder)
      const heroClean = stripDiacritics(String(hero.name || '').trim())
        .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
      const heroAssets = (window.__PARALLAX_MANIFEST__ && heroClean) ? window.__PARALLAX_MANIFEST__[heroClean] : null;
      const thumbSrc = (heroAssets && heroAssets.fg) ? heroAssets.fg : HERO_FG_PLACEHOLDER;

      btn.innerHTML = `
        <div class="heroCard__row">
          ${thumbSrc ? `<div class="heroCard__thumb" data-src="${thumbSrc}" data-hero-name="${String(hero.name||'').replace(/"/g,'&quot;')}"></div>` : `<div class="heroCard__thumb" data-src="" data-hero-name="${String(hero.name||'').replace(/"/g,'&quot;')}"></div>`}
          <div class="heroCard__info">
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
        // OPTIMIZED: Use selectHero() instead of multiple re-renders
        selectHero(hero.id);
      });
      list.appendChild(btn);
    });

    // Miniaturas: intenta cargar la imagen por nombre; si falla, usa silueta por género.
    applyThumbFallbacks(list);
  }

  export function currentHero(){
    // Use global getSelectedHero() with fallback to first hero
    const selected = getSelectedHero();
    if (selected) return selected;
    const heroes = state.data?.heroes || [];
    return heroes[0] || null;
  }

  export function renderStats(hero){
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
      if (typeof window.renderHeroList === 'function') window.renderHeroList();
      // En algunas versiones esta función no existe; evitamos crashear.
      if (typeof window.updateHeroHeaderUI === 'function') window.updateHeroHeaderUI();
    });

    box.appendChild(row);
  });

    // Nota: el fallback de miniaturas se aplica al terminar de renderizar la lista,
    // no aquí (aquí no existe la variable `list`).
}

  export function stripDiacritics(str){
    try{ return String(str).normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }catch(_){ return String(str); }
  }


  // --- Helpers para determinación de género por nombre ---
  export function heroFirstName(fullName){
    if (!fullName) return '';
    const parts = String(fullName).trim().split(/\s+/);
    return parts[0].toLowerCase();
  }

  // Conjunto de nombres femeninos comunes en español
  export const FEMALE_NAME_SET = new Set([
    'maria', 'ana', 'carmen', 'laura', 'marta', 'sara', 'sofia', 'isabel',
    'elena', 'paula', 'beatriz', 'teresa', 'rosa', 'patricia', 'andrea',
    'lucia', 'raquel', 'monica', 'cristina', 'silvia', 'pilar', 'angela',
    'susana', 'julia', 'clara', 'natalia', 'adriana', 'gabriela', 'diana',
    'carolina', 'alejandra', 'victoria', 'mariana', 'daniela', 'valeria',
    'camila', 'isabella', 'valentina', 'fernanda', 'paula', 'andrea',
    'maia', 'emma', 'olivia', 'ava', 'mia', 'luna', 'eva', 'nora'
  ]);

  // --- Placeholders para héroes sin arte ---
  export function isFemaleHeroName(heroName){
    const n = heroFirstName(heroName);
    if (!n) return false;
    if (FEMALE_NAME_SET.has(n)) return true;
    // Heurística suave (por si hay nombres que no estén en la lista)
    if (n.endsWith('a') && !['jesus','josue','natanael','santiago','tadeo','luis','juan','carlos','david','eric','ernesto','alexis'].includes(n)) {
      return true;
    }
    return false;
  }

  export function fallbackSiluetaFor(_heroName){
    return HERO_BG_PLACEHOLDER;
  }

  export function preloadImage(url){
    return new Promise((resolve, reject)=>{
      const img = new Image();
      img.onload = ()=>resolve(url);
      img.onerror = ()=>reject(new Error('image-not-found'));
      img.src = url;
    });
  }

  export function applyThumbFallbacks(rootEl){
    if (!rootEl) return;
    const thumbs = rootEl.querySelectorAll('.heroCard__thumb[data-src]');
    thumbs.forEach((el)=>{
      const src = el.getAttribute('data-src') || HERO_FG_PLACEHOLDER;
      el.style.backgroundImage = `url('${src}')`;
    });
  }

  export function showFallbackAvatar(heroName){
    const box = document.getElementById('avatarBox');
    if (!box) return;
    box.replaceChildren();
    box.classList.remove('is-empty');
    box.removeAttribute('aria-hidden');
    const img = document.createElement('img');
    img.src = fallbackSiluetaFor(heroName);
    img.alt = heroName ? `Silueta de ${heroName}` : 'Silueta del héroe';
    img.loading = 'lazy';
    box.appendChild(img);
  }

export function buildAssetCandidates(heroName){
    const base = String(heroName || '').trim();
    if (!base) return [];

    const raw = base;
    const noAcc = stripDiacritics(base);
    const lower = noAcc.toLowerCase();
    const slug = lower.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

    const stems = [raw, noAcc, lower, slug].filter(Boolean);
    // GitHub Pages is case-sensitive; try common upper/lowercase extensions too.
    const exts = ['png','PNG','jpg','JPG','jpeg','JPEG','webp','WEBP'];
    const folders = ['assets/parallax'];
    const out = [];
    for (const stem of stems){
      for (const ext of exts){
        for (const folder of folders){
          out.push(`${folder}/${stem}_fg.${ext}`);
          out.push(`${folder}/${stem}_mid.${ext}`);
          out.push(`${folder}/${stem}_bg.${ext}`);
        }
      }
    }
    // de-duplicate while preserving order
    return Array.from(new Set(out));
  }

  // Nota: Ya no existe editor ni auto-load de fotos. Las fotos se gestionan en /assets
  // y se referencian en el JSON con hero.photo o hero.photoSrc.

export function renderHeroAvatar(hero){
    const box = $('#avatarBox');
    if (!box) return;

    const heroName = hero ? String(hero.name || hero.nombre || '').trim() : '';
    const url = hero ? (hero.photo || hero.img || hero.image || hero.photoSrc || '') : '';

    box.replaceChildren();

    if (url){
      box.classList.remove('is-empty');
      box.removeAttribute('aria-hidden');
      const img = document.createElement('img');
      img.src = String(url);
      img.alt = heroName ? `Foto de ${heroName}` : 'Foto del héroe';
      img.loading = 'lazy';
      box.appendChild(img);
      return;
    }

    // Sin foto: oculta la capa de foto para que se vean las capas de prueba.
    box.classList.add('is-empty');
    box.setAttribute('aria-hidden','true');

    // Sin foto: se oculta la capa para que se vean las capas de escena (parallax/demo).
  }

  export function applyHeroSceneLayers(hero){
    const scene = document.getElementById('heroScene');
    if (!scene) return;

    // Token anti-carreras: evita que un preload viejo pise al héroe actual
    const __reqId = (scene.__reqId = (scene.__reqId || 0) + 1);

    // Reset
    try{ scene.classList.remove('is-silhouette'); }catch(_e){}
    scene.style.setProperty('--heroLayerBg', 'none');
    scene.style.setProperty('--heroLayerMid', 'none');
    scene.style.setProperty('--heroLayerFg', 'none');

    const abs = (u)=>{ try{ return new URL(u, document.baseURI).href; }catch(e){ return u; } };

    // Determinar assets por manifest (evita 404 por intentar nombres que no existen)
    let cleanName = '';
    if (hero && hero.name){
      cleanName = stripDiacritics(String(hero.name).trim())
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
    }

    const heroAssets = (window.__PARALLAX_MANIFEST__ && cleanName) ? window.__PARALLAX_MANIFEST__[cleanName] : null;

    if (heroAssets && (heroAssets.fg || heroAssets.bg || heroAssets.mid)){
      scene.dataset.parallax = '1';
      // Aplicar de inmediato (sin preload) — las rutas existen (manifest)
      scene.style.setProperty('--heroLayerBg', heroAssets.bg ? `url("${abs(heroAssets.bg)}")` : `url("${abs(HERO_BG_PLACEHOLDER)}")`);
      scene.style.setProperty('--heroLayerMid', heroAssets.mid ? `url("${abs(heroAssets.mid)}")` : 'none');
      scene.style.setProperty('--heroLayerFg', heroAssets.fg ? `url("${abs(heroAssets.fg)}")` : 'none');
      ensureHeroNotesToggle(scene);
      return;
    }

    // Sin arte definido → placeholder
    scene.dataset.parallax = '0';
    try{ scene.classList.add('is-silhouette'); }catch(_e){}
    scene.style.setProperty('--heroLayerBg', `url("${abs(HERO_BG_PLACEHOLDER)}")`);
    scene.style.setProperty('--heroLayerMid', 'none');
    scene.style.setProperty('--heroLayerFg', 'none');
    ensureHeroNotesToggle(scene);
  }

  export function ensureHeroNotesToggle(scene){
    try{
      if (!scene) return;

      const placeBtn = ()=>{
        const btn = scene.querySelector('.heroNotesToggleBtn');
        if (!btn) return;

        const collapsed = scene.classList.contains('notesCollapsed');

        // Cuando está visible: poner el botón EN la línea superior del cuadro de Descripción.
        if (!collapsed){
          const row = scene.querySelector('.noteTitleRow--desc .noteTitleTools');
          if (row && btn.parentElement !== row){
            row.appendChild(btn);
          }
          btn.classList.add('is-inline');
          return;
        }

        // Cuando está oculto: regresar el botón a la esquina inferior derecha (sobre la imagen)
        if (btn.parentElement !== scene){
          scene.appendChild(btn);
        }
        btn.classList.remove('is-inline');
      };

      // Crear botón una sola vez
      let btn = scene.querySelector('.heroNotesToggleBtn');
      if (!btn){
        btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'heroNotesToggleBtn';
        btn.setAttribute('aria-label', 'Mostrar u ocultar descripción y meta');
        btn.title = 'Mostrar/Ocultar Descripción y Meta';
        btn.textContent = '🗒';

        btn.addEventListener('click', (e)=>{
          e.preventDefault();
          e.stopPropagation();

          const next = !scene.classList.contains('notesCollapsed');
          scene.classList.toggle('notesCollapsed', next);

          try{ localStorage.setItem('lu_notesCollapsed', next ? '1' : '0'); }catch(_){ }

          placeBtn();
        });

        // por default va en la esquina (si luego se muestra, placeBtn lo moverá)
        scene.appendChild(btn);
      }

      // Restaurar preferencia
      let saved = false;
      try{ saved = (localStorage.getItem('lu_notesCollapsed') === '1'); }catch(_){ }
      scene.classList.toggle('notesCollapsed', saved);

      // Colocar según estado actual
      placeBtn();
    }catch(_){ }
  }

  const ROLE_OPTIONS = [
    // Académico / mental
    { id:'analista',      name:'Analista',      desc:'Observa con calma, detecta patrones y propone mejoras.' },
    { id:'estratega',     name:'Estratega',     desc:'Planea pasos, organiza al equipo y decide prioridades.' },
    { id:'investigador',  name:'Investigador',  desc:'Hace preguntas, busca evidencias y explica lo que encontró.' },
    { id:'bibliotecario', name:'Bibliotecario', desc:'Encuentra recursos, resume ideas y ayuda a estudiar mejor.' },

    // Creativo / expresión
    { id:'creador',       name:'Creador',       desc:'Imagina soluciones nuevas y se anima a probar cosas.' },
    { id:'artista',       name:'Artista',       desc:'Cuida el estilo, los detalles y expresa ideas con creatividad.' },
    { id:'disenador',     name:'Diseñador',     desc:'Ordena la idea, la hace clara y la presenta con buena estética.' },

    // Tecnología / manos a la obra
    { id:'programador',   name:'Programador',   desc:'Piensa en pasos, lógica y arregla errores con paciencia.' },
    { id:'tecnico',       name:'Técnico',       desc:'Configura, repara y hace que las cosas funcionen en la práctica.' },
    { id:'inventor',      name:'Inventor',      desc:'Construye prototipos, mejora objetos y aprende probando.' },

    // Social / liderazgo
    { id:'lider',         name:'Líder',         desc:'Motiva, organiza y ayuda a que el grupo avance.' },
    { id:'comunicador',   name:'Comunicador',   desc:'Explica claro, presenta ideas y conecta con los demás.' },
    { id:'mediador',      name:'Mediador',      desc:'Calma conflictos y busca acuerdos justos.' },
    { id:'colaborador',   name:'Colaborador',   desc:'Trabaja en equipo, apoya y comparte responsabilidades.' },
    { id:'mentor',        name:'Mentor',        desc:'Acompaña a otros, enseña sin juzgar y da consejos útiles.' },

    // Acción / energía
    { id:'explorador',    name:'Explorador',    desc:'Se adapta rápido, prueba caminos nuevos y no se paraliza.' },
    { id:'deportista',    name:'Deportista',    desc:'Trae energía, disciplina y empuja con constancia.' },
    { id:'guardian',      name:'Guardián',      desc:'Cuida el orden, el enfoque y las reglas del equipo.' }
  ];

  export function renderRoleOptions(){
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

  export function openRoleModal(){
    const modal = $('#roleModal');
    if (!modal) return;
    closeAllModals('roleModal');
    renderRoleOptions();
    modal.hidden = false;
  }
  export function closeRoleModal(){
    const modal = $('#roleModal');
    if (!modal) return;
    modal.hidden = true;
  }

  export function renderHeroDetail(){
    const hero = currentHero();
    if (!hero) return;

    // Capas de escena (parallax demo)
    applyHeroSceneLayers(hero);

    // Foto del héroe (si existe). En este layout ocupa TODO el panel izquierdo.
    renderHeroAvatar(hero);

    $('#heroName').textContent = (hero.name || 'NUEVO HÉROE').toUpperCase();
    $('#inNombre').value = hero.name || '';
    $('#inEdad').value = (hero.age ?? '');
    $('#inRol').value = hero.role || '';

    // Medallas (read-only)
    const medalsEl = document.getElementById('heroMedalsCount');
    if (medalsEl){
      medalsEl.textContent = String(Number(hero.medals ?? 0));
    }

    const tDesc = $('#txtDesc');
    const tMeta = $('#txtMeta');
    tDesc.value = hero.desc || '';
    tMeta.value = hero.goal || '';
    wireAutoGrow(document);
    autoGrowTextarea(tDesc);
    autoGrowTextarea(tMeta);

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

    // Inline button to claim pending rewards (visible only when there are pending rewards)
    _syncPendingRewardsInline(hero);

    // Pending reward mini-notification
    hero.pendingRewards = Array.isArray(hero.pendingRewards) ? hero.pendingRewards : [];
    if (hero.pendingRewards.length){
      // show a gentle toast once per selection
      if (state.ui.pendingToastHeroId !== hero.id){
        toast('🎁 Recompensa pendiente por reclamar');
        state.ui.pendingToastHeroId = hero.id;
      }
    }

    // Apply lock state after rendering dynamic controls (stats/chips)
    updateEditButton();
    applyFichaLock();
  }

  // Botón inline para reclamar recompensas pendientes (solo aparece si hay pendientes)
  function _syncPendingRewardsInline(hero){
    const btn = document.getElementById('btnClaimPendingInline');
    const badge = document.getElementById('pendingRewardCountInline');
    if (!btn || !badge) return;

    const pending = Array.isArray(hero?.pendingRewards) ? hero.pendingRewards.filter(p=>p && Number.isFinite(Number(p.level??p)) && Number(p.level??p)>=2 && Number(p.level??p)<=Number(hero.level||0)).length : 0;
    if (pending > 0){
      btn.hidden = false;
      badge.textContent = String(pending);
      badge.hidden = false;
    } else {
      btn.hidden = true;
      badge.hidden = true;
    }

    // Evita doble-binding: marcamos el botón con un flag
    if (!btn.dataset.bound){
      btn.dataset.bound = '1';
      btn.addEventListener('click', ()=>{
        try{
          // Abre el modal de subida de nivel EN MODO "pendiente" (si existe)
          if (typeof openLevelUpModal === 'function') openLevelUpModal();
          else if (typeof window.openLevelUpModal === 'function') window.openLevelUpModal();
          else toast('No se pudo abrir el modal de recompensa.');
        }catch(_){ toast('No se pudo abrir el modal de recompensa.'); }
      });
    }
  }

  // --- Recompensas (general + por héroe) ---
  const REWARD_OPTIONS = [
  { id: "stat+1", label: "+1 a una estadística", desc: "Elige una stat para subir en +1.", icon: "⚡", kind: "stat", amount: 1 },
  { id: "xp+30", label: "+30 XP", desc: "Un empujón extra en tu barra de XP.", icon: "⭐", kind: "xp", amount: 30 },
  { id: "medal+1", label: "+1 medalla", desc: "Una medalla para la tienda.", icon: "🏅", kind: "medal", amount: 1 },
  { id: "doubleNext", label: "Doble XP (siguiente desafío)", desc: "El próximo desafío vale el doble de XP.", icon: "✨", kind: "doubleNext", amount: 2 },
];

  export function formatDateMX(iso){
    try{
      const d = new Date(iso);
      return d.toLocaleDateString('es-MX', { year:'numeric', month:'short', day:'2-digit' });
    }catch(_){ return iso || ''; }
  }

  export function renderHeroRewardsList(hero, listEl, emptyEl){
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

  export function renderRewards(){
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

  
export function difficultyLabel(diff){
  const d = String(diff || '').toLowerCase();
  if (d === 'easy') return 'Fácil';
  if (d === 'medium') return 'Medio';
  if (d === 'hard') return 'Difícil';
  return '—';
}


export function ensureChallengeUI(){
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

export function positionSubjectMenu(){
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
  menu.style.zIndex = '25050';
}

export function openSubjectDropdown(){
  const dd = $('#subjectDropdown');
  if (dd) dd.classList.add('is-open');
  positionSubjectMenu();
}
export function closeSubjectDropdown(){
  const dd = $('#subjectDropdown');
  if (dd) dd.classList.remove('is-open');
}
export function toggleSubjectDropdown(){
  const dd = $('#subjectDropdown');
  if (!dd) return;
  dd.classList.toggle('is-open');
  if (dd.classList.contains('is-open')) positionSubjectMenu();
}






// --- Parallax en Fichas (solo móvil): 2 capas (bg + fg) ---
(function initHeroSceneParallax(){
  try{
    if (window.__luHeroSceneParallaxInit) return;
    window.__luHeroSceneParallaxInit = true;

    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;

    const mqMobile = window.matchMedia ? window.matchMedia('(max-width: 980px)') : { matches: false, addEventListener: null };

    // Al cambiar entre móvil/escritorio, reseteamos transforms para que no se quede el offset del parallax.
    let lastMobile = !!mqMobile.matches;
    function resetHeroLayerTransforms(){
      const scene = document.getElementById('heroScene');
      if (!scene) return;
      const layers = scene.querySelectorAll('.heroSceneLayer[data-speed]');
      layers.forEach(l=>{ l.style.transform = 'translate3d(0,0,0)'; });
    }


    // En esta app el scroll principal vive en .pages (no en window) en móvil.
    let scroller = null;
    function getScroller(){
      scroller = document.querySelector('.pages') || window;
      return scroller;
    }

    let ticking = false;

    function offsetTopWithin(el, ancestor){
      let y = 0;
      let n = el;
      while (n && n !== ancestor){
        y += (n.offsetTop || 0);
        n = n.offsetParent;
      }
      return y;
    }

    function update(){
      ticking = false;
      // Solo en la pantalla de fichas
      if (typeof state !== 'undefined' && state.route && state.route !== 'fichas') return;
      if (!mqMobile.matches){
        if (lastMobile){ resetHeroLayerTransforms(); lastMobile = false; }
        return;
      }
      lastMobile = true;

      const scene = document.getElementById('heroScene');
      if (!scene) return;
      if (String(scene.dataset.parallax||'0') !== '1'){
        if (lastMobile){ resetHeroLayerTransforms(); }
        return;
      }
      const layers = scene.querySelectorAll('.heroSceneLayer[data-speed]');
      if (!layers || !layers.length) return;

      // Usamos el scroll REAL (contenedor .pages en móvil). Esto es más confiable que window.scroll.
      const isWindow = (scroller === window);
      const scrollTop = isWindow ? (window.scrollY || document.documentElement.scrollTop || 0) : (scroller.scrollTop || 0);
      const viewH = isWindow ? (window.innerHeight || 1) : (scroller.clientHeight || 1);
      const sceneTop = isWindow ? (scene.getBoundingClientRect().top + scrollTop) : offsetTopWithin(scene, scroller);
      const sceneH = scene.offsetHeight || 1;
      const center = scrollTop + viewH * 0.5;
      const progress = (center - sceneTop) / (sceneH + viewH); // aprox 0..1
      const p = Math.max(-0.25, Math.min(1.25, progress));

      layers.forEach(layer => {
        const speed = parseFloat(layer.getAttribute('data-speed') || '0.2');
        // Efecto más fuerte (se nota más en celular al hacer scroll)
        let y = (p - 0.5) * 380 * speed;

        // Prioridad móvil: mantener FG anclada al borde inferior de la escena.
        // Evitamos desplazamiento hacia arriba (y negativo) para que no "flote"
        // separado del piso visual del background.
        if (layer.classList && layer.classList.contains('heroSceneLayer--fg')){
          y = Math.max(0, y);
        }

        layer.style.transform = `translate3d(0, ${y}px, 0)`;
      });
    }

    function onScroll(){
      if (!ticking){
        ticking = true;
        requestAnimationFrame(update);
      }
    }

    // Listeners: window + contenedor .pages (si existe)
    const s = getScroller();
    if (s && s !== window) s.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true }); // fallback (desktop / casos raros)
    window.addEventListener('resize', onScroll);

    if (mqMobile.addEventListener) mqMobile.addEventListener('change', (e)=>{
      if (!e.matches){ resetHeroLayerTransforms(); lastMobile = false; }
      onScroll();
    });

    // init: dispara varias veces por si la UI se pinta después del load
    onScroll();
    setTimeout(onScroll, 0);
    setTimeout(onScroll, 250);
    setTimeout(onScroll, 800);

  }catch(e){
    // Fail silently (viewer experience)
    console.warn('hero scene parallax init error', e);
  }
})();
