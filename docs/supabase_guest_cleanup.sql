-- Limpieza de acceso guest/anon a datos reales de alumnos
-- Ejecutar manualmente en Supabase SQL Editor.

-- 1) Policies guest/anon en stats/progress
DROP POLICY IF EXISTS stats_guest_select ON public.student_stats;
DROP POLICY IF EXISTS progress_guest_select ON public.student_progress;

-- 2) Vista pública de alumnos (ya no se usa)
DROP VIEW IF EXISTS public.students_public;

-- 3) Revocar permisos anon a datos de alumnos
REVOKE ALL ON public.students FROM anon;
REVOKE ALL ON public.student_stats FROM anon;
REVOKE ALL ON public.student_progress FROM anon;

-- 4) Nota importante:
-- NO se recomienda revocar USAGE del schema public al rol anon aquí,
-- porque puede afectar flujos no deseados según la configuración del proyecto.
-- Endurece con RLS + REVOKE por tabla (arriba), que es más granular.

-- (Opcional) Verificación rápida
-- select schemaname, tablename, policyname from pg_policies
-- where schemaname='public' and policyname in ('stats_guest_select','progress_guest_select');
