-- =============================================================================
-- Panama Global Sports · 3/6 · Acciones (RPC)
--
--   set_photo_consent       padre/madre o admin
--   start_match             delegado asignado o admin (carga asistencia)
--   finish_match            delegado asignado o admin (abre votación MVP)
--   set_match_mvp           delegado asignado o admin
--   cast_mvp_vote           familias de los dos equipos
--   close_mvp_voting        admin o servidor
--   close_expired_mvp_votes servidor (cron)
-- =============================================================================

-- Consentimiento de foto sin poder editar nada más del jugador
create function public.set_photo_consent(p_player_id uuid, p_consent boolean)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not (public.is_admin() or public.is_guardian_of(p_player_id)) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  update public.players set photo_consent = p_consent where id = p_player_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Marcador en vivo
-- ---------------------------------------------------------------------------
create function public.start_match(p_match_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not (public.is_admin() or public.is_match_official(p_match_id)) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  update public.matches
  set status = 'live', started_at = now(),
      home_score = coalesce(home_score, 0), away_score = coalesce(away_score, 0)
  where id = p_match_id and status in ('scheduled', 'postponed');
  if not found then
    raise exception 'El partido no se puede iniciar en su estado actual';
  end if;

  -- Todos presentes por defecto; el delegado quita a los ausentes.
  insert into public.match_attendance (match_id, player_id, team_id)
  select p_match_id, r.player_id, r.team_id
  from public.matches m
  join public.roster_entries r on r.team_id in (m.home_team_id, m.away_team_id)
  where m.id = p_match_id
  on conflict do nothing;
end;
$$;

create function public.finish_match(p_match_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not (public.is_admin() or public.is_match_official(p_match_id)) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  update public.matches set status = 'finished', finished_at = now()
  where id = p_match_id and status = 'live';
  if not found then
    raise exception 'Solo se puede finalizar un partido en vivo';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- MVP
-- ---------------------------------------------------------------------------
create function public.match_mvp_context(p_match_id uuid)
returns table (
  status public.match_status, finished_at timestamptz, home_team_id uuid, away_team_id uuid,
  mvp_mode public.mvp_mode, voting_closes_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select m.status, m.finished_at, m.home_team_id, m.away_team_id, l.mvp_mode,
         m.finished_at + make_interval(hours => l.mvp_vote_hours)
  from public.matches m
  join public.categories c on c.id = m.category_id
  join public.leagues l    on l.id = c.league_id
  where m.id = p_match_id;
$$;

-- Voto: una familia por partido, por cualquier jugador de los dos equipos
-- excepto un hijo propio, dentro de la ventana tras el final.
create function public.cast_mvp_vote(p_match_id uuid, p_player_id uuid)
returns void language plpgsql security definer set search_path = ''
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
  where fm.user_id = (select auth.uid()) and r.team_id in (ctx.home_team_id, ctx.away_team_id)
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

-- Elección oficial. En modo votación, el delegado solo decide empates o
-- equipos sin votos, una vez cerrada la votación. El admin puede corregir siempre.
create function public.set_match_mvp(p_match_id uuid, p_player_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  ctx     record;
  v_team  uuid;
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

  if not public.is_admin() then
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

-- Cierre: gana el más votado de cada equipo; si hay empate, decide el delegado/admin.
create function public.close_mvp_voting(p_match_id uuid)
returns void language plpgsql security definer set search_path = ''
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

-- Para el cron del servidor: cierra votaciones vencidas de la última semana.
create function public.close_expired_mvp_votes()
returns int language plpgsql security definer set search_path = ''
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

-- ---------------------------------------------------------------------------
-- Permisos
-- ---------------------------------------------------------------------------
revoke execute on function public.set_photo_consent(uuid, boolean) from public, anon;
revoke execute on function public.start_match(uuid)                from public, anon;
revoke execute on function public.finish_match(uuid)               from public, anon;
revoke execute on function public.cast_mvp_vote(uuid, uuid)        from public, anon;
revoke execute on function public.set_match_mvp(uuid, uuid)        from public, anon;
revoke execute on function public.close_mvp_voting(uuid)           from public, anon;
revoke execute on function public.close_expired_mvp_votes()        from public, anon, authenticated;
revoke execute on function public.match_mvp_context(uuid)          from public, anon, authenticated;

grant execute on function public.set_photo_consent(uuid, boolean) to authenticated;
grant execute on function public.start_match(uuid)                to authenticated;
grant execute on function public.finish_match(uuid)               to authenticated;
grant execute on function public.cast_mvp_vote(uuid, uuid)        to authenticated;
grant execute on function public.set_match_mvp(uuid, uuid)        to authenticated;
grant execute on function public.close_mvp_voting(uuid)           to authenticated;
