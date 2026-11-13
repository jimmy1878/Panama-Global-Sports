@AGENTS.md

# Panama Global Sports

Plataforma web para ligas deportivas infantiles en Panamá. Interfaz y contenido en **español**; código (variables, funciones, tablas) en **inglés**.

## Contexto del negocio

- Primer deporte: **fútbol**. La arquitectura debe soportar otros deportes después (no asumir fútbol en el modelo de datos).
- Ligas actuales:
  - **Boys Champion League**: U6, U8, U10, U12, U14
  - **Girls Champion League**: U8, U10, U12, U14, U17
- Cada categoría: **6 equipos** de **12 a 18 jugadores**.
- **5 temporadas por año**. Los rosters cambian por temporada: un jugador pertenece a un equipo *en una temporada*, no de forma permanente.

## Alcance funcional (fase actual)

1. **Tabla de posiciones automática** por categoría y temporada: PJ, G, E, P, GF, GC, DG, Pts (3 victoria, 1 empate). Vista SQL `standings` calculada de los partidos finalizados; nunca se guarda a mano.
2. **Líderes de la temporada** (goles, asistencias, atajadas, fair play, MVP) calculados desde `match_events`. Cada categoría tiene `recognition_mode`:
   - `team_stars` (U6, U8): solo estrellas y reconocimientos de equipo. **Sin ranking individual ni tabla de goleadores** — las vistas de líderes excluyen estas categorías desde la BD, no solo desde la UI.
   - `individual_ranking` (U10 en adelante): ranking individual.
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
9. **Certificado de temporada en PDF** por jugador al cerrar la temporada (`seasons.closed_at`): nombre, equipo, categoría, temporada y estadísticas (partidos jugados, goles, asistencias, MVPs, estrellas). En U6/U8: participación y valores, **sin números individuales** (la vista devuelve `null`). Solo lo descarga la familia vinculada (vista `my_family_season_certificates`).

## Hoja de ruta (orden aprobado el 2026-11-13)

Construir **una fase a la vez** y esperar aprobación antes de empezar la siguiente.

0. ✅ Base de datos aplicada en Supabase (6 migraciones + seed + usuario admin) — 2026-11-13.
1. ✅ Fundamentos: conexión Supabase, login, refresco de sesión en `src/proxy.ts`, PWA instalable. (Pendiente: tipos generados con `npm run db:types`.)
2. Consulta pública: Inicio, Calendario, Equipos, Estadísticas (posiciones, líderes, estrellas U6/U8), página de partido.
3. Panel admin: temporadas, equipos, jugadores, familias, asignación de delegados.
4. Marcador en vivo (delegado) + Realtime + asistencia + MVP oficial.
5. Cuenta de familia: hijos, consentimiento, equipos seguidos, voto MVP, estrellas.
6. Notificaciones push (recordatorio y resultado final, Vercel Cron).
7. Tarjetas de resultado para compartir (`next/og`).
8. Crónica con la API de Claude.
9. Galería (subida, procesamiento, etiquetado, revisión).
10. Certificados PDF de temporada.
Futuro: álbum de figuritas y fantasy.

Decisiones pendientes: cómo procesar videos (fase 9); alcance del voto MVP (uno por partido vs. uno por equipo); MVP y tabla de posiciones en U6/U8.

### Base de datos (`supabase/migrations/`)

```
sports → leagues (mvp_mode) → categories (recognition_mode)     seasons (5/año, una is_current)
teams (season × category; colores, logo_path)
players (privada) ← roster_entries (player × team × season; número, posición)
matches (season, category, home/away, venue, starts_at, status, marcador, started_at, finished_at)
match_events (match, team, player, event_type, minute, voided_at) → event_types.points (≥ 0)
match_mvps (match × team) · mvp_votes (match × family)
profiles (role: admin | delegate | parent) · families · family_members · family_players · match_officials
team_follows · notification_preferences · push_subscriptions · notification_log (solo servidor)
match_attendance (partidos jugados) · media_items → media_tags · match_chronicles
```

- **Público lee**: `sports, leagues, categories, seasons, venues, teams, roster_entries, matches, match_attendance, event_types, match_events, match_mvps`, crónicas publicadas y las vistas `public_players`, `standings`, `scoring_events`, `player_season_stats`, `season_leaders`, `team_season_recognitions`, `public_match_scorers`.
- **Solo familias de la liga (y admin)**: galería aprobada (`media_items`, bucket `match-media`).
- **Solo la familia del niño (y admin)**: `my_family_player_stars`, `my_family_season_certificates`, `mvp_votes` de su familia, datos completos en `players`.
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
- Tipos de BD: `src/types/database.ts` es provisional hasta vincular el proyecto (`npx supabase link`) y ejecutar `npm run db:types`.

## Comandos

```powershell
npm run dev     # servidor local en http://localhost:3000
npm run build   # build de producción (correr antes de dar algo por terminado)
npm run lint
npm run test:db # pruebas de la base de datos (PGlite simula Supabase)
npm run icons   # regenera los iconos de la PWA
npm run db:types  # tipos de TypeScript desde Supabase (requiere `npx supabase link`)
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
- La navegación está definida una sola vez en `src/components/layout/nav-items.ts`; móvil y desktop la consumen.
- Respetar `env(safe-area-inset-bottom)` en el menú inferior (iPhone).
- Colores de marca como tokens en `globals.css` (`brand-blue`, `brand-red`, inspirados en la bandera de Panamá). No usar colores hex sueltos en componentes.

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
