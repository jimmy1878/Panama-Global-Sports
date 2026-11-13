-- =============================================================================
-- Panama Global Sports · Migración 9 · Contenido: asistencia, galería,
-- crónicas, tarjetas de resultado y certificados
--
--   · match_attendance: quién jugó cada partido ("partidos jugados").
--   · Galería por partido: fotos y videos (≤ 30 s). Nada se publica sin
--     aprobación de un admin; se bloquea si aparece un niño sin consentimiento
--     que no esté recortado/difuminado; EXIF/GPS eliminados antes de revisión.
--   · Crónicas generadas con la API de Claude: borrador → aprobada por admin.
--   · Tarjetas de resultado: vista public_match_scorers (sin goleadores en U6/U8).
--   · Certificados de temporada: solo la familia del niño, temporada cerrada.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Asistencia ("partidos jugados")
-- ---------------------------------------------------------------------------
create table public.match_attendance (
  match_id    uuid not null references public.matches (id) on delete cascade,
  player_id   uuid not null references public.players (id) on delete cascade,
  team_id     uuid not null references public.teams (id) on delete restrict,
  created_at  timestamptz not null default now(),
  primary key (match_id, player_id)
);
create index match_attendance_player_idx on public.match_attendance (player_id);
create index match_attendance_team_idx on public.match_attendance (team_id);

comment on table public.match_attendance is
  'Jugadores presentes. start_match carga a todo el roster; el delegado quita a los ausentes.';

create trigger match_attendance_validate before insert or update on public.match_attendance
  for each row execute function public.validate_match_team_player();

alter table public.match_attendance enable row level security;

create policy "Lectura pública" on public.match_attendance
  for select to anon, authenticated using (true);
create policy "Admin gestiona asistencia" on public.match_attendance
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Delegado marca presentes" on public.match_attendance
  for insert to authenticated
  with check ((select public.is_match_official(match_id)) and (select public.is_match_editable(match_id)));
create policy "Delegado quita ausentes" on public.match_attendance
  for delete to authenticated
  using ((select public.is_match_official(match_id)) and (select public.is_match_editable(match_id)));

-- start_match ahora también carga la asistencia con todo el roster.
create or replace function public.start_match(p_match_id uuid)
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

  insert into public.match_attendance (match_id, player_id, team_id)
  select p_match_id, r.player_id, r.team_id
  from public.matches m
  join public.roster_entries r on r.team_id in (m.home_team_id, m.away_team_id)
  where m.id = p_match_id
  on conflict do nothing;
end;
$$;

-- ---------------------------------------------------------------------------
-- Temporadas: cierre (habilita certificados)
-- ---------------------------------------------------------------------------
alter table public.seasons add column closed_at timestamptz;
comment on column public.seasons.closed_at is
  'Fecha de cierre. Al cerrarse se habilitan los certificados de temporada.';

-- ---------------------------------------------------------------------------
-- Auxiliares de acceso
-- ---------------------------------------------------------------------------
-- ¿El usuario pertenece a una familia con algún hijo inscrito en la liga?
create function public.is_league_family(p_league_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.family_members fm
    join public.family_players fp on fp.family_id = fm.family_id
    join public.roster_entries r  on r.player_id = fp.player_id
    join public.teams t           on t.id = r.team_id
    join public.categories c      on c.id = t.category_id
    where fm.user_id = (select auth.uid()) and c.league_id = p_league_id
  );
$$;

-- ¿Su familia tiene un hijo en alguno de los dos equipos del partido?
create function public.is_match_family(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.matches m
    join public.roster_entries r  on r.team_id in (m.home_team_id, m.away_team_id)
    join public.family_players fp on fp.player_id = r.player_id
    join public.family_members fm on fm.family_id = fp.family_id
    where m.id = p_match_id and fm.user_id = (select auth.uid())
  );
$$;

-- ---------------------------------------------------------------------------
-- Galería por partido
-- ---------------------------------------------------------------------------
create type public.media_kind as enum ('photo', 'video');
create type public.media_status as enum ('processing', 'pending_review', 'approved', 'rejected');

