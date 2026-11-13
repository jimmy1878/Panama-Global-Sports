-- =============================================================================
-- Panama Global Sports · Migración 3 · Vistas públicas
-- =============================================================================

-- ---------------------------------------------------------------------------
-- public_players: ÚNICA puerta pública a los datos de jugadores.
--
-- Es una vista "security definer" (security_invoker = false) a propósito:
-- la tabla players está cerrada al público y esta vista expone solo columnas
-- permitidas. La foto aparece únicamente con consentimiento.
-- El panel de Supabase la marcará como advertencia ("Security Definer View");
-- es intencional.
-- ---------------------------------------------------------------------------
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

comment on view public.public_players is
  'Datos públicos de jugadores menores: nombre + inicial y foto solo con consentimiento.';

-- Las vistas simples son actualizables en Postgres: quitar todo y dejar solo
-- lectura, para que nadie pueda escribir en players a través de la vista.
revoke all on public.public_players from public, anon, authenticated;
grant select on public.public_players to anon, authenticated;

-- ---------------------------------------------------------------------------
-- player_season_stats: totales y puntos por jugador, equipo y temporada.
-- Cuenta partidos en juego o terminados.
-- ---------------------------------------------------------------------------
create view public.player_season_stats
with (security_invoker = true)
as
select
  m.season_id,
  e.team_id,
  e.player_id,
  count(distinct e.match_id)                            as matches_with_events,
  count(*) filter (where et.code = 'goal')              as goals,
  count(*) filter (where et.code = 'assist')            as assists,
  count(*) filter (where et.code = 'save')              as saves,
  count(*) filter (where et.code = 'fair_play')         as fair_play,
  count(*) filter (where et.code = 'yellow_card')       as yellow_cards,
  count(*) filter (where et.code = 'red_card')          as red_cards,
  coalesce(sum(et.points), 0)::int                      as points
from public.match_events e
join public.matches m      on m.id = e.match_id
join public.event_types et on et.id = e.event_type_id
where m.status in ('live', 'finished')
group by m.season_id, e.team_id, e.player_id;

revoke all on public.player_season_stats from public, anon, authenticated;
grant select on public.player_season_stats to anon, authenticated;

-- ---------------------------------------------------------------------------
-- standings: tabla de posiciones (3 pts victoria, 1 empate).
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
)
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
group by t.id;

revoke all on public.standings from public, anon, authenticated;
grant select on public.standings to anon, authenticated;
