-- LevelUp V2: esquema escalable de roles + RLS
-- Ejecutar en Supabase SQL Editor como owner (postgres/service role).

create extension if not exists pgcrypto;

-- ============================================================
-- 1) Tipos y tablas base
-- ============================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('admin', 'teacher', 'student', 'guest');
  end if;

  if not exists (select 1 from pg_type where typname = 'challenge_difficulty') then
    create type public.challenge_difficulty as enum ('fácil', 'medio', 'difícil');
  end if;
end $$;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.teachers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(user_id) on delete cascade,
  full_name text not null,
  email text not null unique
);

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  name text not null,
  grade text,
  school_year text
);

-- Nota: students.id se define como text para permitir IDs legibles/compatibles
-- (ej. h_2d_2) sin cambiar lógica de frontend.
create table if not exists public.students (
  id text primary key,
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid unique references auth.users(id) on delete set null,
  display_name text not null,
  full_name text not null,
  age int,
  role_name text,
  avatar_url text
);

create table if not exists public.student_stats (
  id uuid primary key default gen_random_uuid(),
  student_id text not null unique references public.students(id) on delete cascade,
  int int not null default 0 check (int between 0 and 20),
  sab int not null default 0 check (sab between 0 and 20),
  car int not null default 0 check (car between 0 and 20),
  res int not null default 0 check (res between 0 and 20),
  cre int not null default 0 check (cre between 0 and 20)
);

create table if not exists public.student_progress (
  id uuid primary key default gen_random_uuid(),
  student_id text not null unique references public.students(id) on delete cascade,
  level int not null default 1,
  xp_total int not null default 0,
  xp_weekly int not null default 0,
  medals int not null default 0
);

create table if not exists public.shop_items (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid null references public.teachers(id) on delete cascade,
  name text not null,
  cost_medals int not null default 0,
  description text,
  active boolean not null default true
);

create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  group_id uuid null references public.groups(id) on delete set null,
  subject text,
  title text not null,
  difficulty public.challenge_difficulty not null default 'medio',
  xp_reward int not null default 0,
  instructions text
);

create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_teachers_user_id on public.teachers(user_id);
create index if not exists idx_groups_teacher_id on public.groups(teacher_id);
create index if not exists idx_students_group_id on public.students(group_id);
create index if not exists idx_students_user_id on public.students(user_id);
create index if not exists idx_stats_student_id on public.student_stats(student_id);
create index if not exists idx_progress_student_id on public.student_progress(student_id);
create index if not exists idx_shop_teacher_id on public.shop_items(teacher_id);
create index if not exists idx_challenges_teacher_id on public.challenges(teacher_id);
create index if not exists idx_challenges_group_id on public.challenges(group_id);

-- ============================================================
-- 2) Funciones helper de autorización
-- ============================================================

create or replace function public.my_role()
returns public.app_role
language sql
stable
as $$
  select p.role
  from public.profiles p
  where p.user_id = auth.uid()
  limit 1
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce(public.my_role() = 'admin', false)
$$;

create or replace function public.is_teacher()
returns boolean
language sql
stable
as $$
  select coalesce(public.my_role() = 'teacher', false)
$$;

create or replace function public.is_student()
returns boolean
language sql
stable
as $$
  select coalesce(public.my_role() = 'student', false)
$$;

create or replace function public.is_guest()
returns boolean
language sql
stable
as $$
  select coalesce(public.my_role() = 'guest', false)
$$;

create or replace function public.current_teacher_id()
returns uuid
language sql
stable
as $$
  select t.id
  from public.teachers t
  where t.user_id = auth.uid()
  limit 1
$$;

create or replace function public.teacher_owns_group(p_group_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.groups g
    where g.id = p_group_id
      and g.teacher_id = public.current_teacher_id()
  )
$$;

create or replace function public.teacher_owns_student(p_student_id text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.students s
    join public.groups g on g.id = s.group_id
    where s.id = p_student_id
      and g.teacher_id = public.current_teacher_id()
  )
$$;

create or replace function public.is_self_student(p_student_id text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.students s
    where s.id = p_student_id
      and s.user_id = auth.uid()
  )
$$;

-- ============================================================
-- 3) RLS
-- ============================================================

alter table public.profiles enable row level security;
alter table public.teachers enable row level security;
alter table public.groups enable row level security;
alter table public.students enable row level security;
alter table public.student_stats enable row level security;
alter table public.student_progress enable row level security;
alter table public.shop_items enable row level security;
alter table public.challenges enable row level security;

-- Limpieza idempotente de policies

do $$
declare
  rec record;
begin
  for rec in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname='public'
      and tablename in ('profiles','teachers','groups','students','student_stats','student_progress','shop_items','challenges')
  loop
    execute format('drop policy if exists %I on %I.%I', rec.policyname, rec.schemaname, rec.tablename);
  end loop;
end $$;

-- Admin full access en todas
create policy profiles_admin_all on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());
create policy teachers_admin_all on public.teachers
  for all using (public.is_admin()) with check (public.is_admin());
create policy groups_admin_all on public.groups
  for all using (public.is_admin()) with check (public.is_admin());
create policy students_admin_all on public.students
  for all using (public.is_admin()) with check (public.is_admin());
create policy stats_admin_all on public.student_stats
  for all using (public.is_admin()) with check (public.is_admin());
create policy progress_admin_all on public.student_progress
  for all using (public.is_admin()) with check (public.is_admin());
