'use strict';

/**
 * @module core_globals
 * @description Core utilities, state management, and global functions for LevelUp V2
 *
 * PUBLIC EXPORTS:
 * - CONFIG, DIFFICULTY, POINTS_BY_DIFFICULTY, DEFAULT_WEEK_XP_MAX
 * - state (global app state)
 * - logger (debug/info/warn/error)
 * - debounce, throttle
 * - escapeHtml, escapeAttr, sanitizeFileName
 * - makeId, uid, makeBlankHero
 * - seedChallengesDemo, seedEventsDemo
 * - getSelectedHero, uiLock, syncModalOpenState
 * - normalizeDifficulty, isChallengeDone, getFilteredChallenges
 * - countCompletedForHeroByDifficulty, countCompletedForHero
 * - heroMaxStat, isEventUnlocked, getEventUnlockProgress, isHeroEligibleForEvent
 * - normalizeData, totalCompletedAcrossHeroes
 */

// === TYPEDEFS ===

/**
 * @typedef {Object} HeroStats
 * @property {number} int
 * @property {number} sab
 * @property {number} car
 * @property {number} res
 * @property {number} cre
 * @property {number} INT
 * @property {number} SAB
 * @property {number} CAR
 * @property {number} RES
 * @property {number} CRE
 */

/**
 * @typedef {Object} Hero
 * @property {string}  id
 * @property {string}  group
 * @property {string}  name
 * @property {string|number} age
 * @property {string}  role
 * @property {number}  level
 * @property {number}  xp
 * @property {number}  xpMax
 * @property {number}  weekXp
 * @property {number}  weekXpMax
 * @property {number}  statsCap
 * @property {string}  photo
 * @property {string}  photoSrc
 * @property {string}  desc
 * @property {string}  goal
 * @property {string}  goodAt
 * @property {string}  improve
 * @property {number}  medals
 * @property {number}  tokens
 * @property {HeroStats} stats
 * @property {string[]} assignedChallenges
 * @property {Object.<string,*>} challengeCompletions
 * @property {Array}   challengeHistory
 * @property {Array}   rewardsHistory
 * @property {Array}   storeClaims
 * @property {Array}   pendingRewards
 */

/**
 * @typedef {Object} Challenge
 * @property {string}  id
 * @property {string}  title
 * @property {string}  [body]
 * @property {string}  difficulty - 'easy' | 'medium' | 'hard'
 * @property {number}  points
 * @property {string}  subjectId
 * @property {string}  [subject]
 */

/**
 * @typedef {Object} Subject
 * @property {string} id
 * @property {string} name
 */

/**
 * @typedef {Object} AppEvent
 * @property {string}  id
 * @property {string}  kind       - 'boss' | 'event'
 * @property {string}  title
 * @property {boolean} unlocked
 * @property {Object}  unlock
 * @property {Object}  eligibility
 */

/**
 * @typedef {Object} StoreItem
 * @property {string}  id
 * @property {string}  name
 * @property {string}  description
 * @property {string}  icon
 * @property {number}  cost
 * @property {number}  stock
 * @property {boolean} available
 */

/**
 * @typedef {Object} AppData
 * @property {Object}     meta
 * @property {Hero[]}     heroes
 * @property {Challenge[]} challenges
 * @property {Subject[]}  subjects
 * @property {AppEvent[]} events
 * @property {{ items: StoreItem[] }} store
 */

/**
 * @typedef {Object} ChallengeFilter
 * @property {string|null} subjectId
 * @property {string}      diff
 */

/**
 * @typedef {Object} AppState
 * @property {string}           route
 * @property {string}           role
 * @property {string}           group
 * @property {string|null}      selectedHeroId
 * @property {string|null}      selectedChallengeId
 * @property {ChallengeFilter}  challengeFilter
 * @property {string}           eventsTab
 * @property {boolean}          isDetailsOpen
 * @property {AppData|null}     data
 * @property {string}           dataSource
 * @property {{ pendingToastHeroId: string|null }} ui
 */

// === FIN TYPEDEFS ===

const BUILD_ID = 'LevelUP_V2_01.00';
window.LEVELUP_BUILD = BUILD_ID;

// Initialize LevelUp namespace for better organization
// (Individual window.* assignments maintained for backwards compatibility)
window.LevelUp = window.LevelUp || {};

