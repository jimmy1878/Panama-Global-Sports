-- =============================================================================
-- Panama Global Sports · 8 · Modelo de torneos
--
-- Reemplaza "temporada" (una sola, global, compartida por las dos ligas) por la
-- cadena real de la liga:
--
--   organización → liga → circuito → torneo → categoría
--
--   · circuito       Academias | Escolares
--   · tipo de torneo Apertura | Clausura | Copa de Navidad
--                    (Copa de Navidad SOLO para Academias: lo impone la BD)
--   · torneo         liga × circuito × tipo × año, con sus propias fechas y estado
--   · jornada        agrupa partidos (y, más adelante, galerías)
--
-- TEMPORADA = EL AÑO VIGENTE (decisión del dueño, 2026-11-14). No hay tabla de
-- temporadas: el año vive en `tournaments.year` y se consulta con
-- `public.current_season()`. Es la unidad que usarán las exclusividades de
-- patrocinio.
--
-- Dos torneos de la misma liga PUEDEN estar en curso a la vez (Academias y
-- Escolares): a propósito no hay índice único sobre el estado.
--
-- Esta migración traslada los datos existentes: cada temporada se convierte en
-- un torneo por liga, para no perder equipos, partidos ni eventos.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------
create type public.tournament_status as enum ('proximo', 'inscripciones', 'en_curso', 'finalizado');
comment on type public.tournament_status is
  'proximo: anunciado · inscripciones: abiertas · en_curso: se juega (puede haber varios) · finalizado: pasa al historial';

