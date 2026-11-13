-- =============================================================================
-- Panama Global Sports · Migración 8 · Equipos seguidos y notificaciones push
--
-- El envío (Web Push con claves VAPID) se hace en servidor con service role:
-- un cron diario para recordatorios y un aviso al finalizar cada partido.
-- notification_log evita mandar dos veces el mismo aviso.
-- =============================================================================

create type public.notification_kind as enum ('match_reminder', 'final_result', 'album_packs');

-- Equipos que sigue cada usuario
create table public.team_follows (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  team_id     uuid not null references public.teams (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, team_id)
);
create index team_follows_team_idx on public.team_follows (team_id);

-- Qué avisos quiere recibir cada usuario
create table public.notification_preferences (
  user_id         uuid primary key references public.profiles (id) on delete cascade,
  match_reminder  boolean not null default true,    -- "Tu equipo juega mañana 9:00 en Cancha 2"
  final_result    boolean not null default true,    -- "Final: Tigres 3 – Leones 1"
  album_packs     boolean not null default true,    -- fase álbum: sobres nuevos
  updated_at      timestamptz not null default now()
);
create trigger notification_preferences_updated_at before update on public.notification_preferences
  for each row execute function public.set_updated_at();

-- Suscripciones Web Push (una por navegador/dispositivo)
create table public.push_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  endpoint      text not null unique,
  p256dh        text not null,
  auth          text not null,
  user_agent    text,
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- Registro de envíos (solo servidor)
create table public.notification_log (
  id        bigint generated always as identity primary key,
  user_id   uuid not null references public.profiles (id) on delete cascade,
  kind      public.notification_kind not null,
  match_id  uuid references public.matches (id) on delete cascade,
  sent_at   timestamptz not null default now(),
  unique (user_id, kind, match_id)
);
create index notification_log_match_idx on public.notification_log (match_id);

-- Preferencias por defecto al registrarse (y para usuarios ya existentes)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  insert into public.notification_preferences (user_id) values (new.id);
  return new;
end;
$$;

insert into public.notification_preferences (user_id)
select id from public.profiles
on conflict (user_id) do nothing;

-- RLS: cada usuario gestiona solo lo suyo
alter table public.team_follows enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_log enable row level security;   -- sin políticas: solo service role

create policy "Mis equipos seguidos" on public.team_follows
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Seguir equipo" on public.team_follows
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Dejar de seguir" on public.team_follows
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "Ver mis preferencias" on public.notification_preferences
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Crear mis preferencias" on public.notification_preferences
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Editar mis preferencias" on public.notification_preferences
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "Ver mis suscripciones" on public.push_subscriptions
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Registrar suscripción" on public.push_subscriptions
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Actualizar suscripción" on public.push_subscriptions
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Eliminar suscripción" on public.push_subscriptions
  for delete to authenticated using (user_id = (select auth.uid()));

revoke all on public.team_follows, public.notification_preferences, public.push_subscriptions from anon;
revoke all on public.notification_log from anon, authenticated;
