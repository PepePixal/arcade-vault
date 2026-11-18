# SPEC 11 — Puntuaciones sobre Supabase

> **Status:** Implementado
> **Depends on:** SPEC 06, SPEC 08, SPEC 09, SPEC 10
> **Date:** 2026-11-18
> **Objective:** Reemplazar la implementación `localStorage` de `lib/scores` por consultas a Supabase (`scores_asteroides` y `global_scores`), manteniendo las firmas públicas y los componentes que la consumen.

## Scope

**In:**
- `lib/scores/index.ts`: reescribir `saveScore`, `getGameScores`, `getGameStats`, `getGlobalRanking`, `getTodayRanking` y `getRecentScores` para que usen `createClient<Database>()` de `lib/supabase/client.ts`.
- Mapa tipado `gameId → tabla` en `lib/scores` (hoy solo `asteroides → scores_asteroides`).
- Mapeo de fila a `ScoreEntry` (`game_id → gameId`, `created_at → createdAt`), estrechando las columnas nulables de la vista `global_scores`.
- Actualizar el mensaje de error de `components/games/game-over-modal.tsx`, que hoy habla de "permitir guardar datos en el navegador".
- Eliminar de `lib/scores` el código de `localStorage` para puntuaciones que quede sin uso (`SCORES_KEY`, `readAll`, `writeAll`, `isScoreEntry`).

**Out of scope (para specs futuras):**
- Leer la información de los juegos (título, descripción, categoría) desde la tabla `games`: `lib/data.ts` sigue siendo la fuente de la UI.
- Importar a Supabase las puntuaciones que existan en `localStorage` (descartado en SPEC 10).
- Autenticación, antitrampas y límite de inserciones.
- Realtime y refresco automático de la home.
- Vista SQL "mejor puntuación por jugador y juego" para aligerar el ranking.
- Tablas de puntuación de otros juegos.
- `getLastPlayerName` y `setLastPlayerName`: el último nombre usado es una preferencia local y sigue en `localStorage`.
- El aviso de seguridad sobre `public.rls_auto_enable()`.

## Data model

Este spec no introduce nuevas entidades ni cambios en la base de datos. Reutiliza `ScoreEntry`, `GlobalRankingRow`, `GameStats` y `NewScore` de `lib/scores/types.ts`, sin modificarlos, y la tabla y la vista de SPEC 10.

```ts
// lib/scores/index.ts (firmas públicas, sin cambios)
export function saveScore(entry: NewScore): Promise<ScoreEntry>;
export function getGameScores(gameId: string, limit?: number): Promise<ScoreEntry[]>;
export function getGameStats(gameId: string): Promise<GameStats>;
export function getGlobalRanking(limit?: number): Promise<GlobalRankingRow[]>;
export function getTodayRanking(limit?: number): Promise<GlobalRankingRow[]>;
export function getRecentScores(limit?: number): Promise<ScoreEntry[]>;
```

Convenciones:

- **Tabla por juego:** un mapa tipado `{ asteroides: "scores_asteroides" }` resuelve el `gameId` a la tabla. Un `gameId` sin tabla (los juegos mock) devuelve lista vacía, o `{ best: null, plays: 0 }` en las estadísticas, sin consultar la BD. `saveScore` con un `gameId` sin tabla lanza error.
- **Guardar:** `saveScore` normaliza el nombre con `normalizeName` antes del INSERT, redondea `score` y `level` como hoy y devuelve la fila insertada como `ScoreEntry`. Un nombre vacío tras normalizar sigue lanzando error.
- **Leaderboard del juego:** `getGameScores` ordena por `score` descendente y `created_at` ascendente, con `limit`.
- **Estadísticas:** `getGameStats` devuelve la mayor puntuación (`best`, `null` si no hay) y el número de partidas guardadas (`plays`).
- **Últimas puntuaciones:** `getRecentScores` lee `global_scores` ordenado por `created_at` descendente, con `limit`.
- **Rankings:** `getGlobalRanking` trae todas las filas de `global_scores` y `getTodayRanking` solo las de hoy (desde las 00:00 locales del navegador, enviadas como fecha ISO). Ambos reutilizan la función interna `rankPlayers` sin cambiarla, para conservar la regla de SPEC 06 (suma de la mejor puntuación por jugador y juego, con su desempate).
- **Errores:** las lecturas rechazan la promesa si Supabase falla; los consumidores existentes ya capturan el error y muestran el estado vacío. `saveScore` rechaza la promesa y `GameOverModal` muestra el error y permite reintentar.

## Implementation plan

1. En `lib/scores/index.ts`, crear el mapa `gameId → tabla` tipado y la función que convierte una fila (de la tabla o de la vista, con columnas nulables) en `ScoreEntry`, descartando las filas incompletas.
2. Reescribir `saveScore`, `getGameScores` y `getGameStats` con consultas a `scores_asteroides`.
3. Reescribir `getRecentScores`, `getTodayRanking` y `getGlobalRanking` con consultas a `global_scores`, reutilizando `rankPlayers`.
4. Eliminar el código de `localStorage` para puntuaciones que ya no se use y actualizar el texto de error de `game-over-modal.tsx`.
5. Verificación: `npm run dev`, jugar Asteroides, guardar una puntuación y comprobarla en el leaderboard del juego, en el Salón de la Fama y en la home, también tras recargar; simular un fallo de Supabase y comprobar el estado vacío y el error con reintento; `get_advisors`; `npm run lint`, `npx tsc --noEmit` y `npm run build`; borrar las filas de prueba de `scores_asteroides`.

