-- =============================================================================
-- Panama Global Sports · 2/6 · Funciones de acceso, triggers y Row Level Security
--
-- Quién puede qué:
--   · Público (anon y cualquier usuario): lee solo información pública.
--   · admin: escribe en todo.
--   · delegate: carga sus partidos asignados (vía RPC del archivo 3 y eventos).
--   · parent: su perfil, su familia, sus avisos, consentimiento y voto (RPC).
-- Acciones con reglas de negocio = RPC security definer, no políticas amplias.
-- =============================================================================

-- =============================================================================
-- Funciones de acceso (security definer: evitan recursión de RLS)
-- =============================================================================
create function public.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select p.role = 'admin' from public.profiles p where p.id = (select auth.uid())),
    false);
$$;

create function public.is_match_official(p_match_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.match_officials mo
    join public.profiles p on p.id = mo.user_id
    where mo.match_id = p_match_id
      and mo.user_id = (select auth.uid())
      and p.role = 'delegate');
$$;

-- "Tutor de" = miembro de una familia vinculada al jugador
create function public.is_guardian_of(p_player_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.family_players fp
    join public.family_members fm on fm.family_id = fp.family_id
    where fp.player_id = p_player_id and fm.user_id = (select auth.uid()));
$$;

create function public.is_family_member(p_family_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.family_members fm
    where fm.family_id = p_family_id and fm.user_id = (select auth.uid()));
$$;

-- Familia con algún hijo inscrito en la liga (ve la galería de la liga)
create function public.is_league_family(p_league_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.family_members fm
    join public.family_players fp on fp.family_id = fm.family_id
    join public.roster_entries r  on r.player_id = fp.player_id
    join public.teams t           on t.id = r.team_id
    join public.categories c      on c.id = t.category_id
    where fm.user_id = (select auth.uid()) and c.league_id = p_league_id);
$$;

-- Familia con un hijo en alguno de los dos equipos del partido
create function public.is_match_family(p_match_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.matches m
    join public.roster_entries r  on r.team_id in (m.home_team_id, m.away_team_id)
    join public.family_players fp on fp.player_id = r.player_id
    join public.family_members fm on fm.family_id = fp.family_id
    where m.id = p_match_id and fm.user_id = (select auth.uid()));
$$;

-- Se pueden cargar/corregir eventos: en vivo o hasta 1 h después del final
create function public.is_match_editable(p_match_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.matches m
    where m.id = p_match_id
      and (m.status = 'live'
           or (m.status = 'finished' and m.finished_at > now() - interval '1 hour')));
$$;

-- Niños etiquetados sin consentimiento y sin difuminar. Se evalúa EN VIVO:
-- si un padre retira el consentimiento, el contenido aprobado se oculta al instante.
create function public.media_blocking_tags(p_media_id uuid)
returns int language sql stable security definer set search_path = ''
as $$
  select count(*)::int
  from public.media_tags t
  join public.players p on p.id = t.player_id
  where t.media_id = p_media_id and not p.photo_consent and not t.redacted;
$$;

create function public.can_view_media(p_media_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.media_items mi
    join public.matches m    on m.id = mi.match_id
    join public.categories c on c.id = m.category_id
    where mi.id = p_media_id
      and (public.is_admin()
           or mi.uploaded_by = (select auth.uid())
           or (mi.status = 'approved'
               and public.media_blocking_tags(mi.id) = 0
               and public.is_league_family(c.league_id))));
$$;

create function public.can_upload_media(p_match_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.is_admin() or public.is_match_official(p_match_id) or public.is_match_family(p_match_id);
$$;

-- =============================================================================
-- Triggers
-- =============================================================================
create function public.set_updated_at()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'leagues', 'categories', 'seasons', 'venues', 'teams', 'players', 'roster_entries',
    'profiles', 'families', 'matches', 'match_events', 'notification_preferences',
    'media_items', 'match_chronicles'
  ] loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      t || '_updated_at', t);
  end loop;
end;
$$;

