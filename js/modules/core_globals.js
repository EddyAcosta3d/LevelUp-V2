'use strict';


const BUILD_ID = 'LevelUP_V2_00.069';
window.LEVELUP_BUILD = BUILD_ID;

// CLEAN PASS v29: stability + small UI tweaks

/* LevelUp Hybrid Skeleton — app.js
   HÍBRIDO:
   1) intenta cargar ./data/data.json (GitHub Pages) cuando hay internet
   2) si falla, usa la última copia en localStorage
   3) siempre puedes importar JSON manual (iPad offline) y se guarda localmente
*/
  // CLEAN PASS v29: stability + small UI tweaks

  const CONFIG = {
    remoteUrl: './data/data.json',
    remoteTimeoutMs: 3500,
    storageKey: 'levelup:data:v1'
  };

  // Weekly XP cap for "Actividades pequeñas" (per hero). If hero.weekXpMax is missing, we fall back to this.
  const DEFAULT_WEEK_XP_MAX = 40;

  // === CONSTANTES DE DIFICULTAD ===
  const DIFFICULTY = Object.freeze({
    EASY: 'easy',
    MEDIUM: 'medium',
    HARD: 'hard'
  });

  // Puntos base por dificultad
  const POINTS_BY_DIFFICULTY = Object.freeze({
    [DIFFICULTY.EASY]: 10,
    [DIFFICULTY.MEDIUM]: 20,
    [DIFFICULTY.HARD]: 40
  });

  // === SISTEMA DE LOGGING ===
  const logger = {
    _enabled: new URLSearchParams(location.search).has('debug'),
    
    error: function(message, data) {
      console.error(`[LevelUp ERROR] ${message}`, data || '');
      if (this._enabled) {
        toast(`⚠️ ${message}`);
      }
    },
    
    warn: function(message, data) {
      console.warn(`[LevelUp WARN] ${message}`, data || '');
    },
    
    info: function(message) {
      if (this._enabled) {
        console.info(`[LevelUp INFO] ${message}`);
      }
    },
    
    debug: function(message, data) {
      if (this._enabled) {
        console.log(`[LevelUp DEBUG] ${message}`, data || '');
      }
    }
  };

  // === UTILIDADES ===
  
  /**
   * Debounce: retrasa la ejecución hasta que pasen X ms sin llamadas
   */
  function debounce(func, wait) {
    let timeout;
    return function(...args) {
      const context = this;
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(context, args), wait);
    };
  }

  /**
   * Throttle: ejecuta como máximo una vez cada X ms
   */
  function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
      const context = this;
      if (!inThrottle) {
        func.apply(context, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

// Convierte texto a un nombre seguro de archivo (sin perder mayúsculas/minúsculas)
function sanitizeFileName(str){
  const raw = String(str || '').trim();
  if(!raw) return '';
  // quita acentos cuando sea posible
  let s = raw;
  try{ s = raw.normalize('NFD').replace(/[\u0300-\u036f]/g,''); }catch(_e){}
  // quita caracteres inválidos para nombres de archivo / rutas
  s = s.replace(/[\\/\u0000-\u001f:*?"<>|]/g,'');
  // colapsa espacios
  s = s.replace(/\s+/g,' ').trim();
  return s;
}

// Escape HTML para prevenir XSS
function escapeHtml(s){
  return String(s ?? '')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'",'&#039;');
}

function makeId(prefix='h'){
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
}

// Compat / util: algunos bloques usan uid('x') en lugar de makeId('x')
function uid(prefix='id'){
  return makeId(prefix);
}

function makeBlankHero(group){
  return {
    id: makeId('h'),
    group: group || '2D',
    name: 'Nuevo héroe',
    age: '',
    role: '',
    level: 1,
    xp: 0,
    xpMax: 100,
    weekXp: 0,
    weekXpMax: DEFAULT_WEEK_XP_MAX,
    stats: { int: 0, sab: 0, car: 0, res: 0, cre: 0 },
    desc: '',
    goal: '',
    photo: '',
    // Ruta a la imagen dentro del proyecto (por ejemplo: assets/personajes/eddy.png)
    // Se gestiona fuera de la app (carpetas/GitHub/JSON).
    photoSrc: ''
  };
}

// Demo de desafíos (2 por dificultad) para probar layout/UI.
// Se inyecta SOLO si el JSON viene vacío y aún no se ha marcado meta.seededDemo.
function seedChallengesDemo(S){
  const safe = (x, fallback) => (x && typeof x === 'object') ? x : fallback;
  S = safe(S, {
    tec:{id:'sub-tech', name:'Tecnología'},
    ing:{id:'sub-eng', name:'Inglés'},
    esp:{id:'sub-esp', name:'Español'},
    mat:{id:'sub-mat', name:'Matemáticas'},
    tut:{id:'sub-tut', name:'Tutoría'},
  });

  // Desafíos de Tecnología (los que definiste)
  return [
    {
      id:'ch-tech-01', subjectId: S.tec.id, subject: S.tec.name, difficulty:'easy', points:10,
      title:'Ejercicio 1 – ¿Tecnología o no?',
      body:`Dificultad: Fácil

Consigna:
Observa la lista y responde:

- celular
- presa
- cuaderno
- antena
- martillo

1) ¿Cuáles sí son tecnología?
2) Explica por qué al menos uno que no parezca tecnología sí lo es.

Incluye: tecnología + energía + infraestructura
Evalúa: comprensión básica, romper la idea “solo lo electrónico”.`
    },
    {
      id:'ch-tech-02', subjectId: S.tec.id, subject: S.tec.name, difficulty:'easy', points:10,
      title:'Ejercicio 2 – ¿Seguro o no seguro?',
      body:`Dificultad: Fácil

Consigna:
Marca si la acción es segura o no segura y explica por qué.

- conectarte a un WiFi público sin contraseña
- compartir una foto donde aparece tu escuela
- reenviar un mensaje sin leerlo

Incluye: internet + seguridad
Evalúa: criterio básico, sentido común digital.`
    },
    {
      id:'ch-tech-03', subjectId: S.tec.id, subject: S.tec.name, difficulty:'medium', points:20,
      title:'Ejercicio 3 – El camino de la energía',
      body:`Dificultad: Media

Consigna:
Explica cómo llega la energía eléctrica desde una presa hasta tu casa.
Incluye al menos:

- la presa
- el generador
- los cables
- tu casa

Evalúa: comprensión de energía, procesos técnicos, orden lógico.`
    },
    {
      id:'ch-tech-04', subjectId: S.tec.id, subject: S.tec.name, difficulty:'medium', points:20,
      title:'Ejercicio 4 – Internet como sistema técnico',
      body:`Dificultad: Media

Consigna:
Explica cómo funciona el siguiente sistema técnico:

Mandar un mensaje por WhatsApp a un amigo.

Incluye:
- dispositivo
- señal (WiFi o datos)
- antena o cable
- servidor

Después responde:
¿Qué podría fallar en este sistema?

Evalúa: concepto de sistema técnico, relación entre partes.`
    },
    {
      id:'ch-tech-05', subjectId: S.tec.id, subject: S.tec.name, difficulty:'hard', points:40,
      title:'Ejercicio 5 – Exposición: Riesgos y seguridad en Internet',
      body:`Dificultad: Difícil
Modalidad: Exposición individual o en equipo

Tema: Un riesgo del internet (a elegir):
- cuentas falsas
- pérdida de privacidad
- ciberacoso
- información falsa

Debe incluir:
- explicación del riesgo
- ejemplo real o posible
- recomendaciones de seguridad

Conexión directa: Manual de Seguridad en Internet
Evalúa: análisis, claridad, expresión oral.`
    },
    {
      id:'ch-tech-06', subjectId: S.tec.id, subject: S.tec.name, difficulty:'hard', points:40,
      title:'Ejercicio 6 – Exposición: Energía y tecnología en la vida diaria',
      body:`Dificultad: Difícil
Modalidad: Exposición en equipo

Tema: Cómo un tipo de energía permite que funcione una tecnología.

Ejemplos:
- energía eléctrica → internet
- energía hidráulica → presas
- energía eléctrica → celulares

Debe incluir:
- de dónde viene la energía
- cómo se transforma
- por qué es importante

Evalúa: relación energía–tecnología, explicación clara, trabajo en equipo.`
    },
  ];
}

  const state = {
    route: 'fichas',
    role: 'viewer',      // futuro: 'teacher' con PIN
    group: '2D',
    selectedHeroId: null,
    selectedChallengeId: null,
    challengeFilter: { subjectId: null, diff: 'easy' },
    eventsTab: 'boss',
    isDetailsOpen: false,
    data: null,
    dataSource: '—'      // remote | local | demo
  };

  // Build marker (para confirmar en GitHub que sí cargó la versión correcta)
  // Build identifier (also used for cache-busting via querystring in index.html)
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  // Selected hero helper (used across modules/bindings)
  function getSelectedHero(){
    const people = state?.data?.people || [];
    return people.find(p=>p.id===state.selectedHeroId) || null;
  }
  window.getSelectedHero = getSelectedHero;

  // UI lock helper: prevents double clicks / repeated actions consistently
  function uiLock(root, locked=true, opts={}){
    if (!root) return;
    const selector = opts.selector || 'button, [role="button"], a, input, select, textarea';
    const setPointer = (opts.pointerEvents !== false);
    if (setPointer){
      if (locked){
        if (!root.dataset._pePrev) root.dataset._pePrev = root.style.pointerEvents || '';
        root.style.pointerEvents = 'none';
      }else{
        root.style.pointerEvents = root.dataset._pePrev || '';
        delete root.dataset._pePrev;
      }
    }
    root.classList.toggle('is-ui-locked', !!locked);
    try{
      root.querySelectorAll(selector).forEach(el=>{
        if ('disabled' in el) el.disabled = !!locked;
        el.setAttribute('aria-disabled', locked ? 'true' : 'false');
      });
    }catch(_e){}
  }
  window.uiLock = uiLock;

  // Modal helper (evita que un modal quede debajo de otro)
  const MODAL_IDS = ['roleModal','levelUpModal','confirmModal','subjectsModal','challengeModal', 'eventModal'];
  const getModal = (id) => document.getElementById(id);
  function closeAllModals(exceptId=null){
    MODAL_IDS.forEach(id=>{
      if (exceptId && id === exceptId) return;
      const m = getModal(id);
      if (m) m.hidden = true;
    });
    try{ if (typeof syncModalOpenState === 'function') syncModalOpenState(); }catch(e){}
  }

  function syncModalOpenState(){
    try{
      const anyOpen = !!document.querySelector('.modal:not([hidden])');
      document.body.classList.toggle('is-modal-open', anyOpen);
    }catch(e){}
  }
  window.syncModalOpenState = syncModalOpenState;


  function demoData(){
    return {
      meta: { app: 'LevelUp', version: 'hybrid-skeleton-v1', updatedAt: new Date().toISOString() },
      heroes: [
        { id:'h1', group:'2D', name:'Eddy', age:12, role:'Analista', level:3, xp:28, xpMax:100,
          stats:{ INT:5, SAB:6, CAR:5, RES:7, CRE:8 }, weekXp:40, weekXpMax:40, desc:'', goal:'', goodAt:'', improve:'' },
        { id:'h2', group:'2D', name:'Test', age:12, role:'Mentor', level:2, xp:25, xpMax:100,
          stats:{ INT:4, SAB:4, CAR:4, RES:4, CRE:4 }, weekXp:0, weekXpMax:40, desc:'', goal:'', goodAt:'', improve:'' }
      ],
      challenges: [
        { id:'c1', title:'Desafío 1: Lectura breve', status:'locked', body:'(contenido teacher) ...' },
        { id:'c2', title:'Desafío 2: Escritura libre', status:'available', body:'(contenido teacher) ...' }
      ],
      events: [
        { id:'e1', title:'?????', locked:true, req:'Requisito: Completa 1 desafío' },
        { id:'e2', title:'Evento: Bonus XP', locked:false, req:'Siguiente: Completa 2 desafíos' }
      ]
    };
  }

  
function seedEventsDemo(){
  return [
    {
      id:'ev_loquito',
      kind:'boss',
      title:'El Loquito del Centro',
      unlocked:false,
      unlock:{ type:'completions_total', count:3, label:'Completa 3 desafíos (en total)' },
      eligibility:{ type:'level', min:1, label:'Cualquier héroe (nivel 1+)' }
    },
    {
      id:'ev_garbanzo',
      kind:'boss',
      title:'El Garbanzo Coqueto',
      unlocked:false,
      unlock:{ type:'level_any', min:2, label:'Algún héroe llega a Nivel 2' },
      eligibility:{ type:'level', min:2, label:'Nivel 2+' }
    },
    {
      id:'ev_bonus',
      kind:'event',
      title:'Evento: Cofre Misterioso',
      unlocked:false,
      unlock:{ type:'completions_total', count:6, label:'Completa 6 desafíos (en total)' },
      eligibility:{ type:'completions_hero', count:2, label:'Completa 2 desafíos con este héroe' }
    }
  ];
}

function totalCompletedAcrossHeroes(){
  const heroes = Array.isArray(state.data?.heroes) ? state.data.heroes : [];
  let n = 0;
  heroes.forEach(h=>{
    const c = (h.challengeCompletions && typeof h.challengeCompletions==='object') ? h.challengeCompletions : {};
    n += Object.keys(c).length;
  });
  return n;
}

function normalizeDifficulty(diff){
  const d = String(diff||'').toLowerCase().trim();
  if (!d) return '';
  if (['easy','facil','fácil','f'].includes(d)) return 'easy';
  if (['medium','medio','m'].includes(d)) return 'medium';
  if (['hard','dificil','difícil','d'].includes(d)) return 'hard';
  return d;
}

function isChallengeDone(hero, challengeId){
  if (!hero) return false;
  hero.challengeCompletions = (hero.challengeCompletions && typeof hero.challengeCompletions === 'object') ? hero.challengeCompletions : {};
  return !!hero.challengeCompletions[String(challengeId || '')];
}

function getFilteredChallenges(){
  const challenges = Array.isArray(state.data?.challenges) ? state.data.challenges : [];
  const subjects = Array.isArray(state.data?.subjects) ? state.data.subjects : [];
  const f = state.challengeFilter || {};
  let sub = f.subjectId ? String(f.subjectId) : '';
  const diff = f.diff ? String(f.diff) : '';
  if (!sub && subjects.length){
    sub = subjects[0].id;
    state.challengeFilter = state.challengeFilter || {};
    state.challengeFilter.subjectId = sub;
  }
  return challenges.filter(ch=>{
    if (sub && String(ch.subjectId || '') !== String(sub)) return false;
    if (diff && String(ch.difficulty || '') !== diff) return false;
    return true;
  });
}

function countCompletedForHeroByDifficulty(hero, difficulty){
  if (!hero) return 0;
  const diff = normalizeDifficulty(difficulty);
  const map = new Map((Array.isArray(state.data?.challenges) ? state.data.challenges : []).map(c=>[String(c.id), c]));
  const comp = (hero.challengeCompletions && typeof hero.challengeCompletions==='object') ? hero.challengeCompletions : {};
  return Object.keys(comp).reduce((acc, id)=>{
    const ch = map.get(String(id));
    return acc + ((ch && normalizeDifficulty(ch.difficulty) === diff) ? 1 : 0);
  }, 0);
}

function countCompletedForHero(hero){
  if (!hero) return 0;
  const c = (hero.challengeCompletions && typeof hero.challengeCompletions==='object') ? hero.challengeCompletions : {};
  return Object.keys(c).length;
}

function _activeGroup(){
  // Prefer explicit state.group; fallback to selected hero group if available.
  const g = String(state?.group || '').trim();
  if (g) return g;
  try{
    const h = (state?.data?.heroes||[]).find(x=>x.id===state.selectedHeroId);
    return h?.group || '2D';
  }catch(e){ return '2D'; }
}

function completedCountForHero(hero){
  const c = (hero && hero.challengeCompletions && typeof hero.challengeCompletions==='object') ? hero.challengeCompletions : {};
  return Object.keys(c).length;
}

function completedForHeroByDifficulty(hero, diff){
  const want = String(diff||'').toLowerCase();
  const c = (hero && hero.challengeCompletions && typeof hero.challengeCompletions==='object') ? hero.challengeCompletions : {};
  const ids = Object.keys(c);
  if (!ids.length) return 0;
  const map = new Map((state.data?.challenges||[]).map(ch=>[String(ch.id), String(ch.difficulty||'').toLowerCase()]));
  let n=0;
  ids.forEach(id=>{ if (map.get(String(id))===want) n++; });
  return n;
}

function heroMaxStat(hero){
  const s = (hero && hero.stats && typeof hero.stats==='object') ? hero.stats : {};
  let m = 0;
  Object.keys(s).forEach(k=>{
    const v = Number(s[k]||0);
    if (!Number.isNaN(v)) m = Math.max(m, v);
  });
  return m;
}

function _rulePassesForHero(hero, u){
  const type = String(u.type||'').trim();
  if (type==='minChallenges'){
    const need = Number(u.perHero ?? u.count ?? u.value ?? 0);
    return completedCountForHero(hero) >= need;
  }
  if (type==='anyStatAtLeast'){
    const th = Number(u.threshold ?? u.min ?? u.value ?? 0);
    return heroMaxStat(hero) >= th;
  }
  if (type==='hasDifficulty'){
    const diff = String(u.difficulty||'').toLowerCase();
    const need = Number(u.perHero ?? 1);
    return completedForHeroByDifficulty(hero, diff) >= need;
  }

  // Compat: reglas antiguas
  if (type==='completions_total' || type==='challengesCompleted' || type==='completionsTotal'){
    const total = totalCompletedAcrossHeroes();
    return total >= Number(u.count||0);
  }
  if (type==='level_any' || type==='levelAny'){
    const min = Number(u.min ?? u.level ?? 1);
    return Number(hero?.level||1) >= min;
  }
  return false;
}

function isEventUnlocked(ev){
  if (!ev) return false;
  if (ev.unlocked) return true;
  const u = ev.unlock || {};
  const scope = String(u.scope || 'any').trim(); // any | count | percent
  const heroesAll = Array.isArray(state.data?.heroes) ? state.data.heroes : [];
  const group = String(u.group || _activeGroup()).trim() || _activeGroup();
  const heroes = heroesAll.filter(h=>String(h.group||'')===group);

  if (!heroes.length) return false;

  if (scope==='any'){
    return heroes.some(h=>_rulePassesForHero(h, u));
  }
  if (scope==='count'){
    const need = Number(u.value ?? u.count ?? 0);
    const cur = heroes.filter(h=>_rulePassesForHero(h, u)).length;
    return cur >= need;
  }
  if (scope==='percent'){
    const needPct = Number(u.value ?? 0);
    const cur = heroes.filter(h=>_rulePassesForHero(h, u)).length;
    const pct = (cur / Math.max(1, heroes.length)) * 100;
    return pct >= needPct;
  }

  // default fallback
  return heroes.some(h=>_rulePassesForHero(h, u));
}

// Helper for UI: progress numbers for unlock rules (group-based)
function getEventUnlockProgress(ev){
  const u = ev?.unlock || {};
  const scope = String(u.scope || 'any').trim();
  const heroesAll = Array.isArray(state.data?.heroes) ? state.data.heroes : [];
  const group = String(u.group || _activeGroup()).trim() || _activeGroup();
  const heroes = heroesAll.filter(h=>String(h.group||'')===group);
  const totalHeroes = Math.max(1, heroes.length);

  if (!heroes.length){
    return { text:'Sin héroes en el grupo', pct:0, cur:0, need:1, scope, group };
  }

  if (scope==='any'){
    // For any, show best current value vs threshold
    const type = String(u.type||'').trim();
    if (type==='minChallenges'){
      const need = Number(u.perHero ?? 0);
      const cur = heroes.reduce((m,h)=>Math.max(m, completedCountForHero(h)), 0);
      const pct = need<=0 ? 100 : Math.max(0, Math.min(100, Math.round((cur/need)*100)));
      return { text:`Mejor del grupo: ${cur} / ${need} desafíos`, pct, cur, need, scope, group };
    }
    if (type==='anyStatAtLeast'){
      const need = Number(u.threshold ?? 0);
      const cur = heroes.reduce((m,h)=>Math.max(m, heroMaxStat(h)), 0);
      const pct = need<=0 ? 100 : Math.max(0, Math.min(100, Math.round((cur/need)*100)));
      return { text:`Mejor stat del grupo: ${cur} / ${need}`, pct, cur, need, scope, group };
    }
    if (type==='hasDifficulty'){
      const diff = String(u.difficulty||'').toLowerCase();
      const need = Number(u.perHero ?? 1);
      const cur = heroes.reduce((m,h)=>Math.max(m, completedForHeroByDifficulty(h, diff)), 0);
      const pct = need<=0 ? 100 : Math.max(0, Math.min(100, Math.round((cur/need)*100)));
      const tag = diff==='hard' ? 'difíciles' : (diff==='medium' ? 'medios' : diff);
      return { text:`Mejor del grupo: ${cur} / ${need} desafíos ${tag}`, pct, cur, need, scope, group };
    }
    return { text:'Progreso del grupo', pct:0, cur:0, need:1, scope, group };
  }

  if (scope==='count'){
    const need = Number(u.value ?? 0);
    const cur = heroes.filter(h=>_rulePassesForHero(h, u)).length;
    const pct = need<=0 ? 100 : Math.max(0, Math.min(100, Math.round((cur/need)*100)));
    return { text:`${cur} / ${need} del grupo`, pct, cur, need, scope, group };
  }

  if (scope==='percent'){
    const need = Number(u.value ?? 0);
    const cur = heroes.filter(h=>_rulePassesForHero(h, u)).length;
    const pctCur = Math.round((cur/totalHeroes)*100);
    const pct = need<=0 ? 100 : Math.max(0, Math.min(100, Math.round((pctCur/need)*100)));
    return { text:`${pctCur}% / ${need}% del grupo`, pct, cur:pctCur, need, scope, group };
  }

  return { text:'Progreso del grupo', pct:0, cur:0, need:1, scope, group };
}


function isHeroEligibleForEvent(hero, ev){
  if (!hero || !ev) return false;
  const r = ev.eligibility || {};
  const type = String(r.type||'').trim();

  if (type==='level' || type==='minLevel'){
    const min = Number(r.min ?? r.level ?? 1);
    return Number(hero.level||1) >= min;
  }

  if (type==='completions_hero' || type==='challengesCompletedHero'){
    return countCompletedForHero(hero) >= Number(r.count||0);
  }

  if (type==='difficultyCompleted'){
    const need = Number(r.count||1);
    const diff = normalizeDifficulty(r.difficulty);
    return countCompletedForHeroByDifficulty(hero, diff) >= need;
  }

  return true;
}
function normalizeData(data){
    const d = data && typeof data === 'object' ? data : {};
    d.meta = (d.meta && typeof d.meta === 'object') ? d.meta : {};
    d.meta.updatedAt = d.meta.updatedAt || new Date().toISOString();

    d.heroes = Array.isArray(d.heroes) ? d.heroes : [];
    d.challenges = Array.isArray(d.challenges) ? d.challenges : [];
    d.events = Array.isArray(d.events) ? d.events : [];

    d.subjects = Array.isArray(d.subjects) ? d.subjects : [];
    // Normaliza IDs a string para evitar comparaciones estrictas rotas (dataset siempre devuelve string)
    d.heroes.forEach(h => { if (h && h.id !== undefined) h.id = String(h.id); else if (h) h.id = String(uid('h')); });
    d.subjects.forEach(s => { if (s && s.id !== undefined) s.id = String(s.id); else if (s) s.id = String(uid('sub')); });
    d.challenges.forEach(c => {
      if (!c || typeof c !== 'object') return;
      if (c.id === undefined || c.id === null || c.id === '') c.id = uid('c');
      c.id = String(c.id);
      if (c.subjectId !== undefined && c.subjectId !== null && c.subjectId !== '') c.subjectId = String(c.subjectId);
      // Compat: algunos datos traen "subject" en vez de "subjectId"; lo mantenemos como texto
    });
    d.events.forEach(ev => { if (ev && ev.id !== undefined) ev.id = String(ev.id); else if (ev) ev.id = String(uid('ev')); });


    // Si vienen desafíos pero no vienen materias, reconstruimos materias desde los desafíos
    // (para evitar que la UI quede sin opciones en el dropdown).
    if (!d.subjects.length && d.challenges.length){
      const seen = new Set();
      d.subjects = d.challenges
        .map(c => ({ id: c.subjectId || uid('sub'), name: (c.subject || '').trim() || 'Materia' }))
        .filter(s => {
          const k = (s.name || '').toLowerCase();
          if (!k || seen.has(k)) return false;
          seen.add(k);
          return true;
        });
    }

    // Seed demo SOLO una vez. Si ya exportaste tu JSON, esto no vuelve a inyectar datos.
    const shouldSeedDemo = !d.meta.seededDemo && !d.subjects.length && !d.challenges.length;
    if (shouldSeedDemo){
      d.subjects = [
        { id:'sub_tec', name:'Tecnología' },
        { id:'sub_ing', name:'Inglés' },
        { id:'sub_esp', name:'Español' },
        { id:'sub_mat', name:'Matemáticas' },
        { id:'sub_tut', name:'Tutoría' },
      ];

      // Demo de desafíos (6 total) para probar layout
      const byName = (n)=> (d.subjects.find(s=> (s.name||'').toLowerCase() === n.toLowerCase()) || d.subjects[0]);
      const S = {
        tec: byName('Tecnología'),
        ing: byName('Inglés'),
        esp: byName('Español'),
        mat: byName('Matemáticas'),
        tut: byName('Tutoría'),
      };
      d.challenges = seedChallengesDemo(S);
      d.meta.seededDemo = true;
    }

    
    // Seed demo de eventos/bosses (si no hay eventos aún)
    if (!d.meta.seededEvents && !d.events.length){
      d.events = seedEventsDemo();
      d.meta.seededEvents = true;
    }

    // Seed demo de tienda (si no hay items aún)
    if (!d.store || !Array.isArray(d.store.items) || d.store.items.length === 0){
      d.store = {
        items: [
          {
            id: 'store_demo_1',
            name: 'Clase con juegos de mesa',
            description: 'Una clase completa jugando juegos de mesa educativos',
            icon: '🎲',
            cost: 6,
            stock: 1,
            available: true
          },
          {
            id: 'store_demo_2',
            name: 'Quitar 1 pregunta del examen',
            description: 'Elimina una pregunta de tu próximo examen',
            icon: '📝',
            cost: 4,
            stock: 999,
            available: true
          },
          {
            id: 'store_demo_3',
            name: 'Elegir tema de exposición',
            description: 'Escoge el tema que quieras para tu exposición',
            icon: '🎤',
            cost: 3,
            stock: 5,
            available: true
          },
          {
            id: 'store_demo_4',
            name: 'Día libre de tarea',
            description: 'Un día sin tarea (aplica una vez)',
            icon: '🎉',
            cost: 5,
            stock: 3,
            available: true
          }
        ]
      };
    }

d.heroes.forEach(h=>{
      // ID ya normalizado arriba, solo asegurar defaults para otros campos
      h.group = h.group || '2D';
      h.name = h.name ?? '';
      h.age = h.age ?? '';
      h.role = h.role ?? '';
      h.level = Number(h.level ?? 1);
      h.xp = Number(h.xp ?? 0);
      h.xpMax = Number(h.xpMax ?? 100);
      h.weekXp = Number(h.weekXp ?? 0);
      h.weekXpMax = Number(h.weekXpMax ?? DEFAULT_WEEK_XP_MAX);
      // Tope inicial de autoevaluación: 0–8. Después puedes subirlo en el JSON a 20.
      // statsCap was used in an older autoevaluación clamp; kept for future use but not enforced.
      // Default to 20 so it doesn't imply a hard cap.
      h.statsCap = Number(h.statsCap ?? 20);
      h.photoSrc = h.photoSrc || '';
      h.desc = h.desc || '';
      h.goal = h.goal || '';
      h.medals = Number(h.medals ?? 0); // Sistema de medallas
      h.storeClaims = Array.isArray(h.storeClaims) ? h.storeClaims : []; // Historial de canjes
      h.rewardsHistory = Array.isArray(h.rewardsHistory) ? h.rewardsHistory : [];
      h.challengeCompletions = (h.challengeCompletions && typeof h.challengeCompletions === 'object') ? h.challengeCompletions : {};
      // Historial de desafíos completados (solo quedan los que siguen marcados como completados)
      h.challengeHistory = Array.isArray(h.challengeHistory) ? h.challengeHistory : [];
      h.pendingRewards = Array.isArray(h.pendingRewards) ? h.pendingRewards : []; // items: { level, createdAt }
      // Reconcile: remove pending rewards that were already claimed (based on rewardsHistory levels)
      try{
        const claimed = new Set((Array.isArray(h.rewardsHistory)?h.rewardsHistory:[]).map(r=>Number(r && r.level)).filter(n=>Number.isFinite(n)));
        // Normalize pending to objects {level, createdAt} and dedupe by level
        const seen = new Set();
        h.pendingRewards = (Array.isArray(h.pendingRewards)?h.pendingRewards:[])
          .map(p=> (p && typeof p==='object') ? p : ({ level: Number(p), createdAt: 0 }))
          // keep only valid levels (>=2 and <= current hero level) to avoid "ghost" pending rewards like 0/null/""
          .filter(p=> Number.isFinite(Number(p.level)))
          .filter(p=> Number.isInteger(Number(p.level)))
          .filter(p=> Number(p.level) >= 2 && Number(p.level) <= Number(h.level || 0))
          .filter(p=> !claimed.has(Number(p.level)))
          .filter(p=> { const lv=Number(p.level); if (seen.has(lv)) return false; seen.add(lv); return true; });
      }catch(_e){}
      h.tokens = Number(h.tokens ?? 0);
      // keep stats object
      h.stats = h.stats && typeof h.stats === 'object' ? h.stats : {};
      // Compat: algunos JSON viejos usan INT/SAB... (mayúsculas) y otros usan int/sab... (minúsculas)
      const statMap = { int:'INT', sab:'SAB', car:'CAR', res:'RES', cre:'CRE' };
      Object.keys(statMap).forEach(low=>{
        const up = statMap[low];
        if (h.stats[low] === undefined && h.stats[up] !== undefined) h.stats[low] = Number(h.stats[up] ?? 0);
        if (h.stats[up] === undefined && h.stats[low] !== undefined) h.stats[up] = Number(h.stats[low] ?? 0);
        if (h.stats[low] === undefined) h.stats[low] = 0;
        if (h.stats[up] === undefined) h.stats[up] = 0;
      });
    });
    return d;
  }


