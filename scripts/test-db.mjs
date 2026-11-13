// Prueba las migraciones, el seed y las reglas de seguridad (RLS) en un
// Postgres en memoria (PGlite) que simula lo mínimo de Supabase.
// Uso: npm run test:db
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const db = new PGlite();
let failures = 0;
let passed = 0;

const ok = (name) => { passed++; console.log("  ✓ " + name); };
const bad = (name, e) => { failures++; console.log("  ✗ " + name + " → " + (e?.message ?? e)); };
const check = (cond, name, detail) => (cond ? ok(name) : bad(name, detail));

async function expectOk(name, sql) {
  try { await db.exec(sql); ok(name); } catch (e) { bad(name, e); }
}
async function expectFail(name, sql, re) {
  try { await db.exec(sql); bad(name, "debió fallar"); }
  catch (e) {
    if (re && !re.test(e.message)) bad(name, "error inesperado: " + e.message);
    else ok(`${name}  [${e.message.slice(0, 70)}]`);
  }
}
async function q(sql) {
  const r = (await db.exec(sql)).filter((x) => x.fields.length);
  return r[r.length - 1].rows;
}
/** Ejecuta `sql` como un rol de Supabase ('anon' | 'authenticated') con el usuario `uid`. */
function as(role, uid, sql) {
  return `reset role; select set_config('request.jwt.claim.sub', '${uid ?? ""}', false);
          set role ${role}; ${sql}; reset role; reset "request.jwt.claim.sub";`;
}
const anon = (sql) => as("anon", null, sql);
const user = (uid, sql) => as("authenticated", uid, sql);

// ---------------------------------------------------------------------------
// Simulación mínima de Supabase
// ---------------------------------------------------------------------------
await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  create schema auth; grant usage on schema auth to anon, authenticated;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant execute on function auth.uid() to anon, authenticated;
  create schema storage; grant usage on schema storage to anon, authenticated;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets, name text);
  alter table storage.objects enable row level security;
  grant all on storage.objects to anon, authenticated;
  create function storage.foldername(name text) returns text[] language sql immutable as
    $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
  grant execute on function storage.foldername(text) to anon, authenticated;
  create publication supabase_realtime;