-- Perfil y preferencias al registrarse. El rol SIEMPRE empieza como 'parent':
-- nunca se toma de los metadatos del registro (los controla el usuario).
create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  insert into public.notification_preferences (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Solo un admin cambia roles (desde el SQL Editor auth.uid() es NULL:
-- así se nombra al primer administrador).
create function public.guard_profile_role()
returns trigger language plpgsql set search_path = ''
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

-- Quién y cuándo cambió el consentimiento de foto
create function public.stamp_photo_consent()
returns trigger language plpgsql set search_path = ''
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

-- Defensa en profundidad: quien no es admin solo cambia marcador, estado y horas
-- (las RPC de delegado corren con su sesión).
create function public.guard_match_update()
returns trigger language plpgsql set search_path = ''
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
    raise exception 'Solo un administrador puede cambiar los datos del partido' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger matches_guard_update
  before update on public.matches
  for each row execute function public.guard_match_update();

-- El jugador es del equipo y el equipo juega el partido
-- (asistencia, MVP y votos)
create function public.validate_match_team_player()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.matches m
    where m.id = new.match_id and new.team_id in (m.home_team_id, m.away_team_id)) then
    raise exception 'El equipo % no juega el partido %', new.team_id, new.match_id;
  end if;
  if not exists (
    select 1 from public.roster_entries r
    where r.player_id = new.player_id and r.team_id = new.team_id) then
    raise exception 'El jugador % no está inscrito en el equipo %', new.player_id, new.team_id;
  end if;
  return new;
end;
$$;

create trigger match_attendance_validate before insert or update on public.match_attendance
  for each row execute function public.validate_match_team_player();
create trigger match_mvps_validate before insert or update on public.match_mvps
  for each row execute function public.validate_match_team_player();
create trigger mvp_votes_validate before insert or update on public.mvp_votes
  for each row execute function public.validate_match_team_player();

-- Eventos: misma validación + el MVP no es evento + registrar anulación
create function public.validate_match_event()
returns trigger language plpgsql set search_path = ''
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
    where r.player_id = new.player_id and r.team_id = new.team_id) then
    raise exception 'El jugador % no está inscrito en el equipo %', new.player_id, new.team_id;
  end if;
  if exists (select 1 from public.event_types where id = new.event_type_id and is_award) then
    raise exception 'El MVP no se carga como evento: usa set_match_mvp o la votación';
  end if;

  if tg_op = 'UPDATE' and new.voided_at is not null and old.voided_at is null then
    new.voided_by := auth.uid();
  elsif new.voided_at is null then
    new.voided_by := null;
  end if;
  return new;
end;
$$;

create trigger match_events_validate
  before insert or update on public.match_events
  for each row execute function public.validate_match_event();

-- Marcador de partidos en vivo/terminados = goles no anulados (autogol suma al rival).
-- security definer: actualiza el partido aunque cargue un delegado.
create function public.match_events_sync_score()
returns trigger language plpgsql security definer set search_path = ''
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
  where id = v_match and (home_score is distinct from v_hs or away_score is distinct from v_as);
  return null;
end;
$$;

create trigger match_events_sync_score
  after insert or update or delete on public.match_events
  for each row execute function public.match_events_sync_score();

-- Etiquetas de galería: solo jugadores del partido
create function public.validate_media_tag()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.media_items mi
    join public.matches m on m.id = mi.match_id
    join public.roster_entries r on r.team_id in (m.home_team_id, m.away_team_id)
    where mi.id = new.media_id and r.player_id = new.player_id) then
    raise exception 'El jugador % no jugó el partido de esta foto/video', new.player_id;
  end if;
  new.tagged_by := coalesce(new.tagged_by, auth.uid());
  return new;
end;
$$;

create trigger media_tags_validate before insert or update on public.media_tags
  for each row execute function public.validate_media_tag();

-- Galería: solo admin (o el servidor) cambia el estado; no se aprueba con niños bloqueantes
create function public.guard_media_status()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    if (select auth.uid()) is not null and not public.is_admin() then
      raise exception 'Solo un administrador puede publicar o rechazar contenido' using errcode = '42501';
    end if;
    if new.status = 'approved' and public.media_blocking_tags(new.id) > 0 then
      raise exception 'Bloqueado: aparecen niños sin consentimiento de foto. Recórtalos o difumínalos antes de publicar.';
    end if;
    if new.status in ('approved', 'rejected') then
      new.reviewed_by := auth.uid();
      new.reviewed_at := now();
    end if;
  end if;
  return new;
