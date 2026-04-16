'use strict';

/**
 * @module hero_session
 * @description Gestión de autenticación/sesión con contexto de rol desde Supabase.
 */

import { SUPABASE_URL, SUPABASE_ANON_KEY, getCurrentUserContext } from './supabase_client.js';

const AUTH_TIMEOUT_MS = 8000;

const SESSION_KEY = 'levelup:session';

// ============================================
// AUTH — Login / Logout / Registro
// ============================================


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

function getTokenEmail(token) {
  const payload = decodeJwtPayload(token);
  const email = payload?.email;
  return typeof email === 'string' ? email.toLowerCase().trim() : null;
}

function isStrictAdminSession(session) {
  return session?.role === 'admin';
}

async function safeReadJson(res) {
  try {
    return await res.json();
  } catch (_) {
    return {};
  }
}

async function authFetch(path, body, timeoutMs = AUTH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${SUPABASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new Error('La conexión tardó demasiado. Revisa internet e inténtalo de nuevo.');
    }
    throw new Error('No se pudo conectar al servidor. Revisa internet e inténtalo de nuevo.');
  } finally {
    window.clearTimeout(timeoutId);
  }
}


export async function loginHero(email, password) {
  const normalizedEmail = email.toLowerCase().trim();
  const res = await authFetch('/auth/v1/token?grant_type=password', {
    email: normalizedEmail,
    password
  });

  const data = await safeReadJson(res);
  if (!res.ok) throw new Error(data.error_description || data.msg || 'Correo o contraseña incorrectos');

  // Resolver rol/contexto desde tablas de Supabase (profiles/students).
  const tmpSession = {
    email: normalizedEmail,
    token: data.access_token,
    refreshToken: data.refresh_token || null,
    savedAt: Date.now()
  };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(tmpSession));
  const context = await getCurrentUserContext();
  if (!context?.role) throw new Error('Tu cuenta no tiene perfil en LevelUp. Pide al admin que te asigne un rol.');
  if (context.role === 'student' && !context.studentId) {
    throw new Error('Tu cuenta no está vinculada a ningún alumno. Pide al admin que la vincule.');
  }

  // Guardar sesión
  const session = {
    email: normalizedEmail,
    role: context.role,
    heroId: context.role === 'student' ? context.studentId : null,
    isAdmin: context.role === 'admin',
    token: data.access_token,
    refreshToken: data.refresh_token || null,
    savedAt: Date.now()
  };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}


export function loginGuest() {
  const session = {
    email: 'guest@levelup.local',
    role: 'guest',
    heroId: null,
    isAdmin: false,
    token: 'guest-mode',
    guest: true,
    savedAt: Date.now()
  };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}
export async function registerHero(email, password) {
  const res = await authFetch('/auth/v1/signup', {
    email: email.toLowerCase().trim(),
    password
  });

  const data = await safeReadJson(res);
  if (!res.ok) throw new Error(data.error_description || data.msg || 'Error al crear cuenta');
  if (data.user?.identities?.length === 0) throw new Error('Este correo ya tiene cuenta. Usa "Iniciar sesión".');
  return true;
}

export async function changeHeroPassword(email, currentPassword, newPassword) {
  const normalizedEmail = email.toLowerCase().trim();

  const loginRes = await authFetch('/auth/v1/token?grant_type=password', {
    email: normalizedEmail,
    password: currentPassword
  });

  const loginData = await safeReadJson(loginRes);
  if (!loginRes.ok || !loginData.access_token) {
    throw new Error(loginData.error_description || 'La contraseña actual no es correcta.');
  }

  const updateRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    method: 'PUT',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${loginData.access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ password: newPassword })
  });

  const updateData = await updateRes.json();
  if (!updateRes.ok) {
    throw new Error(updateData.error_description || updateData.msg || 'No se pudo actualizar la contraseña.');
  }

  return true;
}

export function getSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || typeof s !== 'object') return null;

    // Sesión válida por 8 horas
    if (Date.now() - s.savedAt > 8 * 60 * 60 * 1000) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }

    // Guest mode: no JWT validation required
    if (s.guest === true) {
      s.isAdmin = false;
      return s;
    }

    const email = typeof s.email === 'string' ? s.email.toLowerCase().trim() : '';
    const tokenEmail = getTokenEmail(s.token);

    // If token has an email claim, it must match session email
    if (tokenEmail && email && tokenEmail !== email) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }

    // Never trust client flag blindly: recompute admin from strict conditions
    s.isAdmin = isStrictAdminSession(s);

    return s;
  } catch (_) { return null; }
}

export function logout() {
  sessionStorage.removeItem(SESSION_KEY);
  window.location.href = 'login.html';
}

export function requireSession() {
  const session = getSession();
  if (!session) {
    window.location.href = 'login.html';
    return null;
  }
  return session;
}

// Exponer para acceso global
if (typeof window !== 'undefined') {
  window.LevelUp = window.LevelUp || {};
  window.LevelUp.getSession = getSession;
  window.LevelUp.logout = logout;
}
