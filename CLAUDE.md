@AGENTS.md

# Panama Global Sports

Plataforma web para ligas deportivas infantiles en Panamá. Interfaz y contenido en **español**; código (variables, funciones, tablas) en **inglés**.

## Contexto del negocio

- Primer deporte: **fútbol**. La arquitectura debe soportar otros deportes después (no asumir fútbol en el modelo de datos).
- Estructura real (especificación del dueño, 2026-11-14): **organización → liga → circuito → torneo → categoría**.
  - **Organización**: Panama Global Sports (azul marino `#1B1464`, amarillo `#FFFF00`).
  - **Ligas**: **Boys Champions League** (celeste `#29ABE2`) y **Girls Champions League** (magenta `#ED1E79`).
  - **Circuitos**: cada liga se juega en **Academias** y **Escolares** ("Academy/School Edition", sin logo propio).
  - **Tipos de torneo**: **Apertura** y **Clausura** en los dos circuitos; **Copa de Navidad** solo en Academias, sin apertura ni clausura. La BD impone la combinación válida.
  - **Categorías**: Boys U6–U14, Girls U8–U17.
- **Pueden jugarse dos torneos de la misma liga a la vez** (Academias y Escolares). A propósito no hay índice único sobre el estado: se intenta que no coincidan, pero no se bloquea.
- **La temporada es el año vigente** (`tournaments.year`, `current_season()`). No hay tabla de temporadas. Es la unidad de las exclusividades anuales de patrocinio.
- Cada categoría: **6 equipos** de **12 a 18 jugadores**.
- Los rosters cambian por torneo: un jugador pertenece a un equipo **en un torneo**, no de forma permanente. Un niño puede jugar a la vez en su academia y en su colegio, que son torneos distintos.
- Al finalizar, un torneo pasa al **historial**.

## Alcance funcional (fase actual)

1. **Tabla de posiciones automática** por categoría y temporada: PJ, G, E, P, GF, GC, DG, Pts (3 victoria, 1 empate). Vista SQL `standings` calculada de los partidos finalizados; nunca se guarda a mano. **Se muestra en todas las categorías, también U6 y U8** (decisión 2026-11-13).
2. **Líderes de la temporada** (goles, asistencias, atajadas, fair play, MVP) calculados desde `match_events`. Cada categoría tiene `recognition_mode`, que el admin cambia en **/admin/categorias** (no es una regla fija por edad):
   - `team_stars`: solo estrellas y reconocimientos de equipo. **Sin ranking individual ni nombres de goleadores** — las vistas excluyen estas categorías desde la BD, no solo desde la UI. Afecta también tarjetas, crónica y certificados.
   - `individual_ranking`: ranking individual, goleadores con nombre, certificados con estadísticas.
   - **Decisión 2026-11-13: U6 y U8 también en `individual_ranking`** (todas las categorías individuales). El código sigue soportando `team_stars`: los textos de abajo que dicen "U6/U8" se refieren a categorías en modo `team_stars`.
3. **Jugador del partido (MVP)**: uno por equipo y partido. Configurable por liga (`leagues.mvp_mode`):
   - `official`: lo elige el delegado/árbitro asignado.
   - `parent_vote`: votan las familias de ambos equipos, **un voto por familia y por partido**, ventana de 24 h tras el final, sin votar por un hijo propio. Empate → decide el delegado/admin.
   - Las cuentas de padres se vinculan a sus hijos mediante **familias** (`families`, `family_members`, `family_players`); una familia puede tener varios hijos y varios adultos.
   - El MVP suma puntos extra (`event_types.code = 'mvp'`) y en el futuro desbloqueará una figurita especial (`match_mvps` es el ancla).
4. **Marcador en vivo**: el delegado/árbitro inicia (`start_match`), carga goles y eventos con minuto desde el celular (pantalla mínima, botones grandes) y finaliza (`finish_match`). El marcador se recalcula solo a partir de los goles. Los errores se corrigen anulando el evento (`voided_at`), nunca borrándolo. Los padres lo siguen con **Supabase Realtime** (`matches`, `match_events`, `match_mvps`).
5. **Notificaciones push (Web Push, PWA)**: recordatorio el día anterior ("Tu equipo juega mañana 9:00 en Cancha 2"), resultado final ("Final: Tigres 3 – Leones 1") y, en la fase del álbum, sobres nuevos. Cada usuario sigue equipos (`team_follows`) y elige qué recibe (`notification_preferences`). El envío es solo en servidor (service role) y se registra en `notification_log` para no duplicar. La web es una **PWA instalable**.
6. **Galería por partido** (fotos y videos ≤ 30 s, comprimidos). Suben admins, delegados asignados y familias con hijos en el partido. Flujo: el original va al bucket de cuarentena `media-uploads/{user_id}/…` → el **servidor** elimina EXIF/GPS, comprime y escribe en `match-media` (`status = pending_review`) → un **admin** aprueba o rechaza. Cada archivo lleva etiquetados los jugadores (`media_tags`); si alguno **no tiene consentimiento de foto**, la BD **impide aprobar** hasta que el admin lo recorte/difumine (`redacted = true`). Si un padre retira el consentimiento después, el contenido se oculta al instante y vuelve a `media_review_queue`. Solo lo ven **familias registradas de la liga** (y admin), con **URLs firmadas**.
7. **Tarjeta de resultado** para Instagram (1080×1350) y WhatsApp (1080×1080): logos, colores, marcador, goleadores (`public_match_scorers`, solo nombre + inicial) y marca Panama Global Sports. Imagen generada en servidor con `next/og` (`ImageResponse`). En U6/U8 sin goleadores (la vista ya no los devuelve). Botón de compartir con Web Share API (`navigator.share` con archivo), con descarga como alternativa.
8. **Crónica automática** con la API de Claude (`@anthropic-ai/sdk`, modelo `claude-opus-5-5`, solo servidor, `ANTHROPIC_API_KEY` en variables de entorno). Entrada: eventos del partido (sin datos privados). Reglas: tono siempre positivo y celebratorio, nunca mencionar errores ni criticar a un niño, solo nombre + inicial, **80–120 palabras**, español; en U6/U8 centrada en el equipo, sin destacar individuos. Se guarda como **borrador** en `match_chronicles`; el admin la edita y la publica. Validar en código el conteo de palabras y que no aparezcan apellidos completos antes de guardar.
9. **Certificado en PDF** por jugador al finalizar un torneo (`tournaments.status = 'finalizado'`): nombre, equipo, categoría, temporada y estadísticas (partidos jugados, goles, asistencias, MVPs, estrellas). En U6/U8: participación y valores, **sin números individuales** (la vista devuelve `null`). Solo lo descarga la familia vinculada (vista `my_family_tournament_certificates`, con el año de la temporada).