-- ---------------------------------------------------------------------------
-- Organización, circuitos y tipos de torneo
-- ---------------------------------------------------------------------------
create table public.organizations (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name           text not null,
  logo_path      text,
  primary_color  text not null default '#1B1464' check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  accent_color   text not null default '#FFFF00' check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
comment on table public.organizations is 'Marca madre. Una sola fila: Panama Global Sports.';

create table public.circuits (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9-]+$'),   -- academias | escolares
  name        text not null,
  logo_label  text,                                                 -- "Academy Edition" / "School Edition"
  sort_order  smallint not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table public.circuits is
  'Cada liga se juega en dos circuitos. No tienen logo propio: una etiqueta bajo el logo de la liga.';

create table public.tournament_types (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9-]+$'),   -- apertura | clausura | copa-navidad
  name        text not null,
  sort_order  smallint not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Qué tipo de torneo puede jugarse en qué circuito. La Copa de Navidad solo
-- existe en Academias: esta tabla es el destino de una FK compuesta en
-- `tournaments`, así que la combinación prohibida es imposible de guardar.
create table public.tournament_type_circuits (
  tournament_type_id  uuid not null references public.tournament_types (id) on delete cascade,
  circuit_id          uuid not null references public.circuits (id) on delete cascade,
  primary key (tournament_type_id, circuit_id)
);

-- ---------------------------------------------------------------------------
-- Liga: pertenece a la organización y tiene sus colores
-- ---------------------------------------------------------------------------
alter table public.leagues
  add column organization_id uuid references public.organizations (id) on delete restrict,
  add column primary_color   text not null default '#29ABE2' check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  add column text_color      text not null default '#1B1464' check (text_color ~ '^#[0-9A-Fa-f]{6}$'),
  add column logo_path       text;

-- Destino de las FK compuestas que atan categoría y torneo a la misma liga
alter table public.categories add constraint categories_id_league_key unique (id, league_id);

-- ---------------------------------------------------------------------------
-- Torneos
-- ---------------------------------------------------------------------------
create table public.tournaments (
  id                     uuid primary key default gen_random_uuid(),
  league_id              uuid not null references public.leagues (id) on delete restrict,
  circuit_id             uuid not null references public.circuits (id) on delete restrict,
  tournament_type_id     uuid not null references public.tournament_types (id) on delete restrict,
  year                   smallint not null check (year between 2020 and 2100),
  slug                   text not null check (slug ~ '^[a-z0-9-]+$'),   -- "academias-clausura-2026"
  name                   text not null,                                 -- "Academias · Clausura 2026"
  starts_on              date not null,
  ends_on                date not null,
  status                 public.tournament_status not null default 'proximo',
  registration_opens_on  date,                                          -- banner del próximo torneo
  registration_closes_on date,
  finished_at            timestamptz,                                   -- al finalizar pasa al historial
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (league_id, circuit_id, tournament_type_id, year),
  unique (league_id, slug),
  unique (id, league_id),                  -- destino de FK compuestas
  constraint tournaments_type_allows_circuit
    foreign key (tournament_type_id, circuit_id)
    references public.tournament_type_circuits (tournament_type_id, circuit_id),
  check (ends_on > starts_on)
);
create index tournaments_status_idx on public.tournaments (status, year desc);
create index tournaments_league_idx on public.tournaments (league_id, year desc);
comment on column public.tournaments.year is
  'La temporada es el año vigente. Sobre este campo se calculan las exclusividades anuales.';
comment on table public.tournaments is
  'Varios torneos de la misma liga pueden estar en curso a la vez (Academias y Escolares): no hay índice único sobre el estado, a propósito.';

-- Qué categorías juega cada torneo. La FK compuesta obliga a que la categoría
-- sea de la misma liga que el torneo.
create table public.tournament_categories (
  id             uuid primary key default gen_random_uuid(),
  tournament_id  uuid not null,
  category_id    uuid not null,
  league_id      uuid not null,
  format         text check (char_length(format) <= 40),
  slots          smallint check (slots > 0),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (tournament_id, category_id),
  foreign key (tournament_id, league_id) references public.tournaments (id, league_id) on delete cascade,
  foreign key (category_id, league_id)   references public.categories  (id, league_id) on delete restrict
);
create index tournament_categories_category_idx on public.tournament_categories (category_id);

-- Jornada: agrupa partidos y, en la fase de galería, las fotos del día
create table public.matchdays (
  id             uuid primary key default gen_random_uuid(),
  tournament_id  uuid not null references public.tournaments (id) on delete cascade,
  number         smallint not null check (number > 0),
  played_on      date,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (tournament_id, number),
  unique (id, tournament_id)               -- destino de FK compuesta
);

-- ---------------------------------------------------------------------------
-- Datos de referencia
-- ---------------------------------------------------------------------------
insert into public.organizations (slug, name) values ('panama-global-sports', 'Panama Global Sports');

insert into public.circuits (slug, name, logo_label, sort_order) values
  ('academias', 'Academias', 'Academy Edition', 1),
  ('escolares', 'Escolares', 'School Edition',  2);

insert into public.tournament_types (slug, name, sort_order) values
  ('apertura',     'Apertura',        1),
  ('clausura',     'Clausura',        2),
  ('copa-navidad', 'Copa de Navidad', 3);

-- Apertura y Clausura en los dos circuitos; Copa de Navidad solo en Academias
insert into public.tournament_type_circuits (tournament_type_id, circuit_id)
select tt.id, c.id
from public.tournament_types tt
join public.circuits c on (tt.slug in ('apertura', 'clausura') or c.slug = 'academias');

update public.leagues
set organization_id = (select id from public.organizations where slug = 'panama-global-sports');
alter table public.leagues alter column organization_id set not null;

-- Slugs cortos para las rutas que pide la especificación (/ligas/boys/…),
-- nombre y colores de marca de cada liga.
update public.leagues
set slug = 'boys', name = 'Boys Champions League', primary_color = '#29ABE2', text_color = '#1B1464'
where slug = 'boys-champion-league';

update public.leagues
set slug = 'girls', name = 'Girls Champions League', primary_color = '#ED1E79', text_color = '#FFFFFF'
where slug = 'girls-champion-league';

-- ---------------------------------------------------------------------------
-- Vistas: se eliminan para poder cambiar las columnas; se recrean más abajo
-- ---------------------------------------------------------------------------
drop view if exists public.my_family_season_certificates;
drop view if exists public.my_family_player_stars;
drop view if exists public.season_leaders;
drop view if exists public.player_season_stats;
drop view if exists public.team_season_recognitions;
drop view if exists public.scoring_events;
drop view if exists public.standings;

-- ---------------------------------------------------------------------------
-- Traslado de datos: cada temporada pasa a ser un torneo por liga
-- ---------------------------------------------------------------------------
-- Las 5 temporadas de un año son, en la estructura real, los 5 torneos del año:
-- Escolares Apertura y Clausura, Academias Apertura y Clausura, y la Copa de
-- Navidad (que solo existe en Academias). Así nada se pierde y cada torneo cae
-- en una combinación válida.
-- El mapa va escrito en cada consulta (no en una tabla temporal) para que esto
-- también se pueda pegar tal cual en el SQL Editor de Supabase, donde las
-- tablas temporales no sobreviven de una sentencia a la siguiente.
insert into public.tournaments (
  league_id, circuit_id, tournament_type_id, year, slug, name, starts_on, ends_on, status, finished_at
)
select
  l.id, c.id, tt.id, s.year,
  c.slug || '-' || tt.slug || '-' || s.year,
  c.name || ' · ' || tt.name || ' ' || s.year,
  s.starts_on,
  s.ends_on,
  case when s.is_current then 'en_curso' else 'finalizado' end::public.tournament_status,
  case when not s.is_current then s.ends_on::timestamptz end
from public.seasons s
join (values
  (1, 'escolares', 'apertura'),
  (2, 'escolares', 'clausura'),
  (3, 'academias', 'apertura'),
  (4, 'academias', 'clausura'),
  (5, 'academias', 'copa-navidad')
) as m (number, circuit, kind)    on m.number = s.number
join public.circuits c            on c.slug = m.circuit
join public.tournament_types tt   on tt.slug = m.kind
cross join public.leagues l;

-- Equipos
alter table public.teams add column tournament_id uuid references public.tournaments (id) on delete restrict;

with mapa as (
  select s.id as season_id, tr.league_id, tr.id as tournament_id
  from public.seasons s
  join (values
    (1, 'escolares', 'apertura'),
    (2, 'escolares', 'clausura'),
    (3, 'academias', 'apertura'),
    (4, 'academias', 'clausura'),
    (5, 'academias', 'copa-navidad')
  ) as m (number, circuit, kind)  on m.number = s.number
  join public.circuits c          on c.slug = m.circuit
  join public.tournament_types tt on tt.slug = m.kind
  join public.tournaments tr      on tr.year = s.year
                                 and tr.circuit_id = c.id
                                 and tr.tournament_type_id = tt.id
)
update public.teams t
set tournament_id = mapa.tournament_id
from public.categories cat, mapa
where cat.id = t.category_id
  and mapa.season_id = t.season_id
  and mapa.league_id = cat.league_id;

delete from public.teams where tournament_id is null;
alter table public.teams alter column tournament_id set not null;

-- Qué categorías juega cada torneo (a partir de los equipos que ya existían)
insert into public.tournament_categories (tournament_id, category_id, league_id)
select distinct t.tournament_id, t.category_id, c.league_id
from public.teams t
join public.categories c on c.id = t.category_id;

-- Claves compuestas de equipos: (id, torneo) y (id, torneo, categoría)
alter table public.roster_entries drop constraint roster_entries_team_id_season_id_fkey;
alter table public.matches        drop constraint matches_home_team_id_season_id_category_id_fkey;
alter table public.matches        drop constraint matches_away_team_id_season_id_category_id_fkey;

alter table public.teams drop constraint teams_id_season_id_key;
alter table public.teams drop constraint teams_id_season_id_category_id_key;
alter table public.teams drop constraint teams_season_id_category_id_slug_key;
alter table public.teams drop column season_id;

alter table public.teams
  add constraint teams_id_tournament_key unique (id, tournament_id),
  add constraint teams_id_tournament_category_key unique (id, tournament_id, category_id),
  add constraint teams_tournament_category_slug_key unique (tournament_id, category_id, slug),
  add column club_name text check (char_length(club_name) <= 80);
comment on column public.teams.club_name is 'Academia o colegio al que representa el equipo.';

-- Inscripciones de jugadores: un equipo por TORNEO (no por año). Un niño puede
-- jugar a la vez en su academia y en su colegio, que son torneos distintos.
alter table public.roster_entries add column tournament_id uuid;
update public.roster_entries r set tournament_id = t.tournament_id from public.teams t where t.id = r.team_id;
delete from public.roster_entries where tournament_id is null;
alter table public.roster_entries alter column tournament_id set not null;

alter table public.roster_entries drop constraint roster_entries_player_id_season_id_key;
alter table public.roster_entries drop column season_id;
alter table public.roster_entries
  add constraint roster_entries_team_tournament_fkey
    foreign key (team_id, tournament_id) references public.teams (id, tournament_id) on delete cascade,
  add constraint roster_entries_player_tournament_key unique (player_id, tournament_id);
comment on constraint roster_entries_player_tournament_key on public.roster_entries is
  'Un equipo por torneo. A propósito NO es por año: academia y colegio son torneos distintos y pueden coincidir.';

-- Partidos
alter table public.matches add column tournament_id uuid references public.tournaments (id) on delete restrict;
update public.matches m set tournament_id = t.tournament_id from public.teams t where t.id = m.home_team_id;
delete from public.matches where tournament_id is null;
alter table public.matches alter column tournament_id set not null;

-- Jornadas a partir del número que ya traían los partidos
insert into public.matchdays (tournament_id, number, played_on)
select m.tournament_id, m.matchday, min((m.starts_at at time zone 'America/Panama')::date)
from public.matches m
where m.matchday is not null
group by m.tournament_id, m.matchday;

alter table public.matches add column matchday_id uuid;
update public.matches m
set matchday_id = j.id
from public.matchdays j
where j.tournament_id = m.tournament_id and j.number = m.matchday;

alter table public.matches drop column matchday;
alter table public.matches drop column season_id;

alter table public.matches
  add constraint matches_matchday_fkey
    foreign key (matchday_id, tournament_id) references public.matchdays (id, tournament_id) on delete set null,
  add constraint matches_home_team_fkey
    foreign key (home_team_id, tournament_id, category_id) references public.teams (id, tournament_id, category_id),
  add constraint matches_away_team_fkey
    foreign key (away_team_id, tournament_id, category_id) references public.teams (id, tournament_id, category_id);

drop index if exists public.matches_season_category_idx;
create index matches_tournament_category_idx on public.matches (tournament_id, category_id, starts_at);
create index matches_matchday_idx on public.matches (matchday_id);

-- Fuera la temporada
drop function if exists public.admin_set_current_season(uuid);
drop table public.seasons;

-- ---------------------------------------------------------------------------
-- La temporada es el año
-- ---------------------------------------------------------------------------
create function public.current_season()
returns smallint
language sql stable
set search_path = ''
as $$
  select coalesce(
    (select max(t.year) from public.tournaments t where t.status = 'en_curso'),
    extract(year from (now() at time zone 'America/Panama'))::smallint
  );
$$;
comment on function public.current_season() is
  'Temporada = año vigente: el año del torneo en curso más reciente, o el año actual en Panamá.';
grant execute on function public.current_season() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Disparadores de updated_at para las tablas nuevas
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'organizations', 'circuits', 'tournament_types', 'tournaments',
    'tournament_categories', 'matchdays'
  ] loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      t || '_updated_at', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- El delegado tampoco puede mover el torneo ni la jornada de un partido