`);

console.log("Migraciones:");
const migDir = join(ROOT, "supabase", "migrations");
for (const f of readdirSync(migDir).filter((f) => f.endsWith(".sql")).sort()) {
  await expectOk(f, readFileSync(join(migDir, f), "utf8"));
}
console.log("Seed:");
const seed = readFileSync(join(ROOT, "supabase", "seed.sql"), "utf8");
await expectOk("seed.sql", seed);
await expectFail("no se puede correr dos veces", seed, /ya tiene temporadas/);

const counts = (await q(`select
  (select count(*) from categories)::int categorias, (select count(*) from teams)::int equipos,
  (select count(*) from players)::int jugadores, (select count(*) from matches)::int partidos,
  (select count(*) from matches where status='finished')::int jugados,
  (select count(*) from match_events)::int eventos, (select count(*) from match_mvps)::int mvps`))[0];
console.log("   " + JSON.stringify(counts));
check(counts.categorias === 10 && counts.equipos === 60 && counts.partidos === 150, "10 categorías, 60 equipos, 150 partidos");
const rosterRange = (await q(`select min(c)::int mn, max(c)::int mx from (select count(*) c from roster_entries group by team_id) x`))[0];
check(rosterRange.mn >= 12 && rosterRange.mx <= 18, `12–18 jugadores por equipo (${rosterRange.mn}–${rosterRange.mx})`);
const goalMismatch = (await q(`select count(*)::int n from matches m where status='finished' and
  m.home_score + m.away_score <> (select count(*) from match_events e join event_types t on t.id=e.event_type_id
  where e.match_id=m.id and t.code='goal')`))[0].n;
check(goalMismatch === 0, "goles = marcador en todos los partidos jugados");
const pairs = (await q(`select count(*)::int n from (select least(home_team_id,away_team_id), greatest(home_team_id,away_team_id)
  from matches group by 1,2 having count(*) <> 1) x`))[0].n;
check(pairs === 0, "todos contra todos: cada par se enfrenta una vez");
const realtime = (await q(`select string_agg(tablename, ',' order by tablename) t from pg_publication_tables where pubname='supabase_realtime'`))[0].t;
check(realtime === "match_events,match_mvps,matches,media_items", "Realtime publica matches, match_events, match_mvps y media_items", realtime);

const noRls = (await q(`select coalesce(string_agg(relname, ','), '') t from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind='r' and not c.relrowsecurity`))[0].t;
check(noRls === "", "todas las tablas tienen Row Level Security", noRls);
const tables = (await q(`select count(*)::int c from pg_tables where schemaname='public'`))[0].c;
console.log("   tablas: " + tables);

// ---------------------------------------------------------------------------
// Usuarios de prueba
// ---------------------------------------------------------------------------
const U = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const ADMIN = U(1), DELEG = U(2), PARENT = U(3), PARENT_B = U(4), PARENT2 = U(5), OUTSIDER = U(6), HACKER = U(7);
await db.exec(`insert into auth.users (id, email, raw_user_meta_data) values
  ('${ADMIN}','a@x','{"full_name":"Admin"}'), ('${DELEG}','d@x','{}'), ('${PARENT}','p@x','{}'),
  ('${PARENT_B}','pb@x','{}'), ('${PARENT2}','p2@x','{}'), ('${OUTSIDER}','o@x','{}'),
  ('${HACKER}','h@x','{"role":"admin"}');`);

console.log("Registro y roles:");
const roles = await q(`select role, count(*)::int c from profiles group by role`);
check(roles.length === 1 && roles[0].role === "parent" && roles[0].c === 7, "todos empiezan como 'parent' (ignora role en metadata)", JSON.stringify(roles));
const prefs = (await q(`select count(*)::int c from notification_preferences where match_reminder and final_result`))[0].c;
check(prefs === 7, "preferencias de notificación creadas al registrarse");
await expectOk("SQL Editor nombra admin y delegado",
  `update profiles set role='admin' where id='${ADMIN}'; update profiles set role='delegate' where id='${DELEG}';`);
await expectFail("un padre no puede hacerse admin", user(PARENT, `update profiles set role='admin' where id='${PARENT}'`), /administrador/);
check((await q(user(PARENT, `update profiles set full_name='x' where id='${ADMIN}' returning id`))).length === 0, "no edita perfiles ajenos");

// ---------------------------------------------------------------------------
// Público
// ---------------------------------------------------------------------------
console.log("Público (anon):");
const P1 = (await q(`select p.id from players p join roster_entries r on r.player_id=p.id join teams t on t.id=r.team_id join categories c on c.id=t.category_id join leagues l on l.id=c.league_id where l.gender='girls' and c.code='U12' and r.jersey_number between 4 and 12 and p.photo_consent order by t.slug, r.jersey_number limit 1`))[0].id;
const P2 = (await q(`select p.id from players p join roster_entries r on r.player_id=p.id join teams t on t.id=r.team_id join categories c on c.id=t.category_id join leagues l on l.id=c.league_id where l.gender='girls' and c.code='U12' and r.jersey_number between 4 and 12 and not p.photo_consent order by t.slug, r.jersey_number limit 1`))[0].id;
await db.exec(`update players set photo_path = id::text || '.jpg' where id in ('${P1}','${P2}');
  insert into storage.objects (bucket_id, name) values ('player-photos','${P1}.jpg'), ('player-photos','${P2}.jpg');`);

for (const t of ["players", "profiles", "families", "family_members", "family_players", "mvp_votes",
                 "team_follows", "push_subscriptions", "notification_log", "my_family_player_stars"]) {
  await expectFail(`no lee ${t}`, anon(`select * from ${t}`), /permission denied/);
}
const pubs = await q(anon(`select id, photo_path from public_players where id in ('${P1}','${P2}') order by photo_path nulls last`));
check(pubs[0].photo_path && !pubs[1].photo_path, "public_players: foto solo con consentimiento");
const cols = (await q(`select string_agg(column_name, ',' order by ordinal_position) c from information_schema.columns where table_name='public_players'`))[0].c;
check(cols === "id,first_name,last_initial,display_name,photo_path", "public_players solo expone nombre, inicial y foto", cols);
await expectFail("no escribe a través de public_players", anon(`update public_players set first_name='X'`), /permission denied/);
await expectFail("no inserta datos", anon(`insert into venues (name) values ('X')`), /row-level security|permission/);
const objs = await q(anon(`select name from storage.objects where bucket_id='player-photos'`));
check(objs.length === 1 && objs[0].name === `${P1}.jpg`, "storage: solo entrega la foto con consentimiento");
const pubRead = (await q(anon(`select (select count(*) from standings)::int s, (select count(*) from season_leaders)::int l,
  (select count(*) from team_season_recognitions)::int r, (select count(*) from match_mvps)::int m`)))[0];
check(pubRead.s === 60 && pubRead.l > 0 && pubRead.r === 60 && pubRead.m > 0, "lee posiciones, líderes, reconocimientos y MVPs", JSON.stringify(pubRead));
for (const fn of ["start_match(gen_random_uuid())", "cast_mvp_vote(gen_random_uuid(), gen_random_uuid())",
                  "set_photo_consent(gen_random_uuid(), true)", "close_expired_mvp_votes()"]) {
  await expectFail(`no ejecuta ${fn.split("(")[0]}`, anon(`select ${fn}`), /permission denied/);
}

// ---------------------------------------------------------------------------
// Posiciones y líderes
// ---------------------------------------------------------------------------
console.log("Posiciones y líderes:");
const st = await q(`select position, played, won, drawn, lost, goals_for, goals_against, goal_difference, points from standings
  where category_id = (select c.id from categories c join leagues l on l.id=c.league_id where l.gender='boys' and c.code='U10') order by position`);
check(st.length === 6 && st.every((r) => r.played === 3 && r.points === 3 * r.won + r.drawn && r.goal_difference === r.goals_for - r.goals_against),
  "standings: PJ, G, E, P, GF, GC, DG y Pts coherentes (3/1/0)");
check(st[0].position === 1, "standings: incluye posición");
const smallCats = (await q(`select count(*)::int n from season_leaders s join categories c on c.id=s.category_id where c.code in ('U6','U8')`))[0].n;
const smallStats = (await q(`select count(*)::int n from player_season_stats s join categories c on c.id=s.category_id where c.recognition_mode='team_stars'`))[0].n;
check(smallCats === 0 && smallStats === 0, "U6/U8: sin ranking individual ni goleadores (filtrado en la BD)");
const bigCats = (await q(`select count(distinct category_id)::int n from season_leaders where stat='goals'`))[0].n;
check(bigCats === 7, `U10+: tabla de goleadores en las 7 categorías (${bigCats})`);
const ptsCheck = (await q(`select count(*)::int n from player_season_stats where points <> goals*3 + assists*2 + saves + fair_play*2 + mvps*3`))[0].n;
check(ptsCheck === 0, "puntos = gol 3 + asistencia 2 + atajada 1 + fair play 2 + MVP 3");
const u6Team = (await q(`select sum(stars)::int s from team_season_recognitions r join categories c on c.id=r.category_id where c.code='U6'`))[0].s;
check(u6Team > 0, "U6: reconocimientos de equipo (estrellas) disponibles");

// ---------------------------------------------------------------------------
// Familias y consentimiento
// ---------------------------------------------------------------------------
console.log("Familias:");
await db.exec(`
  insert into families (id, name) values ('${U(101)}','Familia A'), ('${U(102)}','Familia B'), ('${U(103)}','Familia C');
  insert into family_members values ('${U(101)}','${PARENT}','madre'), ('${U(101)}','${PARENT_B}','padre'),
    ('${U(102)}','${PARENT2}','padre'), ('${U(103)}','${OUTSIDER}','madre');
  insert into family_players (family_id, player_id) values ('${U(101)}','${P2}');`);
check((await q(user(OUTSIDER, `select id from players`))).length === 0, "sin hijos vinculados no ve jugadores");
const seen = await q(user(PARENT_B, `select id from players`));
check(seen.length === 1 && seen[0].id === P2, "el otro adulto de la familia también ve a su hijo/a");
check((await q(user(PARENT, `select name from storage.objects`))).length === 2, "ve la foto de su hijo/a aunque aún no haya consentimiento");
check((await q(user(PARENT, `update players set first_name='Hack' where id='${P2}' returning id`))).length === 0, "no edita datos del jugador");
await expectOk("da consentimiento con set_photo_consent", user(PARENT, `select set_photo_consent('${P2}', true)`));
const stamp = (await q(`select photo_consent, photo_consent_updated_by from players where id='${P2}'`))[0];
check(stamp.photo_consent && stamp.photo_consent_updated_by === PARENT, "consentimiento registrado con autor y fecha");
await expectFail("no cambia el consentimiento de otro niño", user(PARENT, `select set_photo_consent('${P1}', false)`), /No autorizado/);
await expectFail("no se vincula solo a un niño", user(PARENT, `insert into family_players (family_id, player_id) values ('${U(101)}','${P1}')`), /row-level security/);
const famStars = await q(user(PARENT, `select player_id from my_family_player_stars`));
check(famStars.every((r) => r.player_id === P2), "my_family_player_stars: solo sus hijos");
check((await q(user(OUTSIDER, `select * from my_family_player_stars`))).length === 0, "my_family_player_stars: vacío para otras familias");

// ---------------------------------------------------------------------------
// Marcador en vivo
// ---------------------------------------------------------------------------
console.log("Marcador en vivo:");
const M = (await q(`select id, home_team_id h, away_team_id a from matches where status='scheduled' order by starts_at, id limit 1`))[0];
const homeP = (await q(`select player_id p from roster_entries where team_id='${M.h}' and jersey_number=2`))[0].p;
const awayP = (await q(`select player_id p from roster_entries where team_id='${M.a}' and jersey_number=2`))[0].p;
const otherP = (await q(`select player_id p from roster_entries where team_id not in ('${M.h}','${M.a}') limit 1`))[0].p;
const ev = (code, team, player, min) =>
  `insert into match_events (match_id, team_id, player_id, event_type_id, minute) values ('${M.id}','${team}','${player}',(select id from event_types where code='${code}'),${min})`;
const score = async () => (await q(`select home_score::text || '-' || away_score::text s, status from matches where id='${M.id}'`))[0];

await expectFail("delegado no asignado no inicia el partido", user(DELEG, `select start_match('${M.id}')`), /No autorizado/);
await db.exec(`insert into match_officials (match_id, user_id) values ('${M.id}','${DELEG}')`);
await expectFail("no carga eventos antes de iniciar", user(DELEG, ev("goal", M.h, homeP, 1)), /row-level security/);
await expectOk("delegado asignado inicia el partido", user(DELEG, `select start_match('${M.id}')`));
check((await score()).s === "0-0" && (await score()).status === "live", "en vivo, 0-0");
await expectOk("carga gol local min 5", user(DELEG, ev("goal", M.h, homeP, 5)));
await expectOk("carga autogol de un visitante min 12", user(DELEG, ev("own_goal", M.a, awayP, 12)));
await expectOk("carga gol visitante min 20", user(DELEG, ev("goal", M.a, awayP, 20)));
check((await score()).s === "2-1", "marcador calculado solo: 2-1 (el autogol suma al rival)", (await score()).s);
await expectFail("rechaza jugador que no juega", user(DELEG, ev("goal", M.h, otherP, 21)), /no está inscrito/);
await expectFail("el MVP no se carga como evento", user(DELEG, ev("mvp", M.h, homeP, 22)), /MVP no se carga/);
const lastGoal = (await q(`select e.id from match_events e join event_types t on t.id=e.event_type_id where match_id='${M.id}' and t.code='goal' and team_id='${M.a}'`))[0].id;
await expectOk("corrige: anula el gol cargado por error", user(DELEG, `update match_events set voided_at = now() where id='${lastGoal}'`));
check((await score()).s === "2-0", "marcador se corrige a 2-0", (await score()).s);
check((await q(`select voided_by from match_events where id='${lastGoal}'`))[0].voided_by === DELEG, "queda registrado quién anuló");
await expectOk("delegado no puede borrar eventos (0 filas)", user(DELEG, `delete from match_events where id='${lastGoal}'`));
check((await q(`select count(*)::int c from match_events where id='${lastGoal}'`))[0].c === 1, "el evento anulado se conserva");
check((await q(user(DELEG, `update matches set home_score=9 where id='${M.id}' returning id`))).length === 0, "no edita el marcador a mano");
await expectOk("finaliza el partido", user(DELEG, `select finish_match('${M.id}')`));
check((await score()).status === "finished", "estado: finalizado");
await expectOk("puede corregir durante la primera hora tras el final", user(DELEG, ev("fair_play", M.h, homeP, 50)));
await db.exec(`update matches set finished_at = now() - interval '2 hours' where id='${M.id}'`);
await expectFail("no corrige pasada 1 hora", user(DELEG, ev("fair_play", M.a, awayP, 50)), /row-level security/);
await expectFail("no finaliza dos veces", user(DELEG, `select finish_match('${M.id}')`), /Solo se puede finalizar/);
await expectFail("un padre no inicia partidos", user(PARENT, `select start_match('${M.id}')`), /No autorizado/);

// ---------------------------------------------------------------------------
// MVP oficial
// ---------------------------------------------------------------------------
console.log("MVP oficial:");
await expectOk("delegado elige MVP local", user(DELEG, `select set_match_mvp('${M.id}','${homeP}')`));
await expectOk("delegado cambia de opinión (reemplaza)", user(DELEG, `select set_match_mvp('${M.id}','${(await q(`select player_id p from roster_entries where team_id='${M.h}' and jersey_number=3`))[0].p}')`));
check((await q(`select count(*)::int c from match_mvps where match_id='${M.id}' and team_id='${M.h}'`))[0].c === 1, "un solo MVP por equipo");
await expectFail("un padre no elige MVP", user(PARENT, `select set_match_mvp('${M.id}','${awayP}')`), /No autorizado/);
await expectFail("en modo oficial no se vota", user(PARENT, `select cast_mvp_vote('${M.id}','${awayP}')`), /delegado o árbitro/);

// ---------------------------------------------------------------------------
// MVP por votación de familias
// ---------------------------------------------------------------------------
console.log("MVP por votación:");
const VM = (await q(`select m.id, m.home_team_id h, m.away_team_id a from matches m join categories c on c.id=m.category_id
  join leagues l on l.id=c.league_id where l.gender='girls' and m.status='finished' order by m.starts_at, m.id limit 1`))[0];
const roster = async (team) => (await q(`select player_id p from roster_entries where team_id='${team}' order by jersey_number`)).map((r) => r.p);
const [vh, va] = [await roster(VM.h), await roster(VM.a)];
await db.exec(`
  update leagues set mvp_mode='parent_vote' where gender='girls';
  delete from match_mvps where match_id='${VM.id}';
  update matches set finished_at = now() - interval '1 hour' where id='${VM.id}';
  insert into family_players (family_id, player_id) values ('${U(101)}','${vh[0]}'), ('${U(102)}','${va[0]}');
  insert into match_officials (match_id, user_id) values ('${VM.id}','${DELEG}');`);
const vote = (uid, player) => user(uid, `select cast_mvp_vote('${VM.id}','${player}')`);
await expectFail("no vota por su propio hijo", vote(PARENT, vh[0]), /hijo propio/);
await expectOk("familia A vota", vote(PARENT, vh[1]));
await expectFail("la misma persona no vota dos veces", vote(PARENT, vh[2]), /ya votó/);
await expectFail("el otro adulto de la familia tampoco (un voto por familia)", vote(PARENT_B, vh[2]), /ya votó/);
await expectFail("una familia ajena al partido no vota", vote(OUTSIDER, vh[1]), /Solo votan las familias/);
await expectOk("familia B (equipo rival) vota", vote(PARENT2, vh[1]));
await expectFail("no vota por jugador de otro partido", vote(PARENT2, otherP), /no pertenece/);
check((await q(user(PARENT, `select * from mvp_votes`))).length === 1, "los votos son secretos: cada familia ve solo el suyo");
await expectFail("no inserta votos directamente", user(PARENT, `insert into mvp_votes (match_id, family_id, team_id, player_id) values ('${VM.id}','${U(101)}','${VM.h}','${vh[3]}')`), /row-level security/);
await expectFail("delegado no decide con la votación abierta", user(DELEG, `select set_match_mvp('${VM.id}','${va[1]}')`), /sigue abierta/);
await db.exec(`update matches set finished_at = now() - interval '25 hours' where id='${VM.id}'`);
await expectFail("no se vota pasadas 24 h", vote(OUTSIDER, vh[1]), /no está abierta/);
await expectOk("admin cierra la votación", user(ADMIN, `select close_mvp_voting('${VM.id}')`));
const won = await q(`select team_id, player_id, source, votes from match_mvps where match_id='${VM.id}'`);
check(won.length === 1 && won[0].player_id === vh[1] && won[0].source === "parent_vote" && won[0].votes === 2,
  "gana el más votado (2 votos) en el equipo local", JSON.stringify(won));
await expectOk("visitante sin votos: decide el delegado", user(DELEG, `select set_match_mvp('${VM.id}','${va[1]}')`));
await expectFail("el delegado no pisa un MVP ganado por votación", user(DELEG, `select set_match_mvp('${VM.id}','${vh[2]}')`), /ya tiene MVP/);
await expectFail("un padre no cierra votaciones", user(PARENT, `select close_mvp_voting('${VM.id}')`), /No autorizado/);

// ---------------------------------------------------------------------------
// Notificaciones
// ---------------------------------------------------------------------------
console.log("Notificaciones:");
await expectOk("sigue un equipo", user(PARENT, `insert into team_follows (user_id, team_id) values ('${PARENT}','${M.h}')`));
await expectFail("no hace seguir un equipo a otro usuario", user(PARENT, `insert into team_follows (user_id, team_id) values ('${PARENT2}','${M.h}')`), /row-level security/);
check((await q(user(PARENT2, `select * from team_follows`))).length === 0, "no ve los equipos que siguen otros");
await expectOk("desactiva el recordatorio", user(PARENT, `update notification_preferences set match_reminder=false where user_id='${PARENT}'`));
await expectOk("registra suscripción push", user(PARENT, `insert into push_subscriptions (user_id, endpoint, p256dh, auth) values ('${PARENT}','https://push.example/1','k','a')`));
check((await q(user(PARENT2, `select * from push_subscriptions`))).length === 0, "no ve suscripciones ajenas");
await expectFail("no lee notification_log", user(PARENT, `select * from notification_log`), /permission denied/);

// ---------------------------------------------------------------------------
// Asistencia
// ---------------------------------------------------------------------------
console.log("Asistencia:");
const att = (await q(`select count(*)::int c from match_attendance where match_id='${M.id}'`))[0].c;
const rosterBoth = (await q(`select count(*)::int c from roster_entries where team_id in ('${M.h}','${M.a}')`))[0].c;
check(att === rosterBoth, `start_match cargó a los ${rosterBoth} jugadores de ambos equipos`);
const absentP = (await q(`select player_id p from roster_entries where team_id='${M.h}' and jersey_number=5`))[0].p;
await expectOk("admin quita a un ausente", user(ADMIN, `delete from match_attendance where match_id='${M.id}' and player_id='${absentP}'`));
check((await q(`select count(*)::int c from match_attendance where match_id='${M.id}'`))[0].c === rosterBoth - 1, "asistencia actualizada");

// ---------------------------------------------------------------------------
// Galería
// ---------------------------------------------------------------------------
console.log("Galería:");
// Partido de la familia A (hijo P2 en su equipo) y un niño sin consentimiento en ese partido
const GM = (await q(`select m.id, m.home_team_id h from matches m join roster_entries r on r.team_id in (m.home_team_id, m.away_team_id)
  where r.player_id='${P2}' and m.status='finished' order by m.starts_at limit 1`))[0];
const noConsent = (await q(`select r.player_id p from roster_entries r join players p on p.id=r.player_id
  where r.team_id='${GM.h}' and not p.photo_consent and r.player_id <> '${P2}' limit 1`))[0].p;
const withConsent = (await q(`select r.player_id p from roster_entries r join players p on p.id=r.player_id
  where r.team_id='${GM.h}' and p.photo_consent limit 1`))[0].p;
const MEDIA = U(201), MEDIA2 = U(202);

await expectFail("una familia ajena no sube fotos del partido", user(OUTSIDER,
  `insert into media_items (id, match_id, uploaded_by, kind) values ('${U(299)}','${GM.id}','${OUTSIDER}','photo')`), /row-level security/);
await expectOk("familia del partido sube una foto (queda en processing)", user(PARENT,
  `insert into media_items (id, match_id, uploaded_by, kind, upload_path) values ('${MEDIA}','${GM.id}','${PARENT}','photo','${PARENT}/a.heic')`));
await expectFail("no puede subirla ya marcada como aprobada", user(PARENT,
  `insert into media_items (match_id, uploaded_by, kind, status) values ('${GM.id}','${PARENT}','photo','approved')`), /row-level security/);
await expectOk("etiqueta a dos niños (uno sin consentimiento)", user(PARENT,
  `insert into media_tags (media_id, player_id) values ('${MEDIA}','${withConsent}'), ('${MEDIA}','${noConsent}')`));
await expectFail("no etiqueta a un niño de otro partido", user(PARENT,
  `insert into media_tags (media_id, player_id) values ('${MEDIA}','${otherP}')`), /no jugó el partido/);
await expectFail("no pasa a revisión sin quitar EXIF", `update media_items set status='pending_review', storage_path='x.jpg' where id='${MEDIA}'`, /check constraint/);
await expectOk("el servidor quita EXIF y la pasa a revisión", `update media_items set status='pending_review', storage_path='m/${MEDIA}.jpg',
  thumbnail_path='m/${MEDIA}_t.jpg', metadata_stripped=true, upload_path=null where id='${MEDIA}';
  insert into storage.objects (bucket_id, name) values ('match-media','m/${MEDIA}.jpg');`);
check((await q(user(PARENT, `update media_items set status='approved' where id='${MEDIA}' returning id`))).length === 0, "quien subió no puede aprobarla (0 filas)");
check((await q(`select status from media_items where id='${MEDIA}'`))[0].status === "pending_review", "sigue pendiente de revisión");
check((await q(user(ADMIN, `select blocking_tags b from media_review_queue where id='${MEDIA}'`)))[0]?.b === 1, "la cola del admin muestra 1 niño que bloquea");
await expectFail("el admin no puede aprobar con un niño sin consentimiento", user(ADMIN, `update media_items set status='approved' where id='${MEDIA}'`), /Bloqueado/);
check((await q(user(PARENT, `update media_tags set redacted=true where media_id='${MEDIA}' returning player_id`))).length === 0, "solo el admin marca difuminado (0 filas)");
await expectOk("admin difumina al niño y aprueba", user(ADMIN, `update media_tags set redacted=true where media_id='${MEDIA}' and player_id='${noConsent}';
  update media_items set status='approved' where id='${MEDIA}'`));
check((await q(`select reviewed_by from media_items where id='${MEDIA}'`))[0].reviewed_by === ADMIN, "queda registrado quién aprobó");
check((await q(user(PARENT2, `select id from media_items where id='${MEDIA}'`))).length === 1, "otra familia de la liga la ve");
check((await q(user(PARENT2, `select name from storage.objects where bucket_id='match-media'`))).length === 1, "y puede pedir la URL firmada del archivo");
const boysFamily = U(104), BOYS_PARENT = U(8);
await db.exec(`insert into auth.users (id, email) values ('${BOYS_PARENT}','bp@x');
  insert into families (id, name) values ('${boysFamily}','Familia niños'); insert into family_members values ('${boysFamily}','${BOYS_PARENT}','padre');
  insert into family_players (family_id, player_id) select '${boysFamily}', r.player_id from roster_entries r join teams t on t.id=r.team_id
    join categories c on c.id=t.category_id join leagues l on l.id=c.league_id
    where l.gender <> (select l2.gender from matches m join categories c2 on c2.id=m.category_id join leagues l2 on l2.id=c2.league_id where m.id='${GM.id}') limit 1;`);
check((await q(user(BOYS_PARENT, `select id from media_items where id='${MEDIA}'`))).length === 0, "una familia de otra liga no la ve");
check((await q(user(OUTSIDER, `select id from media_items where id='${MEDIA}'`))).length === 0, "un usuario sin hijos inscritos no la ve");
await expectFail("el público no ve la galería", anon(`select * from media_items`), /permission denied/);
check((await q(anon(`select name from storage.objects where bucket_id='match-media'`))).length === 0, "el público no accede a los archivos");
await db.exec(`update players set photo_consent=false where id='${withConsent}'`);
check((await q(user(PARENT2, `select id from media_items where id='${MEDIA}'`))).length === 0, "si un padre retira el consentimiento, la foto se oculta al instante");
check((await q(user(ADMIN, `select id from media_review_queue where id='${MEDIA}'`))).length === 1, "y vuelve a la cola del admin");
await db.exec(`update players set photo_consent=true where id='${withConsent}'`);
await expectFail("rechaza videos de más de 30 s", user(ADMIN,
  `insert into media_items (id, match_id, uploaded_by, kind, duration_seconds) values ('${MEDIA2}','${GM.id}','${ADMIN}','video',31)`), /check constraint/);
await expectOk("sube a su carpeta de cuarentena", user(PARENT, `insert into storage.objects (bucket_id, name) values ('media-uploads','${PARENT}/b.mp4')`));
await expectFail("no sube a la carpeta de otro", user(PARENT, `insert into storage.objects (bucket_id, name) values ('media-uploads','${PARENT2}/b.mp4')`), /row-level security/);
check((await q(user(PARENT2, `select name from storage.objects where bucket_id='media-uploads'`))).length === 0, "nadie lee la cuarentena desde la app");
await expectFail("un padre no escribe en la galería procesada", user(PARENT, `insert into storage.objects (bucket_id, name) values ('match-media','m/z.jpg')`), /row-level security/);

// ---------------------------------------------------------------------------
// Crónicas y tarjetas
// ---------------------------------------------------------------------------
console.log("Crónicas y tarjetas:");
await expectOk("el servidor guarda un borrador generado", `insert into match_chronicles (match_id, body, generated_body, model, prompt_version, generated_at)
  values ('${GM.id}','Borrador','Borrador','claude-opus-5-5','v1', now())`);
check((await q(anon(`select * from match_chronicles where match_id='${GM.id}'`))).length === 0, "el público no ve borradores");
check((await q(user(PARENT, `update match_chronicles set status='published' where match_id='${GM.id}' returning match_id`))).length === 0, "un padre no publica crónicas (0 filas)");
check((await q(`select status from match_chronicles where match_id='${GM.id}'`))[0].status === "draft", "sigue en borrador tras el intento del padre");
await expectOk("admin edita y publica", user(ADMIN, `update match_chronicles set body='Gran tarde de fútbol...', status='published' where match_id='${GM.id}'`));
const chr = (await q(`select edited_by, approved_by, published_at from match_chronicles where match_id='${GM.id}'`))[0];
check(chr.edited_by === ADMIN && chr.approved_by === ADMIN && chr.published_at, "registra quién editó y aprobó");
check((await q(anon(`select body from match_chronicles where match_id='${GM.id}'`))).length === 1, "el público lee la crónica publicada");
const scorersBig = (await q(`select count(*)::int c from public_match_scorers s join matches m on m.id=s.match_id join categories c on c.id=m.category_id where c.code='U14'`))[0].c;
const scorersSmall = (await q(`select count(*)::int c from public_match_scorers s join matches m on m.id=s.match_id join categories c on c.id=m.category_id where c.recognition_mode='team_stars'`))[0].c;
check(scorersBig > 0 && scorersSmall === 0, "tarjetas: goleadores en U10+, ninguno en U6/U8");
const scorerCols = (await q(`select string_agg(column_name, ',' order by ordinal_position) c from information_schema.columns where table_name='public_match_scorers'`))[0].c;
check(!/last_name|photo|birth/.test(scorerCols), "tarjetas: solo nombre + inicial (" + scorerCols + ")");

// ---------------------------------------------------------------------------
// Certificados
// ---------------------------------------------------------------------------
console.log("Certificados:");
check((await q(user(PARENT, `select * from my_family_season_certificates`))).length === 0, "temporada abierta: sin certificados");
await db.exec(`update seasons set closed_at = now() where is_current`);
const certs = await q(user(PARENT, `select player_id, recognition_mode, matches_played, goals, mvps, stars, participated from my_family_season_certificates`));
const famKids = (await q(`select count(*)::int c from family_players where family_id='${U(101)}'`))[0].c;
check(certs.length === famKids, `la familia A ve ${famKids} certificados (sus hijos)`);
check(certs.every((c) => c.recognition_mode === "individual_ranking" ? c.matches_played !== null : c.goals === null && c.stars === null),
  "U10+: con estadísticas · U6/U8: sin números individuales");
check((await q(user(OUTSIDER, `select * from my_family_season_certificates`))).length === 0, "otra familia no ve certificados ajenos");
await expectFail("el público no accede a certificados", anon(`select * from my_family_season_certificates`), /permission denied/);
const smallCert = (await q(user(BOYS_PARENT, `select recognition_mode, goals, participated from my_family_season_certificates`)));
console.log("   certificado de la familia de niños:", JSON.stringify(smallCert));
await db.exec(`update seasons set closed_at = null where is_current`);

// ---------------------------------------------------------------------------
// Validaciones de datos
// ---------------------------------------------------------------------------
console.log("Validaciones:");
await expectFail("rechaza puntos negativos", user(ADMIN, `update event_types set points=-1 where code='red_card'`), /check constraint/);
await expectFail("rechaza apellido completo", user(ADMIN, `insert into players (first_name, last_initial) values ('Ana','Pérez')`), /check constraint/);
await expectFail("rechaza partido entre categorías distintas", `insert into matches (season_id, category_id, home_team_id, away_team_id, starts_at)
  select t1.season_id, t1.category_id, t1.id, t2.id, now() from teams t1, teams t2 where t1.category_id <> t2.category_id limit 1`, /foreign key/);
await expectOk("admin cambia el rol de otro usuario", user(ADMIN, `update profiles set role='delegate' where id='${HACKER}'`));

// ---------------------------------------------------------------------------
// Funciones del panel de administración
// ---------------------------------------------------------------------------
console.log("Panel admin:");
const users = await q(user(ADMIN, `select email, role from admin_list_users()`));
check(users.length >= 7 && users.some((u) => u.email === "a@x" && u.role === "admin"), `admin lista usuarios con correo (${users.length})`);
await expectFail("un padre no lista usuarios", user(PARENT, `select * from admin_list_users()`), /No autorizado/);
await expectFail("el público no lista usuarios", anon(`select * from admin_list_users()`), /permission denied/);
const found = await q(user(ADMIN, `select id from admin_find_user('  P@X ')`));
check(found.length === 1 && found[0].id === PARENT, "admin busca usuario por correo (sin importar mayúsculas/espacios)");
await expectFail("un delegado no busca usuarios", user(DELEG, `select * from admin_find_user('p@x')`), /No autorizado/);
const S1 = (await q(`select id from seasons where number=1`))[0].id;
await expectOk("admin cambia la temporada actual", user(ADMIN, `select admin_set_current_season('${S1}')`));
check((await q(`select number from seasons where is_current`)).map((r) => r.number).join() === "1", "solo una temporada actual (la nueva)");
await expectFail("un padre no cambia la temporada", user(PARENT, `select admin_set_current_season('${S1}')`), /No autorizado/);
await db.exec(`select admin_set_current_season((select id from seasons where number=5))`);

console.log(failures ? `\n${failures} PRUEBA(S) FALLARON, ${passed} pasaron` : `\nTODAS LAS PRUEBAS PASARON (${passed})`);
process.exit(failures ? 1 : 0);
