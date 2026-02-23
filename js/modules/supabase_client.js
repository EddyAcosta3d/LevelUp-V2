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

function updateSessionTokens(tokens = {}) {
  try {
    const session = getSession();
    if (!session) return;
    if (tokens.access_token) session.token = tokens.access_token;
    if (tokens.refresh_token) session.refreshToken = tokens.refresh_token;
    session.savedAt = Date.now();
    sessionStorage.setItem('levelup:session', JSON.stringify(session));
  } catch (_) {}
}

async function refreshSessionToken() {
  const session = getSession();
  const refreshToken = session?.refreshToken;
  if (!refreshToken) return null;

  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ refresh_token: refreshToken })
  });

  if (!res.ok) {
    clearSessionToken();
    return null;
  }

  const data = await res.json();
  if (!data?.access_token) return null;
  updateSessionTokens(data);
  return data.access_token;
}

function getSessionToken() {
  const session = getSession();
  const token = session?.token || null;
  if (!token) return null;

  const payload = decodeJwtPayload(token);
  const exp = Number(payload?.exp || 0);
  if (exp && (Date.now() >= exp * 1000)) {
    return null;
  }

  return token;
}

export function hasActiveSessionToken() {
  const session = getSession();
  if (!session) return false;
  return !!(getSessionToken() || session.refreshToken);
}

async function getUsableSessionToken() {
  const current = getSessionToken();
  if (current) return current;
  return await refreshSessionToken();
}

async function parseError(res, fallback) {
  try {
    const data = await res.json();
    return data?.message || data?.error_description || data?.error || fallback;
  } catch (_) {
    return fallback;
  }
}

async function throwIfNotOk(res, fallback) {
  if (res.ok) return;
  const msg = await parseError(res, fallback);
  if (res.status === 403) throw new Error(`RLS_DENIED: ${msg}`);
  throw new Error(msg);
}

const buildHeaders = ({ useAnon = false, token = null } = {}) => ({
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${useAnon ? SUPABASE_ANON_KEY : (token || SUPABASE_ANON_KEY)}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
});

async function supabaseFetch(path, init = {}, { retryWithAnon = true } = {}) {
  const customHeaders = init.headers || {};
  const doFetch = async (useAnon = false, forcedToken = null) => {
    const token = useAnon ? SUPABASE_ANON_KEY : (forcedToken || await getUsableSessionToken() || SUPABASE_ANON_KEY);
    return await fetch(`${SUPABASE_URL}${path}`, {
    ...init,
    headers: {
      ...buildHeaders({ useAnon, token }),
      ...customHeaders
    }
    });
  };

  let res = await doFetch(false);
  if (res.status === 401) {
    const refreshedToken = await refreshSessionToken();
    if (refreshedToken) {
      res = await doFetch(false, refreshedToken);
    }
  }
  if (retryWithAnon && res.status === 401) {
    clearSessionToken();
    res = await doFetch(true);
  }
  return res;
}

function isRpcMissingError(status, msg) {
  const text = String(msg || '');
  if (status === 404) return true;
  return (
    status === 400 && (
      text.includes('Could not find the function') ||
      text.includes('function') && text.includes('does not exist')
    )
  );
}

async function callAssignmentRpc(functionName, payload) {
  const res = await supabaseFetch(`/rest/v1/rpc/${functionName}`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  if (res.ok) return { ok: true, missing: false };

  const msg = await parseError(res, `RPC ${functionName} error: ${res.status}`);
  if (isRpcMissingError(res.status, msg)) {
    return { ok: false, missing: true };
  }

  throw new Error(msg);
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

  // Ruta principal: RPC con SECURITY DEFINER para evitar efectos de RLS
  // en escrituras de asignaciones.
  const rpc = await callAssignmentRpc('lu_assign_challenge', {
    p_hero_id: String(heroId),
    p_challenge_id: String(challengeId)
  });
  if (rpc.ok) return true;
  throw new Error('RPC_MISSING');
}

export async function deleteHeroAssignment(heroId, challengeId) {
  if (!hasActiveSessionToken()) throw new Error('AUTH_REQUIRED');

  const rpc = await callAssignmentRpc('lu_unassign_challenge', {
    p_hero_id: String(heroId),
    p_challenge_id: String(challengeId)
  });
  if (rpc.ok) return true;
  throw new Error('RPC_MISSING');
}

export async function getHeroAssignments(heroId) {
  const res = await supabaseFetch(
    `/rest/v1/hero_assignments?hero_id=eq.${encodeURIComponent(heroId)}&select=challenge_id`
  );
  await throwIfNotOk(res, `Error al leer asignaciones: ${res.status}`);
  const rows = await res.json();
  return rows.map(r => String(r.challenge_id));
}

export async function getAllHeroAssignments() {
  const res = await supabaseFetch('/rest/v1/hero_assignments?select=hero_id,challenge_id');
  if (!res.ok) throw new Error(await parseError(res, `Error al leer asignaciones: ${res.status}`));
  const rows = await res.json();
  return rows.map(row => ({
    ...row,
    challenge_id: String(row.challenge_id)
  }));
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
