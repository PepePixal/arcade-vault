# SPEC 14 — Integración del juego Tetris

> **Status:** Implementada
> **Depends on:** SPEC 05, SPEC 06, SPEC 07, SPEC 09, SPEC 12, SPEC 13
> **Date:** 2026-11-20
> **Objective:** Integrar el juego Tetris de `references/started-games/03-tetris/` como el juego jugable "TETRIS" de Arcade Vault, con tarjeta en `/juego`, detalle en `/juego/tetris` y partida en `/juego/tetris/jugar` dentro del CRT de la plataforma, enviando puntuación, vidas y nivel al HUD y guardando la puntuación en `scores`.

## Scope

**In:**

- Migración nueva que inserta la fila `tetris` en `public.games`:
  - `id = 'tetris'`, `title = 'TETRIS'`, `category = 'PUZZLE'`, `cover = 'cover-tetris'`, `color = 'magenta'`.
  - `short_description` y `long_description` en español, redactadas al implementar.
  - Sin columna `score_table` (ya no existe desde SPEC 13).
  - La fila debe existir antes de guardar cualquier puntuación, porque `scores.game_id` es una FK a `games.id`.
- Clase `.cover-tetris` en `app/globals.css`, para la tarjeta y la ficha. No se modifica ni se reutiliza `.cover-tetro`.
- Motor `app/juego/tetris/engine.ts`: port a TypeScript estricto de `references/started-games/03-tetris/game.js`, encapsulado en la factory `createTetrisGame(canvas, callbacks)`.
- Reproductor `app/juego/tetris/tetris-player.tsx` (client component) y página `app/juego/tetris/jugar/page.tsx`, con el mismo patrón que Asteroides.
- Un único canvas con resolución interna 800×600 (4:3), escalado por CSS dentro de `.crt-screen`. Dibuja el tablero de 10×20 centrado, la pieza fantasma y la pieza siguiente a un lado.
- Mecánicas del juego de partida que se portan tal cual:
  - 7 piezas estándar: I, O, T, S, Z, J, L.
  - Rotación horaria con wall kicks `[0, -1, 1, -2, 2]`.
  - Soft drop (1 punto por fila) y hard drop (2 puntos por celda).
  - Puntuación de líneas `[0, 100, 300, 500, 800]` multiplicada por el nivel.
  - Nivel que sube cada 10 líneas y velocidad de caída `max(100, 1000 - (level - 1) * 90)` ms.
  - Fin de partida cuando una pieza nueva colisiona al aparecer.
- Controles: `←` `→` mover, `↑` o `X` rotar, `↓` bajar, `Espacio` caída instantánea. La pausa solo se activa con el botón PAUSA del HUD.
- HUD de la plataforma: Jugador (`INVITADO`), Puntuación, Vidas y Nivel. Tetris tiene una única vida: Vidas muestra `♥` mientras se juega y `—` en game over.
- Botones del HUD: PAUSA / REANUDAR, FIN y SALIR.
- Fin de partida con `GameOverModal` y guardado con `saveScore({ gameId, name, score, level })`.
- Limpieza al desmontar: cancelar `requestAnimationFrame` y quitar los listeners de teclado.

**Out of scope (para specs futuras):**

- La pieza extra "N" (tuerca 3×3): se elimina, el juego queda con las 7 piezas estándar.
- `pieza-L.png`: ningún archivo del juego de partida la referencia, no se copia a `public/`.
- Skins (retro, neon, pastel, pixel), interruptor de tema claro/oscuro y selector de nivel inicial.
- Ranking local en `localStorage` y stats de combo y de mejor limpieza de líneas: los sustituye la tabla `scores`.
- Mostrar el contador de líneas en el HUD (el motor lo usa internamente para calcular el nivel).
- Teclas `P` y `Esc` para pausar.
- Soporte táctil o móvil y sonido.
- Cambios en el esquema de `scores`, en `lib/scores/index.ts` y en el reproductor de Asteroides.
- Cualquier modificación de las specs anteriores.

## Data model

Esta spec no introduce tablas ni columnas nuevas. Reutiliza `games` (SPEC 09 y 12) y `scores` (SPEC 13), y solo añade una fila de datos:

```sql
insert into public.games (id, title, short_description, long_description, category, cover, color)
values ('tetris', 'TETRIS', '...', '...', 'PUZZLE', 'cover-tetris', 'magenta');
```

Contrato del motor hacia la plataforma, con la misma forma que el de Asteroides:

