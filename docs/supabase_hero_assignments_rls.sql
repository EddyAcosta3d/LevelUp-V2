-- Ejecuta esto en Supabase SQL Editor para permitir que el admin autenticado
-- pueda leer/escribir asignaciones de desafíos.
-- Ajusta el correo si cambia.

alter table public.hero_assignments enable row level security;

-- Limpieza opcional de políticas antiguas con nombres comunes
-- (si no existen, ignora los errores)
drop policy if exists "hero_assignments_select_admin" on public.hero_assignments;
drop policy if exists "hero_assignments_insert_admin" on public.hero_assignments;
drop policy if exists "hero_assignments_delete_admin" on public.hero_assignments;

create policy "hero_assignments_select_admin"
on public.hero_assignments
for select
using (
  auth.jwt() ->> 'email' = 'eddy@levelup.mx'
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

-- (Opcional) evita duplicados por diseño
create unique index if not exists hero_assignments_hero_id_challenge_id_idx
on public.hero_assignments (hero_id, challenge_id);
