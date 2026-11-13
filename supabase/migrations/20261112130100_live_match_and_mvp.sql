-- =============================================================================
-- Panama Global Sports · Migración 7 · Marcador en vivo, MVP y líderes
--
--   · Partido en vivo: start_match / finish_match, marcador calculado desde
--     los goles, correcciones por anulación (voided_at), Realtime.
--   · MVP por equipo y partido: elección oficial o voto de familias (24 h).
--   · Vistas: standings (con posición), scoring_events, player_season_stats,
--     season_leaders, team_season_recognitions, my_family_player_stars.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Configuración por liga
-- ---------------------------------------------------------------------------
create type public.mvp_mode as enum ('official', 'parent_vote');

alter table public.leagues
  add column mvp_mode public.mvp_mode not null default 'official',
  add column mvp_vote_hours smallint not null default 24 check (mvp_vote_hours between 1 and 72);

comment on column public.leagues.mvp_mode is
  'official: el MVP lo elige el delegado/árbitro. parent_vote: votan las familias de ambos equipos (un voto por familia y partido).';

-- ---------------------------------------------------------------------------
-- Partidos: horas reales de inicio y final
-- ---------------------------------------------------------------------------
alter table public.matches
  add column started_at  timestamptz,
  add column finished_at timestamptz;

update public.matches
set started_at = starts_at, finished_at = starts_at + interval '1 hour'
where status = 'finished' and finished_at is null;

alter table public.matches
  add constraint matches_finished_has_time check (status <> 'finished' or finished_at is not null),
  add constraint matches_live_has_score   check (status not in ('live', 'finished') or home_score is not null);

-- ---------------------------------------------------------------------------
-- Tipos de evento: autogol y MVP (premio, no se carga como evento)
-- ---------------------------------------------------------------------------
alter table public.event_types
  add column is_award boolean not null default false;

comment on column public.event_types.is_award is
  'true = premio (MVP): no se carga en match_events; sus puntos se aplican desde match_mvps.';

insert into public.event_types (sport_id, code, name, points, sort_order, is_award)
select s.id, v.code, v.name, v.points, v.sort_order, v.is_award
from public.sports s
cross join (values
  ('own_goal', 'Autogol',             0, 7, false),
  ('mvp',      'Jugador del partido', 3, 8, true)
) as v (code, name, points, sort_order, is_award)
where s.slug = 'futbol';

-- ---------------------------------------------------------------------------
-- Eventos: anulación en lugar de borrado
-- ---------------------------------------------------------------------------
alter table public.match_events
  add column voided_at timestamptz,
  add column voided_by uuid references public.profiles (id) on delete set null;

comment on column public.match_events.voided_at is
  'Evento anulado por error. Se conserva para auditoría y para que Realtime muestre la corrección.';

create index match_events_live_idx on public.match_events (match_id) where voided_at is null;
create index match_events_voided_by_idx on public.match_events (voided_by);

create or replace function public.validate_match_event()
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

  if exists (select 1 from public.event_types where id = new.event_type_id and is_award) then
    raise exception 'El MVP no se carga como evento: usa set_match_mvp o la votación';
  end if;

  -- Registrar quién anuló el evento.
  if tg_op = 'UPDATE' and new.voided_at is not null and old.voided_at is null then
    new.voided_by := auth.uid();
  elsif new.voided_at is null then
    new.voided_by := null;
  end if;

  return new;
end;
$$;

-- El marcador de un partido en vivo o terminado se recalcula desde los goles
-- (el autogol cuenta para el rival). security definer: corre como dueño para
-- poder actualizar el partido aunque quien carga sea un delegado.
create function public.match_events_sync_score()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_match  uuid := coalesce(new.match_id, old.match_id);
  v_home   uuid;
  v_away   uuid;
  v_status public.match_status;
  v_hs     int;
  v_as     int;
begin
  select home_team_id, away_team_id, status into v_home, v_away, v_status
  from public.matches where id = v_match;

  if v_status not in ('live', 'finished') then
    return null;
  end if;

  select
    count(*) filter (where (t.code = 'goal' and e.team_id = v_home) or (t.code = 'own_goal' and e.team_id = v_away)),
    count(*) filter (where (t.code = 'goal' and e.team_id = v_away) or (t.code = 'own_goal' and e.team_id = v_home))
  into v_hs, v_as
  from public.match_events e
  join public.event_types t on t.id = e.event_type_id
  where e.match_id = v_match and e.voided_at is null;

  update public.matches
  set home_score = v_hs, away_score = v_as
  where id = v_match
    and (home_score is distinct from v_hs or away_score is distinct from v_as);

  return null;