## Hoja de ruta (orden aprobado el 2026-11-13)

Construir **una fase a la vez** y esperar aprobación antes de empezar la siguiente.

0. ✅ Base de datos aplicada en Supabase (6 migraciones + seed + usuario admin) — 2026-11-13.
1. ✅ Fundamentos: conexión Supabase, login, refresco de sesión en `src/proxy.ts`, PWA instalable. Tipos generados desde Supabase.
2. ✅ Consulta pública: Inicio, Calendario, Equipos (+ detalle), Estadísticas (posiciones, líderes, estrellas U6/U8), página de partido.
3. ✅ Panel admin (`/admin`): torneos, equipos (logo), jugadores (foto + consentimiento, borrado total), partidos y delegados, familias, usuarios y roles, canchas. Migración 7 (`admin_helpers`) aplicada.
4. ✅ Marcador en vivo: consola del delegado en `/delegado` (iniciar, eventos con minuto, anular, asistencia, finalizar, MVP) + Realtime en la página pública del partido e Inicio.
5. ✅ Cuenta de familia (`/familia`): hijos con estadísticas y próximo partido, consentimiento de foto, equipos seguidos (botón también en la página del equipo), voto MVP en la página del partido. Panel: MVP por liga (delegado o votación) y cierre manual de la votación.
6. ✅ Notificaciones push (`/avisos`, resultado final al terminar, cron diario con recordatorios y cierre de votaciones). Desplegado en Vercel: https://panama-global-sports.vercel.app — 2026-11-14.
7. ✅ Tarjetas de resultado para compartir (`next/og`, Instagram 1080×1350 y WhatsApp 1080×1080) — 2026-11-14.
7b. ✅ **Reestructuración al modelo de torneos** (migración 8, `tournament_model`) — 2026-11-15. Sustituye la temporada única por organización → liga → circuito → torneo → categoría. Aplicada en Supabase y desplegada.
8. ✅ Crónica con la API de Claude (`/admin/cronicas`) — 2026-11-15. Construida y desplegada, pero APAGADA hasta que haya `ANTHROPIC_API_KEY` con saldo.
9. ◐ Galería de FOTOS (`/galeria`, subida en la página del partido, revisión en `/admin/galeria`) — 2026-11-15. Agrupada por **jornada**. **El video queda fuera**: sigue sin decidirse cómo procesarlo.
10. ✅ **Patrocinios** (migración 9, `sponsorships`) — 2026-11-15. Aplicada en Supabase. Panel en `/admin/patrocinios` y espacios en la página de categoría y en la de partido. Falta vender: no hay ningún patrocinador cargado.
11. ✅ **Certificados PDF** al finalizar cada torneo (`/familia`, ruta `/familia/certificado`) — 2026-11-16. Migración 10: el certificado es un espacio de patrocinio más (`certificado`).
Futuro: álbum de figuritas y fantasy.

Decisiones tomadas: tabla de posiciones visible en todas las categorías. MVP en todas las categorías (con nombre). U6 y U8 en modo `individual_ranking` (goleadores con nombre y rankings), configurable en /admin/categorias.
Decisión 2026-11-15: la temporada es el año vigente (dueño), y el modelo pasa a torneos.
Decisiones pendientes: precios de cada nivel de patrocinio y si hace falta el rol Comercial; cómo procesar videos (fase 9); si la ficha de un jugador se puede compartir como imagen; alcance del voto MVP (uno por partido vs. uno por equipo); calendario anual (en qué orden van Academias, Escolares, Apertura, Clausura y Navidad); si los primeros puestos clasifican a una final (el mockup lo dice, el dueño no lo ha confirmado, y por eso la tabla no resalta ningún puesto); el historial (`/historial`); el consentimiento sigue siendo un solo booleano y la especificación pide dos (foto de perfil y fotos de galería); **SMTP propio, que bloquea abrir la app a los padres**.
Ideas pospuestas: reloj del partido guardado en la BD con botones "Medio tiempo / Reanudar" (hoy el minuto corre en tiempo real desde el inicio y el ajuste −/+ del delegado es local y el público no lo ve).

### Base de datos (`supabase/migrations/`)

```
organizations → leagues (mvp_mode, colores) → categories (recognition_mode)
circuits (academias | escolares) · tournament_types (apertura | clausura | copa-navidad)
tournament_type_circuits (combinaciones válidas: Navidad solo en Academias)
tournaments (league × circuit × type × year; slug, fechas, status) → tournament_categories
matchdays (tournament × número; agrupa partidos y, en la fase 9, galerías)
teams (tournament × category; colores, logo_path, club_name)
players (privada) ← roster_entries (player × team × tournament; número, posición)
matches (tournament, category, matchday, home/away, venue, starts_at, status, marcador)
match_events (match, team, player, event_type, minute, voided_at) → event_types.points (≥ 0)
match_mvps (match × team) · mvp_votes (match × family)
profiles (role: admin | delegate | parent) · families · family_members · family_players · match_officials
team_follows · notification_preferences · push_subscriptions · notification_log (solo servidor)
match_attendance (partidos jugados) · media_items → media_tags · match_chronicles
```

