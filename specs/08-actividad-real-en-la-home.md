# SPEC 08 — Actividad real en la home

> **Status:** Borrador
> **Depends on:** SPEC 02, SPEC 06
> **Date:** 2026-11-16
> **Objective:** Reemplazar los datos mock de la sección "ACTIVIDAD EN VIVO" de la home (últimas puntuaciones y top jugadores de hoy) por datos reales leídos desde `lib/scores`.

## Scope

**In:**

- Nueva función `getRecentScores(limit)` en `lib/scores/` que devuelve las últimas puntuaciones guardadas, de la más reciente a la más antigua.
- Nueva función `getTodayRanking(limit)` en `lib/scores/` que devuelve el ranking de los jugadores con partidas guardadas hoy (día natural local del navegador), con la misma regla de cálculo que `getGlobalRanking`.
- Función `formatRelativeTime(iso, now)` en `lib/scores/format.ts` para mostrar "hace 2 min", "hace 3 h", etc.
- Client component `components/home-activity.tsx` con las dos tarjetas de la sección (`ÚLTIMAS PUNTUACIONES` y `TOP JUGADORES · HOY`), que reemplaza el bloque `activity-grid` de `app/page.tsx`.
- `ÚLTIMAS PUNTUACIONES`: las últimas 7 puntuaciones guardadas, con jugador, juego, puntos y tiempo relativo. Se cargan al montar, sin refresco automático.
- `TOP JUGADORES · HOY`: hasta 5 jugadores del día, con rango, nombre y total. El título se mantiene.
- Estado vacío en ambas tarjetas, con un mensaje claro y un enlace a `/juego`. La sección sigue visible.
- Eliminar de `lib/data.ts` el código mock ya sin uso: `RECENT_ACTIVITY`, `TOP_PLAYERS_TODAY`, `ActivityEntry`, `TopPlayerEntry`, `seededScores`, `ScoreRow` y `PLAYERS`.

**Out of scope (para specs futuras):**

- La franja de cifras de la home (`HOME_STATS`: "12+ JUEGOS", "MILES DE PARTIDAS", "GLOBAL RANKING"): es copy de marketing y su cambio merece su propia decisión.
- Refresco automático o "en vivo" real (polling, Realtime de Supabase).
- Supabase y sincronización entre dispositivos.
- Contar partidas jugadas pero no guardadas.
- Cambiar la ventana de "hoy" a otra zona horaria; se usa la del navegador.
- Rediseño visual de la sección; se mantienen las clases y el marcado actuales.

## Data model

Este spec no introduce nuevas entidades de datos ni claves de `localStorage`. Reutiliza `ScoreEntry` y `GlobalRankingRow` de SPEC 06.

```ts
// lib/scores/index.ts
export function getRecentScores(limit?: number): Promise<ScoreEntry[]>;       // createdAt desc, por defecto 7
export function getTodayRanking(limit?: number): Promise<GlobalRankingRow[]>; // por defecto 5

// lib/scores/format.ts
export function formatRelativeTime(iso: string, now?: number): string;
```

Convenciones:

- "Hoy" es el intervalo desde las 00:00 locales del día actual hasta ahora.
- El ranking de hoy suma, por jugador, su mejor puntuación de cada juego entre las entradas de hoy, con el desempate de SPEC 06. Se comparte el cálculo con `getGlobalRanking` mediante una función interna común, sin duplicar la lógica.
- Formato del tiempo relativo: menos de 1 min `hace unos segundos`; menos de 1 h `hace N min`; menos de 24 h `hace N h`; menos de 7 días `hace N d`; desde 7 días, fecha `dd/mm/aaaa`.
- El color de acento del jugador en el feed sale del campo `color` del juego en `GAMES`; el nombre del juego, de su `title`. Si el `gameId` no existe en `GAMES`, se muestra el `gameId` y sin color de acento.

## Implementation plan

1. En `lib/scores/index.ts`, extraer el cálculo del ranking a una función interna que reciba las entradas, y hacer que `getGlobalRanking` la use sin cambiar su comportamiento. Agregar `getRecentScores` y `getTodayRanking`. Probar con un `localStorage` simulado: entradas de hoy y de ayer, empate de totales y sin datos.
2. Agregar `formatRelativeTime` a `lib/scores/format.ts`. Probar con un `now` fijo los límites: 30 s, 5 min, 3 h, 2 días y 10 días.
3. Crear `components/home-activity.tsx` (client component): carga ambas listas al montar, con estados de carga, vacío y datos, y usa las clases existentes (`activity-grid`, `activity-card`, `ticker`, `tick-row`, `top-list`, `top-row`). El botón "VER SALÓN →" pasa a enlace a `/salon-de-la-fama`.
4. En `app/page.tsx`, reemplazar el contenido del `activity-grid` por `<HomeActivity />` y quitar los imports de `RECENT_ACTIVITY` y `TOP_PLAYERS_TODAY`. Verificar que la sección y su cabecera siguen igual.
5. Eliminar de `lib/data.ts` el código mock sin uso y confirmar con `npx tsc --noEmit` y una búsqueda de usos que no queda ninguna referencia.
6. Verificación final: `npm run dev`, recorrido manual (home sin datos, guardar partidas, volver a la home), `npm run lint`, `npx tsc --noEmit`, `npm run build`.

## Acceptance criteria