end;
$$;

create trigger match_events_sync_score
  after insert or update or delete on public.match_events
  for each row execute function public.match_events_sync_score();

-- ¿Se pueden cargar/corregir eventos? En vivo, o hasta 1 h después del final.
create function public.is_match_editable(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.matches m
    where m.id = p_match_id
      and (m.status = 'live'
           or (m.status = 'finished' and m.finished_at > now() - interval '1 hour'))
  );
$$;

-- Los delegados ya no editan la fila del partido directamente: usan las RPC.
drop policy "Delegado actualiza su partido" on public.matches;
drop policy "Delegado inserta eventos"     on public.match_events;
drop policy "Delegado actualiza eventos"   on public.match_events;
drop policy "Delegado elimina eventos"     on public.match_events;

create policy "Delegado carga eventos en vivo" on public.match_events
  for insert to authenticated
  with check ((select public.is_match_official(match_id)) and (select public.is_match_editable(match_id)));

create policy "Delegado corrige eventos" on public.match_events
  for update to authenticated
  using ((select public.is_match_official(match_id)) and (select public.is_match_editable(match_id)))
  with check ((select public.is_match_official(match_id)) and (select public.is_match_editable(match_id)));
-- Sin política de borrado para delegados: los errores se anulan (voided_at).

-- ---------------------------------------------------------------------------
-- RPC del marcador en vivo
-- ---------------------------------------------------------------------------
create function public.start_match(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (public.is_admin() or public.is_match_official(p_match_id)) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  update public.matches
  set status = 'live',
      started_at = now(),
      home_score = coalesce(home_score, 0),
      away_score = coalesce(away_score, 0)
  where id = p_match_id and status in ('scheduled', 'postponed');

  if not found then
    raise exception 'El partido no se puede iniciar en su estado actual';
  end if;
end;
$$;

create function public.finish_match(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (public.is_admin() or public.is_match_official(p_match_id)) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  update public.matches
  set status = 'finished', finished_at = now()
  where id = p_match_id and status = 'live';

  if not found then
    raise exception 'Solo se puede finalizar un partido en vivo';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- MVP
-- ---------------------------------------------------------------------------
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
  'Un MVP por equipo y partido. Fase álbum: cada fila desbloqueará una figurita especial (la tabla de figuritas referenciará (match_id, team_id)).';

create table public.mvp_votes (
  id          uuid primary key default gen_random_uuid(),
  match_id    uuid not null references public.matches (id) on delete cascade,
  family_id   uuid not null references public.families (id) on delete cascade,
  team_id     uuid not null references public.teams (id) on delete restrict,
  player_id   uuid not null references public.players (id) on delete cascade,
  voter_id    uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (match_id, family_id)                 -- un voto por familia y por partido
);
create index mvp_votes_tally_idx on public.mvp_votes (match_id, team_id, player_id);
create index mvp_votes_family_idx on public.mvp_votes (family_id);
create index mvp_votes_voter_idx on public.mvp_votes (voter_id);
create index mvp_votes_player_idx on public.mvp_votes (player_id);
create index mvp_votes_team_idx on public.mvp_votes (team_id);

-- Mismo control que los eventos: el jugador es del equipo y el equipo juega.
create function public.validate_match_team_player()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.matches m
    where m.id = new.match_id and new.team_id in (m.home_team_id, m.away_team_id)
  ) then
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

create trigger match_mvps_validate before insert or update on public.match_mvps
  for each row execute function public.validate_match_team_player();
create trigger mvp_votes_validate before insert or update on public.mvp_votes
  for each row execute function public.validate_match_team_player();

-- Datos de MVP del partido (modo de la liga y cierre de votación).
create function public.match_mvp_context(p_match_id uuid)
returns table (
  status public.match_status, finished_at timestamptz, home_team_id uuid, away_team_id uuid,
  mvp_mode public.mvp_mode, voting_closes_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.status, m.finished_at, m.home_team_id, m.away_team_id, l.mvp_mode,
         m.finished_at + make_interval(hours => l.mvp_vote_hours)
  from public.matches m
  join public.categories c on c.id = m.category_id
  join public.leagues l    on l.id = c.league_id
  where m.id = p_match_id;
$$;

-- Voto de una familia (padre o madre de un jugador de cualquiera de los dos equipos).
create function public.cast_mvp_vote(p_match_id uuid, p_player_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ctx      record;
  v_family uuid;
  v_team   uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Debes iniciar sesión para votar' using errcode = '42501';
  end if;

  select * into ctx from public.match_mvp_context(p_match_id);
  if not found then
    raise exception 'Partido no encontrado';
  end if;
  if ctx.mvp_mode <> 'parent_vote' then
    raise exception 'En esta liga el MVP lo elige el delegado o árbitro';
  end if;
  if ctx.status <> 'finished' or now() > ctx.voting_closes_at then
    raise exception 'La votación de este partido no está abierta';
  end if;

  select fm.family_id into v_family
  from public.family_members fm
  join public.family_players fp on fp.family_id = fm.family_id
  join public.roster_entries r  on r.player_id = fp.player_id
  where fm.user_id = (select auth.uid())
    and r.team_id in (ctx.home_team_id, ctx.away_team_id)
  limit 1;
  if v_family is null then
    raise exception 'Solo votan las familias de los equipos que jugaron' using errcode = '42501';
  end if;

  select r.team_id into v_team
  from public.roster_entries r
  where r.player_id = p_player_id and r.team_id in (ctx.home_team_id, ctx.away_team_id);
  if v_team is null then
    raise exception 'Ese jugador no pertenece a ninguno de los dos equipos';
  end if;

  if exists (select 1 from public.family_players where family_id = v_family and player_id = p_player_id) then
    raise exception 'No se puede votar por un hijo propio';
  end if;

  insert into public.mvp_votes (match_id, family_id, team_id, player_id, voter_id)
  values (p_match_id, v_family, v_team, p_player_id, (select auth.uid()));
exception
  when unique_violation then
    raise exception 'Tu familia ya votó en este partido';
end;
$$;

-- Elección oficial (delegado asignado o admin). En modo votación, el delegado
-- solo decide si hubo empate al cerrar; el admin puede corregir siempre.
create function public.set_match_mvp(p_match_id uuid, p_player_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ctx     record;
  v_team  uuid;
  v_admin boolean := public.is_admin();
begin
  select * into ctx from public.match_mvp_context(p_match_id);
  if not found then
    raise exception 'Partido no encontrado';
  end if;

  select r.team_id into v_team
  from public.roster_entries r
  where r.player_id = p_player_id and r.team_id in (ctx.home_team_id, ctx.away_team_id);
  if v_team is null then
    raise exception 'Ese jugador no pertenece a ninguno de los dos equipos';
  end if;

  if not v_admin then
    if not public.is_match_official(p_match_id) then
      raise exception 'No autorizado' using errcode = '42501';
    end if;
    if ctx.status <> 'finished' then
      raise exception 'El MVP se elige cuando el partido termina';
    end if;
    if ctx.mvp_mode = 'parent_vote' then
      if now() <= ctx.voting_closes_at then
        raise exception 'La votación de las familias sigue abierta';
      end if;
      if exists (select 1 from public.match_mvps where match_id = p_match_id and team_id = v_team) then
        raise exception 'Este equipo ya tiene MVP por votación';
      end if;
    end if;
  end if;

  insert into public.match_mvps (match_id, team_id, player_id, source, votes, decided_by)
  values (p_match_id, v_team, p_player_id, 'official', null, (select auth.uid()))
  on conflict (match_id, team_id) do update
    set player_id = excluded.player_id, source = 'official', votes = null,
        decided_by = excluded.decided_by, decided_at = now();
end;
$$;

-- Cierra la votación de un partido: gana el más votado de cada equipo.
-- Si hay empate, queda sin MVP para que decida el delegado/admin.
create function public.close_mvp_voting(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ctx    record;
  v_team uuid;
  top    record;
begin
  if (select auth.uid()) is not null and not public.is_admin() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  select * into ctx from public.match_mvp_context(p_match_id);
  if not found or ctx.mvp_mode <> 'parent_vote' or ctx.status <> 'finished' or now() <= ctx.voting_closes_at then
    return;
  end if;

  foreach v_team in array array[ctx.home_team_id, ctx.away_team_id] loop
    continue when exists (select 1 from public.match_mvps where match_id = p_match_id and team_id = v_team);

    select player_id, votes, votes > coalesce(lead(votes) over (order by votes desc), -1) as is_unique
      into top
    from (
      select player_id, count(*)::int as votes
      from public.mvp_votes
      where match_id = p_match_id and team_id = v_team
      group by player_id
    ) t
    order by votes desc
    limit 1;

    if found and top.is_unique then
      insert into public.match_mvps (match_id, team_id, player_id, source, votes)
      values (p_match_id, v_team, top.player_id, 'parent_vote', top.votes);
    end if;
  end loop;
end;
$$;

-- Para un cron (pg_cron o Vercel Cron con service role): cierra todas las
-- votaciones vencidas de la última semana. Devuelve cuántos partidos revisó.
create function public.close_expired_mvp_votes()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_match uuid;
  n int := 0;
begin
  for v_match in
    select m.id
    from public.matches m
    join public.categories c on c.id = m.category_id
    join public.leagues l    on l.id = c.league_id
    where l.mvp_mode = 'parent_vote'
      and m.status = 'finished'
      and m.finished_at + make_interval(hours => l.mvp_vote_hours) < now()
      and m.finished_at > now() - interval '7 days'
      and (select count(*) from public.match_mvps mv where mv.match_id = m.id) < 2
  loop
    perform public.close_mvp_voting(v_match);
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- Permisos de las RPC
revoke execute on function public.start_match(uuid)               from public, anon;
revoke execute on function public.finish_match(uuid)              from public, anon;
revoke execute on function public.cast_mvp_vote(uuid, uuid)       from public, anon;
revoke execute on function public.set_match_mvp(uuid, uuid)       from public, anon;
revoke execute on function public.close_mvp_voting(uuid)          from public, anon;
revoke execute on function public.close_expired_mvp_votes()       from public, anon, authenticated;
revoke execute on function public.match_mvp_context(uuid)         from public, anon, authenticated;
revoke execute on function public.match_events_sync_score()       from public, anon, authenticated;
grant execute on function public.start_match(uuid)         to authenticated;
grant execute on function public.finish_match(uuid)        to authenticated;
grant execute on function public.cast_mvp_vote(uuid, uuid) to authenticated;
grant execute on function public.set_match_mvp(uuid, uuid) to authenticated;
grant execute on function public.close_mvp_voting(uuid)    to authenticated;

-- RLS de MVP
alter table public.match_mvps enable row level security;
alter table public.mvp_votes enable row level security;

create policy "Lectura pública" on public.match_mvps
  for select to anon, authenticated using (true);
create policy "Admin gestiona MVP" on public.match_mvps
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Los votos son secretos: cada familia ve solo el suyo. Se vota con cast_mvp_vote().
create policy "Ver voto de mi familia o admin" on public.mvp_votes
  for select to authenticated
  using ((select public.is_family_member(family_id)) or (select public.is_admin()));
create policy "Admin elimina votos" on public.mvp_votes
  for delete to authenticated using ((select public.is_admin()));

revoke all on public.mvp_votes from anon;

-- ---------------------------------------------------------------------------
-- Realtime (marcador en vivo). El publication existe solo en Supabase.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.matches, public.match_events, public.match_mvps;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Vistas de estadísticas
-- ---------------------------------------------------------------------------
drop view public.player_season_stats;
drop view public.standings;

-- Posiciones: se calculan solas a partir de los partidos finalizados.
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

comment on view public.standings is
  'Tabla de posiciones: PJ, G, E, P, GF, GC, DG, Pts (3/1/0). Desempate: DG, luego GF.';

-- Base común: eventos válidos (no anulados) de partidos en vivo o terminados,
-- más los MVP como un evento de premio.
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

-- Estadísticas individuales: SOLO categorías con ranking individual (U10+).
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

-- Líderes por estadística con posición (empates comparten puesto).
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

comment on view public.season_leaders is
  'Goleadores, asistencias, atajadas, fair play, MVP y puntos. Excluye categorías team_stars (U6/U8) desde la BD.';

-- Reconocimientos de equipo (todas las categorías, también U6/U8).
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

-- Estrellas de cada niño: visibles SOLO para su familia (y admin).
-- security definer a propósito: filtra por la familia del usuario actual.
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

-- Solo lectura en todas las vistas
revoke all on public.standings, public.scoring_events, public.player_season_stats,
              public.season_leaders, public.team_season_recognitions
  from public, anon, authenticated;
grant select on public.standings, public.scoring_events, public.player_season_stats,
                public.season_leaders, public.team_season_recognitions
  to anon, authenticated;

revoke all on public.my_family_player_stars from public, anon, authenticated;
grant select on public.my_family_player_stars to authenticated;
