-- =============================================================================
-- Panama Global Sports · Migración 2 · Roles, perfiles y Row Level Security
--
-- Reglas:
--   · Público (anon y cualquier usuario): solo lee información pública.
--   · admin: escribe en todo.
--   · delegate: actualiza resultado/estado y eventos SOLO de los partidos
--     a los que está asignado en match_officials.
--   · parent: lee y gestiona el consentimiento de foto de sus hijos.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Funciones auxiliares (security definer para que RLS no se llame a sí misma)
-- ---------------------------------------------------------------------------
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.role = 'admin' from public.profiles p where p.id = (select auth.uid())),
    false
  );
$$;

create function public.is_match_official(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.match_officials mo
    join public.profiles p on p.id = mo.user_id
    where mo.match_id = p_match_id
      and mo.user_id = (select auth.uid())
      and p.role = 'delegate'
  );
$$;

create function public.is_guardian_of(p_player_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.player_guardians g
    where g.player_id = p_player_id and g.user_id = (select auth.uid())
  );
$$;

-- ---------------------------------------------------------------------------
-- Perfil automático al registrarse. El rol SIEMPRE empieza como 'parent':
-- nunca se toma de los metadatos del registro (los controla el usuario).
-- ---------------------------------------------------------------------------
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Solo un admin puede cambiar roles. (Desde el SQL Editor de Supabase
-- auth.uid() es NULL, así se puede nombrar al primer administrador.)
create function public.guard_profile_role()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.role is distinct from old.role
     and (select auth.uid()) is not null
     and not public.is_admin() then
    raise exception 'Solo un administrador puede cambiar roles' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_role
  before update on public.profiles
  for each row execute function public.guard_profile_role();

-- Un delegado solo puede tocar marcador y estado; el resto lo cambia un admin.
create function public.guard_match_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or public.is_admin() then
    return new;
  end if;

  if (new.season_id, new.category_id, new.home_team_id, new.away_team_id,
      new.venue_id, new.starts_at, new.matchday, new.notes)
     is distinct from
     (old.season_id, old.category_id, old.home_team_id, old.away_team_id,
      old.venue_id, old.starts_at, old.matchday, old.notes) then
    raise exception 'Un delegado solo puede cambiar el marcador y el estado del partido'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger matches_guard_update
  before update on public.matches
  for each row execute function public.guard_match_update();

-- Padre/madre (o admin) cambia el consentimiento de foto sin poder editar
-- nada más del jugador.
create function public.set_photo_consent(p_player_id uuid, p_consent boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (public.is_admin() or public.is_guardian_of(p_player_id)) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  update public.players set photo_consent = p_consent where id = p_player_id;
end;
$$;

revoke execute on function public.set_photo_consent(uuid, boolean) from public, anon;
grant execute on function public.set_photo_consent(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS en tablas públicas: lectura para todos, escritura solo admin
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'sports', 'leagues', 'categories', 'seasons', 'venues', 'teams',
    'roster_entries', 'matches', 'event_types', 'match_events'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "Lectura pública" on public.%I for select to anon, authenticated using (true)', t);
    execute format(
      'create policy "Admin inserta" on public.%I for insert to authenticated with check ((select public.is_admin()))', t);
    execute format(
      'create policy "Admin actualiza" on public.%I for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))', t);
    execute format(
      'create policy "Admin elimina" on public.%I for delete to authenticated using ((select public.is_admin()))', t);
  end loop;
end;
$$;

-- Delegados: resultado de sus partidos asignados
create policy "Delegado actualiza su partido" on public.matches
  for update to authenticated
  using ((select public.is_match_official(id)))
  with check ((select public.is_match_official(id)));

-- Delegados: eventos de sus partidos asignados
create policy "Delegado inserta eventos" on public.match_events
  for insert to authenticated
  with check ((select public.is_match_official(match_id)));

create policy "Delegado actualiza eventos" on public.match_events
  for update to authenticated
  using ((select public.is_match_official(match_id)))
  with check ((select public.is_match_official(match_id)));

create policy "Delegado elimina eventos" on public.match_events
  for delete to authenticated
  using ((select public.is_match_official(match_id)));

-- ---------------------------------------------------------------------------
-- RLS en tablas privadas
-- ---------------------------------------------------------------------------

-- players: nadie del público lee la tabla (usa la vista public_players).
alter table public.players enable row level security;

create policy "Admin o tutor lee jugador" on public.players
  for select to authenticated
  using ((select public.is_admin()) or (select public.is_guardian_of(id)));

create policy "Admin inserta jugador" on public.players
  for insert to authenticated with check ((select public.is_admin()));

create policy "Admin actualiza jugador" on public.players
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "Admin elimina jugador" on public.players
  for delete to authenticated using ((select public.is_admin()));

-- profiles: cada quien ve y edita el suyo; el admin ve y edita todos.
alter table public.profiles enable row level security;

create policy "Ver perfil propio o admin" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

create policy "Editar perfil propio o admin" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()))
  with check (id = (select auth.uid()) or (select public.is_admin()));

-- player_guardians: el tutor ve sus vínculos; solo el admin los crea.
alter table public.player_guardians enable row level security;

create policy "Ver vínculos propios o admin" on public.player_guardians
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy "Admin gestiona vínculos" on public.player_guardians
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- match_officials: el delegado ve sus asignaciones; solo el admin asigna.
alter table public.match_officials enable row level security;

create policy "Ver asignaciones propias o admin" on public.match_officials
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy "Admin gestiona asignaciones" on public.match_officials
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Defensa en profundidad: el rol anónimo no tiene ningún privilegio sobre
-- las tablas privadas, aunque RLS ya lo bloquea.
revoke all on public.players, public.profiles, public.player_guardians, public.match_officials from anon;
