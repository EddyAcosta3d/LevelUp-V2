'use strict';

// CLEAN PASS v29: stability + small UI tweaks

/* LevelUp Hybrid Skeleton — app.js
   HÍBRIDO:
   1) intenta cargar ./data/data.json (GitHub Pages) cuando hay internet
   2) si falla, usa la última copia en localStorage
   3) siempre puedes importar JSON manual (iPad offline) y se guarda localmente
*/
  window.LEVELUP_BUILD = 'LevelUP_V2_00.034';

  // CLEAN PASS v29: stability + small UI tweaks

  const CONFIG = {
    remoteUrl: './data/data.json',
    remoteTimeoutMs: 3500,
    storageKey: 'levelup:data:v1'
  };

  // Weekly XP cap for "Actividades pequeñas" (per hero). If hero.weekXpMax is missing, we fall back to this.
  const DEFAULT_WEEK_XP_MAX = 40;

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
    // Para edición de encuadre (si más adelante activamos el editor)
    photoFit: { x: 50, y: 50, scale: 1 }
  };
}

// Demo de desafíos (2 por dificultad) para probar layout/UI.
// Se inyecta SOLO si el JSON viene vacío y aún no se ha marcado meta.seededDemo.
function seedChallengesDemo(S){
  const safe = (x, fallback) => (x && typeof x === 'object') ? x : fallback;
  S = safe(S, {
    tec:{id:'sub_tec', name:'Tecnología'},
    ing:{id:'sub_ing', name:'Inglés'},
    esp:{id:'sub_esp', name:'Español'},
    mat:{id:'sub_mat', name:'Matemáticas'},
    tut:{id:'sub_tut', name:'Tutoría'},
  });
  return [
    { id: uid('c'), subjectId: S.tec.id, subject: S.tec.name, difficulty:'easy',   points:10,
      title:'Fácil: Dibuja un ícono (10 min)',
      body:'En tu libreta, diseña un ícono para una app escolar.\n\nRequisitos:\n- Debe ser simple\n- 2 a 3 formas geométricas\n- Explica qué significa' },
    { id: uid('c'), subjectId: S.ing.id, subject: S.ing.name, difficulty:'easy',   points:10,
      title:'Fácil: 10 palabras en inglés',
      body:'Escribe 10 palabras en inglés relacionadas con la escuela.\n\nLuego, elige 3 y escribe una oración con cada una.' },

    { id: uid('c'), subjectId: S.esp.id, subject: S.esp.name, difficulty:'medium', points:20,
      title:'Medio: Mini historia (8 líneas)',
      body:'Escribe una historia corta de 8 líneas.\n\nIncluye:\n- Un inicio claro\n- Un problema\n- Un final' },
    { id: uid('c'), subjectId: S.mat.id, subject: S.mat.name, difficulty:'medium', points:20,
      title:'Medio: 3 problemas con contexto',
      body:'Resuelve 3 problemas en tu libreta (pueden ser inventados).\n\nCada problema debe tener:\n- Datos\n- Operación\n- Respuesta con unidades' },

    { id: uid('c'), subjectId: S.tec.id, subject: S.tec.name, difficulty:'hard',   points:40,
      title:'Difícil: Plan de proyecto (1 página)',
      body:'Crea un plan de proyecto en 1 página.\n\nIncluye:\n- Objetivo\n- Materiales\n- Pasos\n- Tiempo estimado\n- Cómo evaluarás si quedó bien' },
    { id: uid('c'), subjectId: S.tut.id, subject: S.tut.name, difficulty:'hard',   points:40,
      title:'Difícil: Reflexión (2 párrafos)',
      body:'Escribe 2 párrafos sobre un reto personal en la escuela.\n\nIncluye:\n- Qué pasó\n- Qué aprendiste\n- Qué harás diferente la próxima vez' },
  ];
}

  const state = {
    route: 'fichas',
    role: 'viewer',      // futuro: 'teacher' con PIN
    group: '2D',
    selectedHeroId: null,
    selectedChallengeId: null,
    challengeFilter: { subjectId: null, diff: 'easy' },
    isDetailsOpen: false,
    data: null,
    dataSource: '—'      // remote | local | demo
  };

  // Build marker (para confirmar en GitHub que sí cargó la versión correcta)
  // Build identifier (also used for cache-busting via querystring in index.html)
  const BUILD_ID = 'LevelUP_V2_00.034';

  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  // Modal helper (evita que un modal quede debajo de otro)
  const MODAL_IDS = ['roleModal','photoModal','levelUpModal','confirmModal','subjectsModal','challengeModal', 'eventModal'];
  const getModal = (id) => document.getElementById(id);
  function closeAllModals(exceptId=null){
    MODAL_IDS.forEach(id=>{
      if (exceptId && id === exceptId) return;
      const m = getModal(id);
      if (m) m.hidden = true;
    });
  }


function readFileAsDataURL(file){
  return new Promise((resolve, reject)=>{
    try{
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error || new Error('No se pudo leer la imagen'));
      reader.readAsDataURL(file);
    } catch (err){
      reject(err);
    }
  });
}

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

function countCompletedForHero(hero){
  if (!hero) return 0;
  const c = (hero.challengeCompletions && typeof hero.challengeCompletions==='object') ? hero.challengeCompletions : {};
  return Object.keys(c).length;
}

function isEventUnlocked(ev){
  if (!ev) return false;
  if (ev.unlocked) return true;
  const u = ev.unlock || {};
  const heroes = Array.isArray(state.data?.heroes) ? state.data.heroes : [];
  const total = totalCompletedAcrossHeroes();
  if (u.type==='completions_total') return total >= Number(u.count||0);
  if (u.type==='level_any') return heroes.some(h=>Number(h.level||1) >= Number(u.min||1));
  return false;
}

function isHeroEligibleForEvent(hero, ev){
  if (!hero || !ev) return false;
  const r = ev.eligibility || {};
  if (r.type==='level') return Number(hero.level||1) >= Number(r.min||1);
  if (r.type==='completions_hero') return countCompletedForHero(hero) >= Number(r.count||0);
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

d.heroes.forEach(h=>{
      h.id = h.id || uid('h');
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
      h.photoFit = h.photoFit || { x:50, y:50, scale:1 };
      h.photoSrc = h.photoSrc || '';
      h.desc = h.desc || '';
      h.goal = h.goal || '';
      h.rewardsHistory = Array.isArray(h.rewardsHistory) ? h.rewardsHistory : [];
      h.challengeCompletions = (h.challengeCompletions && typeof h.challengeCompletions === 'object') ? h.challengeCompletions : {};
      h.pendingRewards = Array.isArray(h.pendingRewards) ? h.pendingRewards : []; // items: { level, createdAt }
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