// CLEAN PASS v29: stability + small UI tweaks

/* LevelUp Hybrid Skeleton — app.js
   HÍBRIDO:
   1) intenta cargar ./data/data.json (GitHub Pages) cuando hay internet
   2) si falla, usa la última copia en localStorage
   3) siempre puedes importar JSON manual (iPad offline) y se guarda localmente
*/
  // CLEAN PASS v29: stability + small UI tweaks

  export const CONFIG = {
    remoteUrl: './data/data.json',
    remoteTimeoutMs: 1500,
    storageKey: 'levelup:data:v1'
  };

  // Weekly XP cap for "Actividades pequeñas" (per hero). If hero.weekXpMax is missing, we fall back to this.
  export const DEFAULT_WEEK_XP_MAX = 40;

  // === CONSTANTES DE DIFICULTAD ===
  export const DIFFICULTY = Object.freeze({
    EASY: 'easy',
    MEDIUM: 'medium',
    HARD: 'hard'
  });

  // Puntos base por dificultad
  export const POINTS_BY_DIFFICULTY = Object.freeze({
    [DIFFICULTY.EASY]: 10,
    [DIFFICULTY.MEDIUM]: 20,
    [DIFFICULTY.HARD]: 40
  });

  /** @enum {string} Roles de usuario para state.role */
  export const ROLE = Object.freeze({
    VIEWER:  'viewer',
    TEACHER: 'teacher'
  });

  /** @enum {string} Rutas de la app — deben coincidir con data-page en el HTML */
  export const ROUTE = Object.freeze({
    FICHAS:      'fichas',
    DESAFIOS:    'desafios',
    EVENTOS:     'eventos',
    TIENDA:      'tienda',
    RECOMPENSAS: 'recompensas'
  });

  /** @enum {string} Origen de los datos para state.dataSource / state.loadedFrom */
  export const DATA_SOURCE = Object.freeze({
    REMOTE: 'remote',
    LOCAL:  'local',
    DEMO:   'demo'
  });

  // === SISTEMA DE LOGGING ===
  export const logger = {
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
   * Retrasa la ejecución hasta que pasen X ms sin llamadas.
   * @param {Function} func - Función a ejecutar con retraso.
   * @param {number}   wait - Milisegundos de espera.
   * @returns {Function} Función con debounce aplicado.
   */
  export function debounce(func, wait) {
    let timeout;
    return function(...args) {
      const context = this;
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(context, args), wait);
    };
  }

  /**
   * Ejecuta como máximo una vez cada X ms.
   * @param {Function} func  - Función a limitar.
   * @param {number}   limit - Milisegundos mínimos entre ejecuciones.
   * @returns {Function} Función con throttle aplicado.
   */
  export function throttle(func, limit) {
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

/**
 * Convierte texto a un nombre seguro de archivo (sin perder mayúsculas/minúsculas).
 * @param {*}      str - Cadena a normalizar.
 * @returns {string} Nombre de archivo saneado.
 */
export function sanitizeFileName(str){
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

/**
 * Escapa HTML para prevenir XSS.
 *
 * POLÍTICA DE SEGURIDAD — innerHTML:
 * ─────────────────────────────────────────────────────────────────────────
 * Toda cadena proveniente de datos externos (data.json, Supabase, input del
 * usuario) DEBE pasar por escapeHtml() antes de insertarse con innerHTML.
 * Las únicas excepciones válidas son strings literales hardcodeados en el
 * código fuente (no datos externos).
 *
 * Correcto:  el.innerHTML = `<span>${escapeHtml(hero.name)}</span>`;
 * Incorrecto: el.innerHTML = `<span>${hero.name}</span>`;   // ← XSS
 * ─────────────────────────────────────────────────────────────────────────
 * @param {*}      s - Valor a escapar (se convierte a string si no lo es).
 * @returns {string} HTML con caracteres especiales escapados.
 */
export function escapeHtml(s){
  return String(s ?? '')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'",'&#039;');
}

/**
 * Escapa cadenas para uso seguro en atributos HTML (alias de escapeHtml).
 * @param {*}      s - Valor a escapar.
 * @returns {string} Cadena escapada.
 */
export function escapeAttr(s){
  return escapeHtml(s);
}

// ============================================
// DOM HELPERS WITH CACHE (Performance optimization)
// ============================================
const _domCache = new Map();

/**
 * Optimized querySelector with cache
 * @param {string} selector - CSS selector
 * @param {boolean} skipCache - Force fresh query
 * @returns {Element|null}
 */
export function $(selector, skipCache = false) {
  if (!skipCache && _domCache.has(selector)) {
    const cached = _domCache.get(selector);
    // Verify element is still in DOM
    if (cached && document.contains(cached)) {
      return cached;
    }
    _domCache.delete(selector);
  }

  const el = document.querySelector(selector);
  if (el && !skipCache) {
    _domCache.set(selector, el);
  }
  return el;
}

/**
 * Optimized querySelectorAll
 * @param {string} selector - CSS selector
 * @returns {NodeList}
 */
export function $$(selector) {
  return document.querySelectorAll(selector);
}

/**
 * Clear DOM cache (call when DOM structure changes significantly)
 */
export function clearDOMCache() {
  _domCache.clear();
}

// ============================================
// TIMEOUT MANAGER (Memory leak prevention)
// ============================================
class TimeoutManager {
  constructor() {
    this.timeouts = new Set();
    this.intervals = new Set();
  }

  setTimeout(fn, delay, ...args) {
    const id = setTimeout(() => {
      this.timeouts.delete(id);
      fn(...args);
    }, delay);
    this.timeouts.add(id);
    return id;
  }

  setInterval(fn, delay, ...args) {
    const id = setInterval(() => fn(...args), delay);
    this.intervals.add(id);
    return id;
  }

  clearTimeout(id) {
    clearTimeout(id);
    this.timeouts.delete(id);
  }

  clearInterval(id) {
    clearInterval(id);
    this.intervals.delete(id);
  }

  cleanup() {
    this.timeouts.forEach(id => clearTimeout(id));
    this.intervals.forEach(id => clearInterval(id));
    this.timeouts.clear();
    this.intervals.clear();
  }

  getStats() {
    return {
      activeTimeouts: this.timeouts.size,
      activeIntervals: this.intervals.size,
      total: this.timeouts.size + this.intervals.size
    };
  }
}

// Global timeout manager instance
export const timeoutManager = new TimeoutManager();

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => timeoutManager.cleanup());
}