- **Público lee**: `sports, organizations, leagues, circuits, tournament_types, tournament_type_circuits, tournaments, tournament_categories, categories, matchdays, venues, teams, roster_entries, matches, match_attendance, event_types, match_events, match_mvps`, crónicas publicadas y las vistas `public_players`, `standings`, `scoring_events`, `player_season_stats`, `season_leaders`, `team_season_recognitions`, `public_match_scorers`.
- **Solo familias de la liga (y admin)**: galería aprobada (`media_items`, bucket `match-media`).
- **Solo la familia del niño (y admin)**: `my_family_player_stars`, `my_family_tournament_certificates`, `mvp_votes` de su familia, datos completos en `players`.
- **Nunca leer `players` desde el público**: usar `public_players` (nombre + inicial, foto solo con consentimiento).
- **Escritura**:
  - admin: todo.
  - delegate (asignado en `match_officials`): `start_match`, `finish_match`, cargar/corregir eventos mientras el partido está en vivo y hasta 1 h después del final, `set_match_mvp`.
  - parent: `set_photo_consent()`, `cast_mvp_vote()`, sus equipos seguidos, preferencias y suscripciones push.
- Acciones con reglas de negocio = **funciones RPC `security definer`** que validan permisos; no abrir políticas de escritura amplias.
- Los roles se cambian solo por un admin (o desde el SQL Editor). El registro siempre crea `parent`.
- Storage: `team-logos` (público), `player-photos` (privado, servido solo con consentimiento), `media-uploads` (cuarentena, solo servidor lee), `match-media` (privado, URLs firmadas).
- Pruebas de BD: `npm run test:db` (PGlite simula Supabase). Ejecutarlo tras cualquier cambio en migraciones o seed y añadir pruebas para cada regla nueva de RLS.
- Esquema unificado en 6 archivos: `…000100_core_schema` (tablas), `…000200_functions_and_rls` (acceso, triggers, RLS), `…000300_rpc` (acciones), `…000400_views` (todo lo calculado), `…000500_storage` (buckets), `…000600_reference_data_and_realtime`.
- Cambios de esquema = **nueva migración** con timestamp; nunca editar una migración ya aplicada en Supabase. Datos de prueba en `supabase/seed.sql`.
- Futuro álbum/fantasy: las figuritas referencian `roster_entries`; los puntos salen de `match_events`.

## Stack

- **Next.js 16** (App Router, `src/`, Turbopack, `cacheComponents` activado) + **TypeScript** estricto
- **Tailwind CSS v4** (configuración en `src/app/globals.css` vía `@theme`, no hay `tailwind.config`)
- **Supabase**: Postgres + Auth (`@supabase/ssr`, `@supabase/supabase-js`)
- Iconos: `lucide-react`
- Deploy: **Vercel**
- Entorno de desarrollo: **Windows** (los scripts deben funcionar en PowerShell; no depender de bash)

### Notas de Next.js 16

- Esta versión tiene cambios incompatibles con versiones anteriores: leer la guía en `node_modules/next/dist/docs/` antes de usar una API.
- `middleware.ts` ahora se llama **`proxy.ts`** (va en `src/proxy.ts`). Ahí irá el refresco de sesión de Supabase cuando se implemente auth.
- Con `cacheComponents`, los client components que usan `usePathname`/`useSearchParams` deben ir dentro de `<Suspense>` para no romper el prerender en rutas dinámicas.

## Autenticación y PWA (fase 1)

- **Login sin contraseña con código de 6 dígitos por email** (`signInWithOtp` + `verifyOtp`), no con enlace mágico: en una PWA instalada el enlace se abre en el navegador, no en la app. Página `/ingresar`, acciones en `src/app/ingresar/actions.ts`.
- Mientras Supabase use su correo por defecto (no deja editar plantillas), el correo trae un **enlace**: vuelve a `/auth/callback` (flujo PKCE, abrir en el mismo navegador). Con SMTP propio, añadir `{{ .Token }}` a las plantillas *Magic Link* y *Confirm signup* para usar el código. Antes de abrir la app a los padres hace falta SMTP propio (el correo por defecto solo llega al equipo del proyecto y tiene límite por hora).
- `getCurrentUser()` llama a `connection()` primero: la sesión nunca se prerenderiza y `getClaims()` usa `Date.now()`.
- **Leer la sesión solo con `getCurrentUser()` / `requireUser()` / `requireRole()`** de `src/lib/auth.ts` (Data Access Layer). Usa `getClaims()` (valida el JWT). Con Cache Components, todo componente que lea la sesión va dentro de `<Suspense>` con un fallback del mismo tamaño.
- `requireRole` es solo comodidad de UI: la seguridad real la imponen RLS y las RPC en la BD.
- `src/proxy.ts` refresca la sesión en cada petición. Si faltan las variables de Supabase, la app funciona sin login (`getSupabaseEnv()` devuelve null).
- Redirecciones tras login: siempre con `safeNextPath()` (evita redirecciones abiertas).
- PWA: `src/app/manifest.ts`, iconos en `public/icons/` (se regeneran con `npm run icons`), service worker estático en `public/sw.js` (página `/offline` y manejo de push). Se registra **solo en producción**; para probarla en local: `npm run build` y `npm start`. Al cambiar `sw.js`, subir `CACHE_VERSION`.
- `experimental.useOffline` activo: `<OfflineBanner />` avisa cuando se pierde la conexión y Next reintenta solo.
- Tipos de BD: `src/types/database.ts` se genera con `npm run db:types` (usa `SUPABASE_ACCESS_TOKEN` de `.env.local`). Regenerar después de cada migración aplicada. No editar a mano.