end;
$$;

create trigger media_items_guard_status before update on public.media_items
  for each row execute function public.guard_media_status();

-- Crónicas: registrar edición y aprobación
create function public.stamp_chronicle()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.body is distinct from old.body and (select auth.uid()) is not null then
    new.edited_by := auth.uid();
  end if;
  if new.status = 'published' and (tg_op = 'INSERT' or old.status <> 'published') then
    new.approved_by := coalesce(auth.uid(), new.approved_by);
    new.published_at := now();
  elsif new.status = 'draft' then
    new.approved_by := null;
    new.published_at := null;
  end if;
  return new;
end;
$$;

create trigger match_chronicles_stamp before insert or update on public.match_chronicles
  for each row execute function public.stamp_chronicle();

-- Funciones internas de triggers: nadie las llama directo
revoke execute on function public.match_events_sync_score() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- =============================================================================
-- RLS · tablas públicas: lectura para todos, escritura solo admin
-- =============================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'sports', 'leagues', 'categories', 'seasons', 'venues', 'teams', 'roster_entries',
    'matches', 'match_attendance', 'event_types', 'match_events', 'match_mvps'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "Lectura pública" on public.%I for select to anon, authenticated using (true)', t);
    execute format('create policy "Admin inserta" on public.%I for insert to authenticated with check ((select public.is_admin()))', t);
    execute format('create policy "Admin actualiza" on public.%I for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))', t);
    execute format('create policy "Admin elimina" on public.%I for delete to authenticated using ((select public.is_admin()))', t);
  end loop;
end;
$$;

-- Delegado: eventos de su partido mientras sea editable (sin borrar: se anulan)
create policy "Delegado carga eventos en vivo" on public.match_events
  for insert to authenticated
  with check ((select public.is_match_official(match_id)) and (select public.is_match_editable(match_id)));
create policy "Delegado corrige eventos" on public.match_events
  for update to authenticated
  using ((select public.is_match_official(match_id)) and (select public.is_match_editable(match_id)))
  with check ((select public.is_match_official(match_id)) and (select public.is_match_editable(match_id)));

-- Delegado: asistencia de su partido
create policy "Delegado marca presentes" on public.match_attendance
  for insert to authenticated
  with check ((select public.is_match_official(match_id)) and (select public.is_match_editable(match_id)));
create policy "Delegado quita ausentes" on public.match_attendance
  for delete to authenticated
  using ((select public.is_match_official(match_id)) and (select public.is_match_editable(match_id)));

-- =============================================================================
-- RLS · personas
-- =============================================================================
-- players: el público usa la vista public_players
alter table public.players enable row level security;
create policy "Admin o tutor lee jugador" on public.players
  for select to authenticated
  using ((select public.is_admin()) or (select public.is_guardian_of(id)));
create policy "Admin inserta jugador" on public.players
  for insert to authenticated with check ((select public.is_admin()));
create policy "Admin actualiza jugador" on public.players
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admin elimina jugador" on public.players
  for delete to authenticated using ((select public.is_admin()));

alter table public.profiles enable row level security;
create policy "Ver perfil propio o admin" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));
create policy "Editar perfil propio o admin" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()))
  with check (id = (select auth.uid()) or (select public.is_admin()));

alter table public.families enable row level security;
create policy "Ver familia propia o admin" on public.families
  for select to authenticated
  using ((select public.is_family_member(id)) or (select public.is_admin()));
create policy "Admin gestiona familias" on public.families
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

alter table public.family_members enable row level security;
create policy "Ver miembros de mi familia o admin" on public.family_members
  for select to authenticated
  using ((select public.is_family_member(family_id)) or (select public.is_admin()));
create policy "Admin gestiona miembros" on public.family_members
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

alter table public.family_players enable row level security;
create policy "Ver hijos de mi familia o admin" on public.family_players
  for select to authenticated
  using ((select public.is_family_member(family_id)) or (select public.is_admin()));
