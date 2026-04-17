-- Migración urgente: hero_accounts -> students
-- Objetivo:
-- 1) Crear filas en public.students usando hero_accounts.hero_id como students.id.
-- 2) Vincular user_id contra auth.users por email.
-- 3) Conservar compatibilidad con frontend actual (heroId = students.id).
--
-- Ejecutar en Supabase SQL Editor.
-- Recomendado: correr primero en staging/copia de seguridad.

begin;

-- 0) Resolver los group_id destino para 2D y 3D.
--    Ajusta los criterios si tus grupos tienen otro nombre.
with resolved_groups as (
  select
    (
      select g.id
      from public.groups g
      where lower(coalesce(g.name, '')) in ('2d', 'grupo 2d', '2do', 'segundo d')
         or lower(coalesce(g.grade, '')) in ('2d', 'segundo d')
      order by g.name
      limit 1
    ) as group_2d,
    (
      select g.id
      from public.groups g
      where lower(coalesce(g.name, '')) in ('3d', 'grupo 3d', '3ro d', 'tercero d')
         or lower(coalesce(g.grade, '')) in ('3d', 'tercero d')
      order by g.name
      limit 1
    ) as group_3d
),
source_rows as (
  select
    ha.hero_id as student_id,
    lower(trim(ha.email)) as email,
    case
      when lower(ha.hero_id) like 'h_2d_%' then '2D'
      when lower(ha.hero_id) like 'h_3d_%' then '3D'
      else null
    end as inferred_group,
    initcap(split_part(lower(trim(ha.email)), '@', 1)) as inferred_name
  from public.hero_accounts ha
  where ha.hero_id is not null
),
prepared as (
  select
    s.student_id,
    case
      when s.inferred_group = '2D' then rg.group_2d
      when s.inferred_group = '3D' then rg.group_3d
      else null
    end as group_id,
    u.id as user_id,
    s.inferred_name as display_name,
    s.inferred_name as full_name,
    s.email
  from source_rows s
  cross join resolved_groups rg
  left join auth.users u on lower(u.email) = s.email
)
insert into public.students (
  id,
  group_id,
  user_id,
  display_name,
  full_name
)
select
  p.student_id,
  p.group_id,
  p.user_id,
  p.display_name,
  p.full_name
from prepared p
where p.group_id is not null
on conflict (id) do update
set
  group_id = excluded.group_id,
  user_id = coalesce(excluded.user_id, public.students.user_id),
  display_name = coalesce(nullif(excluded.display_name, ''), public.students.display_name),
  full_name = coalesce(nullif(excluded.full_name, ''), public.students.full_name);

-- 1) Reporte rápido de filas que no se pudieron migrar por falta de grupo.
--    (no corta la transacción, solo deja evidencia)
do $$
declare
  missing_groups int;
  missing_users int;
begin
  with source_rows as (
    select
      ha.hero_id as student_id,
      lower(trim(ha.email)) as email,
      case
        when lower(ha.hero_id) like 'h_2d_%' then '2D'
        when lower(ha.hero_id) like 'h_3d_%' then '3D'
        else null
      end as inferred_group
    from public.hero_accounts ha
    where ha.hero_id is not null
  ),
  resolved_groups as (
    select
      (
        select g.id
        from public.groups g
        where lower(coalesce(g.name, '')) in ('2d', 'grupo 2d', '2do', 'segundo d')
           or lower(coalesce(g.grade, '')) in ('2d', 'segundo d')
        order by g.name
        limit 1
      ) as group_2d,
      (
        select g.id
        from public.groups g
        where lower(coalesce(g.name, '')) in ('3d', 'grupo 3d', '3ro d', 'tercero d')
           or lower(coalesce(g.grade, '')) in ('3d', 'tercero d')
        order by g.name
        limit 1
      ) as group_3d
  )
  select count(*)
  into missing_groups
  from source_rows s
  cross join resolved_groups rg
  where (s.inferred_group = '2D' and rg.group_2d is null)
     or (s.inferred_group = '3D' and rg.group_3d is null)
     or s.inferred_group is null;

  select count(*)
  into missing_users
  from public.hero_accounts ha
  left join auth.users u on lower(u.email) = lower(trim(ha.email))
  where u.id is null;

  raise notice 'Migración students completada. hero_accounts sin grupo resuelto: %', missing_groups;
  raise notice 'hero_accounts sin usuario en auth.users: %', missing_users;
end $$;

commit;

-- Verificación manual recomendada:
-- select count(*) as hero_accounts_total from public.hero_accounts;
-- select count(*) as students_total from public.students;
-- select id, user_id, group_id from public.students order by id;
