-- Supabase Security Advisor fixes for LevelUp
-- Corrige:
-- 1) RLS Disabled in Public (public.hero_accounts)
-- 2) RLS Policy Always True (hero_assignments, submissions, store_claims)
--
-- Ajusta este correo al admin real del proyecto.
-- Recomendado: crear claim app_role='admin' y validar por claim,
-- pero este script usa email para mantener compatibilidad actual.

begin;

-- =====================================================
-- 0) Tabla puente y RLS base
-- =====================================================
create table if not exists public.hero_accounts (
  email text primary key,
  hero_id text not null unique
);

alter table public.hero_accounts enable row level security;
alter table public.hero_assignments enable row level security;
alter table public.submissions enable row level security;
alter table public.store_claims enable row level security;

-- Limpieza de políticas comunes/anteriores
-- hero_accounts
DROP POLICY IF EXISTS "hero_accounts_select_self" ON public.hero_accounts;
DROP POLICY IF EXISTS "hero_accounts_admin_all" ON public.hero_accounts;
DROP POLICY IF EXISTS "hero_accounts_service_role_all" ON public.hero_accounts;

-- hero_assignments
DROP POLICY IF EXISTS "hero_assignments_select_admin" ON public.hero_assignments;
DROP POLICY IF EXISTS "hero_assignments_insert_admin" ON public.hero_assignments;
DROP POLICY IF EXISTS "hero_assignments_delete_admin" ON public.hero_assignments;
DROP POLICY IF EXISTS "hero_assignments_select_student_own" ON public.hero_assignments;
DROP POLICY IF EXISTS "hero_assignments_select_admin_or_student" ON public.hero_assignments;
DROP POLICY IF EXISTS "hero_assignments_admin_all" ON public.hero_assignments;
DROP POLICY IF EXISTS "hero_assignments_student_select_own" ON public.hero_assignments;

-- submissions
DROP POLICY IF EXISTS "submissions_admin_all" ON public.submissions;
DROP POLICY IF EXISTS "submissions_student_select_own" ON public.submissions;
DROP POLICY IF EXISTS "submissions_student_insert_own" ON public.submissions;

-- store_claims
DROP POLICY IF EXISTS "store_claims_admin_all" ON public.store_claims;
DROP POLICY IF EXISTS "store_claims_student_select_own" ON public.store_claims;
DROP POLICY IF EXISTS "store_claims_student_insert_own" ON public.store_claims;

-- =====================================================
-- 1) hero_accounts
-- =====================================================
-- El alumno solo puede ver su propio mapeo.
create policy "hero_accounts_select_self"
on public.hero_accounts
for select
to authenticated
using (lower(email) = lower(auth.jwt() ->> 'email'));

-- Admin puede administrar mapeos.
create policy "hero_accounts_admin_all"
on public.hero_accounts
for all
to authenticated
using (lower(auth.jwt() ->> 'email') = 'eddy@levelup.mx')
with check (lower(auth.jwt() ->> 'email') = 'eddy@levelup.mx');

-- =====================================================
-- 2) hero_assignments
-- =====================================================
-- Admin: control total.
create policy "hero_assignments_admin_all"
on public.hero_assignments
for all
to authenticated
using (lower(auth.jwt() ->> 'email') = 'eddy@levelup.mx')
with check (lower(auth.jwt() ->> 'email') = 'eddy@levelup.mx');

-- Alumno: solo lectura de sus filas.
create policy "hero_assignments_student_select_own"
on public.hero_assignments
for select
to authenticated
using (
  exists (
    select 1
    from public.hero_accounts ha
    where lower(ha.email) = lower(auth.jwt() ->> 'email')
      and ha.hero_id = hero_assignments.hero_id
  )
);

-- =====================================================
-- 3) submissions
-- =====================================================
-- Admin: control total.
create policy "submissions_admin_all"
on public.submissions
for all
to authenticated
using (lower(auth.jwt() ->> 'email') = 'eddy@levelup.mx')
with check (lower(auth.jwt() ->> 'email') = 'eddy@levelup.mx');

-- Alumno: puede leer solo sus evidencias.
create policy "submissions_student_select_own"
on public.submissions
for select
to authenticated
using (
  exists (
    select 1
    from public.hero_accounts ha
    where lower(ha.email) = lower(auth.jwt() ->> 'email')
      and ha.hero_id = submissions.hero_id
  )
);

-- Alumno: puede crear evidencias solo para su hero_id.
create policy "submissions_student_insert_own"
on public.submissions
for insert
to authenticated
with check (
  exists (
    select 1
    from public.hero_accounts ha
    where lower(ha.email) = lower(auth.jwt() ->> 'email')
      and ha.hero_id = submissions.hero_id
  )
);

-- =====================================================
-- 4) store_claims
-- =====================================================
-- Admin: control total.
create policy "store_claims_admin_all"
on public.store_claims
for all
to authenticated
using (lower(auth.jwt() ->> 'email') = 'eddy@levelup.mx')
with check (lower(auth.jwt() ->> 'email') = 'eddy@levelup.mx');

-- Alumno: lectura de sus canjes.
create policy "store_claims_student_select_own"
on public.store_claims
for select
to authenticated
using (
  exists (
    select 1
    from public.hero_accounts ha
    where lower(ha.email) = lower(auth.jwt() ->> 'email')
      and ha.hero_id = store_claims.hero_id
  )
);

-- Alumno: crear canjes solo para su hero_id.
create policy "store_claims_student_insert_own"
on public.store_claims
for insert
to authenticated
with check (
  exists (
    select 1
    from public.hero_accounts ha
    where lower(ha.email) = lower(auth.jwt() ->> 'email')
      and ha.hero_id = store_claims.hero_id
  )
);

-- Índice recomendado para evitar duplicados en asignaciones
create unique index if not exists hero_assignments_hero_id_challenge_id_idx
on public.hero_assignments (hero_id, challenge_id);

commit;

-- =====================================================
-- Post-check (ejecuta por separado)
-- =====================================================
-- select schemaname, tablename, rowsecurity
-- from pg_tables
-- where schemaname='public'
--   and tablename in ('hero_accounts','hero_assignments','submissions','store_claims');
--
-- select schemaname, tablename, policyname, permissive, roles, cmd
-- from pg_policies
-- where schemaname='public'
--   and tablename in ('hero_accounts','hero_assignments','submissions','store_claims')
-- order by tablename, policyname;
