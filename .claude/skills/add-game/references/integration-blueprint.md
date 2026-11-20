# Blueprint de integración de un juego

Derivado de las specs 05, 06, 07, 09, 12 y 13. Verifica contra el código antes de fiarte: el código manda sobre este archivo.

## Specs a leer

| Spec | Por qué |
|------|---------|
| 05 | Port del motor, reproductor, contrato de callbacks |
| 06 | Modal de fin de partida y guardado de puntuación |
| 07 | Estadísticas por juego (`best`, `plays`) |
| 09 | Tabla `games` |
| 12 | Catálogo leído desde Supabase (`lib/games.ts`) |
| 13 | Tabla única `scores` (reemplaza 10 y 11) |

## Código a inspeccionar

- `app/juego/asteroides/engine.ts`, `asteroids-player.tsx`, `jugar/page.tsx`
- `lib/games.ts`, `lib/scores/index.ts`, `lib/data.ts`
- `components/games/game-over-modal.tsx`, `game-card.tsx`, `library.tsx`
- `app/globals.css` (`.cover-*`, `.crt-screen`, `.asteroids-canvas`)
- `supabase/migrations/`

## Qué toca un juego nuevo

1. **Motor** `app/juego/<id>/engine.ts`: factory `createXGame(canvas, callbacks)` que devuelve `start, pause, resume, end, restart, destroy`. Callbacks: `onStats`, `onStatus`, `onGameOver`. Sin globales de módulo, sin importar Supabase ni `lib/data.ts`. Resolución interna fija del canvas, escalada por CSS.
2. **Reproductor y página**: `app/juego/<id>/<id>-player.tsx` (client) y `app/juego/<id>/jugar/page.tsx` (`getGame(id)`, `notFound()` si es null). HUD de la plataforma (jugador, puntuación, vidas, nivel), PAUSA / FIN / SALIR, `GameOverModal`, `saveScore({ gameId, name, score, level })`.
3. **Catálogo**: una migración que inserta en `public.games` (`id, title, short_description, long_description, category, cover, color`). `category` en `ARCADE|PUZZLE|SHOOTER|VERSUS`; `color` en `cyan|magenta|green|yellow`. La columna `games.score_table` ya no existe. La ficha `/juego/[id]`, la biblioteca, la home y el Salón de la Fama leen `games`, así que no hace falta ruta nueva; confírmalo en el código.
4. **Puntuaciones**: ninguna tabla nueva. `scores` es compartida y se filtra por `game_id` (FK a `games.id`), por lo que la fila de `games` debe existir antes. Restricciones: `score >= 0`, `level >= 1`.
5. **Estilos**: `.cover-<id>` en `app/globals.css`; el canvas cabe en `.crt-screen` sin deformarse. Los assets propios van en `public/`.
6. **Verificación**: recorrido manual (biblioteca, ficha, jugar, game over, guardar, leaderboard, salir), `npm run lint`, `npx tsc --noEmit`, `npm run build`, advisors de Supabase si hay migración. Aplicar una migración al proyecto remoto exige confirmación explícita del usuario.

## Riesgos conocidos que la spec debe arrastrar

- Doble loop en desarrollo por React Strict Mode: `destroy()` debe cancelar `requestAnimationFrame` y quitar los listeners.
- Captura global del teclado: listeners y `preventDefault` en Espacio y flechas se quitan al desmontar.
- `dt` enorme al reanudar: limitarlo y reiniciar `lastTime`.
- Re-renders del HUD: emitir `onStats` solo cuando cambian los valores.
- Espacio activando un botón enfocado del HUD: hacer `blur` tras el clic.
- La migración es un cambio de datos en una base compartida.