```ts
// app/juego/tetris/engine.ts
export type TetrisStatus = "playing" | "paused" | "gameover";

export interface TetrisStats {
  score: number;
  lives: number; // 1 mientras se juega, 0 en game over
  level: number; // >= 1
}

export interface TetrisCallbacks {
  onStats: (stats: TetrisStats) => void;
  onStatus: (status: TetrisStatus) => void;
  onGameOver: (finalStats: TetrisStats) => void;
}

export interface TetrisGame {
  start(): void;
  pause(): void;
  resume(): void;
  end(): void;
  restart(): void;
  destroy(): void;
}

export function createTetrisGame(
  canvas: HTMLCanvasElement,
  callbacks: TetrisCallbacks,
): TetrisGame;
```

Convenciones:

- El motor no importa Supabase ni `lib/data.ts`, y no usa variables globales de módulo.
- Tablero: matriz de 20 filas por 10 columnas; cada celda guarda `0` o un índice de pieza del 1 al 7.
- Resolución interna fija 800×600; el tablero mide 300×600 y va centrado, con bloques de 30 px.

## Implementation plan

1. Crear la migración `supabase/migrations/<timestamp>_add_game_tetris.sql` con el `insert` en `games`, y añadir `.cover-tetris` a `app/globals.css`. Aplicar la migración al proyecto remoto solo con confirmación explícita del usuario. Comprobación manual: la tarjeta aparece en `/juego` y `/juego/tetris` muestra la ficha.
2. Crear `app/juego/tetris/engine.ts`: port de `game.js` con la factory `createTetrisGame`, sin skins, tema, ranking local ni la pieza N. Emitir `onStats` solo cuando cambian `score` o `level`, y `onStatus` / `onGameOver` al cambiar el estado. Limitar `dt` y reiniciar `lastTime` al reanudar.
3. Crear `app/juego/tetris/tetris-player.tsx`, con el mismo esquema que `asteroids-player.tsx`: HUD con Jugador, Puntuación, Vidas y Nivel, botones PAUSA, FIN y SALIR, `GameOverModal` y `saveScore`.
4. Crear `app/juego/tetris/jugar/page.tsx`: `getGame("tetris")`, `notFound()` si es `null`.
5. Estilos: comprobar que el canvas 800×600 cabe en `.crt-screen` sin deformarse. Si hace falta una clase propia (por ejemplo `.tetris-canvas`), añadirla en `app/globals.css`.
6. Verificación: recorrido manual completo, `npm run lint`, `npx tsc --noEmit`, `npm run build` y `get_advisors` de Supabase.

## Acceptance criteria

- [ ] Existe una fila `id = 'tetris'` en `public.games` con `category = 'PUZZLE'` y `color = 'magenta'`.
- [ ] `/juego` muestra la tarjeta TETRIS con miniatura propia, distinta de la de ASTEROIDES.
- [ ] `/juego/tetris` muestra la ficha con título y descripción, y su botón JUGAR lleva a `/juego/tetris/jugar`.
- [ ] `/juego/tetris/jugar` muestra el juego dentro del CRT sin deformarse, con el tablero, la pieza fantasma y la pieza siguiente visibles.
- [ ] Solo aparecen las 7 piezas estándar; ninguna pieza gris con hueco central.
- [ ] `←` y `→` mueven la pieza, `↑` y `X` la rotan, `↓` la baja y `Espacio` la deja caer, y ninguna de esas teclas hace scroll en la página.
- [ ] `P` y `Esc` no pausan el juego.
- [ ] Una fila completa suma 100 puntos en nivel 1; dos filas, 300; tres, 500; cuatro, 800.
- [ ] El soft drop suma 1 punto por fila y el hard drop 2 puntos por celda recorrida.
- [ ] El Nivel del HUD empieza en 1 y sube en 1 cada 10 líneas.
- [ ] El HUD muestra Vidas con un único `♥` durante la partida y `—` en game over.
- [ ] Al colisionar una pieza nueva al aparecer, se muestra el `GameOverModal` con la puntuación final.
- [ ] PAUSA congela el juego, el botón pasa a REANUDAR y, al reanudar, la pieza no salta posiciones.
- [ ] FIN termina la partida y muestra el `GameOverModal`.
- [ ] SALIR navega a `/juego/tetris` y, tras salir, no quedan loops ni listeners de teclado activos (`Espacio` vuelve a hacer scroll y no hay errores en consola).
- [ ] Guardar la puntuación crea una fila en `scores` con `game_id = 'tetris'` y `level >= 1`.
- [ ] El nuevo registro aparece en el leaderboard del juego, en el Salón de la Fama y en la actividad de la home.
- [ ] Reiniciar desde el `GameOverModal` deja Puntuación en 0, Nivel en 1 y Vidas en 1.
- [ ] El juego no escribe en `localStorage`.
- [ ] Asteroides se sigue jugando y guardando puntuaciones igual que antes.
- [ ] `get_advisors` de Supabase no muestra avisos de seguridad nuevos.
- [ ] `npm run lint`, `npx tsc --noEmit` y `npm run build` pasan sin errores.