create policy shop_admin_all on public.shop_items
  for all using (public.is_admin()) with check (public.is_admin());
create policy challenges_admin_all on public.challenges
  for all using (public.is_admin()) with check (public.is_admin());

-- Profiles: cada usuario ve su perfil
create policy profiles_self_select on public.profiles
  for select using (user_id = auth.uid());

-- Teachers: su propia fila
create policy teachers_self_all on public.teachers
  for all
  using (public.is_teacher() and user_id = auth.uid())
  with check (public.is_teacher() and user_id = auth.uid());

-- Groups: teacher solo sus grupos
create policy groups_teacher_all on public.groups
  for all
  using (public.is_teacher() and teacher_id = public.current_teacher_id())
  with check (public.is_teacher() and teacher_id = public.current_teacher_id());

-- Students: teacher solo sus alumnos / student solo su fila
create policy students_teacher_all on public.students
  for all
  using (public.is_teacher() and public.teacher_owns_group(group_id))
  with check (public.is_teacher() and public.teacher_owns_group(group_id));

create policy students_student_select_self on public.students
  for select
  using (public.is_student() and user_id = auth.uid());

-- Stats/progress: teacher por pertenencia de alumno; student solo su fila
create policy stats_teacher_all on public.student_stats
  for all
  using (public.is_teacher() and public.teacher_owns_student(student_id))
  with check (public.is_teacher() and public.teacher_owns_student(student_id));

create policy progress_teacher_all on public.student_progress
  for all
  using (public.is_teacher() and public.teacher_owns_student(student_id))
  with check (public.is_teacher() and public.teacher_owns_student(student_id));

create policy stats_student_select_self on public.student_stats
  for select
  using (public.is_student() and public.is_self_student(student_id));

create policy progress_student_select_self on public.student_progress
  for select
  using (public.is_student() and public.is_self_student(student_id));

-- Guest: solo lectura de stats/progress (sin PII)
-- Si usas guest autenticado (profiles.role='guest') funcionará por is_guest().
-- También se permite anon para modo invitado sin login.
-- Shop: teacher maneja solo su tienda (teacher_id propio);
-- items globales (teacher_id null) solo admin.
create policy shop_teacher_all on public.shop_items
  for all
  using (public.is_teacher() and teacher_id = public.current_teacher_id())
  with check (public.is_teacher() and teacher_id = public.current_teacher_id());

-- Challenges: teacher por teacher_id propio o por grupos propios
create policy challenges_teacher_all on public.challenges
  for all
  using (
    public.is_teacher()
    and (
      teacher_id = public.current_teacher_id()
      or (group_id is not null and public.teacher_owns_group(group_id))
    )
  )
  with check (
    public.is_teacher()
    and (
      teacher_id = public.current_teacher_id()
      or (group_id is not null and public.teacher_owns_group(group_id))
    )
  );

-- Mantén USAGE de anon en schema public sin tocar (compatibilidad Auth).
-- Restringimos acceso real por RLS + REVOKE por tabla.
grant usage on schema public to authenticated;

grant select, insert, update, delete on
  public.profiles,
  public.teachers,
  public.groups,
  public.students,
  public.student_stats,
  public.student_progress,
  public.shop_items,
  public.challenges
to authenticated;

revoke all on public.student_stats from anon;
revoke all on public.student_progress from anon;
revoke all on public.students from anon;

-- ============================================================
-- 4) Inserts de prueba (comentados)
-- ============================================================

/*
-- 0) Asegúrate de tener usuarios en auth.users (admin, teacher y student)
-- select id, email from auth.users;

-- 1) Profiles (admin + teacher + student ejemplo)
insert into public.profiles (user_id, role, display_name)
values
  ('00000000-0000-0000-0000-0000000000a1', 'admin',   'Admin LevelUp'),
  ('00000000-0000-0000-0000-0000000000b1', 'teacher', 'Profe Ana'),
  ('00000000-0000-0000-0000-0000000000c1', 'student', 'Luis');

-- 2) Teacher
insert into public.teachers (id, user_id, full_name, email)
values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b1', 'Ana Martínez', 'ana.teacher@levelup.mx');

-- 3) Group
insert into public.groups (id, teacher_id, name, grade, school_year)
values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '3°A', '3°', '2025-2026');

-- 4) Students (3 ejemplos)
insert into public.students (id, group_id, user_id, display_name, full_name, age, role_name, avatar_url)
values
  ('h_3a_1', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c1', 'Luis', 'Luis Pérez Gómez', 9, 'Estratega', null),
  ('h_3a_2', '20000000-0000-0000-0000-000000000001', null, 'María', 'María López Ramírez', 8, 'Comunicadora', null),
  ('h_3a_3', '20000000-0000-0000-0000-000000000001', null, 'Diego', 'Diego Hernández Ruiz', 9, 'Creador', null);

-- 5) Stats
insert into public.student_stats (student_id, int, sab, car, res, cre)
values
  ('h_3a_1', 10, 8, 7, 6, 9),
  ('h_3a_2', 9, 10, 8, 5, 8),
  ('h_3a_3', 7, 8, 9, 10, 6);

-- 6) Progress
insert into public.student_progress (student_id, level, xp_total, xp_weekly, medals)
values
  ('h_3a_1', 2, 140, 40, 3),
  ('h_3a_2', 1, 90, 30, 1),
  ('h_3a_3', 3, 220, 20, 5);
*/
