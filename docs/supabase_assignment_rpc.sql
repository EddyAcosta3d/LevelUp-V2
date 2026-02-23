-- Ejecuta este script en Supabase SQL Editor.
-- Crea dos RPCs con SECURITY DEFINER para asignar/desasignar desafíos
-- sin depender de políticas RLS frágiles en operaciones de escritura.

-- Recomendado: mantener este UID sincronizado con el usuario admin real.
-- Puedes verlo en Authentication > Users > eddy@levelup.mx
-- o con: select id, email from auth.users where lower(email)='eddy@levelup.mx';

create table if not exists public.hero_assignments (
  hero_id text not null,
  challenge_id text not null,
  created_at timestamptz not null default now(),
  constraint hero_assignments_pkey primary key (hero_id, challenge_id)
);

create unique index if not exists hero_assignments_hero_id_challenge_id_idx
on public.hero_assignments (hero_id, challenge_id);

alter table public.hero_assignments enable row level security;

-- Mantén políticas de lectura si las usas en alumnos/profe.
-- Estas RPCs manejan escritura de forma segura para admin.

drop function if exists public.lu_assign_challenge(text, text);
create or replace function public.lu_assign_challenge(p_hero_id text, p_challenge_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Validar admin por email JWT.
  if lower(coalesce(auth.jwt() ->> 'email', '')) <> 'eddy@levelup.mx' then
    raise exception 'FORBIDDEN';
  end if;

  insert into public.hero_assignments(hero_id, challenge_id)
  values (p_hero_id, p_challenge_id)
  on conflict (hero_id, challenge_id) do nothing;
end;
$$;

drop function if exists public.lu_unassign_challenge(text, text);
create or replace function public.lu_unassign_challenge(p_hero_id text, p_challenge_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(coalesce(auth.jwt() ->> 'email', '')) <> 'eddy@levelup.mx' then
    raise exception 'FORBIDDEN';
  end if;

  delete from public.hero_assignments
  where hero_id = p_hero_id
    and challenge_id = p_challenge_id;
end;
$$;

revoke all on function public.lu_assign_challenge(text, text) from public;
revoke all on function public.lu_unassign_challenge(text, text) from public;
grant execute on function public.lu_assign_challenge(text, text) to authenticated;
grant execute on function public.lu_unassign_challenge(text, text) to authenticated;

-- Verificación rápida
-- select proname from pg_proc where proname in ('lu_assign_challenge','lu_unassign_challenge');
