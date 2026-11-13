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

### Modelo de dominio (referencia)

```
sport → league → category (U8, U10…) → season → team → roster_entry (player × team × season)
match (season, category, home_team, away_team, fecha, cancha, resultado)
match_event (gol, asistencia, tarjeta…) → base para estadísticas, figuritas y fantasy
player (datos privados) ≠ user (cuenta de padre/tutor, admin, entrenador)
```

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

## Comandos

```powershell
npm run dev     # servidor local en http://localhost:3000
npm run build   # build de producción (correr antes de dar algo por terminado)
npm run lint
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
8. Imágenes subidas: eliminar metadatos EXIF (ubicación GPS).
9. No enviar datos de jugadores a servicios de analítica o terceros.

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
