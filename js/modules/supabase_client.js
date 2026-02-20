'use strict';

/**
 * @module supabase_client
 * @description Conexión a Supabase para LevelUp V2
 */

const SUPABASE_URL = 'https://nptbobvstfjpytnvzfil.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wdGJvYnZzdGZqcHl0bnZ6ZmlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1MzczOTMsImV4cCI6MjA4NzExMzM5M30.NwUtbFjMwz52fj_TDa8T10TsqEPwbK2h5VS_JGr8i7k';

function getSessionToken() {
  try {
    const raw = sessionStorage.getItem('levelup:session');
    if (!raw) return null;
    const s = JSON.parse(raw);
    return s?.token || null;
  } catch (_) {
    return null;
  }
}

async function parseError(res, fallback) {
  try {
    const data = await res.json();
    return data?.message || data?.error_description || data?.error || fallback;
  } catch (_) {
    return fallback;
  }
}

// Headers base para todas las peticiones
const headers = () => ({
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${getSessionToken() || SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
});

// ============================================
// SUBMISSIONS — Evidencias de desafíos
// ============================================

export async function insertSubmission(data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/submissions`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(await parseError(res, `Error al enviar: ${res.status}`));
  return await res.json();
}

export async function getSubmissionsByHero(heroId) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/submissions?hero_id=eq.${encodeURIComponent(heroId)}&order=created_at.desc`,
    { headers: headers() }
  );
  if (!res.ok) throw new Error(await parseError(res, `Error al leer: ${res.status}`));
  return await res.json();
}

export async function getAllSubmissions() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/submissions?order=created_at.desc`,
    { headers: headers() }
  );
  if (!res.ok) throw new Error(await parseError(res, `Error al leer: ${res.status}`));
  return await res.json();
}

export async function updateSubmission(id, data) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/submissions?id=eq.${id}`,
    {
      method: 'PATCH',
      headers: headers(),
      body: JSON.stringify(data)
    }
  );
  if (!res.ok) throw new Error(await parseError(res, `Error al actualizar: ${res.status}`));
  return true;
}

// ============================================
// STORE CLAIMS — Canjes de tienda
// ============================================

export async function insertStoreClaim(data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/store_claims`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(await parseError(res, `Error al canjear: ${res.status}`));
  return await res.json();
}

export async function getStoreClaimsByHero(heroId) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/store_claims?hero_id=eq.${encodeURIComponent(heroId)}&order=created_at.desc`,
    { headers: headers() }
  );
  if (!res.ok) throw new Error(await parseError(res, `Error al leer canjes: ${res.status}`));
  return await res.json();
}

export async function getAllStoreClaims() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/store_claims?order=created_at.desc`,
    { headers: headers() }
  );
  if (!res.ok) throw new Error(await parseError(res, `Error al leer canjes: ${res.status}`));
  return await res.json();
}

export async function updateStoreClaim(id, data) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/store_claims?id=eq.${id}`,
    {
      method: 'PATCH',
      headers: headers(),
      body: JSON.stringify(data)
    }
  );
  if (!res.ok) throw new Error(await parseError(res, `Error al actualizar canje: ${res.status}`));
  return true;
}

// ============================================
// STORAGE — Subir archivos de evidencia
// ============================================

export async function uploadEvidencia(heroId, challengeId, file) {
  const ext = file.name.split('.').pop();
  const fileName = `${heroId}/${challengeId}_${Date.now()}.${ext}`;

  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/evidencias/${fileName}`,
    {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${getSessionToken() || SUPABASE_ANON_KEY}`,
        'Content-Type': file.type,
        'x-upsert': 'true'
      },
      body: file
    }
  );
  if (!res.ok) throw new Error(await parseError(res, `Error al subir archivo: ${res.status}`));
  return `${SUPABASE_URL}/storage/v1/object/public/evidencias/${fileName}`;
}
