-- =============================================================================
-- Panama Global Sports · 1/6 · Tablas
--
-- Mapa:
--   Competición   sports → leagues → categories · seasons · venues · teams
--   Personas      players (menores, privada) ← roster_entries · profiles (adultos)
--                 families → family_members (adultos) / family_players (hijos)
--   Partido       matches → match_officials · match_attendance · match_events
--                 match_mvps · mvp_votes · event_types (puntos ≥ 0)
--   Avisos        team_follows · notification_preferences · push_subscriptions · notification_log
--   Contenido     media_items → media_tags · match_chronicles
--
-- PRIVACIDAD: los jugadores son menores de edad. `players` solo guarda nombre,
-- inicial del apellido y foto (con consentimiento). NUNCA añadir fecha de
-- nacimiento, colegio, dirección, documento ni datos de contacto del niño.
--
-- Funciones, triggers y RLS: archivo 2. RPC: 3. Vistas: 4. Storage: 5.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('admin', 'delegate', 'parent');
comment on type public.app_role is
  'admin: gestiona todo · delegate: delegado o árbitro, carga sus partidos asignados · parent: padre, madre o tutor';

create type public.league_gender      as enum ('boys', 'girls', 'mixed');
create type public.recognition_mode   as enum ('team_stars', 'individual_ranking');
create type public.mvp_mode           as enum ('official', 'parent_vote');
create type public.match_status       as enum ('scheduled', 'live', 'finished', 'postponed', 'cancelled');
create type public.notification_kind  as enum ('match_reminder', 'final_result', 'album_packs');
create type public.media_kind         as enum ('photo', 'video');
create type public.media_status       as enum ('processing', 'pending_review', 'approved', 'rejected');
create type public.chronicle_status   as enum ('draft', 'published');

-- =============================================================================
-- Competición
-- =============================================================================
create table public.sports (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name        text not null,
  created_at  timestamptz not null default now()
);