/**
 * Genera un ID único con prefijo, timestamp y aleatoriedad.
 * @param {string} [prefix='h'] - Prefijo del ID.
 * @returns {string} ID único en formato `{prefix}_{base36}_{random}`.
 */
export function makeId(prefix='h'){
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
}

/**
 * Alias de makeId. Algunos módulos usan uid() en lugar de makeId().
 * @param {string} [prefix='id'] - Prefijo del ID.
 * @returns {string} ID único.
 */
export function uid(prefix='id'){
  return makeId(prefix);
}

/**
 * Crea un objeto Hero vacío con todos los campos inicializados a sus valores por defecto.
 * @param {string} [group] - Grupo al que pertenece el héroe (ej: '2D').
 * @returns {Hero} Nuevo héroe listo para insertar en state.data.heroes.
 */
export function makeBlankHero(group){
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
    stats: { int: 0, sab: 0, car: 0, res: 0, cre: 0, INT: 0, SAB: 0, CAR: 0, RES: 0, CRE: 0 },
    desc: '',
    goal: '',
    goodAt: '',
    improve: '',
    photo: '',
    photoSrc: '',
    medals: 0,
    tokens: 0,
    storeClaims: [],
    assignedChallenges: [],
    rewardsHistory: [],
    challengeCompletions: {},
    challengeHistory: [],
    pendingRewards: []
  };
}

/**
 * Genera desafíos demo (2 por dificultad) para probar layout/UI.
 * Se inyecta SOLO si el JSON viene vacío y aún no se ha marcado meta.seededDemo.
 * @param {Object} [S] - Mapa de materias con { id, name }. Si no se provee, usa defaults.
 * @returns {Challenge[]} Array de desafíos demo.
 */
