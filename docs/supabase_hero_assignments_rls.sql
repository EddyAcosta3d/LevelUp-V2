-- Ejecuta esto en Supabase SQL Editor para habilitar:
-- 1) Admin: leer/escribir asignaciones de desafíos.
-- 2) Alumno autenticado: leer SOLO sus asignaciones (para ver desbloqueos al recargar).
--
-- IMPORTANTE:
-- La app hace polling de hero_assignments desde la cuenta del alumno.
-- Si no existe una policy SELECT para alumno, el frontend no puede ver
-- los desbloqueos aunque el admin sí los haya guardado.

alter table public.hero_assignments enable row level security;

-- Limpieza opcional de políticas antiguas con nombres comunes
-- (si no existen, ignora los errores)
drop policy if exists "hero_assignments_select_admin" on public.hero_assignments;
drop policy if exists "hero_assignments_insert_admin" on public.hero_assignments;
drop policy if exists "hero_assignments_delete_admin" on public.hero_assignments;
drop policy if exists "hero_assignments_select_student_own" on public.hero_assignments;

-- Tabla puente email -> hero_id para RLS de alumnos.
-- Puedes mantenerla sincronizada con tu HERO_MAP del frontend.
create table if not exists public.hero_accounts (
  email text primary key,
  hero_id text not null unique
);

-- Tabla puente email -> hero_id para RLS de alumnos.
-- Puedes mantenerla sincronizada con tu HERO_MAP del frontend.
create table if not exists public.hero_accounts (
  email text primary key,
  hero_id text not null unique
);

drop policy if exists "hero_accounts_select_self" on public.hero_accounts;

create policy "hero_assignments_select_admin_or_student"
on public.hero_assignments
for select
using (
  -- Admin
  auth.jwt() ->> 'email' = 'eddy@levelup.mx'
  or
  -- Alumno: solo puede leer filas de su propio hero_id
  exists (
    select 1
    from public.hero_accounts ha
    where lower(ha.email) = lower(auth.jwt() ->> 'email')
      and ha.hero_id = hero_assignments.hero_id
  )
);

create policy "hero_assignments_insert_admin"
on public.hero_assignments
for insert
with check (
  auth.jwt() ->> 'email' = 'eddy@levelup.mx'
);

create policy "hero_assignments_delete_admin"
on public.hero_assignments
for delete
using (
  auth.jwt() ->> 'email' = 'eddy@levelup.mx'
);

-- Alumno: solo puede leer filas de su propio hero_id.
create policy "hero_assignments_select_student_own"
on public.hero_assignments
for select
using (
  exists (
    select 1
    from public.hero_accounts ha
    where lower(ha.email) = lower(auth.jwt() ->> 'email')
      and ha.hero_id = hero_assignments.hero_id
  )
);

-- (Opcional) evita duplicados por diseño
create unique index if not exists hero_assignments_hero_id_challenge_id_idx
on public.hero_assignments (hero_id, challenge_id);

-- ============================================
-- CARGA INICIAL COMPLETA (copiar/pegar)
-- ============================================
-- Recomendado: mantener este bloque sincronizado con HERO_MAP
-- en js/modules/hero_session.js
--
-- Si ejecutas SOLO este bloque (sin correr todo el archivo),
-- crea primero la tabla para evitar:
-- ERROR: relation "public.hero_accounts" does not exist
create table if not exists public.hero_accounts (
  email text primary key,
  hero_id text not null unique
);

insert into public.hero_accounts (email, hero_id)
values
  -- Grupo 2D
  ('natanael@levelup.mx', 'h_2d_2'),
  ('maia@levelup.mx', 'h_2d_3'),
  ('jesus@levelup.mx', 'h_2d_4'),
  ('alexa@levelup.mx', 'h_2d_5'),
  ('ernesto@levelup.mx', 'h_2d_6'),
  ('alexis@levelup.mx', 'h_2d_7'),
  ('josue@levelup.mx', 'h_2d_8'),
  ('santiago@levelup.mx', 'h_2d_9'),
  ('tadeo@levelup.mx', 'h_2d_10'),
  ('eric@levelup.mx', 'h_2d_11'),
  ('majo@levelup.mx', 'h_2d_12'),
  ('brandon@levelup.mx', 'h_2d_13'),
  ('arely@levelup.mx', 'h_2d_14'),
  -- Grupo 3D
  ('jannya@levelup.mx', 'h_3d_1'),
  ('anabrenda@levelup.mx', 'h_3d_2'),
  ('carlos@levelup.mx', 'h_3d_3'),
  ('josemiguel@levelup.mx', 'h_3d_4'),
  ('lizeth@levelup.mx', 'h_3d_5'),
  ('thaily@levelup.mx', 'h_3d_6'),
  ('ximena@levelup.mx', 'h_3d_7'),
  ('juan@levelup.mx', 'h_3d_8'),
  ('luis@levelup.mx', 'h_3d_9'),
  ('melinna@levelup.mx', 'h_3d_10'),
  ('zoe@levelup.mx', 'h_3d_11'),
  ('david@levelup.mx', 'h_3d_12'),
  ('leslye@levelup.mx', 'h_3d_13'),
  ('julissa@levelup.mx', 'h_3d_14')
on conflict (email) do update
set hero_id = excluded.hero_id;

-- Validación rápida
-- select count(*) as total_mapeos from public.hero_accounts;