create table public.media_items (
  id                 uuid primary key default gen_random_uuid(),
  match_id           uuid not null references public.matches (id) on delete cascade,
  uploaded_by        uuid references public.profiles (id) on delete set null,
  kind               public.media_kind not null,
  status             public.media_status not null default 'processing',
  upload_path        text,              -- original en "media-uploads" (cuarentena; se borra al procesar)
  storage_path       text,              -- archivo procesado en "match-media"
  thumbnail_path     text,              -- miniatura en "match-media"
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

comment on table public.media_items is
  'Fotos y videos (≤ 30 s) por partido. Flujo: processing (servidor quita EXIF/comprime) → pending_review → approved/rejected por un admin.';

-- Jugadores que aparecen en cada foto/video
create table public.media_tags (
  media_id    uuid not null references public.media_items (id) on delete cascade,
  player_id   uuid not null references public.players (id) on delete cascade,
  redacted    boolean not null default false,   -- el admin lo recortó o difuminó
  tagged_by   uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  primary key (media_id, player_id)
);
create index media_tags_player_idx on public.media_tags (player_id);
create index media_tags_tagged_by_idx on public.media_tags (tagged_by);

comment on column public.media_tags.redacted is
  'true = el niño ya no es reconocible (recortado o difuminado). Obligatorio si no hay consentimiento de foto.';

-- La etiqueta debe ser de un jugador de alguno de los dos equipos del partido.
create function public.validate_media_tag()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.media_items mi
    join public.matches m on m.id = mi.match_id
    join public.roster_entries r on r.team_id in (m.home_team_id, m.away_team_id)
    where mi.id = new.media_id and r.player_id = new.player_id
  ) then
    raise exception 'El jugador % no jugó el partido de esta foto/video', new.player_id;
  end if;
  new.tagged_by := coalesce(new.tagged_by, auth.uid());
  return new;
end;
$$;

create trigger media_tags_validate before insert or update on public.media_tags
  for each row execute function public.validate_media_tag();

-- Etiquetas que bloquean: niño sin consentimiento y sin recortar/difuminar.
-- Se evalúa EN VIVO: si un padre retira el consentimiento, el contenido ya
-- aprobado deja de mostrarse al instante.
create function public.media_blocking_tags(p_media_id uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int
  from public.media_tags t
  join public.players p on p.id = t.player_id
  where t.media_id = p_media_id and not p.photo_consent and not t.redacted;
$$;

-- Reglas de cambio de estado:
--   · Solo admin (o el servidor con service role) cambia el estado.
--   · No se aprueba con etiquetas bloqueantes.
create function public.guard_media_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    if (select auth.uid()) is not null and not public.is_admin() then
      raise exception 'Solo un administrador puede publicar o rechazar contenido' using errcode = '42501';
    end if;

    if new.status = 'approved' then
      if public.media_blocking_tags(new.id) > 0 then
        raise exception 'Bloqueado: aparecen niños sin consentimiento de foto. Recórtalos o difumínalos antes de publicar.';
      end if;
      new.reviewed_by := auth.uid();
      new.reviewed_at := now();
    elsif new.status = 'rejected' then
      new.reviewed_by := auth.uid();
      new.reviewed_at := now();
    end if;
  end if;
  return new;
end;
$$;

create trigger media_items_guard_status before update on public.media_items
  for each row execute function public.guard_media_status();
create trigger media_items_updated_at before update on public.media_items
  for each row execute function public.set_updated_at();

-- ¿Puede el usuario actual ver este contenido?
create function public.can_view_media(p_media_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.media_items mi
    join public.matches m    on m.id = mi.match_id
    join public.categories c on c.id = m.category_id
    where mi.id = p_media_id
      and (
        public.is_admin()
        or mi.uploaded_by = (select auth.uid())
        or (mi.status = 'approved'
            and public.media_blocking_tags(mi.id) = 0
            and public.is_league_family(c.league_id))
      )
  );
$$;

-- ¿Puede subir contenido de este partido? Admin, delegado asignado o familia del partido.
create function public.can_upload_media(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin() or public.is_match_official(p_match_id) or public.is_match_family(p_match_id);
$$;

alter table public.media_items enable row level security;
alter table public.media_tags enable row level security;

create policy "Ver galería permitida" on public.media_items
  for select to authenticated
  using ((select public.can_view_media(id)));

-- Subir: queda en 'processing' hasta que el servidor quite EXIF y comprima.
create policy "Subir al partido" on public.media_items
  for insert to authenticated
  with check (
    uploaded_by = (select auth.uid())
    and status = 'processing'
    and not metadata_stripped
    and (select public.can_upload_media(match_id))
  );

create policy "Admin edita contenido" on public.media_items
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "Borrar lo propio no publicado o admin" on public.media_items
  for delete to authenticated
  using ((select public.is_admin()) or (uploaded_by = (select auth.uid()) and status <> 'approved'));

create policy "Ver etiquetas de contenido visible" on public.media_tags
  for select to authenticated
  using ((select public.can_view_media(media_id)));

-- Etiquetar: quien subió (mientras no esté aprobado) o admin. Solo admin marca 'redacted'.
create policy "Etiquetar contenido propio o admin" on public.media_tags
  for insert to authenticated
  with check (
    (select public.is_admin())
    or (not redacted and exists (
          select 1 from public.media_items mi
          where mi.id = media_id and mi.uploaded_by = (select auth.uid()) and mi.status <> 'approved'))
  );

create policy "Admin edita etiquetas" on public.media_tags
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "Quitar etiquetas propias o admin" on public.media_tags
  for delete to authenticated
  using (
    (select public.is_admin())
    or exists (select 1 from public.media_items mi
               where mi.id = media_id and mi.uploaded_by = (select auth.uid()) and mi.status <> 'approved')
  );

revoke all on public.media_items, public.media_tags from anon;

-- Cola de revisión del admin
create view public.media_review_queue
with (security_invoker = true)
as
select
  mi.id, mi.match_id, mi.kind, mi.status, mi.storage_path, mi.thumbnail_path, mi.duration_seconds,
  mi.uploaded_by, mi.created_at,
  public.media_blocking_tags(mi.id) as blocking_tags,
  (select count(*)::int from public.media_tags t where t.media_id = mi.id) as tags
from public.media_items mi
where mi.status in ('pending_review', 'approved')
  and (mi.status = 'pending_review' or public.media_blocking_tags(mi.id) > 0);

comment on view public.media_review_queue is
  'Pendientes de revisión y aprobados que quedaron bloqueados porque un padre retiró el consentimiento.';

revoke all on public.media_review_queue from public, anon, authenticated;
grant select on public.media_review_queue to authenticated;   -- RLS de media_items: solo admin ve todo

-- ---------------------------------------------------------------------------
-- Storage de la galería
--   media-uploads  privado · cuarentena: originales sin procesar, carpeta {user_id}/
--   match-media    privado · procesados; se sirven con URLs firmadas
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('media-uploads', 'media-uploads', false, 104857600,
   array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'video/mp4', 'video/quicktime', 'video/webm']),
  ('match-media',   'match-media',   false, 26214400,
   array['image/jpeg', 'image/webp', 'video/mp4'])
on conflict (id) do nothing;

create function public.can_view_media_object(p_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.media_items mi
    where (mi.storage_path = p_path or mi.thumbnail_path = p_path)
      and public.can_view_media(mi.id)
  );
$$;

-- Cuarentena: cada quien sube a su carpeta; solo el servidor (service role) la lee.
create policy "Cuarentena: subir a mi carpeta" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'media-uploads'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Cuarentena: borrar lo mío" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'media-uploads'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Procesados: leer solo si can_view_media; escribir solo el servidor o admin.
create policy "Galería: lectura permitida" on storage.objects
  for select to authenticated
  using (bucket_id = 'match-media' and public.can_view_media_object(name));

create policy "Galería: admin sube" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'match-media' and (select public.is_admin()));