export function seedChallengesDemo(S){
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

  // Global application state (exported for modules)
  export const state = {
    route: ROUTE.FICHAS,
    role: ROLE.VIEWER,
    group: '2D',
    selectedHeroId: null,
    selectedChallengeId: null,
    challengeFilter: { subjectId: null, diff: 'easy' },
    eventsTab: 'boss',
    isDetailsOpen: false,
    data: null,
    dataSource: '—',     // remote | local | demo
    ui: {                // UI state tracking
      pendingToastHeroId: null
    }
  };

  // Legacy global exposure for non-module scripts
  window.state = state;
  window.BUILD_ID = BUILD_ID;

  // Build marker (para confirmar en GitHub que sí cargó la versión correcta)
  // Build identifier (also used for cache-busting via querystring in index.html)
  // NOTE: DOM helpers `$`/`$$` are already defined and exported above.
  // Avoid redeclaration here (it breaks module evaluation in browsers).

  /**
   * Retorna el héroe actualmente seleccionado según state.selectedHeroId.
   * @returns {Hero|null} Héroe seleccionado o null si no hay ninguno.
   */
  export function getSelectedHero(){
    const heroes = state?.data?.heroes || [];
    return heroes.find(h=>h.id===state.selectedHeroId) || null;
  }
  window.getSelectedHero = getSelectedHero;
  window.LevelUp.getSelectedHero = getSelectedHero;

  /**
   * Bloquea o desbloquea controles interactivos dentro de un contenedor.
   * Útil para prevenir doble-click y acciones repetidas.
   * @param {Element|null} root            - Elemento raíz a bloquear.
   * @param {boolean}      [locked=true]   - true para bloquear, false para desbloquear.
   * @param {Object}       [opts={}]       - Opciones adicionales.
   * @param {string}       [opts.selector] - Selector CSS de elementos a afectar.
   * @param {boolean}      [opts.pointerEvents] - Si se modifica pointerEvents (default true).
   * @returns {void}
   */
  export function uiLock(root, locked=true, opts={}){
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
  window.LevelUp.uiLock = uiLock;

  // Modal helper (evita que un modal quede debajo de otro)
  const MODAL_IDS = ['roleModal','heroPhotoModal','levelUpModal','confirmModal','subjectsModal','challengeModal', 'eventModal', 'historyModal', 'storeItemModal'];
  const getModal = (id) => document.getElementById(id);
  /**
   * Cierra todos los modales conocidos, excepto el indicado.
   * @param {string|null} [exceptId=null] - ID del modal que NO se debe cerrar.
   * @returns {void}
   */
  export function closeAllModals(exceptId=null){
    MODAL_IDS.forEach(id=>{
      if (exceptId && id === exceptId) return;
      const m = getModal(id);
      if (m) m.hidden = true;
    });
    try{ if (typeof syncModalOpenState === 'function') syncModalOpenState(); }catch(e){}
  }

  /**
   * Sincroniza la clase 'is-modal-open' en body según si hay modales visibles.
   * @returns {void}
   */
  export function syncModalOpenState(){
    try{
      const anyOpen = !!document.querySelector('.modal:not([hidden])');
      document.body.classList.toggle('is-modal-open', anyOpen);
    }catch(e){}
  }
  window.closeAllModals = closeAllModals;
  window.syncModalOpenState = syncModalOpenState;
  window.LevelUp.closeAllModals = closeAllModals;
  window.LevelUp.syncModalOpenState = syncModalOpenState;


  function demoData(){
    return {
      meta: { app: 'LevelUp', version: '01.00', updatedAt: new Date().toISOString() },
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
      events: []
    };
  }

  
/**
 * Genera eventos/bosses demo para probar la sección de Eventos.
 * Se inyecta solo si no hay eventos en el JSON (meta.seededEvents no está marcado).
 * @returns {AppEvent[]} Array de eventos demo.
 */
export function seedEventsDemo(){
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

/**
 * Cuenta el total de desafíos completados por todos los héroes en state.data.
 * @returns {number} Suma de challengeCompletions de todos los héroes.
 */
export function totalCompletedAcrossHeroes(){
  const heroes = Array.isArray(state.data?.heroes) ? state.data.heroes : [];
  let n = 0;
  heroes.forEach(h=>{
    const c = (h.challengeCompletions && typeof h.challengeCompletions==='object') ? h.challengeCompletions : {};
    n += Object.keys(c).length;
  });
  return n;
}

/**
 * Normaliza un valor de dificultad a 'easy', 'medium' o 'hard'.
 * Acepta variantes en español e inglés ('fácil', 'medio', 'difícil', etc.).
 * @param {*}      diff - Valor de dificultad en cualquier formato.
 * @returns {string} Dificultad normalizada o la cadena original si no se reconoce.
 */
export function normalizeDifficulty(diff){
  const d = String(diff||'').toLowerCase().trim();
  if (!d) return '';
  if (['easy','facil','fácil','f'].includes(d)) return 'easy';
  if (['medium','medio','m'].includes(d)) return 'medium';
  if (['hard','dificil','difícil','d'].includes(d)) return 'hard';
  return d;
}

/**
 * Verifica si un héroe ha completado un desafío específico.
 * @param {Hero}          hero        - Héroe a verificar.
 * @param {string|number} challengeId - ID del desafío.
 * @returns {boolean} true si el desafío está en challengeCompletions del héroe.
 */
export function isChallengeDone(hero, challengeId){
  if (!hero) return false;
  hero.challengeCompletions = (hero.challengeCompletions && typeof hero.challengeCompletions === 'object') ? hero.challengeCompletions : {};
  return !!hero.challengeCompletions[String(challengeId || '')];
}

/**
 * Normaliza state.challengeFilter para que apunte a una materia y
 * dificultad válidas. Debe llamarse una vez después de cargar o cambiar
 * state.data, NO durante el render.
 */
export function normalizeFilter(){
  const subjects = Array.isArray(state.data?.subjects) ? state.data.subjects : [];
  if (!subjects.length) return;

  const validSubjectIds = new Set(subjects.map(s => String(s.id || '')));
  const f = state.challengeFilter || {};

  let sub = f.subjectId ? String(f.subjectId) : '';
  // Si el filtro apunta a una materia que ya no existe, resetear.
  if (sub && !validSubjectIds.has(sub)) sub = '';
  // Asegurar que siempre haya una materia seleccionada.
  if (!sub) sub = String(subjects[0].id);

  // Normalizar dificultad (ej: "Fácil" -> "easy").
  const diff = normalizeDifficulty(f.diff ? String(f.diff) : '') || 'easy';

  state.challengeFilter = { ...f, subjectId: sub, diff };
}

/**
 * Retorna los desafíos filtrados según state.challengeFilter (materia + dificultad).
 * @returns {Challenge[]} Array de desafíos que coinciden con el filtro activo.
 */
export function getFilteredChallenges(){
  const challenges = Array.isArray(state.data?.challenges) ? state.data.challenges : [];
  const f = state.challengeFilter || {};

  const sub  = f.subjectId ? String(f.subjectId) : '';
  const diff = normalizeDifficulty(f.diff ? String(f.diff) : '');

  return challenges.filter(ch=>{
    if (sub  && String(ch.subjectId  || '') !== sub)  return false;
    if (diff && String(ch.difficulty || '') !== diff) return false;
    return true;
  });
}

/**
 * Cuenta cuántos desafíos de una dificultad específica ha completado un héroe.
 * @param {Hero}   hero       - Héroe a evaluar.
 * @param {string} difficulty - Dificultad a contar ('easy' | 'medium' | 'hard').
 * @returns {number} Cantidad de desafíos completados para esa dificultad.
 */
export function countCompletedForHeroByDifficulty(hero, difficulty){
  if (!hero) return 0;
  const diff = normalizeDifficulty(difficulty);
  const map = new Map((Array.isArray(state.data?.challenges) ? state.data.challenges : []).map(c=>[String(c.id), c]));
  const comp = (hero.challengeCompletions && typeof hero.challengeCompletions==='object') ? hero.challengeCompletions : {};
  return Object.keys(comp).reduce((acc, id)=>{
    const ch = map.get(String(id));
    return acc + ((ch && normalizeDifficulty(ch.difficulty) === diff) ? 1 : 0);
  }, 0);
}

/**
 * Cuenta el total de desafíos completados por un héroe.
 * @param {Hero} hero - Héroe a evaluar.
 * @returns {number} Número total de entradas en challengeCompletions.
 */
export function countCompletedForHero(hero){
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

/**
 * Retorna el valor más alto entre todas las estadísticas de un héroe.
 * @param {Hero} hero - Héroe a evaluar.
 * @returns {number} Valor máximo de stat (0 si no tiene stats).
 */
export function heroMaxStat(hero){
  const s = (hero && hero.stats && typeof hero.stats==='object') ? hero.stats : {};
  let m = 0;
  Object.keys(s).forEach(k=>{
    const v = Number(s[k]||0);
    if (!Number.isNaN(v)) m = Math.max(m, v);
  });
  return m;
}

function _getStatValue(hero, key){
  if (!hero) return 0;
  const stats = hero.stats || {};
  if (!key) return 0;
  const k = String(key).trim();
  // try exact, lower, upper 3-letter
  if (stats[k] != null) return Number(stats[k]||0);
  const kl = k.toLowerCase();
  if (stats[kl] != null) return Number(stats[kl]||0);
  const ku = k.toUpperCase();
  if (stats[ku] != null) return Number(stats[ku]||0);
  // map common names
  const map = { carisma:['car','CAR'], responsabilidad:['res','RES'], sabiduria:['sab','SAB'], inteligencia:['int','INT'], creatividad:['cre','CRE'] };
  const hit = map[kl];
  if (hit){
    for (const kk of hit){
      if (stats[kk] != null) return Number(stats[kk]||0);
      const kkl = String(kk).toLowerCase();
      if (stats[kkl] != null) return Number(stats[kkl]||0);
    }
  }
  return 0;
}

function _eligPass(hero, rule){
  if (!hero || !rule) return false;
  const type = String(rule.type||'').trim();

  if (type==='allOf'){
    const rules = Array.isArray(rule.rules) ? rule.rules : [];
    return rules.every(r=>_eligPass(hero, r));
  }
  if (type==='anyOf'){
    const rules = Array.isArray(rule.rules) ? rule.rules : [];
    return rules.some(r=>_eligPass(hero, r));
  }

  if (type==='level' || type==='minLevel'){
    const min = Number(rule.min ?? rule.level ?? 1);
    return Number(hero.level||1) >= min;
  }

  if (type==='completions_hero' || type==='challengesCompletedHero'){
    return countCompletedForHero(hero) >= Number(rule.count||0);
  }

  if (type==='difficultyCompleted'){
    const need = Number(rule.count||1);
    const diff = normalizeDifficulty(rule.difficulty);
    return countCompletedForHeroByDifficulty(hero, diff) >= need;
  }

  if (type==='anyStatAtLeast'){
    const th = Number(rule.threshold ?? rule.min ?? rule.value ?? 0);
    return heroMaxStat(hero) >= th;
  }

  if (type==='statAtLeast'){
    const th = Number(rule.threshold ?? rule.min ?? rule.value ?? 0);
    const key = rule.stat || rule.key;
    return _getStatValue(hero, key) >= th;
  }

  if (type==='minStatsAtLeast'){
    const needCount = Number(rule.count||0);
    const th = Number(rule.min ?? rule.threshold ?? 0);
    const stats = hero.stats || {};
    const keys = ['int','sab','car','res','cre','INT','SAB','CAR','RES','CRE'];
    const seen = new Set();
    let c = 0;
    for (const k of keys){
      if (seen.has(k.toLowerCase())) continue;
      seen.add(k.toLowerCase());
      const v = _getStatValue(hero, k);
      if (v >= th) c++;
    }
    return c >= needCount;
  }

  return true;
}

function _rulePassesForHero(hero, u){
  const type = String(u.type||'').trim();
  if (type==='minChallenges'){
    const need = Number(u.perHero ?? u.count ?? u.value ?? 0);
    return countCompletedForHero(hero) >= need;
  }
  if (type==='anyStatAtLeast'){
    const th = Number(u.threshold ?? u.min ?? u.value ?? 0);
    return heroMaxStat(hero) >= th;
  }
  if (type==='hasDifficulty'){
    const diff = String(u.difficulty||'').toLowerCase();
    const need = Number(u.perHero ?? 1);
    return countCompletedForHeroByDifficulty(hero, diff) >= need;
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

/**
 * Determina si un evento/boss está desbloqueado según el progreso del grupo.
 * @param {AppEvent} ev - Evento a evaluar.
 * @returns {boolean} true si el evento está desbloqueado.
 */
export function isEventUnlocked(ev){
  if (!ev) return false;
  if (ev.unlocked) return true;
  const u = ev.unlock || {};
  const scope = String(u.scope || 'any').trim(); // any | count | percent
  const heroesAll = Array.isArray(state.data?.heroes) ? state.data.heroes : [];
  const group = String(u.group || _activeGroup()).trim() || _activeGroup();
  const heroes = heroesAll.filter(h=>String(h.group||'')===group);

  if (!heroes.length) return false;

  // Group total unlock: sum of completed challenges within this group
  if (String(u.type||'').trim()==='groupChallengesAtLeast'){
    const need = Number(u.value ?? u.count ?? 0);
    const cur = heroes.reduce((acc,h)=>acc + countCompletedForHero(h), 0);
    return cur >= need;
  }

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

/**
 * Calcula el progreso de desbloqueo de un evento para mostrarlo en la UI.
 * @param {AppEvent} ev - Evento a evaluar.
 * @returns {{ text: string, pct: number, cur: number, need: number, scope: string, group: string }}
 */
export function getEventUnlockProgress(ev){
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
      const need = Number(u.perHero ?? u.value ?? u.count ?? 0);
      const cur = heroes.reduce((m,h)=>Math.max(m, countCompletedForHero(h)), 0);
      const pct = need<=0 ? 100 : Math.max(0, Math.min(100, Math.round((cur/need)*100)));
      return { text:`Desafíos completados por un héroe: ${cur} / ${need}`, pct, cur, need, scope, group };
    }
    if (type==='anyStatAtLeast'){
      const need = Number(u.threshold ?? u.value ?? u.min ?? 0);
      const cur = heroes.reduce((m,h)=>Math.max(m, heroMaxStat(h)), 0);
      const pct = need<=0 ? 100 : Math.max(0, Math.min(100, Math.round((cur/need)*100)));
      return { text:`Stat más alta de un héroe: ${cur} / ${need}`, pct, cur, need, scope, group };
    }
    if (type==='hasDifficulty'){
      const diff = String(u.difficulty||'').toLowerCase();
      const need = Number(u.perHero ?? 1);
      const cur = heroes.reduce((m,h)=>Math.max(m, countCompletedForHeroByDifficulty(h, diff)), 0);
      const pct = need<=0 ? 100 : Math.max(0, Math.min(100, Math.round((cur/need)*100)));
      const tag = diff==='hard' ? 'difíciles' : (diff==='medium' ? 'medios' : diff);
      return { text:`Desafíos ${tag} de un héroe: ${cur} / ${need}`, pct, cur, need, scope, group };
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


/**
 * Determina si un héroe cumple los requisitos de elegibilidad para un evento.
 * @param {Hero}     hero - Héroe a evaluar.
 * @param {AppEvent} ev   - Evento con reglas de elegibilidad.
 * @returns {boolean} true si el héroe puede participar en el evento.
 */
export function isHeroEligibleForEvent(hero, ev){
  if (!hero || !ev) return false;
  const r = ev.eligibility || {};
  // New flexible evaluator
  if (r && (r.type==='allOf' || r.type==='anyOf' || r.type==='statAtLeast' || r.type==='anyStatAtLeast' || r.type==='minStatsAtLeast')){
    return _eligPass(hero, r);
  }
  // Back-compat simple types
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
/**
 * Normaliza y valida el objeto de datos de la aplicación.
 * Garantiza que heroes, challenges, subjects, events y store existan como arrays.
 * Inyecta datos demo si el JSON está vacío (solo la primera vez).
 * @param {*} data - Datos a normalizar (puede ser cualquier valor; se protege de nulls).
 * @returns {AppData} Datos normalizados y completos.
 */
export function normalizeData(data){
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
      h.assignedChallenges = Array.isArray(h.assignedChallenges)
        ? h.assignedChallenges.map(x => String(x))
        : [];

      // OPTIMIZATION: Limit history arrays to prevent unbounded growth
      const MAX_HISTORY = 200; // Keep last 200 entries
      const MAX_STORE_CLAIMS = 100; // Keep last 100 store claims

      h.rewardsHistory = Array.isArray(h.rewardsHistory) ? h.rewardsHistory.slice(-MAX_HISTORY) : [];
      h.challengeHistory = Array.isArray(h.challengeHistory) ? h.challengeHistory.slice(-MAX_HISTORY) : [];
      h.storeClaims = h.storeClaims.slice(-MAX_STORE_CLAIMS);

      h.challengeCompletions = (h.challengeCompletions && typeof h.challengeCompletions === 'object') ? h.challengeCompletions : {};
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
