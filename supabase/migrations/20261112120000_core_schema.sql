-- =============================================================================
-- Panama Global Sports · Migración 1 · Esquema base
--
-- Jerarquía:  sport → league → category → (season) → team → roster_entry ← player
--             match (season, category, home_team, away_team) → match_event
--
-- PRIVACIDAD: los jugadores son menores de edad. La tabla `players` solo guarda
-- nombre, inicial del apellido y foto (con consentimiento). NUNCA añadir fecha
-- de nacimiento, colegio, dirección, documento ni datos de contacto del niño.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('admin', 'delegate', 'parent');
comment on type public.app_role is
  'admin: gestiona todo · delegate: delegado o árbitro, carga resultados de sus partidos · parent: padre, madre o tutor';

create type public.league_gender as enum ('boys', 'girls', 'mixed');

create type public.match_status as enum ('scheduled', 'live', 'finished', 'postponed', 'cancelled');

-- ---------------------------------------------------------------------------
-- Utilidad: mantener updated_at
-- ---------------------------------------------------------------------------
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Deportes, ligas y categorías
-- ---------------------------------------------------------------------------
create table public.sports (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name        text not null,
  created_at  timestamptz not null default now()
);

create table public.leagues (
  id          uuid primary key default gen_random_uuid(),
  sport_id    uuid not null references public.sports (id) on delete restrict,
  slug        text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name        text not null,
  gender      public.league_gender not null,
  is_active   boolean not null default true,
  sort_order  smallint not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  league_id   uuid not null references public.leagues (id) on delete restrict,
  code        text not null check (code ~ '^U[0-9]{1,2}$'),   -- U6, U8, … U17
  name        text not null,                                  -- "Sub-8"
  max_age     smallint not null check (max_age between 3 and 21),
  sort_order  smallint not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (league_id, code)
);

-- ---------------------------------------------------------------------------
-- Temporadas (5 por año, compartidas por todas las ligas)
-- ---------------------------------------------------------------------------
create table public.seasons (
  id          uuid primary key default gen_random_uuid(),
  year        smallint not null check (year between 2020 and 2100),
  number      smallint not null check (number between 1 and 5),
  name        text not null,                                  -- "Temporada 5 · 2026"
  starts_on   date not null,
  ends_on     date not null,
  is_current  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (year, number),
  check (ends_on > starts_on)
);
-- Como máximo una temporada marcada como actual.
create unique index seasons_single_current on public.seasons (is_current) where is_current;