## Acceptance criteria

- [ ] Las firmas públicas de `lib/scores` no cambian y los componentes solo se modifican en el texto de error de `GameOverModal` y en los comentarios que mencionaban `localStorage` (`game-leaderboard.tsx` y `home-activity.tsx`); su lógica y su marcado no cambian.
- [ ] Guardar una puntuación de Asteroides crea una fila en `scores_asteroides` con el nombre normalizado, la puntuación y el nivel.
- [ ] La puntuación guardada aparece en el leaderboard de `/juego/asteroides`, en el Salón de la Fama y en `ÚLTIMAS PUNTUACIONES` de la home, y sigue ahí tras recargar.
- [ ] El leaderboard del juego ordena de mayor a menor puntuación y, en empate, gana la más antigua.
- [ ] `getGameStats` devuelve la mejor puntuación y el número de partidas guardadas, y `{ best: null, plays: 0 }` si no hay ninguna.
- [ ] Con dos jugadores y puntuaciones guardadas, el ranking global los ordena por la suma de su mejor puntuación por juego, y si un jugador guarda dos puntuaciones en Asteroides cuenta solo la mejor.
- [ ] `TOP JUGADORES · HOY` incluye solo partidas guardadas desde las 00:00 locales de hoy.
- [ ] Un `gameId` sin tabla (juego mock) devuelve estado vacío sin lanzar error ni consultar la BD.
- [ ] Con Supabase inaccesible, las lecturas muestran el estado vacío sin error en pantalla.
- [ ] Con Supabase inaccesible, guardar muestra el error en el modal y permite reintentar sin perder la puntuación.
- [ ] `lib/scores` ya no lee ni escribe puntuaciones en `localStorage`; solo el último nombre usado sigue ahí.
- [ ] `get_advisors` no muestra errores críticos nuevos de seguridad.
- [ ] `npm run lint`, `npx tsc --noEmit` y `npm run build` pasan.
- [ ] No quedan filas de prueba en `scores_asteroides` al terminar.

## Decisions

- **Sí (decisión del usuario):** las lecturas caen a estado vacío si Supabase falla y guardar muestra un error con opción de reintento. Se descartó un fallback a `localStorage`: mantendría dos fuentes de verdad con datos que nunca se sincronizan.
- **Sí (decisión del usuario):** `getGlobalRanking` y `getTodayRanking` traen las filas de `global_scores` y reutilizan `rankPlayers` tal cual. Se descartó crear una vista "mejor por jugador y juego": obligaría a una migración dentro de un spec que es solo de la app. Consecuencia aceptada: el ranking escala mal con miles de partidas.
- **Sí (decisión del usuario):** el `gameId` se resuelve a su tabla con un mapa tipado en el código. Se descartó leer `games.score_table` en cada consulta: perdería el tipado de supabase-js y añadiría una consulta por lectura. Consecuencia aceptada: el mapa puede divergir de `games.score_table`.
- **Sí (asumido):** "hoy" sigue siendo el día natural local del navegador, como en SPEC 08.
- **Sí (asumido):** el último nombre usado sigue en `localStorage`, porque es una preferencia del navegador y no un dato compartido.
- **Sí (asumido):** los consumidores no cambian en lógica porque ya manejan carga, vacío y error; solo se actualiza el texto de error del modal, que hablaba de `localStorage`, y se corrigen dos comentarios desactualizados (`game-leaderboard.tsx` y `home-activity.tsx`), por decisión del usuario durante la implementación.
- **Sí (decisión durante la implementación):** el ranking lee `global_scores` página a página (1000 filas por petición), porque PostgREST limita cada respuesta y, sin paginar, el ranking se calcularía en silencio con datos incompletos a partir de la fila 1001.
- **Sí (asumido):** la puntuación se guarda como antes: el cliente normaliza el nombre y el `check` de la tabla actúa como segunda barrera.
- **No:** autenticación, antitrampas, importar datos de `localStorage`, Realtime, tablas de otros juegos y leer `games` desde la UI en este spec.

## Identified risks

- **Riesgo:** el ranking trae todas las filas de `global_scores` y crece con el número de partidas. Mitigación: aceptado por el volumen actual; la solución futura es una vista con la mejor puntuación por jugador y juego.
- **Riesgo:** el mapa `gameId → tabla` diverge de `games.score_table` o no se amplía al añadir un juego. Mitigación: cada spec de un juego nuevo incluye ampliar el mapa y la vista `global_scores`.
- **Riesgo:** los INSERT anónimos son falsificables y no tienen límite. Mitigación: aceptado hasta un spec de autenticación; los `check` de la tabla acotan los valores.
- **Riesgo:** las columnas de `global_scores` son nulables en los tipos generados. Mitigación: el mapeo descarta las filas incompletas y se cubre en la verificación.
- **Riesgo:** si el guardado falla y el jugador sale del modal, la puntuación se pierde. Mitigación: el modal muestra el error y permite reintentar mientras siga abierto; no se persiste nada más.
- **Riesgo:** la latencia de red alarga los estados de carga. Mitigación: los consumidores ya muestran "Cargando…" hasta recibir datos.

## What is **not** in this spec

Leer la información de los juegos desde `games`, importar datos de `localStorage`, autenticación, antitrampas, Realtime, la vista de mejores puntuaciones por jugador y juego, y tablas de otros juegos. Cada uno, si llega, va en su propio spec.