## Decisions

- **Sí (decisión del usuario):** id `tetris`, con rutas `/juego/tetris` y `/juego/tetris/jugar`, y clase nueva `.cover-tetris`. **No:** reutilizar `.cover-tetro` (diseñada para otro mock) ni usar el id `tetro`.
- **Sí (decisión del usuario):** solo el juego base. **No:** skins, tema, nivel inicial, ranking local ni stats de combo. Los sustituye la tabla `scores` y el tema de la plataforma.
- **Sí (decisión del usuario):** Tetris tiene una única vida, y el HUD muestra Vidas con un solo `♥`. **No:** sustituir Vidas por Líneas.
- **Sí (decisión del usuario):** 7 piezas estándar, sin la tuerca. Cambia respecto al juego de partida, que tenía 8. **No:** copiar `pieza-L.png`, porque nada la usa.
- **Sí (decisión del usuario):** un único canvas 800×600 que dibuja tablero, fantasma y siguiente pieza. **No:** dos canvas ni canvas vertical con bandas.
- **Sí (decisión del usuario):** se portan la pieza fantasma y la vista previa de la siguiente pieza.
- **Sí (decisión del usuario):** sin `P` ni `Esc`; solo el botón PAUSA, como en Asteroides.
- **Sí (decisión del usuario):** color `magenta`, para contrastar con Asteroides (`cyan`).
- **Sí (asumido):** el contador de líneas no se muestra en el HUD; el motor lo guarda para calcular el nivel. Si se quiere verlo, va en otra spec.
- **Sí (asumido):** el motor vive en `app/juego/tetris/engine.ts`, como el de Asteroides en el código actual. SPEC 05 lo ubicaba en `lib/games/asteroids/`, pero el código manda.
- **Sí (asumido):** `TetrisStats` conserva la forma `{ score, lives, level }` para que el reproductor siga el patrón de Asteroides sin cambios en el contrato.
- **Sí (asumido):** `category = 'PUZZLE'`, valor permitido por el catálogo.
- **Sí (asumido):** un reproductor propio por juego, siguiendo el patrón de Asteroides. **No:** un reproductor genérico, que sería una refactorización fuera de esta spec.

## Identified risks

- **Riesgo:** la migración inserta datos en una base compartida. Mitigación: es un `insert` aditivo; aplicarlo al proyecto remoto exige confirmación explícita del usuario.
- **Riesgo:** doble loop en desarrollo por React Strict Mode. Mitigación: `destroy()` cancela `requestAnimationFrame` y quita los listeners, y un criterio de aceptación comprueba la limpieza al salir.
- **Riesgo:** captura global del teclado. Mitigación: los listeners y el `preventDefault` en `Espacio` y flechas se quitan al desmontar.
- **Riesgo:** `dt` enorme al reanudar. Mitigación: limitar `dt` y reiniciar `lastTime` al reanudar.
- **Riesgo:** re-renders del HUD en cada frame. Mitigación: emitir `onStats` solo cuando cambian `score` o `level`.
- **Riesgo:** `Espacio` activa el botón enfocado del HUD. Mitigación: `blur` tras el clic en PAUSA y FIN, como en Asteroides.
- **Riesgo:** el motor porta `game.js`, que está acoplado al DOM (`document.getElementById`, `localStorage`, `confirm`). Mitigación: el motor solo recibe el canvas y los callbacks, y el port elimina todo acceso al DOM y a `localStorage`.
- **Riesgo:** el tablero vertical dentro de un canvas 4:3 puede quedar pequeño o desbalanceado. Mitigación: la verificación manual comprueba que el tablero, la fantasma y la siguiente pieza son legibles en el CRT.

## What is **not** in this spec

Skins, tema claro/oscuro, nivel inicial, ranking local y stats de combo, la pieza tuerca, `pieza-L.png`, contador de líneas en el HUD, pausa con teclado, soporte táctil, sonido y un reproductor genérico. Cada uno, si llega, va en su propia spec.
