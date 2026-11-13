-- =============================================================================
-- Panama Global Sports · Migración 5 · Datos de referencia reales
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

insert into public.categories (league_id, code, name, max_age, sort_order)
select l.id, c.code, 'Sub-' || substr(c.code, 2), substr(c.code, 2)::smallint, c.sort_order
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

-- Puntos por evento (solo positivos; ajustables por un admin).
insert into public.event_types (sport_id, code, name, points, sort_order)
select s.id, v.code, v.name, v.points, v.sort_order
from public.sports s
cross join (values
  ('goal',        'Gol',             3, 1),
  ('assist',      'Asistencia',      2, 2),
  ('save',        'Atajada',         1, 3),
  ('fair_play',   'Fair play',       2, 4),
  ('yellow_card', 'Tarjeta amarilla', 0, 5),
  ('red_card',    'Tarjeta roja',    0, 6)
) as v (code, name, points, sort_order)
where s.slug = 'futbol';
