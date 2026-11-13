-- =============================================================================
-- Panama Global Sports · 4/6 · Vistas (todo lo calculado; nada se guarda a mano)
--
--   Públicas        public_players · standings · scoring_events · player_season_stats
--                   season_leaders · team_season_recognitions · public_match_scorers
--   Familia/admin   my_family_player_stars · my_family_season_certificates
--   Admin           media_review_queue
--
-- Regla U6/U8 (recognition_mode = 'team_stars'): ninguna vista pública devuelve
-- datos individuales de esas categorías; solo reconocimientos de equipo.
--
-- Las vistas "security definer" (security_invoker = false) son intencionales:
-- leen tablas privadas y exponen solo columnas/filas permitidas. El panel de
-- Supabase las marcará como advertencia ("Security Definer View").
-- Todas son de solo lectura (las vistas simples son actualizables en Postgres).
-- =============================================================================

-- ÚNICA puerta pública a los jugadores: nombre + inicial, foto solo con consentimiento
create view public.public_players
with (security_invoker = false, security_barrier = true)
as
select
  p.id,
  p.first_name,
  p.last_initial,
  p.display_name,
  case when p.photo_consent then p.photo_path end as photo_path
from public.players p;

-- Tabla de posiciones: PJ, G, E, P, GF, GC, DG, Pts (3/1/0). Desempate: DG, luego GF.
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
    t.season_id,
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
  rank() over (partition by season_id, category_id
               order by points desc, goal_difference desc, goals_for desc)::int as position,
  totals.*
from totals;

-- Base de puntos: eventos no anulados de partidos en vivo/terminados + MVPs
create view public.scoring_events
with (security_invoker = true)
as
select m.season_id, m.category_id, e.match_id, e.team_id, e.player_id, et.code, et.points
from public.match_events e
join public.matches m      on m.id = e.match_id
join public.event_types et on et.id = e.event_type_id
where m.status in ('live', 'finished') and e.voided_at is null
union all
select m.season_id, m.category_id, mv.match_id, mv.team_id, mv.player_id, et.code, et.points
from public.match_mvps mv
join public.matches m      on m.id = mv.match_id
join public.categories c   on c.id = m.category_id
join public.leagues l      on l.id = c.league_id
join public.event_types et on et.sport_id = l.sport_id and et.code = 'mvp';

-- Estadísticas individuales: SOLO categorías con ranking individual (U10+)
create view public.player_season_stats
with (security_invoker = true)
as
select
  s.season_id,
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
group by s.season_id, s.category_id, s.team_id, s.player_id;

-- Líderes: goles, asistencias, atajadas, fair play, MVP y puntos (empates comparten puesto)
create view public.season_leaders
with (security_invoker = true)
as
select
  st.season_id,
  st.category_id,
  x.stat,
  st.player_id,
  st.team_id,
  x.value,
  rank() over (partition by st.season_id, st.category_id, x.stat order by x.value desc)::int as position
from public.player_season_stats st
cross join lateral (values
  ('goals', st.goals), ('assists', st.assists), ('saves', st.saves),
  ('fair_play', st.fair_play), ('mvps', st.mvps), ('points', st.points)
) as x (stat, value)
where x.value > 0;

-- Reconocimientos de equipo (todas las categorías, también U6/U8)
create view public.team_season_recognitions
with (security_invoker = true)
as
select
  t.season_id,
  t.category_id,
  t.id                                                     as team_id,
  count(s.code) filter (where s.points > 0)::int           as stars,
  count(s.code) filter (where s.code = 'goal')::int        as goals,
  count(s.code) filter (where s.code = 'fair_play')::int   as fair_play,
  count(s.code) filter (where s.code = 'mvp')::int         as mvps
from public.teams t
left join public.scoring_events s on s.team_id = t.id
group by t.id;

-- Goleadores por partido para tarjetas y crónicas (nombre + inicial). Excluye U6/U8.
create view public.public_match_scorers
with (security_invoker = false, security_barrier = true)
as
select
  e.match_id,
  e.team_id,
  e.player_id,
  p.display_name,
  count(*)::int          as goals,
  min(e.minute)::int     as first_minute