- [ ] `getRecentScores(7)` devuelve como máximo 7 entradas, ordenadas de la más reciente a la más antigua.
- [ ] `getTodayRanking()` incluye solo entradas con `createdAt` de hoy: una entrada de ayer no aparece, aunque tenga más puntos.
- [ ] `getTodayRanking()` suma la mejor puntuación por jugador y juego, igual que `getGlobalRanking`, y cuenta solo la mejor si un jugador guarda dos veces el mismo juego.
- [ ] `getGlobalRanking()` devuelve exactamente lo mismo que antes de este spec para los mismos datos.
- [ ] `formatRelativeTime` devuelve `hace unos segundos` a los 30 s, `hace 5 min` a los 5 min, `hace 3 h` a las 3 h, `hace 2 d` a los 2 días y una fecha `dd/mm/aaaa` a los 10 días.
- [ ] Con `localStorage` vacío, ambas tarjetas muestran un estado vacío con un enlace que lleva a `/juego`, y la sección sigue visible.
- [ ] Tras guardar una puntuación de Asteroides y volver a la home, `ÚLTIMAS PUNTUACIONES` la muestra arriba con el nombre del jugador, "ASTEROIDES", los puntos con formato `es-ES` y "hace unos segundos".
- [ ] Tras guardar esa puntuación, `TOP JUGADORES · HOY` muestra al jugador con su total.
- [ ] Una puntuación guardada con fecha de ayer aparece en `ÚLTIMAS PUNTUACIONES` pero no en `TOP JUGADORES · HOY`.
- [ ] El botón "VER SALÓN →" lleva a `/salon-de-la-fama`.
- [ ] Con `localStorage` bloqueado o con JSON corrupto, la home no lanza error y muestra los estados vacíos.
- [ ] El resto de la home (hero, juegos destacados, franja de cifras, precios, FAQ) no cambia.
- [ ] `RECENT_ACTIVITY`, `TOP_PLAYERS_TODAY`, `ActivityEntry`, `TopPlayerEntry`, `seededScores`, `ScoreRow` y `PLAYERS` ya no existen en el código ni se referencian.
- [ ] `npm run lint` pasa sin errores.
- [ ] `npx tsc --noEmit` pasa sin errores.

## Decisions

- **Sí (decisión del usuario):** entran los dos bloques de ACTIVIDAD EN VIVO. La franja de cifras queda fuera: "MILES DE PARTIDAS" no puede ser real con datos locales y cambiarla es una decisión de copy, no de datos.
- **Sí (decisión del usuario):** `TOP JUGADORES · HOY` se mantiene con su título y filtra solo las partidas de hoy. Se descartó el ranking histórico renombrado, que habría garantizado datos casi siempre. Consecuencia aceptada: el bloque estará vacío cuando no haya partidas del día, por eso el estado vacío es parte del alcance.
- **Sí (decisión del usuario):** `ÚLTIMAS PUNTUACIONES` muestra las últimas 7 guardadas, con tiempo relativo y carga solo al montar. Se descartó refrescar cada 30 s: con `localStorage` el feed solo cambia si el mismo navegador guarda en otra pestaña, así que no aporta valor real.
- **Sí (decisión del usuario):** estado vacío con invitación a jugar y enlace a la biblioteca, en lugar de ocultar la sección. Es lo coherente con SPEC 06 y 07 y evita que la estructura de la home cambie según haya o no datos.
- **Sí (asumido, a confirmar al revisar la spec):** el ranking de hoy usa la misma regla que el ranking global (suma de la mejor puntuación por jugador y juego, solo entre entradas de hoy). Se descartó ordenar por mejor partida suelta, que sería una tercera forma de calcular un ranking en la plataforma.
- **Sí (asumido):** el ranking global y el de hoy comparten una función interna de cálculo. Evita dos implementaciones del mismo desempate que puedan divergir.
- **Sí (asumido):** "hoy" es el día natural local del navegador. No hay servidor ni zona horaria del usuario que usar todavía.
- **Sí (asumido):** se eliminan también `seededScores`, `ScoreRow` y `PLAYERS`. Quedaron sin uso tras SPEC 06 y, con este spec, ya no queda ningún dato de puntuaciones inventado en el código.
- **Sí (previsión de futuro, indicada por el usuario):** las puntuaciones vendrán de Supabase. Las nuevas funciones son asíncronas y viven en `lib/scores/`, así que ese cambio sustituirá solo la implementación. Con una base de datos, "hoy" y "últimas" serán consultas con filtro y límite en lugar de leer todas las entradas.
- **No:** refresco automático, Supabase y la franja de cifras en este spec; cada uno merece el suyo.

## Identified risks

- **Hidratación SSR:** `localStorage` no existe en el servidor y la hora cambia entre servidor y cliente. Mitigación: el componente carga en `useEffect`, muestra "Cargando…" hasta tener datos y calcula el tiempo relativo solo en el cliente, con un único `now` por carga.
- **Cambio de día sin recargar:** si la home queda abierta pasada la medianoche, el top de "hoy" sigue mostrando el día anterior hasta recargar. Aceptado: no hay refresco en este spec.
- **Regresión del ranking global:** extraer el cálculo común podría cambiar `getGlobalRanking`. Mitigación: criterio de aceptación explícito y prueba con los mismos datos antes y después de la extracción.
- **Bloque vacío casi siempre:** al filtrar por hoy, `TOP JUGADORES · HOY` estará vacío en la mayoría de las visitas con datos locales. Riesgo aceptado por decisión del usuario y mitigado con un estado vacío útil.
- **Fechas manipulables:** `createdAt` se guarda en el navegador y se puede alterar desde la consola, igual que el resto de datos de SPEC 06. Aceptado hasta Supabase.

## What is **not** in this spec

- La franja de cifras de la home (`HOME_STATS`).
- Refresco automático o "en vivo" real.
- Supabase y sincronización entre dispositivos.
- Contar partidas jugadas sin guardar.
- Rediseño visual de la sección de actividad.

Cada uno, si llega, va en su propio spec.