create policy "Admin vincula hijos" on public.family_players
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

alter table public.match_officials enable row level security;
create policy "Ver asignaciones propias o admin" on public.match_officials
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "Admin gestiona asignaciones" on public.match_officials
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- Votos secretos: cada familia ve solo el suyo; se vota con cast_mvp_vote()
alter table public.mvp_votes enable row level security;
create policy "Ver voto de mi familia o admin" on public.mvp_votes
  for select to authenticated
  using ((select public.is_family_member(family_id)) or (select public.is_admin()));
create policy "Admin elimina votos" on public.mvp_votes
  for delete to authenticated using ((select public.is_admin()));

-- =============================================================================
-- RLS · avisos: cada usuario gestiona lo suyo
-- =============================================================================
alter table public.team_follows enable row level security;
create policy "Mis equipos seguidos" on public.team_follows
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Seguir equipo" on public.team_follows
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Dejar de seguir" on public.team_follows
  for delete to authenticated using (user_id = (select auth.uid()));

alter table public.notification_preferences enable row level security;
create policy "Ver mis preferencias" on public.notification_preferences
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Crear mis preferencias" on public.notification_preferences
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Editar mis preferencias" on public.notification_preferences
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

alter table public.push_subscriptions enable row level security;
create policy "Ver mis suscripciones" on public.push_subscriptions
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Registrar suscripción" on public.push_subscriptions
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Actualizar suscripción" on public.push_subscriptions
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Eliminar suscripción" on public.push_subscriptions
  for delete to authenticated using (user_id = (select auth.uid()));

alter table public.notification_log enable row level security;   -- sin políticas: solo service role

-- =============================================================================
-- RLS · contenido
-- =============================================================================
alter table public.media_items enable row level security;
create policy "Ver galería permitida" on public.media_items
  for select to authenticated using ((select public.can_view_media(id)));
-- Sube en 'processing'; el servidor quita EXIF/comprime y la pasa a revisión.
create policy "Subir al partido" on public.media_items
  for insert to authenticated
  with check (
    uploaded_by = (select auth.uid())
    and status = 'processing'
    and not metadata_stripped
    and (select public.can_upload_media(match_id)));
create policy "Admin edita contenido" on public.media_items
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Borrar lo propio no publicado o admin" on public.media_items
  for delete to authenticated
  using ((select public.is_admin()) or (uploaded_by = (select auth.uid()) and status <> 'approved'));

alter table public.media_tags enable row level security;
create policy "Ver etiquetas de contenido visible" on public.media_tags
  for select to authenticated using ((select public.can_view_media(media_id)));
-- Quien subió etiqueta mientras no esté aprobado; solo el admin marca 'redacted'.
create policy "Etiquetar contenido propio o admin" on public.media_tags
  for insert to authenticated
  with check (
    (select public.is_admin())
    or (not redacted and exists (
          select 1 from public.media_items mi
          where mi.id = media_id and mi.uploaded_by = (select auth.uid()) and mi.status <> 'approved')));
create policy "Admin edita etiquetas" on public.media_tags
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Quitar etiquetas propias o admin" on public.media_tags
  for delete to authenticated
  using (
    (select public.is_admin())
    or exists (select 1 from public.media_items mi
               where mi.id = media_id and mi.uploaded_by = (select auth.uid()) and mi.status <> 'approved'));

alter table public.match_chronicles enable row level security;
create policy "Lectura pública de publicadas" on public.match_chronicles
  for select to anon, authenticated
  using (status = 'published' or (select public.is_admin()));
create policy "Admin gestiona crónicas" on public.match_chronicles
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- =============================================================================
-- Defensa en profundidad: anon sin privilegios sobre tablas privadas
-- =============================================================================
revoke all on
  public.players, public.profiles, public.families, public.family_members, public.family_players,
  public.match_officials, public.mvp_votes, public.team_follows, public.notification_preferences,
  public.push_subscriptions, public.media_items, public.media_tags
from anon;
revoke all on public.notification_log from anon, authenticated;
