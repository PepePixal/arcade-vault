# Blueprint de integración de un juego

Derivado de las specs 05, 06, 07, 09, 12, 13 y 17. Verifica contra el código antes de fiarte: el código manda sobre este archivo.

## Specs a leer

| Spec | Por qué |
|------|---------|
| 05 | Port del motor, reproductor, contrato de callbacks |
| 06 | Modal de fin de partida y guardado de puntuación |
| 07 | Estadísticas por juego (`best`, `plays`) |
| 09 | Tabla `games` |
| 12 | Catálogo leído desde Supabase (`lib/games.ts`) |
| 13 | Tabla única `scores` (reemplaza 10 y 11) |
| 17 | Layout móvil y gamepad virtual que emula el teclado |

Discrepancias conocidas entre specs y código (el código manda):

- La spec 05 ubica el motor en `lib/games/asteroids/engine.ts` y el reproductor en `components/asteroids-player.tsx`. En el código real viven en `app/juego/asteroides/` (`engine.ts`, `asteroids-player.tsx`). Un juego nuevo sigue la ubicación real: `app/juego/<id>/`.
- La spec 05 añade el juego a `GAMES` en `lib/data.ts`. La spec 12 eliminó `GAMES` y `CATS`: el catálogo sale de la tabla `games`. `lib/data.ts` solo conserva `Game`, `GameCategory`, `HomeStat` y `HOME_STATS`.
- Las specs 09, 10 y 11 describen `games.score_table`, las tablas por juego y el mapa `gameId → tabla`. La spec 13 los eliminó. En concreto, la spec 11 pide que cada juego nuevo amplíe ese mapa y la vista `global_scores`: ya no aplica. Un juego nuevo solo inserta su fila en `games`.

## Código a inspeccionar

- `app/juego/asteroides/engine.ts`, `asteroids-player.tsx`, `jugar/page.tsx`
- `lib/games.ts`, `lib/scores/index.ts`, `lib/data.ts`
- `components/games/game-over-modal.tsx`, `game-card.tsx`, `library.tsx`
- `components/games/mobile-stats-bar.tsx`, `mobile-game-controls.tsx`, `virtual-gamepad.tsx`, `skin-select.tsx`
- `app/globals.css` (`.cover-*`, `.crt-screen`, `.asteroids-canvas`)
- `supabase/migrations/`

## Qué toca un juego nuevo

1. **Motor** `app/juego/<id>/engine.ts`: factory `createXGame(canvas, callbacks)` que devuelve `start, pause, resume, end, restart, destroy`. Callbacks: `onStats`, `onStatus`, `onGameOver`. Sin globales de módulo, sin importar Supabase ni `lib/data.ts`. Resolución interna fija del canvas, escalada por CSS.
2. **Reproductor y página**: `app/juego/<id>/<id>-player.tsx` (client) y `app/juego/<id>/jugar/page.tsx` (`getGame(id)`, `notFound()` si es null). HUD de la plataforma (jugador, puntuación, vidas, nivel), PAUSA / FIN / SALIR, `GameOverModal`, `saveScore({ gameId, name, score, level })`.
3. **Catálogo**: una migración que inserta en `public.games` (`id, title, short_description, long_description, category, cover, color`). `category` en `ARCADE|PUZZLE|SHOOTER|VERSUS`; `color` en `cyan|magenta|green|yellow`. La columna `games.score_table` ya no existe. La ficha `/juego/[id]`, la biblioteca, la home y el Salón de la Fama leen `games`, así que no hace falta ruta nueva; confírmalo en el código.
4. **Puntuaciones**: ninguna tabla nueva. `scores` es compartida y se filtra por `game_id` (FK a `games.id`), por lo que la fila de `games` debe existir antes. Restricciones: `score >= 0`, `level >= 1`.
5. **Móvil** (< 768px, spec 17): el reproductor oculta el HUD de escritorio con `className="player-hud max-md:hidden!"` (el `!` es necesario: `.player-hud` es CSS sin `@layer` y le gana a la utilidad de Tailwind sin él), monta `<MobileStatsBar>` justo antes de `.crt` y `<MobileGameControls>` justo después. Declara `const ACTION_A: VirtualKey | null` con la tecla del botón A (`"x"`, `"enter"`, etc.) o `null` si el juego no la usa (A se muestra deshabilitado). B siempre es Espacio y la cruceta, las flechas. La lógica de PAUSA y FIN va en funciones sin evento (`pauseOrResume`, `finishGame`) compartidas por el HUD de escritorio y `onTogglePause` / `onEnd`. La nav, el footer y el marco CRT se ajustan solos con CSS (`body:has(.av-player)`). El motor no cambia: el gamepad despacha `KeyboardEvent` sintéticos en `window` con `key` y `code`, así que el motor debe escuchar en `window`.
6. **Estilos**: `.cover-<id>` en `app/globals.css`; el canvas cabe en `.crt-screen` sin deformarse. Los assets propios van en `public/`.
7. **Verificación**: recorrido manual (biblioteca, ficha, jugar, game over, guardar, leaderboard, salir) en escritorio y con viewport móvil (390×844), `npm run lint`, `npx tsc --noEmit`, `npm run build`, advisors de Supabase si hay migración. Aplicar una migración al proyecto remoto exige confirmación explícita del usuario.

## Riesgos conocidos que la spec debe arrastrar

- Doble loop en desarrollo por React Strict Mode: `destroy()` debe cancelar `requestAnimationFrame` y quitar los listeners.
- Captura global del teclado: listeners y `preventDefault` en Espacio y flechas se quitan al desmontar.
- `dt` enorme al reanudar: limitarlo y reiniciar `lastTime`.
- Re-renders del HUD: emitir `onStats` solo cuando cambian los valores.
- Espacio activando un botón enfocado del HUD: hacer `blur` tras el clic.
- Teclas leídas solo de un elemento (canvas) en vez de `window`: el gamepad virtual no llegaría al motor.
- La migración es un cambio de datos en una base compartida.
