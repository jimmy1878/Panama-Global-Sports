-- =============================================================================
-- Panama Global Sports · Migración 4 · Almacenamiento de imágenes
--
--   team-logos     público  · logos de equipos
--   player-photos  PRIVADO  · fotos de menores; solo se entregan si hay
--                             consentimiento (o al admin / al propio tutor)
--
-- La app debe quitar los metadatos EXIF (ubicación GPS) antes de subir fotos.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('team-logos',    'team-logos',    true,  1048576, array['image/png', 'image/jpeg', 'image/webp']),
  ('player-photos', 'player-photos', false, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

-- ¿Puede el usuario actual ver esta foto?
create function public.can_view_player_photo(p_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.players p
    where p.photo_path = p_path
      and (p.photo_consent or public.is_admin() or public.is_guardian_of(p.id))
  );
$$;

-- Logos: lectura pública por URL (bucket público); solo admin escribe.
create policy "Logos: admin sube" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'team-logos' and (select public.is_admin()));

create policy "Logos: admin actualiza" on storage.objects
  for update to authenticated
  using (bucket_id = 'team-logos' and (select public.is_admin()))
  with check (bucket_id = 'team-logos' and (select public.is_admin()));

create policy "Logos: admin elimina" on storage.objects
  for delete to authenticated
  using (bucket_id = 'team-logos' and (select public.is_admin()));

-- Fotos de jugadores: lectura solo con consentimiento; solo admin escribe.
create policy "Fotos: lectura con consentimiento" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'player-photos' and public.can_view_player_photo(name));

create policy "Fotos: admin sube" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'player-photos' and (select public.is_admin()));

create policy "Fotos: admin actualiza" on storage.objects
  for update to authenticated
  using (bucket_id = 'player-photos' and (select public.is_admin()))
  with check (bucket_id = 'player-photos' and (select public.is_admin()));

create policy "Fotos: admin elimina" on storage.objects
  for delete to authenticated
  using (bucket_id = 'player-photos' and (select public.is_admin()));