-- ---------------------------------------------------------------------------
create or replace function public.guard_match_update()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if (select auth.uid()) is null or public.is_admin() then
    return new;
  end if;
  if (new.tournament_id, new.category_id, new.home_team_id, new.away_team_id,
      new.venue_id, new.starts_at, new.matchday_id, new.notes)
     is distinct from
     (old.tournament_id, old.category_id, old.home_team_id, old.away_team_id,
      old.venue_id, old.starts_at, old.matchday_id, old.notes) then
    raise exception 'Solo un administrador puede cambiar los datos del partido' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS de las tablas nuevas: lectura pública, escritura solo admin
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'organizations', 'circuits', 'tournament_types', 'tournament_type_circuits',
    'tournaments', 'tournament_categories', 'matchdays'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "Lectura pública" on public.%I for select to anon, authenticated using (true)', t);
    execute format('create policy "Admin inserta" on public.%I for insert to authenticated with check ((select public.is_admin()))', t);
    execute format('create policy "Admin actualiza" on public.%I for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))', t);
    execute format('create policy "Admin elimina" on public.%I for delete to authenticated using ((select public.is_admin()))', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Vistas (las mismas de antes; "temporada" pasa a ser "torneo")
-- ---------------------------------------------------------------------------
create view public.standings
with (security_invoker = true)
as
with results as (
  select home_team_id as team_id, home_score as gf, away_score as ga
  from public.matches where status = 'finished'
  union all
  select away_team_id, away_score, home_score
  from public.matches where status = 'finished'
),
totals as (
  select
    t.tournament_id,
    t.category_id,
    t.id                                                   as team_id,
    count(r.team_id)::int                                  as played,
    count(*) filter (where r.gf > r.ga)::int               as won,
    count(*) filter (where r.gf = r.ga)::int               as drawn,
    count(*) filter (where r.gf < r.ga)::int               as lost,
    coalesce(sum(r.gf), 0)::int                            as goals_for,
    coalesce(sum(r.ga), 0)::int                            as goals_against,
    coalesce(sum(r.gf - r.ga), 0)::int                     as goal_difference,
    (3 * count(*) filter (where r.gf > r.ga)
       + count(*) filter (where r.gf = r.ga))::int         as points
  from public.teams t
  left join results r on r.team_id = t.id
  group by t.id
)
select
  rank() over (partition by tournament_id, category_id
               order by points desc, goal_difference desc, goals_for desc)::int as position,
  totals.*
from totals;

create view public.scoring_events
with (security_invoker = true)
as
select m.tournament_id, m.category_id, e.match_id, e.team_id, e.player_id, et.code, et.points
from public.match_events e
join public.matches m      on m.id = e.match_id
join public.event_types et on et.id = e.event_type_id
where m.status in ('live', 'finished') and e.voided_at is null
union all
select m.tournament_id, m.category_id, mv.match_id, mv.team_id, mv.player_id, et.code, et.points
from public.match_mvps mv
join public.matches m      on m.id = mv.match_id
join public.categories c   on c.id = m.category_id
join public.leagues l      on l.id = c.league_id
join public.event_types et on et.sport_id = l.sport_id and et.code = 'mvp';

create view public.player_season_stats
with (security_invoker = true)
as
select
  s.tournament_id,
  s.category_id,
  s.team_id,
  s.player_id,
  count(distinct s.match_id)::int                         as matches_with_events,
  count(*) filter (where s.code = 'goal')::int            as goals,
  count(*) filter (where s.code = 'assist')::int          as assists,
  count(*) filter (where s.code = 'save')::int            as saves,
  count(*) filter (where s.code = 'fair_play')::int       as fair_play,
  count(*) filter (where s.code = 'mvp')::int             as mvps,
  count(*) filter (where s.code = 'yellow_card')::int     as yellow_cards,
  count(*) filter (where s.code = 'red_card')::int        as red_cards,
  coalesce(sum(s.points), 0)::int                         as points
from public.scoring_events s
join public.categories c on c.id = s.category_id
where c.recognition_mode = 'individual_ranking'
group by s.tournament_id, s.category_id, s.team_id, s.player_id;

create view public.season_leaders
with (security_invoker = true)
as
select
  st.tournament_id,
  st.category_id,
  x.stat,
  st.player_id,
  st.team_id,
  x.value,
  rank() over (partition by st.tournament_id, st.category_id, x.stat order by x.value desc)::int as position
from public.player_season_stats st
cross join lateral (values
  ('goals', st.goals), ('assists', st.assists), ('saves', st.saves),
  ('fair_play', st.fair_play), ('mvps', st.mvps), ('points', st.points)
) as x (stat, value)
where x.value > 0;

create view public.team_season_recognitions
with (security_invoker = true)
as
select
  t.tournament_id,
  t.category_id,
  t.id                                                     as team_id,
  count(s.code) filter (where s.points > 0)::int           as stars,
  count(s.code) filter (where s.code = 'goal')::int        as goals,
  count(s.code) filter (where s.code = 'fair_play')::int   as fair_play,
  count(s.code) filter (where s.code = 'mvp')::int         as mvps
from public.teams t
left join public.scoring_events s on s.team_id = t.id
group by t.id;

create view public.my_family_player_stars
with (security_invoker = false, security_barrier = true)
as
select
  s.tournament_id,
  s.team_id,
  s.player_id,
  count(*) filter (where s.points > 0)::int               as stars,
  count(*) filter (where s.code = 'goal')::int            as goals,
  count(*) filter (where s.code = 'assist')::int          as assists,
  count(*) filter (where s.code = 'save')::int            as saves,
  count(*) filter (where s.code = 'fair_play')::int       as fair_play,
  count(*) filter (where s.code = 'mvp')::int             as mvps
from public.scoring_events s
where public.is_admin() or public.is_guardian_of(s.player_id)
group by s.tournament_id, s.team_id, s.player_id;

-- Certificado: ahora es por TORNEO finalizado (la unidad que antes era la
-- temporada). El año va incluido para agrupar por temporada cuando haga falta.
create view public.my_family_tournament_certificates
with (security_invoker = false, security_barrier = true)
as
with base as (
  select
    r.player_id, r.team_id, r.tournament_id, t.category_id,
    (select count(*) from public.match_attendance a
       join public.matches m on m.id = a.match_id
       where a.player_id = r.player_id and a.team_id = r.team_id and m.status = 'finished')::int as matches_played,
    (select count(*) filter (where s.code = 'goal')   from public.scoring_events s where s.player_id = r.player_id and s.team_id = r.team_id)::int as goals,
    (select count(*) filter (where s.code = 'assist') from public.scoring_events s where s.player_id = r.player_id and s.team_id = r.team_id)::int as assists,
    (select count(*) filter (where s.code = 'mvp')    from public.scoring_events s where s.player_id = r.player_id and s.team_id = r.team_id)::int as mvps,
    (select count(*) filter (where s.points > 0)      from public.scoring_events s where s.player_id = r.player_id and s.team_id = r.team_id)::int as stars
  from public.roster_entries r
  join public.teams t       on t.id = r.team_id
  join public.tournaments o on o.id = r.tournament_id
  where o.status = 'finalizado'
    and (public.is_admin() or public.is_guardian_of(r.player_id))
)
select
  b.player_id,
  p.display_name,
  b.team_id,
  t.name                       as team_name,
  t.primary_color,
  t.logo_path,
  b.category_id,
  c.name                       as category_name,
  l.name                       as league_name,
  b.tournament_id,
  tr.name                      as tournament_name,
  tr.year                      as season_year,
  c.recognition_mode,
  case when c.recognition_mode = 'individual_ranking' then b.matches_played end as matches_played,
  case when c.recognition_mode = 'individual_ranking' then b.goals          end as goals,
  case when c.recognition_mode = 'individual_ranking' then b.assists        end as assists,
  case when c.recognition_mode = 'individual_ranking' then b.mvps           end as mvps,
  case when c.recognition_mode = 'individual_ranking' then b.stars          end as stars,
  b.matches_played > 0         as participated
from base b
join public.players p      on p.id = b.player_id
join public.teams t        on t.id = b.team_id
join public.categories c   on c.id = b.category_id
join public.leagues l      on l.id = c.league_id
join public.tournaments tr on tr.id = b.tournament_id;

revoke all on
  public.standings, public.scoring_events, public.player_season_stats,
  public.season_leaders, public.team_season_recognitions,
  public.my_family_player_stars, public.my_family_tournament_certificates
from public, anon, authenticated;

grant select on
  public.standings, public.scoring_events, public.player_season_stats,
  public.season_leaders, public.team_season_recognitions
to anon, authenticated;

grant select on
  public.my_family_player_stars, public.my_family_tournament_certificates
to authenticated;

-- ---------------------------------------------------------------------------
-- Panel: cambiar el estado de un torneo
-- ---------------------------------------------------------------------------
create function public.admin_set_tournament_status(p_tournament_id uuid, p_status public.tournament_status)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and not public.is_admin() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if not exists (select 1 from public.tournaments where id = p_tournament_id) then
    raise exception 'Torneo no encontrado';
  end if;
  update public.tournaments
  set status = p_status,
      finished_at = case when p_status = 'finalizado' then coalesce(finished_at, now()) else null end
  where id = p_tournament_id;
end;
$$;

revoke execute on function public.admin_set_tournament_status(uuid, public.tournament_status) from public, anon;
grant  execute on function public.admin_set_tournament_status(uuid, public.tournament_status) to authenticated;
