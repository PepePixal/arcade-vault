# SPEC — Frogger: integración core del juego

> **Estado:** Implementado
> **Depende de:** 13-tabla-scores-unica, 16-integracion-juego-snake
> **Fecha:** 2026-05-20 (actualizada 2026-11-27 con las decisiones de implementación)
> **Objetivo:** Integrar Frogger (canvas puro, construido desde cero) como juego jugable en Arcade Vault con ID `frogger`, siguiendo el contrato de integración de juegos del proyecto (motor `engine.ts` + player + página `jugar`), con score, vidas, nivel y game over conectados al HUD de la plataforma.

---

## Scope

**In:**

- Migración `supabase/migrations/<version>_add_game_frogger.sql` que inserta la fila `frogger` en `public.games`.
- Motor `app/juego/frogger/engine.ts`: factory `createFroggerGame(canvas, callbacks)` que devuelve `start, pause, resume, end, restart, destroy`. Callbacks `onStats`, `onStatus`, `onGameOver`. Sin globals de módulo, sin imports de Supabase ni de `lib/data.ts`. Canvas interno fijo de 640 × 560 px, escalado por CSS.
- Cuadrícula de 16 columnas × 14 filas de 40 × 40 px (fila 0 = arriba):
  - fila 0: barra de tiempo + 5 bocas destino,
  - filas 1–6: río (6 carriles),
  - fila 7: zona segura intermedia,
  - filas 8–12: carretera (5 carriles),
  - fila 13: zona segura de inicio.
- Entidades de carretera: coches (1 celda) y camiones (2–3 celdas) con velocidad y sentido por carril; loop horizontal continuo; colisión letal.
- Entidades de río: troncos (2–4 celdas) y grupos de tortugas (2–3) con loop horizontal. La rana solo sobrevive en el río encima de un tronco o de tortugas visibles. Las tortugas se sumergen periódicamente (3 s visibles / 1,5 s sumergidas), con fase independiente por grupo.
- Movimiento de la rana: saltos discretos de 1 celda con las **flechas** (↑ ↓ ← →), animación de 120 ms. No puede salir por los laterales ni por abajo.
- Metas: 5 bocas de 2 columnas cada una (columnas 1, 4, 7, 10, 13). Una boca ocupada no puede reutilizarse en la ronda. Al llenar las 5 se completa la ronda.
- Muerte: (a) vehículo, (b) agua, (c) tortuga que se sumerge bajo la rana, (d) salir por un lateral arrastrada en el río, (e) tiempo agotado, (f) aterrizar en una pared o en una boca ocupada de la fila 0.
- 3 vidas. Cada muerte resta 1 y se notifica por `onStats`. Con 0 vidas: `onStats` con `lives: 0` y después `onGameOver`.
- Puntuación: +10 por cada fila nueva alcanzada por la rana actual; +50 por boca ocupada + bonus de `segundos enteros restantes × 10`; +200 al completar la ronda.
- Temporizador por rana: 15 s en el nivel 1, 1 s menos por nivel, mínimo 8 s.
- HUD interno del canvas: **solo la barra de tiempo** (10 px, arriba de la fila 0) separada de las bocas por una franja oscura de 8 px. Score, vidas y nivel van únicamente en el HUD externo de la plataforma (JUGADOR, PUNTUACIÓN, VIDAS, NIVEL), como el resto de los juegos.
- Pausa controlada por la plataforma (`pause()`/`resume()`): congela `update()` pero se sigue dibujando. P / Esc no pausan.
- Listener `keydown` en `window`, registrado en `start()` y liberado en `destroy()`.
- Player `app/juego/frogger/frogger-player.tsx` (cliente) y página `app/juego/frogger/jugar/page.tsx` (servidor, `getGame("frogger")` → `notFound()` o player). Ruta: `/juego/frogger/jugar`.
- Game over con el `GameOverModal` compartido y guardado con `saveScore` de `lib/scores`.
- Estilos en `app/globals.css`: `.cover-frogger` (portada solo con gradientes CSS) y `.crt-screen .frogger-canvas` (canvas 8:7 a todo el alto de la pantalla CRT 4:3, centrado).