from public.match_events e
join public.event_types et on et.id = e.event_type_id and et.code = 'goal'
join public.matches m      on m.id = e.match_id
join public.categories c   on c.id = m.category_id
join public.players p      on p.id = e.player_id
where e.voided_at is null
  and m.status in ('live', 'finished')
  and c.recognition_mode = 'individual_ranking'
group by e.match_id, e.team_id, e.player_id, p.display_name;

-- Estrellas de cada niño: SOLO su familia (y admin)
create view public.my_family_player_stars
with (security_invoker = false, security_barrier = true)
as
select
  s.season_id,
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
group by s.season_id, s.team_id, s.player_id;

-- Datos del certificado PDF: solo familia vinculada o admin; solo temporadas cerradas.
-- U6/U8: sin números individuales (null), solo participación.
create view public.my_family_season_certificates
with (security_invoker = false, security_barrier = true)
as
with base as (
  select
    r.player_id, r.team_id, r.season_id, t.category_id,
    (select count(*) from public.match_attendance a
       join public.matches m on m.id = a.match_id
       where a.player_id = r.player_id and a.team_id = r.team_id and m.status = 'finished')::int as matches_played,
    (select count(*) filter (where s.code = 'goal')   from public.scoring_events s where s.player_id = r.player_id and s.team_id = r.team_id)::int as goals,
    (select count(*) filter (where s.code = 'assist') from public.scoring_events s where s.player_id = r.player_id and s.team_id = r.team_id)::int as assists,
    (select count(*) filter (where s.code = 'mvp')    from public.scoring_events s where s.player_id = r.player_id and s.team_id = r.team_id)::int as mvps,
    (select count(*) filter (where s.points > 0)      from public.scoring_events s where s.player_id = r.player_id and s.team_id = r.team_id)::int as stars
  from public.roster_entries r
  join public.teams t   on t.id = r.team_id
  join public.seasons s on s.id = r.season_id
  where s.closed_at is not null
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
  b.season_id,
  se.name                      as season_name,
  c.recognition_mode,
  case when c.recognition_mode = 'individual_ranking' then b.matches_played end as matches_played,
  case when c.recognition_mode = 'individual_ranking' then b.goals          end as goals,
  case when c.recognition_mode = 'individual_ranking' then b.assists        end as assists,
  case when c.recognition_mode = 'individual_ranking' then b.mvps           end as mvps,
  case when c.recognition_mode = 'individual_ranking' then b.stars          end as stars,
  b.matches_played > 0         as participated
from base b
join public.players p    on p.id = b.player_id
join public.teams t      on t.id = b.team_id
join public.categories c on c.id = b.category_id
join public.leagues l    on l.id = c.league_id
join public.seasons se   on se.id = b.season_id;

-- Cola del admin: pendientes + aprobados que quedaron bloqueados (consentimiento retirado)
create view public.media_review_queue
with (security_invoker = true)
as
select
  mi.id, mi.match_id, mi.kind, mi.status, mi.storage_path, mi.thumbnail_path, mi.duration_seconds,
  mi.uploaded_by, mi.created_at,
  public.media_blocking_tags(mi.id) as blocking_tags,
  (select count(*)::int from public.media_tags t where t.media_id = mi.id) as tags
from public.media_items mi
where mi.status = 'pending_review'
   or (mi.status = 'approved' and public.media_blocking_tags(mi.id) > 0);

-- ---------------------------------------------------------------------------
-- Permisos: solo lectura
-- ---------------------------------------------------------------------------
revoke all on
  public.public_players, public.standings, public.scoring_events, public.player_season_stats,
  public.season_leaders, public.team_season_recognitions, public.public_match_scorers,
  public.my_family_player_stars, public.my_family_season_certificates, public.media_review_queue
from public, anon, authenticated;

grant select on
  public.public_players, public.standings, public.scoring_events, public.player_season_stats,
  public.season_leaders, public.team_season_recognitions, public.public_match_scorers
to anon, authenticated;

grant select on
  public.my_family_player_stars, public.my_family_season_certificates, public.media_review_queue
to authenticated;
