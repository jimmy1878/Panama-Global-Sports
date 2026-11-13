-- =============================================================================
-- Panama Global Sports · Datos de PRUEBA (ficticios)
--
-- Requiere haber ejecutado antes las 5 migraciones (que crean el deporte, las
-- 2 ligas, las 10 categorías reales y los tipos de evento).
--
-- Crea:
--   · 5 temporadas de 2026 (la 5 es la actual)
--   · 3 canchas
--   · 6 equipos por categoría (60 equipos) en la temporada actual
--   · 12–18 jugadores ficticios por equipo (nombre + inicial, sin foto)
--   · calendario todos-contra-todos (5 jornadas); jornadas 1–3 jugadas con
--     resultados y eventos (goles, asistencias, atajadas, fair play, tarjetas)
--
-- Solo para una base vacía: si ya hay temporadas, se detiene sin tocar nada.
-- =============================================================================

do $$
declare
  boy_names text[] := array[
    'Mateo','Santiago','Sebastián','Diego','Gabriel','Lucas','Daniel','Samuel',
    'Thiago','Emiliano','Nicolás','Joaquín','Martín','Alejandro','Andrés','Adrián',
    'Isaac','Benjamín','Tomás','Miguel','Ángel','David','Luis','Carlos',
    'Juan','José','Fernando','Ricardo','Eduardo','Iker','Dylan','Kevin',
    'Josué','Elías','Aarón','Liam','Gael','Emmanuel','Rodrigo','Julián'
  ];
  girl_names text[] := array[
    'Sofía','Valentina','Isabella','Camila','Mariana','Lucía','Victoria','Daniela',
    'Gabriela','Valeria','Natalia','Sara','Ana','María','Paula','Emma',
    'Mía','Renata','Antonella','Ximena','Abigail','Fernanda','Andrea','Alejandra',
    'Carolina','Juliana','Laura','Elena','Regina','Martina','Allison','Ashley',
    'Nicole','Melany','Kiara','Ariana','Luciana','Samantha','Paola','Diana'
  ];
  initials text[] := array[
    'A','B','C','D','E','F','G','H','I','J','L','M','N','O','P','Q','R','S','T','V','Z'
  ];
  boys_clubs jsonb := '[
    {"name":"Tiburones FC","short":"TIB","c1":"#0B4F8A","c2":"#FFFFFF"},
    {"name":"Halcones FC","short":"HAL","c1":"#7A1F1F","c2":"#F2C230"},
    {"name":"Jaguares FC","short":"JAG","c1":"#1F6B3A","c2":"#000000"},
    {"name":"Toros FC","short":"TOR","c1":"#C1272D","c2":"#FFFFFF"},
    {"name":"Cóndores FC","short":"CON","c1":"#2B2B2B","c2":"#E5E5E5"},
    {"name":"Pumas FC","short":"PUM","c1":"#E67E22","c2":"#1B2631"}
  ]';
  girls_clubs jsonb := '[
    {"name":"Panteras FC","short":"PAN","c1":"#4A235A","c2":"#F5B7B1"},
    {"name":"Gaviotas FC","short":"GAV","c1":"#2E86C1","c2":"#FFFFFF"},
    {"name":"Estrellas FC","short":"EST","c1":"#F1C40F","c2":"#1A5276"},
    {"name":"Delfines FC","short":"DEL","c1":"#17A589","c2":"#FFFFFF"},
    {"name":"Lobas FC","short":"LOB","c1":"#566573","c2":"#E74C3C"},
    {"name":"Águilas FC","short":"AGU","c1":"#B9770E","c2":"#FDFEFE"}
  ]';
  positions text[] := array['Defensa','Mediocampista','Delantero'];

  v_season uuid;
  v_venues uuid[];
  et_goal smallint; et_assist smallint; et_save smallint;
  et_fair smallint; et_yellow smallint; et_red smallint;

  cat record;
  club jsonb;
  v_names text[];
  v_team uuid;
  v_player uuid;
  team_ids uuid[];
  rot uuid[];
  pairs uuid[][];
  v_match uuid;
  v_home uuid; v_away uuid;
  v_hs int; v_as int;
  v_side_team uuid; v_side_goals int;
  field uuid[]; whole uuid[]; v_gk uuid;
  v_scorer uuid; v_assister uuid;
  v_minute int;
  cat_idx int := 0;
  n int; i int; r int; p int; k int; side int;