## Datos públicos (fase 2)

- Lectura pública en `src/features/league/data.ts`: cliente **sin cookies** (`createPublicClient()`) + `'use cache'` con `cacheLife("minutes")` y `cacheTag(...)`. Nunca usar el cliente con sesión para datos públicos (rompe la caché).
- Las vistas de Postgres no traen relaciones: se consultan aparte y se unen en TypeScript (mapas por id).
- Filtros por URL legibles: `?cat=boys-u10` (`Category.key` = género de la liga + código). `resolveCategory()` usa la primera categoría si falta o es inválida.
- Páginas con `searchParams` o `params`: el contenido va en `<Suspense>` con `params.then(...)` (Next 16 + Cache Components). Validar ids con `isUuid()` y `notFound()`.
- Línea de tiempo pública: goles, asistencias, fair play y **tarjetas** (decisión del dueño 2026-11-13); las atajadas no se muestran para no saturar. En U6/U8 sin nombres en la línea de tiempo ("Gol de <equipo>"), pero el MVP sí se muestra con nombre.
- Fotos de jugadores aún no se muestran (círculo con el número); se activarán cuando el admin pueda subirlas (fase 3), con URLs firmadas.
- Móvil: tarjetas (`MatchCard`) y tabla de posiciones compacta. Desktop: `MatchTable` y tabla completa (PJ, G, E, P, GF, GC, DG, Pts).

## Panel de administración (fase 3)

- Rutas en `src/app/admin/*`; cada sección tiene `page.tsx` + `actions.ts`. Acceso desde **Más → Panel de administración** (solo admin).
- **Next ejecuta layout y página en paralelo**: el control del layout (`AdminGate`) no basta. Toda lectura privada va en `src/features/admin/data.ts` con `adminClient()` (verifica el rol antes de consultar). Nunca usar `createClient()` directo en páginas del panel.
- Toda acción pasa por `runAdmin()` (`src/features/admin/action.ts`): verifica rol, usa la sesión (RLS) y traduce errores de Postgres al español. Validación con **zod** (`parseForm`). Tras escribir, `refreshPublic(tags)` (= `updateTag`) para que el público vea el cambio al instante.
- Formularios con `<AdminForm>` (`src/features/admin/form.tsx`): no borra lo escrito si hay error, muestra errores por campo y reduce fotos en el navegador (≤1600 px) antes de enviarlas.
- Imágenes: `processImage()` con **sharp** en el servidor → WebP, sin EXIF/GPS. Logos en `team-logos/{team_id}/…` (público); fotos en `player-photos/{player_id}/…` (privado, URL firmada de 1 h). Límite de acciones: 4 MB (`next.config.ts`).
- No exportar nada que no sea el componente/metadata desde un `page.tsx` (constantes en `src/features/admin/constants.ts`).
- **Nunca importar constantes, arrays o funciones desde un archivo `"use client"` en un componente de servidor**: llegan como referencia vacía (p. ej. `ADMIN_SECTIONS.slice is not a function`). Los datos compartidos van en archivos neutros (sin directiva), como `src/features/admin/sections.ts`.
- Fechas de partidos: el admin escribe hora de Panamá (UTC−5, sin horario de verano) → se guarda en ISO.

## Marcador en vivo (fase 4)

- Consola en `/delegado/partidos/[id]` (`live-console.tsx`, cliente). Pensada para una mano en el celular: botones ≥ 64 px, hoja inferior con números de camiseta, pantalla siempre encendida (Wake Lock) mientras está en vivo.
- Lecturas en `src/features/live/data.ts` con `liveClient()` (verifica rol delegate/admin antes de consultar). Nombres siempre desde `public_players` (el delegado no lee `players`).
- Escrituras SOLO por acciones de servidor (`src/app/delegado/actions.ts`, `runLive`): RLS/RPC imponen que el delegado esté asignado y que el partido sea editable (en vivo o ≤ 1 h tras el final). Tras cada acción: `updateTag("matches")` y `updateTag("match-<id>")`.
- Tiempo real: `<LiveRefresher matchId>` se suscribe a `matches`, `match_events` y `match_mvps` y hace `router.refresh()` (con espera para agrupar cambios). Inicio usa `<LiveRefresher delayMs={5000}>`. El minuto en vivo se calcula en el cliente desde `started_at` (`<LiveMinute>`).
- El admin entra a cualquier marcador desde **Panel → Partidos → Abrir marcador**; en `/delegado` ve sus asignados + los de hoy + los en vivo.
- El marcador nunca se escribe a mano en vivo: lo recalcula la BD desde los goles (autogol suma al rival). Errores = anular (`voided_at`), nunca borrar.

## Cuenta de familia (fase 5)

- `/familia`: datos en `src/features/family/data.ts` (sesión; RLS limita a los hijos de la familia). Acciones en `src/app/familia/actions.ts` (`runFamily`): consentimiento (`set_photo_consent`), seguir equipos (`team_follows`), voto (`cast_mvp_vote`).
- Piezas con sesión dentro de páginas públicas en `src/features/family/sections.tsx` (`FollowTeamSection`, `MvpVoteSection`), siempre en `<Suspense>`.
- Votación visible solo si la liga tiene `mvp_mode = parent_vote`, el partido terminó y no venció el plazo. Estados: ingresar / no elegible / ya votó / votar. Los votos son secretos (cada familia solo ve el suyo).
- El cierre de votaciones es manual (Panel → Partidos → Cerrar votación) hasta que la fase 6 programe `close_expired_mvp_votes()`.
- Si una cuenta no tiene hijos vinculados, `/familia` muestra su correo para que el admin la vincule.

