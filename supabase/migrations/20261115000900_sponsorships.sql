-- =============================================================================
-- Panama Global Sports · 9 · Patrocinios
--
-- La fuente principal de ingresos (sección 5 de la especificación). Un
-- patrocinador se asigna a un ESPACIO dentro de un ÁMBITO y unas fechas, y el
-- código solo pregunta "¿quién va en este espacio para esta página, hoy?".
--
--   sponsors              la marca
--   sponsorship_tiers     niveles (titular, liga, torneo, espacio destacado)
--   sponsorship_slots     catálogo de espacios (liga_header, partido_pagina…)
--   sponsorship_contracts el acuerdo comercial
--   sponsorship_placements qué logo va en qué espacio, dónde y cuándo
--   sponsorship_metrics   impresiones y clics por día, para el reporte
--
-- Reglas del documento que impone la base, no la interfaz:
--   · gana el ámbito más específico: categoría > torneo > circuito > liga > organización;
--   · en los niveles exclusivos no se pueden cruzar fechas en el mismo espacio y ámbito;
--   · un espacio sin asignación activa simplemente no se muestra.
-- La portada no lleva patrocinios: eso lo cumple el código, que no pinta
-- ningún espacio ahí.
-- =============================================================================

create type public.sponsorship_scope as enum
  ('organizacion', 'liga', 'circuito', 'torneo', 'categoria');

create type public.contract_status as enum ('borrador', 'activo', 'vencido');

