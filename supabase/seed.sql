-- =============================================================================
-- Panama Global Sports · Datos de PRUEBA (ficticios)
--
-- Requiere haber ejecutado antes las migraciones (crean el deporte, las 2 ligas,
-- las 10 categorías reales, los circuitos, los tipos de torneo y los eventos).
--
-- Crea la estructura real de la liga en 2026:
--   · Boys  · Escolares · Apertura 2026      finalizado   (historial, solo U10)
--   · Boys  · Escolares · Clausura 2026      en curso     (las 5 categorías)
--   · Boys  · Academias · Clausura 2026      en curso     (U10 y U12)
--   · Girls · Escolares · Clausura 2026      en curso     (las 5 categorías)
--   · Girls · Academias · Clausura 2026      próximo      (sin equipos todavía)
--   · Boys  · Academias · Copa de Navidad    inscripciones
--   · Girls · Academias · Copa de Navidad    inscripciones
--
-- Boys tiene DOS torneos en curso a la vez (Escolares y Academias) a propósito:
-- es el caso que la portada muestra como "También en curso".
--
-- Por cada torneo con categorías: 6 equipos, 12–18 jugadores ficticios por
-- equipo, calendario todos contra todos de 5 jornadas con resultados, eventos
-- y un MVP por equipo.
--
-- Solo para una base vacía: si ya hay torneos, se detiene sin tocar nada.
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
    {"name":"Tiburones FC","short":"TIB","c1":"#0B4F8A","c2":"#FFFFFF","club":"Academia Tiburones"},
    {"name":"Halcones FC","short":"HAL","c1":"#7A1F1F","c2":"#F2C230","club":"Colegio San Marcos"},
    {"name":"Jaguares FC","short":"JAG","c1":"#1F6B3A","c2":"#000000","club":"Academia Jaguar"},
    {"name":"Toros FC","short":"TOR","c1":"#C1272D","c2":"#FFFFFF","club":"Colegio La Salle"},
    {"name":"Cóndores FC","short":"CON","c1":"#2B2B2B","c2":"#E5E5E5","club":"Academia Cóndor"},
    {"name":"Pumas FC","short":"PUM","c1":"#E67E22","c2":"#1B2631","club":"Colegio Javier"}
  ]';
  girls_clubs jsonb := '[
    {"name":"Panteras FC","short":"PAN","c1":"#4A235A","c2":"#F5B7B1","club":"Academia Pantera"},
    {"name":"Gaviotas FC","short":"GAV","c1":"#2E86C1","c2":"#FFFFFF","club":"Colegio del Mar"},
    {"name":"Estrellas FC","short":"EST","c1":"#F1C40F","c2":"#1A5276","club":"Academia Estrella"},
    {"name":"Delfines FC","short":"DEL","c1":"#17A589","c2":"#FFFFFF","club":"Colegio Santa Ana"},
    {"name":"Lobas FC","short":"LOB","c1":"#566573","c2":"#E74C3C","club":"Academia Loba"},
    {"name":"Águilas FC","short":"AGU","c1":"#B9770E","c2":"#FDFEFE","club":"Colegio Real"}
  ]';
  positions text[] := array['Defensa','Mediocampista','Delantero'];

  v_venues uuid[];
  et_goal smallint; et_assist smallint; et_save smallint;
  et_fair smallint; et_yellow smallint; et_red smallint;

  tour record;
  cat record;
  club jsonb;
  v_names text[];
  v_team uuid;
  v_player uuid;
  v_matchdays uuid[];
  v_played int;             -- cuántas jornadas se jugaron en este torneo
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
  v_kickoff timestamptz;
  cat_idx int;
  n int; i int; r int; p int; k int; side int;
