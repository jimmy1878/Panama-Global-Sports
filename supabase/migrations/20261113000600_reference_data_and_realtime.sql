-- =============================================================================
-- Panama Global Sports · 6/6 · Datos de referencia reales y Realtime
-- (también se necesitan en producción, por eso van en una migración y no en el seed)
-- =============================================================================

insert into public.sports (slug, name) values ('futbol', 'Fútbol');

insert into public.leagues (sport_id, slug, name, gender, sort_order)
select s.id, v.slug, v.name, v.gender::public.league_gender, v.sort_order
from public.sports s
cross join (values
  ('boys-champion-league',  'Boys Champion League',  'boys',  1),
  ('girls-champion-league', 'Girls Champion League', 'girls', 2)
) as v (slug, name, gender, sort_order)
where s.slug = 'futbol';

-- U6 y U8: modo estrellas (sin ranking individual). U10+: ranking individual.
insert into public.categories (league_id, code, name, max_age, recognition_mode, sort_order)
select l.id, c.code, 'Sub-' || substr(c.code, 2), substr(c.code, 2)::smallint,
       case when c.code in ('U6', 'U8') then 'team_stars' else 'individual_ranking' end::public.recognition_mode,
       c.sort_order
from public.leagues l
join (values
  ('boys-champion-league',  'U6',  1),
  ('boys-champion-league',  'U8',  2),
  ('boys-champion-league',  'U10', 3),
  ('boys-champion-league',  'U12', 4),
  ('boys-champion-league',  'U14', 5),
  ('girls-champion-league', 'U8',  1),
  ('girls-champion-league', 'U10', 2),
  ('girls-champion-league', 'U12', 3),
  ('girls-champion-league', 'U14', 4),
  ('girls-champion-league', 'U17', 5)
) as c (league_slug, code, sort_order) on c.league_slug = l.slug;

-- Puntos por evento (solo positivos; ajustables por un admin)
insert into public.event_types (sport_id, code, name, points, is_award, sort_order)
select s.id, v.code, v.name, v.points, v.is_award, v.sort_order
from public.sports s
cross join (values
  ('goal',        'Gol',                 3, false, 1),
  ('assist',      'Asistencia',          2, false, 2),
  ('save',        'Atajada',             1, false, 3),
  ('fair_play',   'Fair play',           2, false, 4),
  ('yellow_card', 'Tarjeta amarilla',    0, false, 5),
  ('red_card',    'Tarjeta roja',        0, false, 6),
  ('own_goal',    'Autogol',             0, false, 7),
  ('mvp',         'Jugador del partido', 3, true,  8)
) as v (code, name, points, is_award, sort_order)
where s.slug = 'futbol';

-- Realtime: marcador en vivo, MVP y galería (la publicación solo existe en Supabase)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime
      add table public.matches, public.match_events, public.match_mvps, public.media_items;
  end if;
end;
$$;
