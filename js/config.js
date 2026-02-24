'use strict';

/**
 * @file config.js
 * @description Credenciales y configuración de servicios externos para LevelUp V2.
 *
 * SEGURIDAD — IMPORTANTE:
 * ─────────────────────────────────────────────────────────────────────────────
 * La SUPABASE_ANON_KEY es una clave pública diseñada para uso en el navegador.
 * Su seguridad NO depende de ocultarla, sino de las políticas Row Level Security
 * (RLS) configuradas en Supabase. Si las RLS están bien configuradas, un atacante
 * con esta clave solo puede acceder a los datos que un usuario anónimo puede ver.
 *
 * Si en algún momento necesitas rotar la clave:
 * 1. Genera una nueva ANON_KEY en el panel de Supabase (Settings → API).
 * 2. Actualiza este archivo.
 * 3. Haz deploy del cambio.
 *
 * Si clonas este repositorio para tu propia instancia:
 * 1. Copia js/config.example.js → js/config.js
 * 2. Reemplaza los valores con los de tu propio proyecto Supabase.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const SUPABASE_URL = 'https://nptbobvstfjpytnvzfil.supabase.co';

/**
 * Clave anónima pública de Supabase.
 * Segura para el navegador siempre que las políticas RLS estén activas.
 * Ver: https://supabase.com/docs/guides/auth/row-level-security
 */
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wdGJvYnZzdGZqcHl0bnZ6ZmlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1MzczOTMsImV4cCI6MjA4NzExMzM5M30.NwUtbFjMwz52fj_TDa8T10TsqEPwbK2h5VS_JGr8i7k';
