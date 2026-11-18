# SPEC 12 — Catálogo de juegos desde Supabase

> **Status:** Implementada
> **Depends on:** SPEC 01, SPEC 02, SPEC 04, SPEC 09, SPEC 11
> **Date:** 2026-11-18
> **Objective:** Leer en el servidor el catálogo de juegos (título, descripciones, categoría, cover y color) desde la tabla `games` de Supabase en lugar de `GAMES` en `lib/data.ts`, y eliminar `GAMES`.

## Scope.

**In:**
- Módulo nuevo `lib/games.ts`, solo para servidor, con `getGames()` y `getGame(id)`, que leen `games` con `createClient` de `lib/supabase/server.ts` y devuelven objetos `Game`.
- Páginas que pasan a leer de la BD:
  - `app/juego/[id]/page.tsx` (ficha del juego).
  - `app/juego/asteroides/jugar/page.tsx`.
  - `app/salon-de-la-fama/page.tsx`.
  - `app/juego/page.tsx` (biblioteca).
  - `app/page.tsx` (home).
- Biblioteca y home son hoy client components. Cada una se divide en una página servidor que lee `games` y un componente cliente, con el código actual movido sin cambios, que recibe los juegos por props: `components/games/library.tsx` y `components/home/home-view.tsx`.
- `components/home/home-activity.tsx` deja de importar `GAMES` y recibe los juegos por props.
- `app/error.tsx` nuevo, para mostrar un mensaje claro con reintento cuando falla la lectura de la BD.
- Eliminar el reproductor genérico `app/juego/[id]/jugar/page.tsx`, una vista con HUD inventado que no corresponde al juego real. Asteroides sigue jugándose desde su ruta propia, `app/juego/asteroides/jugar/page.tsx`.
- Chips de categoría de la biblioteca derivados de `games`: `TODOS` más las categorías que tengan algún juego (hoy `SHOOTER`). El buscador se mantiene visible.
- Eliminar `GAMES` y `CATS` de `lib/data.ts`. Se conservan `Game`, `GameCategory`, `HomeStat` y `HOME_STATS`.
- Actualizar el comentario de `lib/scores/types.ts` que menciona `GAMES[].id`.

**Out of scope (para specs futuras):**
- Sembrar en `games` los 8 juegos mock. Hacerlo exigiría que `games.score_table` admita `NULL`; si se quiere recuperar el catálogo completo, va en su propio spec.
- Que la búsqueda y los chips de categoría de la biblioteca filtren de verdad (hoy no filtran nada; este spec solo deriva los chips de `games`).
- Cambiar el copy de `HOME_STATS`.
- Resolver la tabla de puntuaciones desde `games.score_table`: `lib/scores` conserva su mapa tipado (SPEC 11).
- Cualquier cambio en la base de datos, caché o revalidación, Realtime y panel para editar juegos.

## Data model

Este spec no cambia la base de datos ni crea migraciones. Lee la tabla `games` de SPEC 09. `Game` y `GameCategory` mantienen su forma actual, para que los componentes que los usan no cambien.

```ts
// lib/games.ts (solo servidor)
export function getGames(): Promise<Game[]>;              // orden estable por created_at asc
export function getGame(id: string): Promise<Game | null>; // null si no existe; lanza error si Supabase falla
```

Mapeo de la fila de `games` a `Game`:

| Columna de `games` | Campo de `Game` |
|---|---|
| `id` | `id` |
| `title` | `title` |
| `short_description` | `short` |
| `long_description` | `long` |
| `category` | `cat` (se valida contra `GameCategory`) |
| `cover` | `cover` |
| `color` | `color` (se valida contra `"cyan" \| "magenta" \| "green" \| "yellow"`) |
| `score_table`, `created_at` | no se exponen |

Convenciones:
- Los `check` de la tabla ya garantizan que `category` y `color` son válidos, pero los tipos generados los dan como `string`. El mapeo estrecha cada valor con una guarda de tipo y descarta la fila si no pertenece a la unión.
- `getGame` devuelve `null` si el juego no existe y las páginas responden `notFound()`. Si la consulta falla, `getGames` y `getGame` lanzan el error y lo recoge `app/error.tsx`.
- Con la tabla actual solo existe `asteroides`, así que las rutas `/juego/<id>` de los juegos mock responden 404.

## Implementation plan