-- ---------------------------------------------------------------------------
-- Catálogos y marcas
-- ---------------------------------------------------------------------------
create table public.sponsors (
  id             uuid primary key default gen_random_uuid(),
  name           text not null check (char_length(name) between 1 and 120),
  logo_path      text,                       -- bucket sponsor-logos
  logo_dark_path text,                       -- versión para fondo oscuro (navy)
  website        text,
  contact_name   text,
  contact_email  text,
  active         boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
comment on table public.sponsors is 'La marca que patrocina. Los datos de contacto son de adultos, nunca de familias.';

create table public.sponsorship_tiers (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name            text not null,
  sort_order      smallint not null default 0,
  exclusive       boolean not null default true,
  reference_price numeric(10, 2),            -- precio por definir con la liga
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
comment on table public.sponsorship_tiers is 'Niveles de la tabla del documento. Los precios los acuerda la liga.';

create table public.sponsorship_slots (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique check (code ~ '^[a-z_]+$'),
  name        text not null,
  description text,
  format      text,                          -- "Logo mediano", "Imagen de figurita"…
  width_px    smallint,
  height_px   smallint,
  sort_order  smallint not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table public.sponsorship_slots is
  'Catálogo de espacios. El código pide un espacio por su `code`; añadir uno nuevo es una fila, no un despliegue.';

-- ---------------------------------------------------------------------------
-- Contratos y asignaciones
-- ---------------------------------------------------------------------------
create table public.sponsorship_contracts (
  id          uuid primary key default gen_random_uuid(),
  sponsor_id  uuid not null references public.sponsors (id) on delete cascade,
  tier_id     uuid not null references public.sponsorship_tiers (id) on delete restrict,
  starts_on   date not null,
  ends_on     date not null,
  amount      numeric(10, 2),
  status      public.contract_status not null default 'borrador',
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (ends_on >= starts_on)
);
create index sponsorship_contracts_sponsor_idx on public.sponsorship_contracts (sponsor_id);

create table public.sponsorship_placements (
  id              uuid primary key default gen_random_uuid(),
  contract_id     uuid not null references public.sponsorship_contracts (id) on delete cascade,
  slot_id         uuid not null references public.sponsorship_slots (id) on delete restrict,
  scope           public.sponsorship_scope not null,
  -- Referencia polimórfica: organizations, leagues, circuits, tournaments o
  -- categories según `scope`. Un trigger comprueba que la fila exista.
  scope_id        uuid not null,
  starts_on       date not null,
  ends_on         date not null,
  priority        smallint not null default 0,
  rotation_weight smallint not null default 1 check (rotation_weight between 1 and 100),
  image_path      text,                      -- si no, se usa el logo del patrocinador
  text            text,                      -- "presentado por", descripción del premio…
  link_url        text,
  -- Copiado del nivel para poder imponer la exclusividad sin mirar dos tablas
  exclusive       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (ends_on >= starts_on)
);
create index sponsorship_placements_slot_idx on public.sponsorship_placements (slot_id, scope, scope_id);
create index sponsorship_placements_contract_idx on public.sponsorship_placements (contract_id);
comment on table public.sponsorship_placements is
  'Qué logo va en qué espacio, en qué ámbito y entre qué fechas. Sin tocar código.';

create table public.sponsorship_metrics (
  placement_id uuid not null references public.sponsorship_placements (id) on delete cascade,
  day          date not null,
  impressions  integer not null default 0 check (impressions >= 0),
  clicks       integer not null default 0 check (clicks >= 0),
  primary key (placement_id, day)
);
comment on table public.sponsorship_metrics is
  'Resumen diario. Es el argumento para renovar y subir precios; nunca se escribe a mano.';

-- ---------------------------------------------------------------------------
-- Reglas
-- ---------------------------------------------------------------------------

-- El ámbito apunta a una fila que existe de verdad
create function public.check_placement_scope()
returns trigger language plpgsql set search_path = ''
as $$
declare ok boolean;
begin
  select case new.scope
    when 'organizacion' then exists (select 1 from public.organizations where id = new.scope_id)
    when 'liga'         then exists (select 1 from public.leagues       where id = new.scope_id)
    when 'circuito'     then exists (select 1 from public.circuits      where id = new.scope_id)
    when 'torneo'       then exists (select 1 from public.tournaments   where id = new.scope_id)
    when 'categoria'    then exists (select 1 from public.categories    where id = new.scope_id)
  end into ok;
  if not ok then
    raise exception 'El ámbito % no apunta a ninguna fila existente', new.scope
      using errcode = '23503';
  end if;
  return new;
end;
$$;

create trigger sponsorship_placements_scope
  before insert or update of scope, scope_id on public.sponsorship_placements
  for each row execute function public.check_placement_scope();

-- La exclusividad del nivel viaja a la asignación, y dos exclusivas no pueden
-- cruzarse en el mismo espacio y ámbito.
create function public.guard_placement_exclusivity()
returns trigger language plpgsql set search_path = ''
as $$
declare conflicto uuid;
begin
  select t.exclusive into new.exclusive
  from public.sponsorship_contracts c
  join public.sponsorship_tiers t on t.id = c.tier_id
  where c.id = new.contract_id;

  if not new.exclusive then
    return new;
  end if;

  select p.id into conflicto
  from public.sponsorship_placements p
  where p.id <> new.id
    and p.exclusive
    and p.slot_id = new.slot_id
    and p.scope = new.scope
    and p.scope_id = new.scope_id
    and daterange(p.starts_on, p.ends_on, '[]') && daterange(new.starts_on, new.ends_on, '[]')
  limit 1;

  if conflicto is not null then
    raise exception 'Ese espacio ya tiene un patrocinador exclusivo en esas fechas'
      using errcode = '23505';
  end if;
  return new;
end;
$$;

create trigger sponsorship_placements_exclusivity
  before insert or update on public.sponsorship_placements
  for each row execute function public.guard_placement_exclusivity();

do $$
declare t text;
begin
  foreach t in array array[
    'sponsors', 'sponsorship_tiers', 'sponsorship_slots',
    'sponsorship_contracts', 'sponsorship_placements'
  ] loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      t || '_updated_at', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS: el público no toca ninguna de estas tablas; lee la vista de abajo
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'sponsors', 'sponsorship_tiers', 'sponsorship_slots',
    'sponsorship_contracts', 'sponsorship_placements', 'sponsorship_metrics'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "Admin lee %1$s" on public.%1$I for select to authenticated using ((select public.is_admin()))', t);
    execute format(
      'create policy "Admin escribe %1$s" on public.%1$I for insert to authenticated with check ((select public.is_admin()))', t);
    execute format(
      'create policy "Admin actualiza %1$s" on public.%1$I for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))', t);
    execute format(
      'create policy "Admin borra %1$s" on public.%1$I for delete to authenticated using ((select public.is_admin()))', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Vistas
-- ---------------------------------------------------------------------------

-- Lo que el público puede ver: solo asignaciones vigentes HOY (hora de Panamá)
-- de contratos activos. Nada de montos, contactos ni fechas del contrato.
create view public.active_sponsor_placements
with (security_invoker = false, security_barrier = true)
as
select
  p.id,
  s.code            as slot_code,
  s.format          as slot_format,
  p.scope,
  p.scope_id,
  p.priority,
  p.rotation_weight,
  p.text,
  p.link_url,
  coalesce(p.image_path, sp.logo_path) as image_path,
  sp.logo_dark_path,
  sp.name           as sponsor_name
from public.sponsorship_placements p
join public.sponsorship_slots s      on s.id = p.slot_id and s.active
join public.sponsorship_contracts c  on c.id = p.contract_id
join public.sponsors sp              on sp.id = c.sponsor_id and sp.active
where c.status = 'activo'
  and (now() at time zone 'America/Panama')::date between p.starts_on and p.ends_on
  and (now() at time zone 'America/Panama')::date between c.starts_on and c.ends_on;

comment on view public.active_sponsor_placements is
  'Lo vigente hoy. El código elige el ámbito más específico y rota por peso.';

-- Reporte por contrato: el argumento para renovar. Solo admin (RLS de las tablas).
create view public.sponsorship_contract_report
with (security_invoker = true)
as
select
  c.id            as contract_id,
  c.status,
  c.starts_on,
  c.ends_on,
  c.amount,
  sp.name         as sponsor_name,
  t.name          as tier_name,
  count(distinct p.id)::int                  as placements,
  coalesce(sum(m.impressions), 0)::bigint    as impressions,
  coalesce(sum(m.clicks), 0)::bigint         as clicks
from public.sponsorship_contracts c
join public.sponsors sp          on sp.id = c.sponsor_id
join public.sponsorship_tiers t  on t.id = c.tier_id
left join public.sponsorship_placements p on p.contract_id = c.id
left join public.sponsorship_metrics m    on m.placement_id = p.id
group by c.id, c.status, c.starts_on, c.ends_on, c.amount, sp.name, t.name;

-- ---------------------------------------------------------------------------
-- Métricas: se escriben solo por esta función, nunca con una política abierta
-- ---------------------------------------------------------------------------
create function public.record_sponsor_event(p_placement uuid, p_kind text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if p_kind not in ('impression', 'click') then
    raise exception 'Tipo de evento inválido' using errcode = '22023';
  end if;

  -- Si la asignación no está vigente hoy, no se cuenta nada (y no se avisa:
  -- es una llamada del navegador, no una acción del usuario).
  if not exists (select 1 from public.active_sponsor_placements v where v.id = p_placement) then
    return;
  end if;

  insert into public.sponsorship_metrics (placement_id, day, impressions, clicks)
  values (
    p_placement,
    (now() at time zone 'America/Panama')::date,
    case when p_kind = 'impression' then 1 else 0 end,
    case when p_kind = 'click' then 1 else 0 end
  )
  on conflict (placement_id, day) do update
    set impressions = public.sponsorship_metrics.impressions + excluded.impressions,
        clicks      = public.sponsorship_metrics.clicks + excluded.clicks;
end;
$$;

grant select on public.active_sponsor_placements to anon, authenticated;
grant execute on function public.record_sponsor_event(uuid, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Almacenamiento: logos de patrocinadores (públicos, como los de los equipos)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sponsor-logos', 'sponsor-logos', true, 1048576,
        array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy "sponsor-logos: admin sube" on storage.objects for insert to authenticated
  with check (bucket_id = 'sponsor-logos' and (select public.is_admin()));
create policy "sponsor-logos: admin actualiza" on storage.objects for update to authenticated
  using (bucket_id = 'sponsor-logos' and (select public.is_admin()))
  with check (bucket_id = 'sponsor-logos' and (select public.is_admin()));
create policy "sponsor-logos: admin elimina" on storage.objects for delete to authenticated
  using (bucket_id = 'sponsor-logos' and (select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Datos de referencia: los niveles y los espacios del documento
-- ---------------------------------------------------------------------------
insert into public.sponsorship_tiers (slug, name, sort_order, exclusive) values
  ('titular-temporada',   'Titular de temporada',   1, true),
  ('patrocinador-liga',   'Patrocinador de liga',   2, true),
  ('patrocinador-torneo', 'Patrocinador de torneo', 3, true),
  ('espacio-destacado',   'Espacio destacado',      4, true)
on conflict (slug) do nothing;

insert into public.sponsorship_slots (code, name, description, format, sort_order) values
  ('liga_header',     'Encabezado de liga',   'Encabezado de las páginas de una liga y sus categorías', 'Logo mediano', 1),
  ('torneo_header',   'Encabezado de torneo', 'Encabezado de las páginas de un torneo, también en el historial', 'Logo mediano', 2),
  ('partido_pagina',  'Página de partido',    'Página de partido, junto al marcador', 'Logo pequeño + "presentado por"', 3),
  ('album_portada',   'Portada del álbum',    'Portada del álbum digital', 'Logo grande', 4),
  ('album_figurita',  'Figurita especial',    'Figurita especial del patrocinador en el álbum', 'Imagen de figurita', 5),
  ('album_sobre',     'Sobre de figuritas',   'Diseño del sobre de figuritas', 'Imagen', 6),
  ('fantasy_premio',  'Premio del fantasy',   'Premio de la jornada o la temporada en el fantasy', 'Logo + descripción del premio', 7)
on conflict (code) do nothing;
