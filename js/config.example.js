'use strict';

/**
 * @file config.example.js
 * @description Plantilla de configuración para LevelUp V2.
 *
 * INSTRUCCIONES PARA NUEVAS INSTANCIAS:
 * ──────────────────────────────────────────────────────────────────────────
 * 1. Copia este archivo: cp js/config.example.js js/config.js
 * 2. Reemplaza los valores de placeholder con los de tu proyecto Supabase.
 * 3. Obtén tus credenciales en: https://supabase.com/dashboard/project/_/settings/api
 *
 * SEGURIDAD:
 * - La SUPABASE_ANON_KEY es una clave pública diseñada para el navegador.
 * - Su seguridad depende de las políticas RLS configuradas en Supabase.
 * - Nunca uses la SERVICE_ROLE_KEY en el frontend.
 * - Documentación RLS: https://supabase.com/docs/guides/auth/row-level-security
 * ──────────────────────────────────────────────────────────────────────────
 */

export const SUPABASE_URL = 'https://TU_PROYECTO_ID.supabase.co';

/**
 * Clave anónima pública de Supabase.
 * Segura para el navegador siempre que las políticas RLS estén activas.
 */
export const SUPABASE_ANON_KEY = 'TU_SUPABASE_ANON_KEY_AQUI';