1. Crear `lib/games.ts` con `getGames`, `getGame` y las guardas de `category` y `color`, usando `createClient` de `lib/supabase/server.ts`.
2. Crear `app/error.tsx` (client component) con un mensaje de error y un botón de reintento. Antes de escribirlo, consultar la documentación local de Next.js 16 en `node_modules/next/dist/docs/`.
3. Cambiar a `getGame`/`getGames` las páginas que ya son server components: `app/juego/[id]/page.tsx`, `app/juego/asteroides/jugar/page.tsx` y `app/salon-de-la-fama/page.tsx`. Eliminar `app/juego/[id]/jugar/page.tsx`.
4. Biblioteca: mover el contenido actual de `app/juego/page.tsx` a `components/games/library.tsx` y hacer que `app/juego/page.tsx` sea un server component que lee `getGames()` y se lo pasa por props. En `library.tsx`, derivar los chips como `TODOS` más las categorías presentes en los juegos recibidos.
5. Home: mover el contenido de `app/page.tsx` a `components/home/home-view.tsx`, recibiendo `games` por props, y hacer que `app/page.tsx` sea un server component. `HomeActivity` recibe los juegos por props en lugar de importar `GAMES`.
6. Eliminar `GAMES` y `CATS` de `lib/data.ts`, actualizar el comentario de `lib/scores/types.ts` y comprobar con una búsqueda que no queda ninguna referencia.
7. Verificación: `npm run dev`, recorrido manual (home, biblioteca, ficha, jugar, Salón de la Fama y un id mock), simular un fallo de Supabase y comprobar la pantalla de error; `npm run lint`, `npx tsc --noEmit` y `npm run build`.

## Acceptance criteria

- [ ] `GAMES` y `CATS` ya no existen en el código ni se referencian; `Game`, `GameCategory`, `HomeStat` y `HOME_STATS` siguen exportados desde `lib/data.ts`.
- [ ] La biblioteca muestra los chips `TODOS` y `SHOOTER` (las categorías de los juegos de `games`) y el buscador, y ningún chip de una categoría sin juegos.
- [ ] `app/juego/[id]/jugar/page.tsx` ya no existe, y `/juego/asteroides/jugar` sigue cargando el juego y el modal de fin de partida.
- [ ] `getGames()` devuelve los juegos de la tabla `games` como objetos `Game`, con `short`, `long` y `cat` mapeados desde `short_description`, `long_description` y `category`.
- [ ] `getGame("asteroides")` devuelve el juego, y `getGame` con un id inexistente devuelve `null`.
- [ ] La biblioteca (`/juego`) y la sección `JUEGOS DISPONIBLES AHORA` de la home muestran solo los juegos de `games`, hoy únicamente Asteroides.
- [ ] La ficha `/juego/asteroides` muestra título, descripción larga, categoría y cover de la BD, y su botón `JUGAR AHORA` lleva a `/juego/asteroides/jugar`.
- [ ] `/juego/ranaria` y `/juego/ranaria/jugar` (ids que no están en `games`) responden 404.
- [ ] La pestaña `ASTEROIDES` y la pestaña `GLOBAL` del Salón de la Fama siguen funcionando, y las pestañas de los juegos mock desaparecen.
- [ ] `ÚLTIMAS PUNTUACIONES` de la home sigue mostrando el nombre del juego y su color de acento, ahora tomados de `games`.
- [ ] Con Supabase inaccesible, las páginas que leen `games` muestran la pantalla de error con un botón de reintento, sin usar una copia local del catálogo.
- [ ] La home y la biblioteca conservan su aspecto y su comportamiento: el código movido no cambia el marcado ni los estilos.
- [ ] No hay cambios en la base de datos ni migraciones nuevas.
- [ ] `npm run lint`, `npx tsc --noEmit` y `npm run build` pasan.

## Decisions