create table public.leagues (
  id              uuid primary key default gen_random_uuid(),
  sport_id        uuid not null references public.sports (id) on delete restrict,
  slug            text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name            text not null,
  gender          public.league_gender not null,
  mvp_mode        public.mvp_mode not null default 'official',
  mvp_vote_hours  smallint not null default 24 check (mvp_vote_hours between 1 and 72),
  is_active       boolean not null default true,
  sort_order      smallint not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
comment on column public.leagues.mvp_mode is
  'official: el MVP lo elige el delegado/árbitro. parent_vote: votan las familias de ambos equipos (un voto por familia y partido).';

create table public.categories (
  id                uuid primary key default gen_random_uuid(),
  league_id         uuid not null references public.leagues (id) on delete restrict,
  code              text not null check (code ~ '^U[0-9]{1,2}$'),   -- U6, U8, … U17
  name              text not null,                                  -- "Sub-8"
  max_age           smallint not null check (max_age between 3 and 21),
  recognition_mode  public.recognition_mode not null default 'individual_ranking',
  sort_order        smallint not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (league_id, code)
);
comment on column public.categories.recognition_mode is
  'team_stars: solo estrellas y reconocimientos de equipo, sin ranking individual (U6, U8). individual_ranking: tablas de líderes (U10+).';

-- 5 temporadas por año, compartidas por todas las ligas
create table public.seasons (
  id          uuid primary key default gen_random_uuid(),
  year        smallint not null check (year between 2020 and 2100),
  number      smallint not null check (number between 1 and 5),
  name        text not null,                                  -- "Temporada 5 · 2026"
  starts_on   date not null,
  ends_on     date not null,
  is_current  boolean not null default false,
  closed_at   timestamptz,                                    -- al cerrar se habilitan los certificados
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (year, number),
  check (ends_on > starts_on)
);
create unique index seasons_single_current on public.seasons (is_current) where is_current;

create table public.venues (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  address     text,
  maps_url    text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Un equipo por categoría y temporada
create table public.teams (
  id               uuid primary key default gen_random_uuid(),
  season_id        uuid not null references public.seasons (id) on delete restrict,
  category_id      uuid not null references public.categories (id) on delete restrict,
  name             text not null,
  slug             text not null check (slug ~ '^[a-z0-9-]+$'),
  short_name       text check (char_length(short_name) between 2 and 4),
  primary_color    text not null default '#005293' check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  secondary_color  text not null default '#FFFFFF' check (secondary_color ~ '^#[0-9A-Fa-f]{6}$'),
  logo_path        text,                                      -- bucket "team-logos"
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (season_id, category_id, slug),
  unique (id, season_id),                  -- destino de FK compuestas
  unique (id, season_id, category_id)
);
create index teams_category_idx on public.teams (category_id);

-- =============================================================================
-- Personas
-- =============================================================================
create table public.players (
  id                        uuid primary key default gen_random_uuid(),
  first_name                text not null check (char_length(btrim(first_name)) between 1 and 40),
  last_initial              text not null check (last_initial ~ '^[A-ZÁÉÍÓÚÑÜ]$'),
  display_name              text generated always as (first_name || ' ' || last_initial || '.') stored,
  photo_path                text,                             -- bucket privado "player-photos"
  photo_consent             boolean not null default false,
  photo_consent_updated_at  timestamptz,
  photo_consent_updated_by  uuid references auth.users (id) on delete set null,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);
comment on table public.players is
  'Menores de edad. Solo nombre, inicial del apellido y foto con consentimiento. No añadir fecha de nacimiento, colegio, dirección ni contacto. El público lee la vista public_players, nunca esta tabla.';
comment on column public.players.photo_consent is
  'Consentimiento del padre/madre/tutor para mostrar la foto. Sin él, la foto nunca se expone y la galería bloquea su publicación.';
create index players_photo_path_idx on public.players (photo_path) where photo_path is not null;

-- Jugador × equipo × temporada (número y posición cambian por temporada)
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
  unique (team_id, jersey_number),
  unique (player_id, season_id)            -- un equipo por temporada
);
create index roster_entries_team_idx on public.roster_entries (team_id);
comment on table public.roster_entries is
  'Base de las figuritas del álbum y del fantasy (fases futuras).';

-- Cuentas de adultos (un menor nunca tiene cuenta propia)
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  role        public.app_role not null default 'parent',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Familia: uno o varios adultos + uno o varios hijos. Vínculo verificado por un admin.
create table public.families (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
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

-- =============================================================================
-- Partido
-- =============================================================================
create table public.matches (
  id            uuid primary key default gen_random_uuid(),
  season_id     uuid not null references public.seasons (id) on delete restrict,
  category_id   uuid not null references public.categories (id) on delete restrict,
  home_team_id  uuid not null,
  away_team_id  uuid not null,
  venue_id      uuid references public.venues (id) on delete set null,
  starts_at     timestamptz not null,                         -- fecha + hora (mostrar en America/Panama)
  matchday      smallint check (matchday > 0),
  status        public.match_status not null default 'scheduled',
  home_score    smallint check (home_score >= 0),             -- en vivo: se calcula desde los goles
  away_score    smallint check (away_score >= 0),
  started_at    timestamptz,
  finished_at   timestamptz,                                  -- abre la votación MVP y la ventana de corrección
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  foreign key (home_team_id, season_id, category_id) references public.teams (id, season_id, category_id),
  foreign key (away_team_id, season_id, category_id) references public.teams (id, season_id, category_id),
  check (home_team_id <> away_team_id),
  check ((home_score is null) = (away_score is null)),
  constraint matches_live_has_score   check (status not in ('live', 'finished') or home_score is not null),
  constraint matches_finished_has_time check (status <> 'finished' or finished_at is not null)
);
create index matches_season_category_idx on public.matches (season_id, category_id, starts_at);
create index matches_home_team_idx on public.matches (home_team_id);
create index matches_away_team_idx on public.matches (away_team_id);
create index matches_starts_at_idx on public.matches (starts_at);

-- Delegados/árbitros asignados (solo ellos cargan ese partido)
create table public.match_officials (
  match_id    uuid not null references public.matches (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  role        text not null default 'delegate' check (role in ('delegate', 'referee')),
  created_at  timestamptz not null default now(),
  primary key (match_id, user_id)
);
create index match_officials_user_idx on public.match_officials (user_id);

-- Presentes en el partido ("partidos jugados")
create table public.match_attendance (
  match_id    uuid not null references public.matches (id) on delete cascade,
  player_id   uuid not null references public.players (id) on delete cascade,
  team_id     uuid not null references public.teams (id) on delete restrict,
  created_at  timestamptz not null default now(),
  primary key (match_id, player_id)
);
create index match_attendance_player_idx on public.match_attendance (player_id);
create index match_attendance_team_idx on public.match_attendance (team_id);

create table public.event_types (
  id          smallint generated always as identity primary key,
  sport_id    uuid not null references public.sports (id) on delete restrict,
  code        text not null check (code ~ '^[a-z_]+$'),
  name        text not null,
  points      smallint not null default 0 check (points >= 0),   -- solo puntos positivos
  is_award    boolean not null default false,                    -- premio (MVP): no se carga como evento
  sort_order  smallint not null default 0,
  unique (sport_id, code)
);

-- Fuente única de estadísticas, puntos, fantasy y figuritas
create table public.match_events (
  id             uuid primary key default gen_random_uuid(),
  match_id       uuid not null references public.matches (id) on delete cascade,
  team_id        uuid not null references public.teams (id) on delete restrict,
  player_id      uuid not null references public.players (id) on delete cascade,
  event_type_id  smallint not null references public.event_types (id) on delete restrict,
  minute         smallint check (minute between 0 and 150),
  voided_at      timestamptz,             -- corrección: se anula, nunca se borra
  voided_by      uuid references public.profiles (id) on delete set null,
  created_by     uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index match_events_match_idx on public.match_events (match_id);
create index match_events_live_idx on public.match_events (match_id) where voided_at is null;
create index match_events_player_idx on public.match_events (player_id);
create index match_events_team_idx on public.match_events (team_id);
create index match_events_type_idx on public.match_events (event_type_id);
create index match_events_created_by_idx on public.match_events (created_by);
create index match_events_voided_by_idx on public.match_events (voided_by);

-- Un MVP por equipo y partido
create table public.match_mvps (
  match_id     uuid not null references public.matches (id) on delete cascade,
  team_id      uuid not null references public.teams (id) on delete restrict,
  player_id    uuid not null references public.players (id) on delete cascade,
  source       text not null check (source in ('official', 'parent_vote')),
  votes        int check (votes >= 0),
  decided_by   uuid references public.profiles (id) on delete set null,
  decided_at   timestamptz not null default now(),
  primary key (match_id, team_id)
);
create index match_mvps_player_idx on public.match_mvps (player_id);
create index match_mvps_team_idx on public.match_mvps (team_id);
create index match_mvps_decided_by_idx on public.match_mvps (decided_by);
comment on table public.match_mvps is
  'Fase álbum: cada fila desbloqueará una figurita especial (la tabla de figuritas referenciará (match_id, team_id)).';

-- Votos secretos de las familias
create table public.mvp_votes (
  id          uuid primary key default gen_random_uuid(),
  match_id    uuid not null references public.matches (id) on delete cascade,
  family_id   uuid not null references public.families (id) on delete cascade,
  team_id     uuid not null references public.teams (id) on delete restrict,
  player_id   uuid not null references public.players (id) on delete cascade,
  voter_id    uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (match_id, family_id)             -- un voto por familia y por partido
);
create index mvp_votes_tally_idx on public.mvp_votes (match_id, team_id, player_id);
create index mvp_votes_family_idx on public.mvp_votes (family_id);
create index mvp_votes_voter_idx on public.mvp_votes (voter_id);
create index mvp_votes_player_idx on public.mvp_votes (player_id);
create index mvp_votes_team_idx on public.mvp_votes (team_id);

-- =============================================================================
-- Avisos (Web Push; el envío es solo en servidor)
-- =============================================================================
create table public.team_follows (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  team_id     uuid not null references public.teams (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, team_id)
);
create index team_follows_team_idx on public.team_follows (team_id);

create table public.notification_preferences (
  user_id         uuid primary key references public.profiles (id) on delete cascade,
  match_reminder  boolean not null default true,    -- "Tu equipo juega mañana 9:00 en Cancha 2"
  final_result    boolean not null default true,    -- "Final: Tigres 3 – Leones 1"
  album_packs     boolean not null default true,    -- fase álbum: sobres nuevos
  updated_at      timestamptz not null default now()
);

create table public.push_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  endpoint      text not null unique,
  p256dh        text not null,
  auth          text not null,
  user_agent    text,
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- Registro de envíos para no duplicar (solo service role)
create table public.notification_log (
  id        bigint generated always as identity primary key,
  user_id   uuid not null references public.profiles (id) on delete cascade,
  kind      public.notification_kind not null,
  match_id  uuid references public.matches (id) on delete cascade,
  sent_at   timestamptz not null default now(),
  unique (user_id, kind, match_id)
);
create index notification_log_match_idx on public.notification_log (match_id);

-- =============================================================================
-- Contenido
-- =============================================================================
-- Galería: processing (servidor quita EXIF/comprime) → pending_review → approved/rejected (admin)
create table public.media_items (
  id                 uuid primary key default gen_random_uuid(),
  match_id           uuid not null references public.matches (id) on delete cascade,
  uploaded_by        uuid references public.profiles (id) on delete set null,
  kind               public.media_kind not null,
  status             public.media_status not null default 'processing',
  upload_path        text,              -- original en "media-uploads" (cuarentena)
  storage_path       text,              -- procesado en "match-media"
  thumbnail_path     text,
  mime_type          text,
  width              int check (width > 0),
  height             int check (height > 0),
  duration_seconds   numeric(5, 2) check (duration_seconds > 0),
  size_bytes         bigint check (size_bytes > 0),
  metadata_stripped  boolean not null default false,   -- EXIF/GPS eliminados por el servidor
  caption            text check (char_length(caption) <= 200),
  reviewed_by        uuid references public.profiles (id) on delete set null,
  reviewed_at        timestamptz,
  rejection_reason   text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  check (kind <> 'video' or duration_seconds is null or duration_seconds <= 30),
  check (status not in ('pending_review', 'approved')
         or (metadata_stripped and storage_path is not null
             and (kind = 'photo' or duration_seconds is not null)))
);
create index media_items_match_idx on public.media_items (match_id, status);
create index media_items_uploaded_by_idx on public.media_items (uploaded_by);
create index media_items_reviewed_by_idx on public.media_items (reviewed_by);
create index media_items_storage_path_idx on public.media_items (storage_path);
create index media_items_thumbnail_path_idx on public.media_items (thumbnail_path);

-- Jugadores que aparecen en cada foto/video
create table public.media_tags (
  media_id    uuid not null references public.media_items (id) on delete cascade,
  player_id   uuid not null references public.players (id) on delete cascade,
  redacted    boolean not null default false,   -- recortado o difuminado por un admin
  tagged_by   uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  primary key (media_id, player_id)
);
create index media_tags_player_idx on public.media_tags (player_id);
create index media_tags_tagged_by_idx on public.media_tags (tagged_by);

-- Crónica generada con la API de Claude: borrador hasta que un admin la publica
create table public.match_chronicles (
  match_id         uuid primary key references public.matches (id) on delete cascade,
  status           public.chronicle_status not null default 'draft',
  body             text not null check (char_length(body) between 1 and 2000),
  generated_body   text,                 -- texto original del modelo (auditoría)
  model            text,
  prompt_version   text,
  generated_at     timestamptz,
  edited_by        uuid references public.profiles (id) on delete set null,
  approved_by      uuid references public.profiles (id) on delete set null,
  published_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (status <> 'published' or (approved_by is not null and published_at is not null))
);
create index match_chronicles_edited_by_idx on public.match_chronicles (edited_by);
create index match_chronicles_approved_by_idx on public.match_chronicles (approved_by);
comment on table public.match_chronicles is
  '80–120 palabras, positiva, en español, solo nombre + inicial (U6/U8: solo equipo).';
