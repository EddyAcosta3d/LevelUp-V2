// LevelUp LAB Eventos v2 — secretos (locked no revela)
const $ = (sel, root=document) => root.querySelector(sel);

const state = {
  events: [],
  showLocked: true,
  overrideUnlocked: new Set(), // solo en lab
};

function setStatus(text){ $('#statusPill').textContent = text; }

function escapeHtml(s){
  return (s ?? '').toString()
    .replaceAll('&','&amp;').replaceAll('<','&lt;')
    .replaceAll('>','&gt;').replaceAll('"','&quot;')
    .replaceAll("'",'&#039;');
}

function getEventImageInfo(ev, isUnlocked){
  const id = ev.assetKey || ev.id;
  const kind = ev.kind === 'boss' ? 'jefes' : 'eventos';
  const prefix = ev.kind === 'boss' ? 'Boss_' : 'Event_';
  const ext = (ev.ext || 'jpg').replace('.','');
  const suffix = isUnlocked ? `_unlocked.${ext}` : `_locked.${ext}`;
  return `../assets/${kind}/${prefix}${id}${suffix}`;
}

function demoEvents(){
  return [
    { id:'loquito', kind:'boss',
      title:'El Loquito del Centro',
      desc:'Reto de presentación. Si lo vences, desbloqueas recompensas especiales.',
      unlock:{ type:'completions_total', count:3, label:'Completa 3 desafíos' }, tags:['JEFE','Racha'] },
    { id:'garbanzo', kind:'boss',
      title:'El Garbanzo Coqueto',
      desc:'Prueba de constancia: completa desafíos en la semana.',
      unlock:{ type:'streak_week', count:3, label:'Completa 3 desafíos en una semana' }, tags:['JEFE'] },
    { id:'doble_xp', kind:'event',
      title:'Evento: Doble XP',
      desc:'Por tiempo limitado: algunos desafíos dan XP extra.',
      unlock:{ type:'level', count:2, label:'Llega a nivel 2' }, tags:['EVENTO','Temporal'] },
    { id:'sorpresa', kind:'event',
      title:'Evento: Recompensa Sorpresa',
      desc:'Completa un desafío difícil para una recompensa especial.',
      unlock:{ type:'difficulty', count:1, label:'Completa 1 desafío difícil' }, tags:['EVENTO'] },
  ];
}

async function tryLoadRemoteData(){
  const urls = ['../data/data.json','./data.json'];
  for (const url of urls){
    try{
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) continue;
      const data = await res.json();
      if (Array.isArray(data.events) && data.events.length){
        return { ok:true, url, events: data.events };
      }
    }catch(_e){}
  }
  return { ok:false };
}

function isUnlocked(ev){
  if (state.overrideUnlocked.has(ev.id)) return true;
  if (ev.unlock?.type === 'always') return true;
  return false;
}

function render(){
  const grid = $('#eventsGrid');
  grid.innerHTML = '';

  const list = state.showLocked ? state.events : state.events.filter(e => isUnlocked(e));
  if (!list.length){
    grid.innerHTML = `<div style="padding:14px; opacity:.8">No hay eventos para mostrar.</div>`;
    return;
  }

  for (const ev of list){
    const unlocked = isUnlocked(ev);
    const card = document.createElement('div');
    card.className = 'card';

    const badges = [];
    badges.push(`<span class="badge boss">${ev.kind==='boss'?'JEFE':'EVENTO'}</span>`);
    badges.push(`<span class="badge ${unlocked?'unlocked':'locked'}">${unlocked?'DESBLOQUEADO':'BLOQUEADO'}</span>`);

    const title = unlocked ? (ev.title || ev.id) : '???';
    const titleClass = unlocked ? '' : 'secretTitle';

    card.innerHTML = `
      <div class="cardMedia">
        <img alt="" />
        ${unlocked ? '' : '<div class="silhouette"></div>'}
        <div class="imgFallback hidden">SIN IMAGEN</div>
      </div>
      <div class="cardBody">
        <div class="cardTitle ${titleClass}">${escapeHtml(title)}</div>
        <div class="badges">${badges.join('')}</div>
        <div class="reqMini">${escapeHtml(ev.unlock?.label || 'Requisito: —')}</div>
      </div>
    `;

    // image
    const img = card.querySelector('img');
    const fb = card.querySelector('.imgFallback');
    img.src = getEventImageInfo(ev, unlocked);
    img.onload = () => fb.classList.add('hidden');
    img.onerror = () => { img.remove(); fb.classList.remove('hidden'); };

    card.addEventListener('click', () => openEventModal(ev));
    grid.appendChild(card);
  }
}