**Fuera de alcance:**

- Sprites bitmap: todo se dibuja con primitivas canvas.
- Skins y versión móvil: los añaden después `skin-designer` y `mobile-porter` (flujo `/spec-impl-game`).
- Animaciones de muerte elaboradas.
- Power-ups (mosca bonus, cocodrilo).
- Supabase Auth y RLS.
- Realtime en el leaderboard.

---

## Data model

### Migración en `public.games`

```sql
insert into public.games (id, title, short_description, long_description, category, cover, color)
values (
  'frogger',
  'FROGGER',
  'Cruza la carretera y el río sin convertirte en papilla.',
  'Guía a tu rana a través de una carretera repleta de coches y un río de troncos y tortugas flotantes. Llena las cinco bocas del otro lado para completar la ronda; cada nivel acelera el tráfico y acorta el tiempo. Tres vidas y mucho asfalto por delante.',
  'ARCADE',
  'cover-frogger',
  'yellow'
);
```

`color` es `yellow` porque el check de la tabla solo admite `cyan | magenta | green | yellow` (`lime` no es válido).

### Contrato del motor

```ts
export type FroggerStatus = "playing" | "paused" | "gameover";

export interface FroggerStats {
  score: number;
  lives: number; // 3 al empezar, 0 en game over
  level: number; // >= 1
}

export interface FroggerCallbacks {
  onStats: (stats: FroggerStats) => void;      // solo cuando algo cambia
  onStatus: (status: FroggerStatus) => void;
  onGameOver: (finalStats: FroggerStats) => void;
}
```

### Guardado del score

`saveScore({ gameId: "frogger", name, score, level })` sobre la tabla única `scores`. No se envía `user_id`; `level` es obligatorio (`level >= 1`).

No se crean tablas nuevas.

---

## Implementation plan

1. **Migración** — crear y aplicar (con confirmación del usuario) la migración del data model; correr los advisors.
   Verificación: la fila `frogger` existe; la card aparece en `/juego`.

2. **Constantes y tipos** en `engine.ts`: contrato público (arriba) y constantes:

   ```ts
   const COLS = 16;
   const ROWS = 14;
   const CELL = 40;
   const CANVAS_W = COLS * CELL; // 640
   const CANVAS_H = ROWS * CELL; // 560
   const ROW_GOALS = 0;
   const ROW_RIVER_TOP = 1;
   const ROW_RIVER_BOT = 6;
   const ROW_SAFE_MID = 7;
   const ROW_ROAD_TOP = 8;
   const ROW_ROAD_BOT = 12;
   const ROW_START = 13;
   ```

   Tipos locales `Direction`, `Lane`, `Entity` (con `diveT?: number` para el ciclo de inmersión de cada grupo de tortugas) y `Frog`.

3. **`buildLanes(level)`** — tablas `RIVER_LANES` y `ROAD_LANES` con fila, tipo, ancho, cantidad, velocidad base (px/frame a 60 fps) y sentido. Río 1–3 px/frame, carretera 1,5–4 px/frame, sentidos alternos. Las entidades se reparten a lo largo de `COLS + ancho` para mantener los huecos constantes al dar la vuelta. Velocidad por nivel: `speed × 1.15^(level − 1)` (compuesto).
   Verificación: cada carril tiene ≥ 2 entidades y huecos ≥ 1 celda.

