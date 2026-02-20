'use strict';

/**
 * @module hero_session
 * @description Mapeo correo → hero_id y gestión de sesión del alumno
 * 
 * CÓMO FUNCIONA:
 * - El alumno entra con su correo y contraseña
 * - El correo está mapeado a su hero_id en HERO_MAP
 * - No hay tabla de usuarios en Supabase, todo es local + sessionStorage
 * 
 * PARA AGREGAR UN ALUMNO:
 * - Agrega su correo y hero_id al HERO_MAP de abajo
 * - El alumno puede crear su cuenta en login.html con ese mismo correo
 */

// ============================================
// MAPA CORREO → HERO_ID
// Edita esto para agregar o cambiar alumnos
// ============================================
const HERO_MAP = {
  // Grupo 2D
  'natanael@levelup.mx':    'h_2d_2',
  'maia@levelup.mx':        'h_2d_3',
  'jesus@levelup.mx':       'h_2d_4',
  'alexa@levelup.mx':       'h_2d_5',
  'ernesto@levelup.mx':     'h_2d_6',
  'alexis@levelup.mx':      'h_2d_7',
  'josue@levelup.mx':       'h_2d_8',
  'santiago@levelup.mx':    'h_2d_9',
  'tadeo@levelup.mx':       'h_2d_10',
  'eric@levelup.mx':        'h_2d_11',
  'majo@levelup.mx':        'h_2d_12',
  'brandon@levelup.mx':     'h_2d_13',
  'arely@levelup.mx':       'h_2d_14',

  // Grupo 3D
  'jannya@levelup.mx':      'h_3d_1',
  'anabrenda@levelup.mx':   'h_3d_2',
  'carlos@levelup.mx':      'h_3d_3',
  'josemiguel@levelup.mx':  'h_3d_4',
  'lizeth@levelup.mx':      'h_3d_5',
  'thaily@levelup.mx':      'h_3d_6',
  'ximena@levelup.mx':      'h_3d_7',
  'juan@levelup.mx':        'h_3d_8',
  'luis@levelup.mx':        'h_3d_9',
  'melinna@levelup.mx':     'h_3d_10',
  'zoe@levelup.mx':         'h_3d_11',
  'david@levelup.mx':       'h_3d_12',
  'leslye@levelup.mx':      'h_3d_13',
  'julissa@levelup.mx':     'h_3d_14',

  // Admin (tú)
  'eddy@levelup.mx':        'admin',
};

const SESSION_KEY = 'levelup:session';
const SUPABASE_URL = 'https://nptbobvstfjpytnvzfil.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wdGJvYnZzdGZqcHl0bnZ6ZmlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1MzczOTMsImV4cCI6MjA4NzExMzM5M30.NwUtbFjMwz52fj_TDa8T10TsqEPwbK2h5VS_JGr8i7k';

// ============================================
// AUTH — Login / Logout / Registro
// ============================================

export async function loginHero(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email: email.toLowerCase().trim(), password })
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || 'Correo o contraseña incorrectos');

  const heroId = HERO_MAP[email.toLowerCase().trim()];
  if (!heroId) throw new Error('Este correo no está registrado en LevelUp. Pídele a tu profe que te agregue.');

  // Guardar sesión
  const session = {
    email: email.toLowerCase().trim(),
    heroId,
    isAdmin: heroId === 'admin',
    token: data.access_token,
    savedAt: Date.now()
  };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export async function registerHero(email, password) {
  // Verificar que el correo esté en el mapa antes de registrar
  const heroId = HERO_MAP[email.toLowerCase().trim()];
  if (!heroId) throw new Error('Este correo no está en la lista de LevelUp. Pídele a tu profe que te agregue primero.');

  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email: email.toLowerCase().trim(), password })
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || 'Error al crear cuenta');
  if (data.user?.identities?.length === 0) throw new Error('Este correo ya tiene cuenta. Usa "Iniciar sesión".');
  return true;
}

export function getSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    // Sesión válida por 8 horas
    if (Date.now() - s.savedAt > 8 * 60 * 60 * 1000) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
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
