-- =============================================================================
-- Panama Global Sports · 5/6 · Almacenamiento de archivos
--
--   team-logos     público  · logos de equipos
--   player-photos  PRIVADO  · fotos de perfil; solo con consentimiento (o admin/tutor)
--   media-uploads  PRIVADO  · cuarentena de la galería, carpeta {user_id}/; solo el servidor la lee
--   match-media    PRIVADO  · galería procesada (sin EXIF); URLs firmadas para familias de la liga
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('team-logos',    'team-logos',    true,  1048576,
   array['image/png', 'image/jpeg', 'image/webp']),
  ('player-photos', 'player-photos', false, 2097152,
   array['image/png', 'image/jpeg', 'image/webp']),
  ('media-uploads', 'media-uploads', false, 104857600,
   array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'video/mp4', 'video/quicktime', 'video/webm']),
  ('match-media',   'match-media',   false, 26214400,
   array['image/jpeg', 'image/webp', 'video/mp4'])
on conflict (id) do nothing;

create function public.can_view_player_photo(p_path text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.players p
    where p.photo_path = p_path
      and (p.photo_consent or public.is_admin() or public.is_guardian_of(p.id)));
$$;

create function public.can_view_media_object(p_path text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.media_items mi
    where (mi.storage_path = p_path or mi.thumbnail_path = p_path)
      and public.can_view_media(mi.id));
$$;

-- ---------------------------------------------------------------------------
-- team-logos y player-photos: solo admin escribe
-- ---------------------------------------------------------------------------
do $$
declare b text;
begin
  foreach b in array array['team-logos', 'player-photos', 'match-media'] loop
    execute format($f$create policy %I on storage.objects for insert to authenticated
      with check (bucket_id = %L and (select public.is_admin()))$f$, b || ': admin sube', b);
    execute format($f$create policy %I on storage.objects for update to authenticated
      using (bucket_id = %L and (select public.is_admin()))
      with check (bucket_id = %L and (select public.is_admin()))$f$, b || ': admin actualiza', b, b);
    execute format($f$create policy %I on storage.objects for delete to authenticated
      using (bucket_id = %L and (select public.is_admin()))$f$, b || ': admin elimina', b);
  end loop;
end;
$$;

-- Lectura de fotos de perfil: solo con consentimiento
create policy "player-photos: lectura con consentimiento" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'player-photos' and public.can_view_player_photo(name));

-- Galería procesada: lectura según can_view_media (familias de la liga, admin, quien subió)
create policy "match-media: lectura permitida" on storage.objects
  for select to authenticated
  using (bucket_id = 'match-media' and public.can_view_media_object(name));

-- Cuarentena: cada quien sube y borra solo en su carpeta; nadie la lee desde la app
create policy "media-uploads: subir a mi carpeta" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'media-uploads' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "media-uploads: borrar lo mío" on storage.objects
  for delete to authenticated
  using (bucket_id = 'media-uploads' and (storage.foldername(name))[1] = (select auth.uid())::text);