begin
  if exists (select 1 from public.tournaments) then
    raise exception 'La base ya tiene torneos. Este seed es solo para una base vacía.';
  end if;
  if not exists (select 1 from public.categories) then
    raise exception 'No hay categorías. Ejecuta primero las migraciones.';
  end if;

  perform setseed(0.2026);  -- datos aleatorios pero reproducibles

  -- ---------------------------------------------------------------------
  -- Torneos de 2026
  -- ---------------------------------------------------------------------
  insert into public.tournaments (
    league_id, circuit_id, tournament_type_id, year, slug, name,
    starts_on, ends_on, status, finished_at, registration_opens_on, registration_closes_on
  )
  select
    (select id from public.leagues where slug = d.league),
    (select id from public.circuits where slug = d.circuit),
    (select id from public.tournament_types where slug = d.kind),
    2026, d.slug, d.name, d.starts_on, d.ends_on, d.status::public.tournament_status,
    case when d.status = 'finalizado' then (d.ends_on + time '18:00') at time zone 'America/Panama' end,
    d.reg_opens, d.reg_closes
  from (values
    ('boys',  'escolares', 'apertura',     'escolares-apertura-2026',  'Escolares · Apertura 2026',       date '2026-03-07', date '2026-06-13', 'finalizado',    null::date,        null::date),
    ('boys',  'escolares', 'clausura',     'escolares-clausura-2026',  'Escolares · Clausura 2026',       date '2026-10-24', date '2026-12-19', 'en_curso',      null,              null),
    ('boys',  'academias', 'clausura',     'academias-clausura-2026',  'Academias · Clausura 2026',       date '2026-10-31', date '2026-12-19', 'en_curso',      null,              null),
    ('girls', 'escolares', 'clausura',     'escolares-clausura-2026',  'Escolares · Clausura 2026',       date '2026-10-24', date '2026-12-19', 'en_curso',      null,              null),
    ('girls', 'academias', 'clausura',     'academias-clausura-2026',  'Academias · Clausura 2026',       date '2027-01-16', date '2027-03-20', 'proximo',       null,              null),
    ('boys',  'academias', 'copa-navidad', 'copa-navidad-2026',        'Academias · Copa de Navidad 2026', date '2026-12-05', date '2026-12-20', 'inscripciones', date '2026-11-01', date '2026-11-28'),
    ('girls', 'academias', 'copa-navidad', 'copa-navidad-2026',        'Academias · Copa de Navidad 2026', date '2026-12-05', date '2026-12-20', 'inscripciones', date '2026-11-01', date '2026-11-28')
  ) as d (league, circuit, kind, slug, name, starts_on, ends_on, status, reg_opens, reg_closes);

  -- Categorías que juega cada torneo
  -- Boys · Escolares · Apertura (historial): solo U10
  insert into public.tournament_categories (tournament_id, category_id, league_id)
  select t.id, c.id, c.league_id
  from public.tournaments t
  join public.leagues l   on l.id = t.league_id and l.slug = 'boys'
  join public.categories c on c.league_id = t.league_id and c.code = 'U10'
  where t.slug = 'escolares-apertura-2026';

  -- Boys · Academias · Clausura: U10 y U12
  insert into public.tournament_categories (tournament_id, category_id, league_id)
  select t.id, c.id, c.league_id
  from public.tournaments t
  join public.leagues l   on l.id = t.league_id and l.slug = 'boys'
  join public.categories c on c.league_id = t.league_id and c.code in ('U10', 'U12')
  where t.slug = 'academias-clausura-2026';

  -- Los dos Clausura de Escolares: todas las categorías de su liga
  insert into public.tournament_categories (tournament_id, category_id, league_id)
  select t.id, c.id, c.league_id
  from public.tournaments t
  join public.categories c on c.league_id = t.league_id
  where t.slug = 'escolares-clausura-2026';

  -- ---------------------------------------------------------------------
  -- Canchas y tipos de evento
  -- ---------------------------------------------------------------------
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

  -- ---------------------------------------------------------------------
  -- Equipos, planteles y calendario de cada torneo con categorías
  -- ---------------------------------------------------------------------
  for tour in
    select t.id, t.slug, t.name, t.starts_on, t.status, l.gender
    from public.tournaments t
    join public.leagues l on l.id = t.league_id
    where exists (select 1 from public.tournament_categories tc where tc.tournament_id = t.id)
    order by l.sort_order, t.starts_on
  loop
    -- Un torneo finalizado tiene las 5 jornadas jugadas; uno en curso, 3
    v_played := case when tour.status = 'finalizado' then 5 else 3 end;

    -- Jornadas: una por semana desde el inicio del torneo
    v_matchdays := '{}';
    for r in 0..4 loop
      insert into public.matchdays (tournament_id, number, played_on)
      values (tour.id, r + 1, tour.starts_on + r * 7)
      returning id into v_match;
      v_matchdays := v_matchdays || v_match;
    end loop;

    cat_idx := 0;
    v_names := case when tour.gender = 'girls' then girl_names else boy_names end;

    for cat in
      select c.id, c.code
      from public.tournament_categories tc
      join public.categories c on c.id = tc.category_id
      where tc.tournament_id = tour.id
      order by c.sort_order
    loop
      team_ids := '{}';

      -- 6 equipos con 12–18 jugadores
      for club in
        select value from jsonb_array_elements(
          case when tour.gender = 'girls' then girls_clubs else boys_clubs end)
      loop
        insert into public.teams (
          tournament_id, category_id, name, slug, short_name, primary_color, secondary_color, club_name
        )
        values (
          tour.id, cat.id,
          club ->> 'name',
          lower(club ->> 'short') || '-' || lower(cat.code),
          club ->> 'short',
          club ->> 'c1',
          club ->> 'c2',
          club ->> 'club'
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

          insert into public.roster_entries (team_id, tournament_id, player_id, jersey_number, position)
          values (
            v_team, tour.id, v_player, i,
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

          if r < v_played then
            v_hs := floor(random() * 5)::int;
            v_as := floor(random() * 5)::int;
          else
            v_hs := null; v_as := null;
          end if;

          -- Cada categoría a una hora, cada partido en una cancha
          v_kickoff := ((tour.starts_on + r * 7) + time '08:00' + cat_idx * interval '1 hour')
                         at time zone 'America/Panama';

          insert into public.matches (
            tournament_id, category_id, home_team_id, away_team_id, venue_id,
            starts_at, matchday_id, status, home_score, away_score, started_at, finished_at
          ) values (
            tour.id, cat.id, v_home, v_away, v_venues[p],
            v_kickoff,
            v_matchdays[r + 1],
            case when r < v_played then 'finished' else 'scheduled' end::public.match_status,
            v_hs, v_as,
            case when r < v_played then v_kickoff end,
            case when r < v_played then v_kickoff + interval '50 minutes' end
          )
          returning id into v_match;

          continue when r >= v_played;

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

            -- MVP del equipo (elegido por el delegado en el modo por defecto)
            insert into public.match_mvps (match_id, team_id, player_id, source)
            values (v_match, v_side_team, whole[1 + floor(random() * array_length(whole, 1))::int], 'official');

            -- Asistencia: ~92 % presentes; quien tuvo eventos o fue MVP, siempre presente
            insert into public.match_attendance (match_id, player_id, team_id)
            select v_match, r.player_id, r.team_id
            from public.roster_entries r
            where r.team_id = v_side_team
              and (random() > 0.08
                   or exists (select 1 from public.match_events e where e.match_id = v_match and e.player_id = r.player_id)
                   or exists (select 1 from public.match_mvps mv where mv.match_id = v_match and mv.player_id = r.player_id));
          end loop;
        end loop;
      end loop;

      cat_idx := cat_idx + 1;
    end loop;
  end loop;

  raise notice 'Seed listo: % torneos, % equipos, % jugadores, % partidos, % eventos',
    (select count(*) from public.tournaments),
    (select count(*) from public.teams),
    (select count(*) from public.players),
    (select count(*) from public.matches),
    (select count(*) from public.match_events);
end;
$$;