## Notificaciones push (fase 6)

- `/avisos`: activar/desactivar en el dispositivo (Web Push con VAPID), aviso de prueba y preferencias (recordatorio, resultado). En iPhone solo con la app instalada (iOS 16.4+).
- Envío solo en servidor: `src/features/notifications/send.ts` (`notifyUsers`) con `createServiceClient()` (`src/lib/supabase/admin.ts`, clave de servicio, ignora RLS: nunca en cliente). Respeta preferencias, deduplica con `notification_log` y borra suscripciones caducadas (404/410).
- Resultado final: `after(() => sendFinalResult(id))` al finalizar (delegado) o al marcar finalizado (admin).
- Cron diario `/api/cron/diario` (vercel.json, 22:00 UTC = 5 p. m. Panamá): recordatorios de los partidos de mañana + `close_expired_mvp_votes()`. Protegido con `Authorization: Bearer CRON_SECRET`. En el plan gratuito de Vercel los crons solo pueden ser diarios: las votaciones se cierran hasta un día después del plazo (o a mano desde el panel).
- Los avisos solo llevan nombres de equipos, nunca datos de niños.
- Si un aviso falla con 401/403, la pareja VAPID del servidor no coincide con la de la suscripción. Subir variables a Vercel sin copiar a mano: `npx vercel@65.16.0 env add NOMBRE --environment production --force --yes` con el valor por stdin, y luego `redeploy` (las variables solo aplican tras desplegar).
- `web-push` v4 es ESM: usar imports con nombre (`import { sendNotification, setVapidDetails } from "web-push"`).

## Galería de fotos (fase 9)

- Flujo: el navegador sube el ORIGINAL a `media-uploads/{user_id}/…` (cuarentena, nadie la lee desde la app) → la acción `registerUpload` crea la fila en `processing` **con la sesión del usuario**, para que RLS compruebe `can_upload_media` → `processMedia()` (servidor, clave de servicio) quita EXIF/GPS con sharp, comprime a WebP (1600 px y miniatura de 480), escribe en `match-media` y pasa la fila a `pending_review` → un admin aprueba en `/admin/galeria`.
- **El original no pasa por la acción de servidor** a propósito: una foto de celular supera el límite de 4 MB. Por eso la cuarentena.
- Nada de lo que se ve sale de rutas públicas: siempre URLs firmadas de 1 h, y quién ve qué lo decide `can_view_media` en la BD, no el código.
- El bloqueo por consentimiento lo impone el trigger `guard_media_status`: si en la foto hay un niño sin `photo_consent` y sin `redacted`, **no se puede aprobar**. El admin recorta la foto y marca "Ya lo recorté". Si un padre retira el consentimiento después, la foto vuelve sola a `media_review_queue`.
- Galería pública en `/galeria` agrupada por **jornada** (`matchdays`), no por partido: es como la vive una familia. Solo con sesión.
- La pantalla sigue el mockup: filtro de liga (Todas / Boys / Girls), lista de torneos con fotos (el actual arriba y los anteriores debajo) y un **visor** con la foto grande, quiénes aparecen y los botones de descargar y compartir. Los filtros van en la URL (`?torneo=<slug>&liga=boys`); elegir una foto es estado del cliente, porque las URLs firmadas ya viajaron con la página.
- **El slug de un torneo no es único**: Boys y Girls tienen cada uno su "academias-clausura-2026". Por eso el selector agrupa por slug y `getGalleryByMatchday` recibe una lista de ids, no uno solo.
- "Aparecen: …" sale de `media_tags` con `redacted = false` y nombres de `public_players`. A un niño recortado **no se le nombra**: decirlo contaría lo que la foto ya no cuenta.
- **Video: fuera de alcance por ahora.** `sharp` solo procesa imágenes; el video necesita ffmpeg o un servicio externo y las funciones de Vercel tienen límites. La subida rechaza videos con un mensaje claro y `processMedia` marca como rechazado cualquier `kind <> 'photo'`. Decidir antes de retomarlo.
- Pruebas: `npm run test:media` comprueba con el mismo pipeline que una foto con GPS sale sin un solo metadato. Es la garantía de privacidad de esta fase: si se toca `processMedia`, correrla.

## Patrocinios (fase 2 de la especificación del dueño)

Es la **fuente principal de ingresos**. Un patrocinador se asigna a un espacio dentro de un ámbito y unas fechas; el código solo pregunta "¿quién va en este espacio, en esta página, hoy?". Vender un espacio nuevo no debe ser un despliegue.