-- ---------------------------------------------------------------------------
-- Canchas
-- ---------------------------------------------------------------------------
create table public.venues (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  address     text,
  maps_url    text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Equipos: uno por categoría y temporada
-- ---------------------------------------------------------------------------
create table public.teams (
  id               uuid primary key default gen_random_uuid(),
  season_id        uuid not null references public.seasons (id) on delete restrict,
  category_id      uuid not null references public.categories (id) on delete restrict,
  name             text not null,
  slug             text not null check (slug ~ '^[a-z0-9-]+$'),
  short_name       text check (char_length(short_name) between 2 and 4),
  primary_color    text not null default '#005293' check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  secondary_color  text not null default '#FFFFFF' check (secondary_color ~ '^#[0-9A-Fa-f]{6}$'),
  logo_path        text,                                      -- ruta en el bucket "team-logos"
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (season_id, category_id, slug),
  -- Destinos de claves foráneas compuestas (garantizan coherencia de temporada/categoría).
  unique (id, season_id),
  unique (id, season_id, category_id)
);
create index teams_category_idx on public.teams (category_id);

-- ---------------------------------------------------------------------------
-- Jugadores (MENORES DE EDAD — ver nota de privacidad arriba)
-- ---------------------------------------------------------------------------
create table public.players (
  id                        uuid primary key default gen_random_uuid(),
  first_name                text not null check (char_length(btrim(first_name)) between 1 and 40),
  last_initial              text not null check (last_initial ~ '^[A-ZÁÉÍÓÚÑÜ]$'),
  display_name              text generated always as (first_name || ' ' || last_initial || '.') stored,
  photo_path                text,                             -- ruta en el bucket privado "player-photos"
  photo_consent             boolean not null default false,
  photo_consent_updated_at  timestamptz,
  photo_consent_updated_by  uuid references auth.users (id) on delete set null,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);
comment on table public.players is
  'Menores de edad. Solo nombre, inicial del apellido y foto con consentimiento. No añadir fecha de nacimiento, colegio, dirección ni contacto. El público lee la vista public_players, nunca esta tabla.';
comment on column public.players.photo_consent is
  'Consentimiento del padre/madre/tutor para mostrar la foto. Sin él, la foto nunca se expone.';
create index players_photo_path_idx on public.players (photo_path) where photo_path is not null;

-- Número y posición dependen de la temporada → viven en la inscripción.
create table public.roster_entries (
  id             uuid primary key default gen_random_uuid(),
  team_id        uuid not null,
  season_id      uuid not null,
  player_id      uuid not null references public.players (id) on delete cascade,
  jersey_number  smallint not null check (jersey_number between 0 and 99),
  position       text check (char_length(position) <= 30),   -- Portero, Defensa, Mediocampista, Delantero
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  foreign key (team_id, season_id) references public.teams (id, season_id) on delete cascade,
  unique (team_id, jersey_number),          -- número único dentro del equipo
  unique (player_id, season_id)             -- un jugador, un equipo por temporada
);
create index roster_entries_team_idx on public.roster_entries (team_id);
comment on table public.roster_entries is
  'Jugador × equipo × temporada. Será la base de las figuritas del álbum y del fantasy.';

-- ---------------------------------------------------------------------------
-- Perfiles de usuario (adultos) y vínculo padre/madre ↔ jugador
-- ---------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  role        public.app_role not null default 'parent',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table public.profiles is 'Cuentas de adultos. Un menor nunca tiene cuenta propia.';

create table public.player_guardians (
  player_id     uuid not null references public.players (id) on delete cascade,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  relationship  text check (relationship in ('madre', 'padre', 'tutor')),
  created_at    timestamptz not null default now(),
  primary key (player_id, user_id)
);
create index player_guardians_user_idx on public.player_guardians (user_id);

-- ---------------------------------------------------------------------------
-- Partidos
-- ---------------------------------------------------------------------------
create table public.matches (
  id            uuid primary key default gen_random_uuid(),
  season_id     uuid not null references public.seasons (id) on delete restrict,
  category_id   uuid not null references public.categories (id) on delete restrict,
  home_team_id  uuid not null,
  away_team_id  uuid not null,
  venue_id      uuid references public.venues (id) on delete set null,
  starts_at     timestamptz not null,                         -- fecha + hora (mostrar en America/Panama)
  matchday      smallint check (matchday > 0),                -- jornada
  status        public.match_status not null default 'scheduled',
  home_score    smallint check (home_score >= 0),
  away_score    smallint check (away_score >= 0),
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- Ambos equipos deben pertenecer a la misma temporada y categoría del partido.
  foreign key (home_team_id, season_id, category_id) references public.teams (id, season_id, category_id),
  foreign key (away_team_id, season_id, category_id) references public.teams (id, season_id, category_id),
  check (home_team_id <> away_team_id),
  check ((home_score is null) = (away_score is null)),
  check (status <> 'finished' or home_score is not null)
);
create index matches_season_category_idx on public.matches (season_id, category_id, starts_at);
create index matches_home_team_idx on public.matches (home_team_id);
create index matches_away_team_idx on public.matches (away_team_id);
create index matches_starts_at_idx on public.matches (starts_at);

-- Delegados/árbitros asignados a cada partido (solo ellos cargan sus resultados).
create table public.match_officials (
  match_id    uuid not null references public.matches (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  role        text not null default 'delegate' check (role in ('delegate', 'referee')),
  created_at  timestamptz not null default now(),
  primary key (match_id, user_id)
);
create index match_officials_user_idx on public.match_officials (user_id);

-- ---------------------------------------------------------------------------
-- Eventos de partido y su puntuación
-- ---------------------------------------------------------------------------
create table public.event_types (
  id          smallint generated always as identity primary key,
  sport_id    uuid not null references public.sports (id) on delete restrict,
  code        text not null check (code ~ '^[a-z_]+$'),
  name        text not null,
  points      smallint not null default 0 check (points >= 0),   -- solo puntos positivos
  sort_order  smallint not null default 0,
  unique (sport_id, code)
);
comment on column public.event_types.points is
  'Puntos que suma el jugador por cada evento. Nunca negativos (las tarjetas suman 0).';

create table public.match_events (
  id             uuid primary key default gen_random_uuid(),
  match_id       uuid not null references public.matches (id) on delete cascade,
  team_id        uuid not null references public.teams (id) on delete restrict,
  player_id      uuid not null references public.players (id) on delete cascade,
  event_type_id  smallint not null references public.event_types (id) on delete restrict,
  minute         smallint check (minute between 0 and 150),
  created_by     uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index match_events_match_idx on public.match_events (match_id);
create index match_events_player_idx on public.match_events (player_id);
create index match_events_team_idx on public.match_events (team_id);
create index match_events_type_idx on public.match_events (event_type_id);
create index match_events_created_by_idx on public.match_events (created_by);
comment on table public.match_events is
  'Fuente única de estadísticas. Alimentará los puntos del fantasy y las figuritas.';

-- El jugador debe estar inscrito en un equipo que juega ese partido.
create function public.validate_match_event()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_home uuid;
  v_away uuid;
begin
  select home_team_id, away_team_id into v_home, v_away
  from public.matches where id = new.match_id;

  if new.team_id not in (v_home, v_away) then
    raise exception 'El equipo % no juega el partido %', new.team_id, new.match_id;
  end if;

  if not exists (
    select 1 from public.roster_entries r
    where r.player_id = new.player_id and r.team_id = new.team_id
  ) then
    raise exception 'El jugador % no está inscrito en el equipo %', new.player_id, new.team_id;
  end if;

  return new;
end;
$$;

create trigger match_events_validate
  before insert or update on public.match_events
  for each row execute function public.validate_match_event();

-- Registrar quién y cuándo cambió el consentimiento de foto.
create function public.stamp_photo_consent()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.photo_consent is distinct from old.photo_consent then
    new.photo_consent_updated_at := now();
    new.photo_consent_updated_by := auth.uid();
  end if;
  return new;
end;
$$;

create trigger players_stamp_photo_consent
  before insert or update of photo_consent on public.players
  for each row execute function public.stamp_photo_consent();

-- updated_at en todas las tablas que lo tienen
create trigger leagues_updated_at        before update on public.leagues        for each row execute function public.set_updated_at();
create trigger categories_updated_at     before update on public.categories     for each row execute function public.set_updated_at();
create trigger seasons_updated_at        before update on public.seasons        for each row execute function public.set_updated_at();
create trigger venues_updated_at         before update on public.venues         for each row execute function public.set_updated_at();
create trigger teams_updated_at          before update on public.teams          for each row execute function public.set_updated_at();
create trigger players_updated_at        before update on public.players        for each row execute function public.set_updated_at();
create trigger roster_entries_updated_at before update on public.roster_entries for each row execute function public.set_updated_at();
create trigger profiles_updated_at       before update on public.profiles       for each row execute function public.set_updated_at();
create trigger matches_updated_at        before update on public.matches        for each row execute function public.set_updated_at();
create trigger match_events_updated_at   before update on public.match_events   for each row execute function public.set_updated_at();