create policy "Galería: admin actualiza" on storage.objects
  for update to authenticated
  using (bucket_id = 'match-media' and (select public.is_admin()))
  with check (bucket_id = 'match-media' and (select public.is_admin()));

create policy "Galería: admin elimina" on storage.objects
  for delete to authenticated
  using (bucket_id = 'match-media' and (select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Crónicas automáticas (API de Claude, solo servidor)
-- ---------------------------------------------------------------------------
create type public.chronicle_status as enum ('draft', 'published');

create table public.match_chronicles (
  match_id         uuid primary key references public.matches (id) on delete cascade,
  status           public.chronicle_status not null default 'draft',
  body             text not null check (char_length(body) between 1 and 2000),
  generated_body   text,                 -- texto original del modelo (auditoría)
  model            text,                 -- p. ej. 'claude-opus-5-5'
  prompt_version   text,                 -- versión del prompt usado
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
  'Crónica de 80–120 palabras, positiva, en español, solo nombre + inicial (U6/U8: solo equipo). Borrador hasta que un admin la aprueba.';

create function public.stamp_chronicle()
returns trigger
language plpgsql
set search_path = ''
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
create trigger match_chronicles_updated_at before update on public.match_chronicles
  for each row execute function public.set_updated_at();

alter table public.match_chronicles enable row level security;

create policy "Lectura pública de publicadas" on public.match_chronicles
  for select to anon, authenticated
  using (status = 'published' or (select public.is_admin()));
create policy "Admin gestiona crónicas" on public.match_chronicles
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Tarjetas de resultado: goleadores (nombre + inicial). Vacío en U6/U8.
-- ---------------------------------------------------------------------------
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

comment on view public.public_match_scorers is
  'Goleadores por partido para tarjetas y crónicas (solo nombre + inicial). Excluye U6/U8.';

revoke all on public.public_match_scorers from public, anon, authenticated;
grant select on public.public_match_scorers to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Certificados de temporada: SOLO la familia del niño (y admin), temporada cerrada.
-- En U6/U8 no hay números individuales: solo participación y valores.
-- ---------------------------------------------------------------------------
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

comment on view public.my_family_season_certificates is
  'Datos del certificado PDF. Solo familia vinculada o admin; solo temporadas cerradas. U6/U8: sin números individuales.';

revoke all on public.my_family_season_certificates from public, anon, authenticated;
grant select on public.my_family_season_certificates to authenticated;

-- Realtime: la galería del partido se actualiza al aprobarse contenido.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.media_items;
  end if;
end;
$$;