- Migración 9 (`20261115000900_sponsorships.sql`): `sponsors` · `sponsorship_tiers` (niveles) · `sponsorship_slots` (catálogo de espacios) · `sponsorship_contracts` · `sponsorship_placements` (asignaciones) · `sponsorship_metrics` (impresiones y clics por día).
- **Espacios** (los códigos son los del documento, en español): `liga_header`, `torneo_header`, `partido_pagina`, `certificado`, `album_portada`, `album_figurita`, `album_sobre`, `fantasy_premio`. Los tres últimos son de fases futuras: están en el catálogo pero todavía no se pintan. `certificado` lo añadió la migración 10 y no sale del documento: es la única pieza que acaba impresa en una casa.
- **Ámbitos**, del más específico al más general: `categoria`, `torneo`, `circuito`, `liga`, `organizacion`. `scope_id` es una referencia polimórfica (no hay FK posible); un trigger comprueba que la fila exista.
- La regla de quién gana vive en `src/features/sponsors/pick.ts`, un **archivo neutro y sin acceso a datos**: gana el ámbito más específico que tenga asignación (no se acumulan), después la `priority` y, si hay empate, se rota por `rotation_weight`. Pruebas: `npm run test:sponsors`.
- **La portada no lleva patrocinios** (lo dice el documento). Eso lo cumple el código, no la base.
- La exclusividad la impone un trigger: dos asignaciones exclusivas no pueden cruzar fechas en el mismo espacio y ámbito. El nivel dice si es exclusivo y el valor baja solo a la asignación.
- El público **no lee ninguna tabla de patrocinios**: lee la vista `active_sponsor_placements`, que solo devuelve lo vigente hoy de contratos activos y nunca montos ni contactos. "Hoy" es el día en **Panamá** (UTC−5), no el del servidor: de noche no son el mismo día.
- Las métricas se escriben solo por `record_sponsor_event(placement, 'impression' | 'click')`, nunca con una política abierta. El reporte por contrato sale de `sponsorship_contract_report` (solo admin).
- Logos en el bucket `sponsor-logos` (público, como los de los equipos).
- **Dónde se pintan hoy**: `liga_header` y `torneo_header` en la cabecera de la pantalla de categoría, `partido_pagina` bajo el marcador y `certificado` en el pie del PDF. Este último no lo avisa el navegador: la impresión la cuenta el servidor al generar el certificado. El `<SponsorSlot>` llama a `connection()` a propósito: si se prerenderizara, la rotación quedaría congelada en el build y un patrocinador se llevaría todas las impresiones.
- La **impresión** la avisa el navegador con `sendBeacon` a `/api/patrocinio/:id/vista`; el **clic** pasa por `/api/patrocinio/:id/ir`, que cuenta y luego redirige, y lee el destino de la base (nunca de la URL) y solo si es http(s).
- Panel en `/admin/patrocinios`: contratos con sus impresiones y clics, asignación de espacios, marcas y cambio de estado. El ámbito se elige en un solo desplegable (`liga:<uuid>`), agrupado por tipo.
- Tras escribir, `refreshPublic("sponsors")`; las lecturas públicas van con `cacheTag("sponsors")`.
- Pendiente de la especificación: el rol **Comercial** (patrocinios y reportes, sin ver datos de jugadores). Hoy solo el admin administra patrocinios; añadirlo es un valor más en `app_role` y tocar las políticas.

## Certificados (fase 11)

- Ruta `/familia/certificado?jugador=<uuid>&torneo=<uuid>`, enlazada desde la sección **Certificados** de `/familia`. Devuelve un PDF con `Cache-Control: private, no-store`.
- El permiso lo impone la base: la vista `my_family_tournament_certificates` solo devuelve torneos **finalizados** y solo los hijos de quien pregunta. La ruta no comprueba nada más; si la vista no trae fila, es un 404 (no es su hijo, o el torneo sigue en curso: la misma respuesta a propósito).
- `display_name` es una columna **generada** (`first_name || ' ' || last_initial || '.'`): el certificado no puede mostrar el apellido completo ni queriendo.
- En categorías con `recognition_mode = 'team_stars'` la vista devuelve `null` en todas las cifras, la lista de estadísticas queda vacía y la plantilla cambia sola a participación y valores. No es la interfaz la que oculta los números: nunca llegan.
- Se dibuja con Satori (`next/og`, mismas fuentes Geist que la tarjeta de resultado) a 2200×1700 px y `pdf-lib` mete esa imagen en una página **carta horizontal** (792×612 pt = 200 ppp). Es imagen y no texto seleccionable a propósito: lo que importa es que se imprima igual en cualquier parte.
- El navy va solo en las bandas de arriba y abajo; el cuerpo queda claro. Un fondo navy completo se come el tóner de una impresora de casa, y de paso evita el problema de que el logotipo trae su propio fondo navy difuminado.
- El pie lleva el espacio de patrocinio `certificado`. Como no hay navegador que avise, la **impresión** la registra el servidor con `after(() => recordSponsorEvent(...))` al generar el PDF.
- `outputFileTracingIncludes` incluye `assets/fonts/*.ttf` también para `/familia/certificado`: las fuentes se leen del disco en tiempo de ejecución.

## Crónica automática (fase 8)

- Al finalizar un partido, `after(() => generateChronicle(id))` (delegado y admin) pide el texto a la API de Claude y lo guarda como **borrador** en `match_chronicles`. Nunca publica: eso lo hace un admin en `/admin/cronicas`.
- `src/features/chronicles/generate.ts` (solo servidor): modelo `claude-opus-5-5`, `effort: "low"`, con `fallbacks` por si un clasificador rechaza la petición (si la cuenta no los admite, repite la llamada sin ellos). Escribe con `createServiceClient()`.
- **La privacidad no se delega en el prompt.** `src/features/chronicles/rules.ts` (archivo neutro, con pruebas) rechaza el texto si: no tiene entre 80 y 120 palabras; un nombre que enviamos aparece seguido de otra palabra con mayúscula que no es su inicial ("Carlos Méndez"); o aparece un "Nombre I." que no jugó ese partido. Si falla, se le dicen los problemas al modelo y se reintenta **una** vez; si sigue mal, no se guarda nada.
- Las mismas reglas se revalidan al publicar, porque el admin puede editar el texto a mano.
- Al modelo solo le llegan nombres de `public_players` (nombre + inicial), equipos, marcador, minutos y tipo de evento. Nunca apellidos ni datos privados.
- En categorías con `recognition_mode = 'team_stars'`, los eventos van sin nombre y el prompt pide una crónica centrada en los equipos.
- Sin `ANTHROPIC_API_KEY` no se genera nada y **no se rompe nada**: finalizar el partido funciona igual. La clave se crea en https://platform.claude.com/settings/keys y necesita saldo; hay que subirla también a Vercel.
- Costo real: ~US$ 0.018 por crónica, ~US$ 13 al año con 750 partidos. Conviene poner un tope de gasto en la consola de Anthropic.
- Pruebas: `npm run test:rules`. Añadir un caso por cada regla nueva.

