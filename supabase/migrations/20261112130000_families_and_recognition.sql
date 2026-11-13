-- =============================================================================
-- Panama Global Sports · Migración 6 · Familias y modo de reconocimiento
--
--   · Familias: una familia agrupa a uno o varios adultos y uno o varios hijos.
--     Reemplaza a player_guardians (los vínculos existentes se migran).
--   · categories.recognition_mode: U6/U8 sin ranking individual.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Modo de reconocimiento por categoría
-- ---------------------------------------------------------------------------
create type public.recognition_mode as enum ('team_stars', 'individual_ranking');

alter table public.categories
  add column recognition_mode public.recognition_mode not null default 'individual_ranking';

comment on column public.categories.recognition_mode is
  'team_stars: solo estrellas y reconocimientos de equipo, sin ranking individual (U6, U8). individual_ranking: tablas de líderes (U10+).';

update public.categories set recognition_mode = 'team_stars' where code in ('U6', 'U8');

-- ---------------------------------------------------------------------------
-- Familias
-- ---------------------------------------------------------------------------
create table public.families (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,                      -- "Familia Rodríguez" (solo visible para la familia y admin)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.family_members (
  family_id     uuid not null references public.families (id) on delete cascade,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  relationship  text check (relationship in ('madre', 'padre', 'tutor')),
  created_at    timestamptz not null default now(),
  primary key (family_id, user_id)
);
create index family_members_user_idx on public.family_members (user_id);

create table public.family_players (
  family_id   uuid not null references public.families (id) on delete cascade,
  player_id   uuid not null references public.players (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (family_id, player_id)
);
create index family_players_player_idx on public.family_players (player_id);

comment on table public.family_players is
  'Vínculo verificado por un admin entre una familia y sus hijos. Base del voto MVP (un voto por familia).';

create trigger families_updated_at before update on public.families
  for each row execute function public.set_updated_at();

-- Migrar vínculos existentes de player_guardians: una familia por adulto.
do $$
declare
  g record;
  v_family uuid;
begin
  for g in
    select distinct pg.user_id, coalesce(p.full_name, 'Familia') as name
    from public.player_guardians pg
    join public.profiles p on p.id = pg.user_id
  loop
    insert into public.families (name) values (g.name) returning id into v_family;
    insert into public.family_members (family_id, user_id, relationship)
      select v_family, g.user_id, min(relationship)
      from public.player_guardians where user_id = g.user_id;
    insert into public.family_players (family_id, player_id)
      select v_family, player_id from public.player_guardians where user_id = g.user_id;
  end loop;
end;
$$;

drop table public.player_guardians;

-- ---------------------------------------------------------------------------
-- Funciones auxiliares
-- ---------------------------------------------------------------------------
-- Ahora "tutor de" = miembro de una familia vinculada al jugador.
create or replace function public.is_guardian_of(p_player_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.family_players fp
    join public.family_members fm on fm.family_id = fp.family_id
    where fp.player_id = p_player_id and fm.user_id = (select auth.uid())
  );
$$;

create function public.is_family_member(p_family_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.family_members fm
    where fm.family_id = p_family_id and fm.user_id = (select auth.uid())
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS: cada familia ve lo suyo; solo el admin crea y vincula familias
-- ---------------------------------------------------------------------------
alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.family_players enable row level security;

create policy "Ver familia propia o admin" on public.families
  for select to authenticated
  using ((select public.is_family_member(id)) or (select public.is_admin()));

create policy "Admin gestiona familias" on public.families
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "Ver miembros de mi familia o admin" on public.family_members
  for select to authenticated
  using ((select public.is_family_member(family_id)) or (select public.is_admin()));

create policy "Admin gestiona miembros" on public.family_members
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "Ver hijos de mi familia o admin" on public.family_players
  for select to authenticated
  using ((select public.is_family_member(family_id)) or (select public.is_admin()));

create policy "Admin vincula hijos" on public.family_players
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

revoke all on public.families, public.family_members, public.family_players from anon;