begin
  if exists (select 1 from public.seasons) then
    raise exception 'La base ya tiene temporadas. Este seed es solo para una base vacía.';
  end if;
  if not exists (select 1 from public.categories) then
    raise exception 'No hay categorías. Ejecuta primero las migraciones.';
  end if;

  perform setseed(0.2026);  -- datos aleatorios pero reproducibles

  -- Temporadas 2026
  insert into public.seasons (year, number, name, starts_on, ends_on, is_current) values
    (2026, 1, 'Temporada 1 · 2026', '2026-01-12', '2026-03-15', false),
    (2026, 2, 'Temporada 2 · 2026', '2026-03-23', '2026-05-24', false),
    (2026, 3, 'Temporada 3 · 2026', '2026-06-01', '2026-08-02', false),
    (2026, 4, 'Temporada 4 · 2026', '2026-08-10', '2026-10-11', false),
    (2026, 5, 'Temporada 5 · 2026', '2026-10-19', '2026-12-20', true);
  select id into v_season from public.seasons where is_current;

  -- Canchas (ficticias)
  with ins as (
    insert into public.venues (name, address) values
      ('Cancha Norte',   'Dirección de prueba 1, Ciudad de Panamá'),
      ('Cancha Central', 'Dirección de prueba 2, Ciudad de Panamá'),
      ('Cancha Sur',     'Dirección de prueba 3, Ciudad de Panamá')
    returning id, name
  )
  select array_agg(id order by name) into v_venues from ins;

  select id into et_goal   from public.event_types where code = 'goal';
  select id into et_assist from public.event_types where code = 'assist';
  select id into et_save   from public.event_types where code = 'save';
  select id into et_fair   from public.event_types where code = 'fair_play';
  select id into et_yellow from public.event_types where code = 'yellow_card';
  select id into et_red    from public.event_types where code = 'red_card';

  for cat in
    select c.id, c.code, l.gender
    from public.categories c
    join public.leagues l on l.id = c.league_id
    order by l.sort_order, c.sort_order
  loop
    team_ids := '{}';
    v_names := case when cat.gender = 'girls' then girl_names else boy_names end;

    -- 6 equipos con 12–18 jugadores
    for club in
      select value from jsonb_array_elements(
        case when cat.gender = 'girls' then girls_clubs else boys_clubs end)
    loop
      insert into public.teams (season_id, category_id, name, slug, short_name, primary_color, secondary_color)
      values (
        v_season, cat.id,
        club ->> 'name',
        lower(club ->> 'short') || '-' || lower(cat.code),
        club ->> 'short',
        club ->> 'c1',
        club ->> 'c2'
      )
      returning id into v_team;
      team_ids := team_ids || v_team;

      n := 12 + floor(random() * 7)::int;
      for i in 1..n loop
        insert into public.players (first_name, last_initial, photo_consent)
        values (
          v_names[1 + floor(random() * array_length(v_names, 1))::int],
          initials[1 + floor(random() * array_length(initials, 1))::int],
          random() < 0.6
        )
        returning id into v_player;

        insert into public.roster_entries (team_id, season_id, player_id, jersey_number, position)
        values (
          v_team, v_season, v_player, i,
          case when i = 1 then 'Portero' else positions[1 + floor(random() * 3)::int] end
        );
      end loop;
    end loop;

    -- Calendario todos contra todos (método del círculo): 5 jornadas × 3 partidos
    for r in 0..4 loop
      rot := array[]::uuid[];
      for k in 0..4 loop
        rot := rot || team_ids[2 + ((k + r) % 5)];
      end loop;
      pairs := array[
        array[team_ids[1], rot[1]],
        array[rot[2], rot[5]],
        array[rot[3], rot[4]]
      ];

      for p in 1..3 loop
        if (r + p) % 2 = 0 then
          v_home := pairs[p][1]; v_away := pairs[p][2];
        else
          v_home := pairs[p][2]; v_away := pairs[p][1];
        end if;

        -- Sábados desde el 24-oct-2026; cada categoría a una hora, cada partido en una cancha.
        if r < 3 then
          v_hs := floor(random() * 5)::int;
          v_as := floor(random() * 5)::int;
        else
          v_hs := null; v_as := null;
        end if;

        insert into public.matches (
          season_id, category_id, home_team_id, away_team_id, venue_id,
          starts_at, matchday, status, home_score, away_score
        ) values (
          v_season, cat.id, v_home, v_away, v_venues[p],
          ((date '2026-10-24' + r * 7) + time '08:00' + cat_idx * interval '1 hour')
            at time zone 'America/Panama',
          r + 1,
          case when r < 3 then 'finished' else 'scheduled' end::public.match_status,
          v_hs, v_as
        )
        returning id into v_match;

        continue when r >= 3;

        -- Eventos de cada equipo
        for side in 1..2 loop
          if side = 1 then
            v_side_team := v_home; v_side_goals := v_hs;
          else
            v_side_team := v_away; v_side_goals := v_as;
          end if;

          select array_agg(player_id) filter (where jersey_number <> 1),
                 array_agg(player_id),
                 (array_agg(player_id) filter (where jersey_number = 1))[1]
            into field, whole, v_gk
          from public.roster_entries where team_id = v_side_team;

          -- Goles (+ asistencia el 60 % de las veces)
          for k in 1..v_side_goals loop
            v_minute := 1 + floor(random() * 50)::int;
            v_scorer := field[1 + floor(random() * array_length(field, 1))::int];
            insert into public.match_events (match_id, team_id, player_id, event_type_id, minute)
            values (v_match, v_side_team, v_scorer, et_goal, v_minute);

            if random() < 0.6 then
              loop
                v_assister := field[1 + floor(random() * array_length(field, 1))::int];
                exit when v_assister <> v_scorer;
              end loop;
              insert into public.match_events (match_id, team_id, player_id, event_type_id, minute)
              values (v_match, v_side_team, v_assister, et_assist, v_minute);
            end if;
          end loop;

          -- Atajadas del portero (0–4)
          for k in 1..floor(random() * 5)::int loop
            insert into public.match_events (match_id, team_id, player_id, event_type_id, minute)
            values (v_match, v_side_team, v_gk, et_save, 1 + floor(random() * 50)::int);
          end loop;

          -- Fair play (50 %), amarilla (15 %), roja (3 %)
          if random() < 0.5 then
            insert into public.match_events (match_id, team_id, player_id, event_type_id)
            values (v_match, v_side_team, whole[1 + floor(random() * array_length(whole, 1))::int], et_fair);
          end if;
          if random() < 0.15 then
            insert into public.match_events (match_id, team_id, player_id, event_type_id, minute)
            values (v_match, v_side_team, field[1 + floor(random() * array_length(field, 1))::int], et_yellow,
                    1 + floor(random() * 50)::int);
          end if;
          if random() < 0.03 then
            insert into public.match_events (match_id, team_id, player_id, event_type_id, minute)
            values (v_match, v_side_team, field[1 + floor(random() * array_length(field, 1))::int], et_red,
                    1 + floor(random() * 50)::int);
          end if;
        end loop;
      end loop;
    end loop;

    cat_idx := cat_idx + 1;
  end loop;

  raise notice 'Seed listo: % equipos, % jugadores, % partidos, % eventos',
    (select count(*) from public.teams),
    (select count(*) from public.players),
    (select count(*) from public.matches),
    (select count(*) from public.match_events);
end;
$$;