## Comandos

```powershell
npm run dev     # servidor local en http://localhost:3000
npm run build   # build de producción (correr antes de dar algo por terminado)
npm run lint
npm run test:db # pruebas de la base de datos (PGlite simula Supabase)
npm run test:rules # reglas de las crónicas (privacidad y longitud)
npm run test:media # el procesado de fotos borra EXIF/GPS
npm run test:sponsors # qué patrocinador gana cada espacio
npm run icons   # regenera los iconos de la PWA
npm run db:types  # tipos de TypeScript desde Supabase (requiere `npx supabase login` una vez en tu terminal)
```

## Estructura

```
src/
  app/                  # rutas (App Router)
  components/
    layout/             # AppShell, SiteHeader (desktop), BottomNav (móvil), nav-items
    ui/                 # componentes reutilizables
  features/             # lógica por dominio (leagues, teams, matches, stats; luego album, fantasy)
  lib/supabase/         # clientes Supabase (client.ts = navegador, server.ts = servidor)
  types/                # tipos compartidos (incl. tipos generados de la BD)
supabase/migrations/    # migraciones SQL (cuando exista la BD)
```

## Reglas de diseño: mobile-first, layouts distintos por dispositivo

No es la versión desktop encogida. Cada vista se diseña **dos veces**:

| | Móvil (< `md`, 768px) | Desktop (≥ `md`) |
|---|---|---|
| Navegación | Menú inferior fijo tipo app: Inicio, Calendario, Equipos, Estadísticas, Más | Menú superior horizontal |
| Contenido | Tarjetas, una columna | Tablas completas, varias columnas |
| Interacción | Áreas táctiles ≥ 44px, gestos simples | Hover, densidad mayor de información |

- Escribir estilos base para móvil y añadir `md:` / `lg:` para desktop. Nunca al revés.
- Cuando la estructura cambia (tarjetas vs. tabla), renderizar **dos componentes** (`md:hidden` / `hidden md:block`) en lugar de forzar uno solo con muchos breakpoints.
- La navegación vive en `src/components/layout/nav-items.ts`, en **dos listas**: `DESKTOP_NAV` (la del diseño: Torneos, En vivo, Calendario, Galería, Álbum, Fantasy, Historial) y `NAV_ITEMS` (los cinco destinos del menú inferior en móvil). Las entradas con `soon: true` se pintan apagadas porque su pantalla no existe; al construirla, quitar la marca.
- **Portada** (`src/app/page.tsx`), en orden: barra `<TodayBar>` (partidos del día **más cualquiera en vivo**, aunque su fecha sea otra) · `<LiveHero>` si hay partido en curso, si no la presentación de los torneos · `<TournamentCards>` (una por liga, en su color, con jornada y categorías) · últimos resultados junto a `<WeekMvpCard>` (el MVP más reciente como figurita) · próximos partidos · `<UpcomingBanner>`, que **solo aparece si algún torneo está en estado `inscripciones`**.
- `match_mvps` **no tiene `created_at`**: para saber cuál es el MVP más reciente hay que partir del último partido jugado (`matches.starts_at`), como hace `getWeekMvp()`.
- Las categorías de un torneo se ordenan por el orden de `getCategories()` (liga y luego edad), no por el que devuelva la BD.
- Solo puede haber **un `<LiveRefresher>` por página**: dos se suscriben al mismo canal de Realtime y el segundo lanza "cannot add postgres_changes callbacks after subscribe()".
- El minuto en vivo (`<LiveMinute>`) se oculta pasados 150 minutos: un marcador que el delegado dejó abierto anunciaba "2974'".
- `<BrandBackdrop>` dibuja el balón y las vetas de luz en SVG; acompaña a `bg-brand-gradient` en el header.
- **Pantalla de categoría** (`/ligas/:liga/:torneo/:categoria`, p. ej. `/ligas/boys/academias-copa-navidad-2026/u10`): la página central del diseño, donde una familia ve todo lo de su hijo. `liga` es el género de la liga, `categoria` el código en minúsculas y `torneo` el slug. Las rutas se arman con `categoryPath()` (`src/features/league/paths.ts`, archivo neutro), nunca a mano.
  - Cinco pestañas en `?v=`: Tabla (posiciones + líderes + próxima jornada), Calendario, Resultados, Líderes y Equipos. `?v=tabla` se omite de la URL.
  - `resolveCategoryRoute()` devuelve categoría + torneo + los torneos de esa categoría; si algo no existe, `notFound()`. Con PPR el HTTP sigue siendo 200 y el 404 llega en el stream: es lo normal en Next 16.
  - La forma ("Últimos 5") sale de `getRecentForm()`, calculada desde los partidos finalizados. En móvil va debajo del nombre del equipo; en desktop tiene su propia columna.
  - `/ligas` es el índice de torneos y es a donde apunta "Torneos" en el menú de desktop. Los torneos que la migración 8 dejó sin categorías (Apertura y Clausura, que no traían datos propios) aparecen ahí como finalizados y vacíos: es real, no un error.
  - `/estadisticas` y `/equipos` siguen existiendo (están en el menú móvil) y ahora enlazan a esta pantalla.