function openEventModal(ev){
  const unlocked = isUnlocked(ev);

  $('#modalEyebrow').textContent = ev.kind === 'boss' ? 'JEFE' : 'EVENTO';
  $('#modalTitle').textContent = unlocked ? (ev.title || ev.id) : '???';

  const badges = [];
  badges.push(`<span class="badge boss">${ev.kind==='boss'?'JEFE':'EVENTO'}</span>`);
  badges.push(`<span class="badge ${unlocked?'unlocked':'locked'}">${unlocked?'DESBLOQUEADO':'BLOQUEADO'}</span>`);
  $('#modalBadges').innerHTML = badges.join('');

  // requisito siempre visible
  $('#modalReq').textContent = ev.unlock?.label || 'Requisito: —';

  // detalles solo si está desbloqueado
  const descWrap = $('#modalDescWrap');
  if (unlocked){
    descWrap.classList.remove('hidden');
    $('#modalDesc').textContent = ev.desc || '';
  }else{
    descWrap.classList.add('hidden');
    $('#modalDesc').textContent = '';
  }

  // image + silhouette
  const img = $('#modalImg');
  const fb = $('#modalImgFallback');
  const sil = $('#modalSilhouette');
  img.classList.remove('hidden');
  fb.classList.add('hidden');
  sil.classList.toggle('hidden', unlocked);

  img.src = getEventImageInfo(ev, unlocked);
  img.onload = () => fb.classList.add('hidden');
  img.onerror = () => { img.classList.add('hidden'); fb.classList.remove('hidden'); };

  $('#btnRetar').onclick = () => showModalToast(unlocked ? '¡Reto iniciado! (demo)' : 'Aún bloqueado.');
  $('#btnToggleUnlock').onclick = () => {
    if (state.overrideUnlocked.has(ev.id)) state.overrideUnlocked.delete(ev.id);
    else state.overrideUnlocked.add(ev.id);
    openEventModal(ev);
    render();
  };

  showModal();
}

function showModalToast(msg){
  const el = $('#modalToast');
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(()=> el.classList.add('hidden'), 1200);
}

function showModal(){
  $('#modalBackdrop').classList.remove('hidden');
  $('#eventModal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}
function closeModal(){
  $('#modalBackdrop').classList.add('hidden');
  $('#eventModal').classList.add('hidden');
  document.body.style.overflow = '';
}

function bindUI(){
  $('#chkShowLocked').addEventListener('change', (e)=>{ state.showLocked = e.target.checked; render(); });
  $('#chkTryRemote').addEventListener('change', ()=> init());
  $('#btnReload').addEventListener('click', init);

  $('#btnCloseModal').addEventListener('click', closeModal);
  $('#modalBackdrop').addEventListener('click', closeModal);
  document.addEventListener('keydown', (e)=>{ if(e.key==='Escape') closeModal(); });
}

async function init(){
  setStatus('Cargando…');
  state.overrideUnlocked.clear();

  if ($('#chkTryRemote').checked){
    const r = await tryLoadRemoteData();
    if (r.ok){
      state.events = r.events;
      setStatus(`Remote OK: ${r.url} (${state.events.length})`);
      render();
      return;
    }
  }
  state.events = demoEvents();
  setStatus(`Demo (${state.events.length})`);
  render();
}

bindUI();
init();