4. **Game loop** con `requestAnimationFrame`:
   - `update(dt)`: no hace nada fuera de `playing`. Mueve entidades con `col += speed × dir × (dt / 16) / CELL` (la velocidad está en px y `col` en celdas). Al salir por un lado se resta/suma `COLS + width`. Avanza el ciclo de las tortugas. Gestiona el salto (120 ms) y al aterrizar llama a `resolveLanding()`. Arrastra a la rana con su soporte en el río. Descuenta el temporizador. Emite `onStats` si algo cambió.
   - `draw()`: fondo por zonas, entidades, rana (elipse con ojos, rotada según la dirección, patas extendidas al saltar), bocas (verde oscuro con borde dorado, rana dentro si están ocupadas) y la barra de tiempo (azul `#1f5fe0` → amarillo → rojo sobre franja oscura `#0a0a14`).

5. **Colisiones y metas** (usando el centro de la rana, `col + 0.5`):
   - `checkRoadCollision(frog, lanes)`.
   - `getSupport(frog, lanes)`: `null` si no hay entidad o si la tortuga está sumergida.
   - `checkGoal(frog, goals)`: marca la boca libre y suma puntos; pared o boca ocupada = muerte.
   - Muertes con la rana quieta (vehículo, inmersión, salir por un lateral) se comprueban en cada frame.
   - Tras ocupar una boca (sin completar la ronda): la rana vuelve al inicio con el temporizador reiniciado y vuelve a puntuar +10 por fila.

6. **`completeRound()`** — +200, vacía las bocas, `level += 1`, `buildLanes(level)` y rana nueva con el temporizador del nuevo nivel. El cambio de nivel llega al HUD por `onStats`.

7. **`killFrog()`** — no hace nada si la partida ya terminó. Resta una vida; con vidas restantes emite stats y resetea la rana; con 0 llama a `gameOver()` (emite `lives: 0`, luego `onGameOver`) y el loop se detiene.

8. **Player, página y estilos**:
   - `jugar/page.tsx`: `getGame("frogger")` + `notFound()`.
   - `frogger-player.tsx`: crea el motor en un `useEffect` (nunca corre en servidor; no se usa `dynamic(..., { ssr: false })`), HUD de la plataforma con PAUSA/REANUDAR, FIN y SALIR, funciones `pauseOrResume` / `finishGame` sin evento, `GameOverModal` + `saveScore` + `setLastPlayerName`, "Jugar de nuevo" llama a `restart()`.
   - `globals.css`: `.cover-frogger` y `.crt-screen .frogger-canvas`.
   Verificación: el HUD refleja score, vidas y nivel en tiempo real.

9. **Verificación final** — `npm run lint`, `npx tsc --noEmit` y `npm run build` sin errores; ninguna ruta existente devuelve 500.

---

## Acceptance criteria

- [ ] La fila `frogger` existe en `games` con los valores del data model (`color = 'yellow'`).
- [ ] La card de Frogger aparece en `/juego` con la portada `cover-frogger`.
- [ ] `/juego/frogger/jugar` carga sin errores.
- [ ] El canvas (640 × 560) muestra las zonas diferenciadas (metas, río, zonas seguras, carretera).
- [ ] La rana aparece centrada en la fila de inicio.
- [ ] La rana salta una celda por pulsación de flecha con animación de 120 ms.
- [ ] La rana no puede salir por los laterales ni por abajo.
- [ ] Coches y camiones se mueven en loop por sus carriles.
- [ ] Troncos y tortugas se mueven en loop por sus carriles.
- [ ] Las tortugas alternan entre visibles y sumergidas.
- [ ] La rana muere al ser alcanzada por un vehículo.
- [ ] La rana muere al caer al agua.
- [ ] La rana muere cuando su tortuga se sumerge.
- [ ] La rana muere al salir por un lateral arrastrada en el río.
- [ ] La rana muere al agotar el temporizador.
- [ ] La rana muere al aterrizar en una pared o en una boca ocupada.
- [ ] Al morir se resta una vida en el HUD y la rana vuelve al inicio.
- [ ] Al llegar a una boca libre, la boca queda marcada, se suma +50 + bonus de tiempo y sale una rana nueva con el tiempo completo.
- [ ] Al completar las 5 bocas se suma +200 y empieza la siguiente ronda con el nivel incrementado.
- [ ] La velocidad de las entidades aumenta con cada nivel.
- [ ] El temporizador disminuye con cada nivel (mínimo 8 s).
- [ ] El canvas solo muestra la barra de tiempo como HUD interno, separada de las bocas por una franja oscura.
- [ ] El HUD de la plataforma refleja en tiempo real puntuación, vidas y nivel.
- [ ] PAUSA congela el juego y REANUDAR lo reanuda; P / Esc no pausan.
- [ ] Con 0 vidas aparece el `GameOverModal`.
- [ ] El modal pre-rellena el último nombre usado.
- [ ] Al guardar, el score (con `level`) se inserta en `scores` y el nombre se recuerda.
- [ ] El botón de guardar no permite doble inserción.
- [ ] "Jugar de nuevo" reinicia la partida desde cero.
- [ ] El score guardado aparece en `/juego/frogger` y en `/salon-de-la-fama`.
- [ ] `npm run lint`, `npx tsc --noEmit` y `npm run build` pasan sin errores.
- [ ] Ninguna ruta existente devuelve 500.