- **Sí (decisión del usuario):** solo los juegos jugables viven en `games`. Los 8 juegos mock desaparecen de la UI: la biblioteca y la home muestran Asteroides y las rutas de los mock responden 404. Se descartó sembrarlos en `games`, que mantendría la UI igual pero exige una migración para que `score_table` admita `NULL`.
- **Sí (decisión del usuario):** la lectura se hace en el servidor. Las páginas llegan con el contenido renderizado y sin estados de carga para el catálogo. Se descartó leer en el navegador con `useEffect`, como las puntuaciones.
- **Sí (decisión del usuario):** si falla la lectura se muestra un mensaje de error, sin respaldo local. Se descartó usar `lib/data.ts` como copia de seguridad: mantendría dos fuentes del catálogo que pueden divergir.
- **Sí (decisión del usuario):** se elimina `GAMES` de `lib/data.ts`, de modo que `games` es la única fuente del catálogo. Se descartó conservarlo como semilla: alguien podría editarlo creyendo que cambia la app.
- **Sí (decisión del usuario):** la home y la biblioteca se dividen en página servidor más componente cliente con el código movido tal cual. Se descartó dejarlas como client components y leer en el navegador, que rompería la decisión de leer en el servidor para esas dos páginas.
- **Sí (decisión del usuario):** se usa el cliente de servidor que ya existe (`lib/supabase/server.ts`, con cookies). Consecuencia aceptada: las páginas que lo usan pasan de estáticas a dinámicas y se renderizan en cada visita. Se descartó un cliente nuevo sin cookies y con revalidación, que mantiene las páginas más estáticas pero añade un helper y una regla de caché.
- **Sí (asumido):** `Game` mantiene sus campos actuales (`short`, `long`, `cat`), y el mapeo desde las columnas vive en `lib/games.ts`. Así `game-card.tsx` y el resto de componentes no cambian.
- **Sí (asumido):** `category` y `color` se estrechan con guardas de tipo en `lib/games.ts`. Resuelve de paso el pendiente de que los tipos generados los den como `string`.
- **Sí (asumido):** `getGame` devuelve `null` si el juego no existe, y la página responde 404; si Supabase falla, lanza el error y lo recoge `app/error.tsx`. Es un `error.tsx` único para toda la app, porque hoy no existe ninguno.
- **Sí (decisión del usuario):** solo se muestran información y vistas del juego real. Se elimina el reproductor genérico `app/juego/[id]/jugar/page.tsx`, una vista con HUD inventado. Se descartó mantenerlo para juegos futuros: con el catálogo actual es inalcanzable (la ruta estática de Asteroides tiene prioridad) y cada juego jugable tiene su propia ruta, como `asteroides/jugar`.
- **Sí (decisión del usuario):** los chips de categoría de la biblioteca se derivan de `games` (`TODOS` más las categorías con juegos, hoy `SHOOTER`) y el buscador se mantiene visible. Se descartó quitar ambos del todo. Consecuencia aceptada: siguen sin filtrar nada, como antes de este spec.
- **Sí (asumido):** `HOME_STATS` no cambia en este spec; su copy es una decisión de marketing aparte (SPEC 08).
- **No:** migraciones, sembrar los juegos mock, caché, y cambiar el copy de la home en este spec.

## Identified risks

- **Riesgo:** la home y la biblioteca dejan de ser estáticas y se renderizan en cada visita. Mitigación: aceptado, el catálogo es una consulta diminuta; si molesta, una spec futura añade un cliente sin cookies con revalidación.
- **Riesgo:** la franja de cifras de la home sigue diciendo "12+ JUEGOS" cuando hay un solo juego. Mitigación: el copy de `HOME_STATS` queda fuera de este spec por decisión previa (SPEC 08); conviene revisarlo en una spec propia.
- **Riesgo:** los enlaces antiguos a `/juego/<id>` de los juegos mock pasan a dar 404. Mitigación: aceptado, esos juegos no eran jugables.
- **Riesgo:** los chips y el buscador se mantienen visibles pero no filtran nada, y con un solo juego es ruido para el usuario. Mitigación: aceptado por decisión del usuario; un spec futuro puede hacer que filtren de verdad.
- **Riesgo:** al eliminar el reproductor genérico, un juego nuevo sin ruta propia no tendría página de juego. Mitigación: cada juego jugable ya tiene su ruta (`asteroides/jugar`), y la spec de cada juego nuevo crea la suya.
- **Riesgo:** mover el contenido de la home y la biblioteca a componentes nuevos puede introducir regresiones visuales. Mitigación: se mueve el código sin editarlo, y el criterio de aceptación exige que el aspecto y el comportamiento no cambien.
- **Riesgo:** un error de lectura en cualquier página cae en `app/error.tsx`, que es global y afecta a toda la app. Mitigación: el mensaje es genérico y ofrece reintento; los errores de las puntuaciones siguen capturándose en cada componente.
- **Riesgo:** el mapa `gameId → tabla` de `lib/scores` y las filas de `games` pueden divergir. Mitigación: aceptado en SPEC 11; cada juego nuevo debe añadirse en ambos sitios.

## What is **not** in this spec

Sembrar los juegos mock, que la búsqueda y las categorías filtren, cambiar el copy de la franja de cifras, cambios en la base de datos, caché y revalidación, y un panel para editar juegos. Cada uno, si llega, va en su propio spec.