- **Ficha de jugador** (`/jugadores/[id]`, con `?torneo=<slug>` para ver otro torneo): la figurita del diseño y el anticipo del álbum. Se llega desde el plantel de un equipo, desde los líderes y desde el MVP de la portada.
  - **Pide sesión y lleva `robots: { index: false }`.** Los datos que muestra son los públicos de la liga, pero una página por niño, abierta y rastreable, es justo lo que la Ley 81 pide evitar. Sin sesión no se consulta nada: el nombre no llega ni en el HTML.
  - La foto sale de `public_players.photo_path`, que es nulo sin consentimiento; sin ella se dibuja una silueta y se explica por qué. La política del bucket tampoco dejaría firmarla.
  - Las **insignias** (`getBadges`) salen de hechos reales: goles, triplete en un partido, cinco fair play, MVP y campeón del torneo. Ninguna es decorativa; una insignia que no se ganó no celebra nada.
  - **No hay botón de "Compartir tarjeta"** aunque el mockup lo tenga: exportar la ficha de un menor como imagen es una decisión del dueño, no una de diseño.
- Respetar `env(safe-area-inset-bottom)` en el menú inferior (iPhone).
- **Identidad (2026-11-15)**: navy y dorado, muestreados del logotipo. Tokens en `globals.css`, nunca hex sueltos en componentes:
  - `navy` `#010f2a` y `navy-soft` `#001743` — fondo de marca. La clase `bg-brand-gradient` reproduce el degradado que el logo trae debajo de sí: se usa en el header, el menú inferior, el hero y las piezas de marca.
  - `gold` `#dfaf42` y `gold-bright` `#fff08b` — llamadas a la acción y texto sobre navy.
  - `boys` `#29abe2` y `girls` `#ed1e79` — color de cada liga; `fair` `#8cc63f` para fair play; `live` `#ed1e79` para "en vivo".
  - `brand-blue` `#0a2250` (botones y enlaces sobre fondo claro) y `brand-red` `#d21034` (solo errores y acciones destructivas).
- Tipografía: **Lilita One** (`font-display`) en títulos y marcadores, en mayúsculas; Geist para el resto.
- Logotipo en `public/brand/`: `logo.webp` (bloque completo, desktop) e `isotipo.webp` (solo el globo, móvil). **Traen el fondo navy difuminado con el que fueron diseñados**: solo se ven bien sobre `bg-brand-gradient`, nunca sobre blanco. Si hace falta una versión para fondo claro, hay que pedirla al diseñador.

## Privacidad: los jugadores son menores de edad (PRIORIDAD)

Aplica la Ley 81 de 2019 de Protección de Datos Personales de Panamá. En caso de duda, mostrar menos.

1. **Datos públicos de un jugador**: nombre + inicial del apellido (p. ej. "Carlos M."), número de camiseta, equipo, categoría y estadísticas deportivas. Nada más.
2. **Nunca públicos**: fecha de nacimiento exacta, dirección, escuela, teléfono, email, documentos de identidad, datos médicos, apellidos completos.
3. **Fotos** de jugadores: solo con consentimiento explícito del padre/tutor guardado en la BD (`photo_consent`). Sin consentimiento → avatar genérico.
4. Las **cuentas** son de adultos (padres/tutores, entrenadores, admins). Un menor no se registra solo; el tutor gestiona su perfil.
5. **Row Level Security activado en todas las tablas** de Supabase, sin excepción. Los datos públicos se exponen mediante vistas (`public_players`, etc.) que solo contienen campos permitidos.
6. La `SUPABASE_SERVICE_ROLE_KEY` solo se usa en servidor. Nunca en código con `"use client"` ni con prefijo `NEXT_PUBLIC_`.
7. Sin chat ni mensajes de texto libre entre usuarios. Sin perfiles buscables de menores por nombre fuera del contexto de su equipo.
8. Imágenes y videos subidos: eliminar metadatos EXIF/GPS **en el servidor** antes de que nadie más los vea. Nada se publica sin aprobación de un admin.
9. No enviar datos de jugadores a servicios de analítica o terceros. Excepción: la API de Claude para crónicas recibe solo nombre + inicial y eventos del partido, nunca datos privados.
10. Todo texto generado por IA sobre niños es un borrador hasta que un admin lo aprueba.

## Fases futuras (NO construir todavía, pero diseñar pensando en ellas)

### Álbum digital de figuritas
- Sobres de 5 figuritas que se compran con **monedas** virtuales; intercambio de figuritas entre usuarios.
- Cada figurita referencia un `roster_entry` (jugador × equipo × temporada) → una colección por temporada.
- Implicaciones de arquitectura: tablas de ledger para monedas (movimientos inmutables, nunca un saldo editable directo), apertura de sobres e intercambios **solo en servidor** (funciones Postgres / route handlers) con transacciones atómicas.
- Riesgo regulatorio: sobres aleatorios pagados para menores se parecen a "loot boxes". Las compras de monedas las hace el tutor; publicar probabilidades. Revisar antes de construir.
- Las figuritas respetan las reglas de privacidad (foto solo con consentimiento).
- Intercambios con ofertas estructuradas (figurita por figurita), sin texto libre.

### Fantasy
- Usa `match_event` como fuente única de puntos → registrar estadísticas por evento desde el inicio, no solo totales.
- Ligas de fantasy privadas por código; sin exponer datos de menores más allá de lo público.

## Convenciones de código

- Server Components por defecto; `"use client"` solo cuando haga falta interactividad.
- Alias de imports: `@/*` → `src/*`.
- Nombres de archivos en `kebab-case.tsx`; componentes en `PascalCase`.
- Rutas en español (`/calendario`, `/equipos`, `/estadisticas`), porque son visibles para el usuario.
- Variables de entorno documentadas en `.env.example` (nunca commitear `.env.local`).
- Antes de terminar una tarea: `npm run lint` y `npm run build` sin errores.
