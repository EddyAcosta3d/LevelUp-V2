'use strict';

/**
 * @module supabase_client
 * @description Conexión a Supabase para LevelUp V2
 */

const SUPABASE_URL = 'https://nptbobvstfjpytnvzfil.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wdGJvYnZzdGZqcHl0bnZ6ZmlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1MzczOTMsImV4cCI6MjA4NzExMzM5M30.NwUtbFjMwz52fj_TDa8T10TsqEPwbK2h5VS_JGr8i7k';

function getSession() {
  try {
    const raw = sessionStorage.getItem('levelup:session');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

function decodeJwtPayload(token) {
  try {
    const payload = token?.split('.')?.[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
    return JSON.parse(atob(padded));
  } catch (_) {
    return null;
  }
}

function clearSessionToken() {
  try {
    const session = getSession();
    if (!session || !session.token) return;
    delete session.token;
    sessionStorage.setItem('levelup:session', JSON.stringify(session));
  } catch (_) {}
}

function getSessionToken() {
  const session = getSession();
  const token = session?.token || null;
  if (!token) return null;

  const payload = decodeJwtPayload(token);
  const exp = Number(payload?.exp || 0);
  if (exp && (Date.now() >= exp * 1000)) {
    clearSessionToken();
    return null;
  }

  return token;
}

export function hasActiveSessionToken() {
  return !!getSessionToken();
}

async function parseError(res, fallback) {
  try {
    const data = await res.json();
    return data?.message || data?.error_description || data?.error || fallback;
  } catch (_) {
    return fallback;
  }
}

const buildHeaders = ({ useAnon = false } = {}) => ({
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${useAnon ? SUPABASE_ANON_KEY : (getSessionToken() || SUPABASE_ANON_KEY)}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
});

async function supabaseFetch(path, init = {}, { retryWithAnon = true } = {}) {
  const customHeaders = init.headers || {};
  const doFetch = (useAnon = false) => fetch(`${SUPABASE_URL}${path}`, {
    ...init,
    headers: {
      ...buildHeaders({ useAnon }),
      ...customHeaders
    }
  });

  let res = await doFetch(false);
  if (retryWithAnon && res.status === 401 && getSessionToken()) {
    clearSessionToken();
    res = await doFetch(true);
  }
  return res;
}

// ============================================
// SUBMISSIONS — Evidencias de desafíos
// ============================================

export async function insertSubmission(data) {
  const res = await supabaseFetch('/rest/v1/submissions', {
    method: 'POST',
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(await parseError(res, `Error al enviar: ${res.status}`));
  return await res.json();
}

export async function getSubmissionsByHero(heroId) {
  const res = await supabaseFetch(
    `/rest/v1/submissions?hero_id=eq.${encodeURIComponent(heroId)}&order=created_at.desc`
  );
  if (!res.ok) throw new Error(await parseError(res, `Error al leer: ${res.status}`));
  return await res.json();
}

export async function getAllSubmissions() {
  const res = await supabaseFetch('/rest/v1/submissions?order=created_at.desc');
  if (!res.ok) throw new Error(await parseError(res, `Error al leer: ${res.status}`));
  return await res.json();
}

export async function updateSubmission(id, data) {
  const res = await supabaseFetch(`/rest/v1/submissions?id=eq.${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(await parseError(res, `Error al actualizar: ${res.status}`));
  return true;
}

// ============================================
// STORE CLAIMS — Canjes de tienda
// ============================================

export async function insertStoreClaim(data) {
  const res = await supabaseFetch('/rest/v1/store_claims', {
    method: 'POST',
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(await parseError(res, `Error al canjear: ${res.status}`));
  return await res.json();
}

export async function getStoreClaimsByHero(heroId) {
  const res = await supabaseFetch(
    `/rest/v1/store_claims?hero_id=eq.${encodeURIComponent(heroId)}&order=created_at.desc`
  );
  if (!res.ok) throw new Error(await parseError(res, `Error al leer canjes: ${res.status}`));
  return await res.json();
}

export async function getAllStoreClaims() {
  const res = await supabaseFetch('/rest/v1/store_claims?order=created_at.desc');
  if (!res.ok) throw new Error(await parseError(res, `Error al leer canjes: ${res.status}`));
  return await res.json();
}

export async function updateStoreClaim(id, data) {
  const res = await supabaseFetch(`/rest/v1/store_claims?id=eq.${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(await parseError(res, `Error al actualizar canje: ${res.status}`));
  return true;
}

// ============================================
// HERO ASSIGNMENTS — Asignaciones en tiempo real
// ============================================

export async function upsertHeroAssignment(heroId, challengeId) {
  if (!hasActiveSessionToken()) throw new Error('AUTH_REQUIRED');
  const res = await supabaseFetch('/rest/v1/hero_assignments', {
    method: 'POST',
    headers: {
      'Prefer': 'resolution=merge-duplicates,return=minimal'
    },
    body: JSON.stringify({ hero_id: heroId, challenge_id: String(challengeId) })
  });
  if (!res.ok) throw new Error(await parseError(res, `Error al asignar: ${res.status}`));
  return true;
}

export async function deleteHeroAssignment(heroId, challengeId) {
  if (!hasActiveSessionToken()) throw new Error('AUTH_REQUIRED');
  const res = await supabaseFetch(
    `/rest/v1/hero_assignments?hero_id=eq.${encodeURIComponent(heroId)}&challenge_id=eq.${encodeURIComponent(String(challengeId))}`,
    { method: 'DELETE' }
  );
  if (!res.ok) throw new Error(await parseError(res, `Error al desasignar: ${res.status}`));
  return true;
}

export async function getHeroAssignments(heroId) {
  const res = await supabaseFetch(
    `/rest/v1/hero_assignments?hero_id=eq.${encodeURIComponent(heroId)}&select=challenge_id`
  );
  if (!res.ok) throw new Error(await parseError(res, `Error al leer asignaciones: ${res.status}`));
  const rows = await res.json();
  return rows.map(r => r.challenge_id);
}

export async function getAllHeroAssignments() {
  const res = await supabaseFetch('/rest/v1/hero_assignments?select=hero_id,challenge_id');
  if (!res.ok) throw new Error(await parseError(res, `Error al leer asignaciones: ${res.status}`));
  return await res.json();
}

// ============================================
// STORAGE — Subir archivos de evidencia
// ============================================

export async function uploadEvidencia(heroId, challengeId, file) {
  const ext = file.name.split('.').pop();
  const fileName = `${heroId}/${challengeId}_${Date.now()}.${ext}`;

  const token = getSessionToken() || SUPABASE_ANON_KEY;
  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/evidencias/${fileName}`,
    {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${token}`,
        'Content-Type': file.type,
        'x-upsert': 'true'
      },
      body: file
    }
  );
  if (!res.ok) throw new Error(await parseError(res, `Error al subir archivo: ${res.status}`));
  return `${SUPABASE_URL}/storage/v1/object/public/evidencias/${fileName}`;
}