---

## Decisions

- **Sí: Contrato de integración del proyecto** (`engine.ts` + `frogger-player.tsx` + `jugar/page.tsx`) en lugar de un componente React con props en `components/games/`. Razón: coherencia con los demás juegos y requisito de `skin-designer` y `mobile-porter`.
- **Sí: Ruta `/juego/frogger/jugar`**, no `/games/frogger/play`. Razón: las rutas del proyecto están en español bajo `/juego`.
- **No: `dynamic(..., { ssr: false })`**. Razón: el motor se crea dentro de un `useEffect`, así que nunca corre en el servidor.
- **Sí: `GameOverModal` y `saveScore` compartidos**, sin modal propio. Razón: reutilización y consistencia.
- **Sí: Guardar `level`, no `user_id: null`**. Razón: la tabla `scores` exige `level >= 1`; `user_id` queda fuera hasta que haya auth.
- **Sí: Migración en `supabase/migrations/`**, no SQL Editor. Razón: convención del proyecto; aplicarla requiere confirmación del usuario.
- **Sí: `color = 'yellow'`**. Razón: `lime` no pasa el check de `games.color`.
- **Sí: Solo barra de tiempo en el HUD interno**. Razón: la fila 0 no tiene espacio para HUD y bocas; score, vidas y nivel ya están en el HUD externo como en el resto de juegos.
- **Sí: Barra de 10 px azul `#1f5fe0` → amarillo → rojo, con 8 px de franja oscura antes de las bocas**. Razón: el verde se confundía con el fondo de las bocas.
- **Sí: Cada rana nueva reinicia tiempo y puntuación por fila** (tras boca o muerte). Razón: llenar 5 bocas en 15 s es inviable; fiel al Frogger clásico.
- **Sí: Temporizador 15 s − 1 s por nivel, mínimo 8 s**.
- **Sí: Velocidad en px/frame convertida a celdas** (`/ CELL`). Razón: la fórmula original sumaba píxeles a una coordenada en celdas.
- **Sí: +15 % de velocidad compuesto por nivel**.
- **Sí: Colisión y soporte con el centro de la rana**. Razón: simétrico en ambos sentidos de tráfico.
- **Sí: Canvas 640 × 560** con río en filas 1–6 (se descartan los valores 480 × 640 y filas 7–2 de la versión anterior).
- **Sí: Portada `.cover-frogger` con gradientes CSS**. Razón: la migración la referencia y el resto del catálogo usa portadas CSS.
- **Sí: Primitivas canvas sin sprites; solo flechas como controles de teclado**.
- **No: Power-ups, RLS, realtime, componente genérico `CanvasGame`**.
