# GAME JAM — Pong (duelo contra CPU) · Variante A: Torneo de sets

> **Status:** Borrador
> **Depends on:** SPEC 05, SPEC 06, SPEC 07, SPEC 09, SPEC 12, SPEC 13, SPEC 14, SPEC 15, SPEC 16, SPEC 17
> **Date:** 2026-11-28
> **Objective:** Crear desde cero un duelo de paletas contra la CPU, con id `pong`, e integrarlo como el juego jugable "PONG" de Arcade Vault (primer juego de la categoría VERSUS), con tarjeta en `/juego`, detalle en `/juego/pong` y partida en `/juego/pong/jugar` dentro del CRT. En esta variante la partida es un **torneo de sets** contra rivales CPU cada vez más duros, y el motor envía puntuación, vidas y nivel al HUD y guarda la puntuación en `scores`.

## Why this spec exists

**Tema:** juego del To Do `references/game-suggestions-todo.md` (`pong`, 45/45): la única categoría vacía del catálogo es VERSUS, y el duelo de paletas es una mecánica instantánea y muy factible en canvas 2D. Catálogo actual: asteroides, tetris, arkanoid, snake y frogger, ninguno en VERSUS; magenta es el color pedido para este juego.

**Idea base (común a las dos variantes):** un duelo de paletas contra la CPU sobre una pista de 800×600, con bola que rebota y rival que reacciona. El juego se basa en la mecánica genérica de las paletas y la bola; la pista, el arte, las reglas del torneo y los rivales son propios. No hay recreación de ningún juego comercial.

**Qué hace distinta a la Variante A:** es el Pong "puro y competitivo". Un solo mando (arriba/abajo), sin poderes ni extras. El interés viene de la **estructura de torneo**: cada set se juega al mejor de 5 puntos, ganar un set te enfrenta a un rival CPU más rápido y preciso (Nivel +1) y perder un set cuesta una de tus 3 vidas. La puntuación premia las **rachas de devoluciones** y ganar sets sin conceder. La Variante B, en cambio, añade movimiento en dos ejes, golpe cargado, objetos de poder y barras de vida de base.

## Scope

**In:**

- Migración nueva que inserta la fila `pong` en `public.games`:
  - `id = 'pong'`, `title = 'PONG'`, `category = 'VERSUS'`, `cover = 'cover-pong'`, `color = 'magenta'`.
  - `short_description` y `long_description` en español (borrador en el modelo de datos), ajustables al implementar.
  - Sin columna `score_table` (ya no existe desde SPEC 13).
  - La fila debe existir antes de guardar cualquier puntuación, porque `scores.game_id` es una FK a `games.id`.
- Miniatura: clase nueva `.cover-pong` en `app/globals.css`, con dos paletas verticales y una bola sobre una red discontinua, en magenta y cian. La plantilla `.cover-duelo` ya existe pero es genérica; se toma como base visual y no se reutiliza tal cual.
- Clase `.pong-canvas` añadida a la regla compartida `.crt-screen .asteroids-canvas, .crt-screen .tetris-canvas, .crt-screen .arkanoid-canvas, .crt-screen .snake-canvas` de `app/globals.css`.
- Motor `app/juego/pong/engine.ts`: TypeScript estricto, encapsulado en la factory `createPongGame(canvas, callbacks)`.
- Reproductor `app/juego/pong/pong-player.tsx` (client component) y página `app/juego/pong/jugar/page.tsx` (`getGame("pong")`, `notFound()` si es `null`), con el mismo patrón que Snake y Tetris, incluido el patrón móvil de la SPEC 17 (`player-hud max-md:hidden!`, `MobileStatsBar` antes de `.crt`, `MobileGameControls` después, `ACTION_A = null`).
- Un único canvas con resolución interna 800×600 (4:3), escalado por CSS dentro de `.crt-screen`.
- Reglas del juego:
  - Pista de 800×600. Paleta del jugador a la izquierda (16×96 px, x = 32) y paleta de la CPU a la derecha (x = 752). Las paletas solo se mueven en vertical y no salen de la pista.
  - Un set se gana al llegar a **5 puntos** (sin diferencia mínima). Un punto se anota cuando la bola cruza el borde izquierdo o derecho.
  - Saque: cuenta atrás de 1,2 s con la bola parada en el centro, que sale hacia quien perdió el último punto (el primer saque va hacia el jugador). Ángulo de salida aleatorio en ±25°.
  - Rebote en paredes superior e inferior con reflexión perfecta.
  - Rebote en paleta: el ángulo de salida depende del punto de impacto (centro = recto, extremos hasta ±55°). Cada devolución acelera la bola un 5 % (de 420 px/s hasta un máximo de 880 px/s). La velocidad vuelve a 420 px/s en cada saque.
  - **Rivales CPU por nivel:** la CPU sigue la altura prevista de la bola con error y retardo. Velocidad de paleta `min(520, 240 + (nivel - 1) * 35)` px/s, error de puntería `max(8, 70 - (nivel - 1) * 9)` px y retardo de reacción `max(40, 220 - (nivel - 1) * 25)` ms. Con todos los topes alcanzados sigue siendo derrotable, porque la bola puede llegar a 880 px/s y la paleta de la CPU no pasa de 520 px/s.
  - **Torneo:** 3 vidas. Ganar un set sube el Nivel en 1 (sin tope) y empieza un set nuevo, con marcador a 0-0. Perder un set quita 1 vida y se repite el mismo nivel con marcador 0-0. Con 0 vidas la partida termina.
- Puntuación:
  - +100 por cada punto anotado a la CPU.
  - Bonus de racha al anotar: +10 × devoluciones consecutivas del jugador en ese intercambio, con tope de +300.
  - Bonus por ganar un set: +500 × nivel del set, más +250 si la CPU se quedó en 0 puntos.
  - Los puntos que concede el jugador no restan puntuación.
- Controles: flechas ↑/↓ o `W` / `S` para mover la paleta, con movimiento continuo mientras la tecla está pulsada. La pausa solo se activa con el botón PAUSA del HUD.
- Aspecto: vectorial minimalista. Fondo casi negro, red central discontinua, paletas y bola con brillo (`shadowBlur`), jugador en cian y CPU en magenta, marcador del set en dígitos grandes de 7 segmentos dibujados por código, y rótulo "RIVAL 0N" y mensaje "SET GANADO / SET PERDIDO" entre sets. Sin imágenes ni assets.
- HUD de la plataforma: Jugador (`INVITADO`), Puntuación, Vidas y Nivel. Vidas muestra un `♥` por vida restante (`♥♥♥`) y `—` al terminar. Nivel muestra el número de rival en dos dígitos.
- Botones del HUD: PAUSA / REANUDAR, FIN y SALIR.
- Fin de partida con `GameOverModal` y guardado con `saveScore({ gameId, name, score, level })`.
- Limpieza al desmontar: cancelar `requestAnimationFrame` y quitar los listeners de teclado.

**Out of scope (para specs futuras):**

- Sonido de cualquier tipo (ni archivos ni WebAudio).
- Modo de dos jugadores humanos y cualquier multijugador en red.
- Poderes, objetos, golpe especial, movimiento horizontal de paletas y múltiples bolas (es la Variante B).
- Skins `clasico` / `neon` / `retro` y su selector: los añade el agente `skin-designer` tras la implementación (`/spec-impl-game`).
- Control por ratón o táctil directo sobre la pista (el móvil usa solo el gamepad virtual de la SPEC 17).
- Dificultad seleccionable por el jugador.
- Ranking local en `localStorage`.
- Cambios en el esquema de `scores`, en `lib/scores/index.ts` y en los reproductores de los demás juegos.
- Cualquier modificación de las specs anteriores.

## Data model

Esta spec no introduce tablas ni columnas nuevas. Reutiliza `games` (SPEC 09 y 12) y `scores` (SPEC 13), y solo añade una fila de datos:

```sql
insert into public.games (id, title, short_description, long_description, category, cover, color)
values (
  'pong',
  'PONG',
  'Gana sets a la CPU, devuelve la bola sin fallar y sube de rival.',
  'Duelo de paletas contra la CPU. Cada set se juega a 5 puntos: gana el set para enfrentarte a un rival más rápido y preciso, y encadena devoluciones para multiplicar tu puntuación. Tienes 3 vidas; pierdes una por cada set perdido.',
  'VERSUS',
  'cover-pong',
  'magenta'
);
```

Contrato del motor hacia la plataforma, con la misma forma que el de Snake, Tetris y Arkanoid:

```ts
// app/juego/pong/engine.ts
export type PongStatus = "playing" | "paused" | "gameover";

export interface PongStats {
  score: number;
  lives: number; // 3 al empezar, baja 1 por set perdido, 0 en game over
  level: number; // >= 1, sube 1 por set ganado, sin tope
}

export interface PongCallbacks {
  onStats: (stats: PongStats) => void;
  onStatus: (status: PongStatus) => void;
  onGameOver: (finalStats: PongStats) => void;
}

export interface PongGame {
  start(): void;
  pause(): void;
  resume(): void;
  end(): void;
  restart(): void;
  destroy(): void;
}

export function createPongGame(
  canvas: HTMLCanvasElement,
  callbacks: PongCallbacks,
): PongGame;
```

Estado interno relevante:

```ts
type Phase = "serve" | "rally" | "setEnd"; // setEnd: pausa de 1,5 s con el mensaje del set

interface Paddle { x: number; y: number; w: number; h: number; vy: number }
interface Ball { x: number; y: number; vx: number; vy: number; r: number; speed: number }

interface MatchState {
  phase: Phase;
  phaseTimer: number;        // ms restantes de saque o de pausa de set
  playerPoints: number;      // 0..5
  cpuPoints: number;         // 0..5
  rally: number;             // devoluciones consecutivas del jugador en el intercambio
  serveToward: "player" | "cpu";
  keys: { up: boolean; down: boolean };
}

interface CpuProfile { paddleSpeed: number; aimError: number; reactionMs: number }
function cpuForLevel(level: number): CpuProfile; // fórmulas del Scope
```

Convenciones:

- El motor no importa Supabase ni `lib/data.ts`, y no usa variables globales de módulo. Escucha el teclado en `window` (el gamepad virtual despacha `KeyboardEvent` sintéticos allí) y reconoce las teclas por `e.code` / `e.key`.
- Resolución interna fija 800×600, origen arriba a la izquierda.
- Bucle con `requestAnimationFrame` y `dt` en segundos limitado a 0,05 s. Movimiento de la bola con subpasos si `speed * dt` supera el grosor de la paleta, para que no atraviese paletas a 880 px/s (anti-tunneling). La velocidad es la misma a 60 Hz y a 144 Hz porque todo avanza por `dt`, y no avanza en pausa.
- La CPU reevalúa su objetivo cada `reactionMs` de tiempo de juego (no por fotograma) y mueve la paleta hacia `objetivo ± aimError`, sin superar `paddleSpeed`.
- `onStats` se emite solo cuando cambian `score`, `lives` o `level`.
- Sin assets: la carpeta `public/pong/` no se crea en esta variante.
- Aleatoriedad (ángulo de saque, error de la CPU) con `Math.random()` dentro del motor, sin estado global.

## Implementation plan

1. Crear la migración `supabase/migrations/<timestamp>_add_game_pong.sql` con el `insert` en `games`, añadir `.cover-pong` y añadir `.pong-canvas` a la regla compartida de `app/globals.css`. Aplicar la migración al proyecto remoto solo con confirmación explícita del usuario. Comprobación manual: la tarjeta con `.cover-pong` aparece en `/juego`, el filtro VERSUS ya muestra un juego y `/juego/pong` muestra la ficha.
2. Crear `app/juego/pong/engine.ts` con el esqueleto: factory, bucle con `dt` limitado, listeners de teclado en `window`, paleta del jugador, bola con rebotes en paredes y paletas (con subpasos), saque con cuenta atrás, `start`/`pause`/`resume`/`end`/`restart`/`destroy`. Crear también `app/juego/pong/pong-player.tsx` (con el patrón móvil de la SPEC 17) y `app/juego/pong/jugar/page.tsx`. Comprobación manual: se mueve la paleta, la bola rebota, el saque cuenta atrás y FIN muestra el `GameOverModal`.
3. Añadir la CPU y el marcador: función `cpuForLevel`, seguimiento con error y retardo, puntos, sets a 5 y fases `serve` / `rally` / `setEnd`. Comprobación manual: la CPU devuelve bolas, el set termina a 5 y se muestra "SET GANADO" o "SET PERDIDO".
4. Añadir torneo y puntuación: vidas, nivel por set ganado, rival más duro, 100 por punto, bonus de racha, bonus de set y `onStats` / `onGameOver`. Comprobación manual: HUD con `♥♥♥`, Nivel 02 tras ganar un set, una vida menos tras perder uno, y game over con 0 vidas.
5. Añadir el dibujo: pista, red discontinua, paletas y bola con brillo, marcador de 7 segmentos, rótulo del rival y mensajes entre sets. Comprobación manual: aspecto correcto, nada se deforma y el marcador se lee bien dentro del CRT.
6. Verificación final: `npm run lint`, `npx tsc --noEmit`, `npm run build`, `get_advisors` de Supabase (seguridad) y recorrido completo (biblioteca → ficha → jugar → game over → guardar → leaderboard → salir), en escritorio y con viewport móvil de 390×844. Comprobación: todos los criterios de aceptación.

## Acceptance criteria

- [ ] Existe una fila `id = 'pong'` en `public.games` con `category = 'VERSUS'` y `color = 'magenta'`.
- [ ] `/juego` muestra la tarjeta PONG con la miniatura `.cover-pong`, distinta de las de los demás juegos, y el filtro VERSUS la lista.
- [ ] `/juego/pong` muestra la ficha con título y descripción, y su botón JUGAR lleva a `/juego/pong/jugar`.
- [ ] `/juego/pong/jugar` muestra la pista dentro del CRT sin deformarse, con las dos paletas, la bola, la red y el marcador 0-0.
- [ ] El HUD empieza con Puntuación 0, Nivel 01 y `♥♥♥` en Vidas.
- [ ] Al empezar hay una cuenta atrás de saque y la bola no se mueve hasta que termina.
- [ ] ↑/↓ y `W` / `S` mueven la paleta del jugador, que no sale de la pista, y ni las flechas ni `Espacio` hacen scroll en la página.
- [ ] La bola rebota en las paredes superior e inferior y en las paletas, y el ángulo de salida depende del punto de impacto.
- [ ] La bola acelera con cada devolución, no supera 880 px/s y vuelve a 420 px/s en cada saque.
- [ ] La bola no atraviesa una paleta a la velocidad máxima ni a 144 Hz.
- [ ] La CPU devuelve bolas y falla alguna; en el Nivel 1 es claramente más lenta que en el Nivel 5.
- [ ] Anotar un punto suma 100 más el bonus de racha (10 por devolución consecutiva, tope 300).
- [ ] Llegar a 5 puntos gana el set: el HUD pasa a Nivel 02, se suma el bonus de set y empieza un set 0-0.
- [ ] Ganar un set con la CPU en 0 puntos suma además 250.
- [ ] Perder un set (la CPU llega a 5) quita una vida, mantiene el Nivel y empieza un set 0-0.
- [ ] Con 0 vidas aparece el `GameOverModal` con la puntuación final y Vidas muestra `—`.
- [ ] `P`, `Espacio` y `Enter` no pausan ni reanudan el juego.
- [ ] PAUSA congela el juego, el botón pasa a REANUDAR y, al reanudar, la bola no salta de posición ni la cuenta atrás se consume.
- [ ] FIN termina la partida y muestra el `GameOverModal`.
- [ ] SALIR navega a `/juego/pong` y, tras salir, no quedan loops ni listeners de teclado activos (`Espacio` vuelve a hacer scroll y no hay errores en consola).
- [ ] La velocidad de la bola y de las paletas es la misma en un monitor de 60 Hz y en uno de 144 Hz.
- [ ] Guardar la puntuación crea una fila en `scores` con `game_id = 'pong'` y `level >= 1`.
- [ ] El nuevo registro aparece en el leaderboard del juego, en el Salón de la Fama y en la actividad de la home.
- [ ] Reiniciar desde el `GameOverModal` deja Puntuación en 0, Nivel en 1, Vidas en 3 y marcador 0-0 con cuenta atrás.
- [ ] Con viewport de 390×844 se ven `MobileStatsBar` y `MobileGameControls`, la cruceta arriba/abajo mueve la paleta y el botón A aparece deshabilitado.
- [ ] El juego no escribe en `localStorage` y no reproduce ningún sonido.
- [ ] Los demás juegos se siguen jugando y guardando puntuaciones igual que antes.
- [ ] `get_advisors` de Supabase no muestra avisos de seguridad nuevos.
- [ ] `npm run lint`, `npx tsc --noEmit` y `npm run build` pasan sin errores.

## Decisions

- **Sí (asumido):** id `pong`, categoría `VERSUS` y color `magenta`, tal y como indica la entrada del To Do; rutas `/juego/pong` y `/juego/pong/jugar`.
- **Sí (asumido):** título en `games` = `PONG` (mayúsculas y corto, como `SNAKE` y `TETRIS`); "(duelo contra CPU)" queda como subtítulo en las descripciones. **No:** `Pong (duelo contra CPU)` en el campo `title`, demasiado largo para la tarjeta.
- **Sí (asumido):** `Pong` es el nombre genérico del género y también marca registrada en el mundo comercial; el juego no copia arte, sonido ni reglas propias de ningún título comercial. Si se prefiere evitar el nombre, cambiar `title` en la migración sin tocar el `id`.
- **Sí (asumido):** juego desde cero, sin carpeta en `references/started-games/` ni assets en `references/source-assets/`.
- **Sí (asumido):** estructura de torneo de sets a 5 puntos, con 3 vidas (una por set perdido) y Nivel = rival superado + 1. **No:** vidas por punto concedido; **No:** partido único al mejor de N sin niveles.
- **Sí (asumido):** una sola dimensión de control (arriba/abajo); la profundidad viene de la puntería con el punto de impacto, la racha y la escalada de rivales. **No:** movimiento horizontal, poderes ni golpe especial (Variante B).
- **Sí (asumido):** fórmulas de puntuación (100 por punto, racha +10 con tope 300, set 500 × nivel y +250 por set en blanco). Son valores de partida que se ajustan al probar.
- **Sí (asumido):** fórmulas de dificultad de la CPU (velocidad, error y retardo por nivel) y velocidades de la bola (420 a 880 px/s, +5 % por devolución). Van en constantes del motor y se ajustan al probar.
- **Sí (asumido):** sin tope de niveles; la CPU deja de mejorar al alcanzar sus topes, pero sigue siendo derrotable por la diferencia de velocidad con la bola.
- **Sí (asumido):** la pausa es solo el botón PAUSA, como en Snake, Tetris y Arkanoid; `P`, `Espacio` y `Enter` no pausan.
- **Sí (asumido):** aspecto vectorial minimalista, paleta cian (jugador) y magenta (CPU), marcador de 7 segmentos por código. **No:** sprites ni imágenes.
- **Sí (asumido):** `ACTION_A = null` en el gamepad móvil, porque esta variante solo usa arriba/abajo.
- **Sí (asumido):** `Espacio` y las flechas hacen `preventDefault` mientras el juego está montado, para evitar el scroll. `Enter` recupera su comportamiento normal.
- **Sí (asumido):** `scores.level` guarda el nivel alcanzado, que siempre es >= 1.
- **Sí (asumido):** el motor vive en `app/juego/pong/engine.ts` y el reproductor en `pong-player.tsx`. **No:** un reproductor genérico.
- **Sí (asumido):** las skins `clasico` / `neon` / `retro` quedan fuera de esta spec; las añade `skin-designer` en el flujo `/spec-impl-game`.
- **Sí (asumido):** sin sonido ni extras.

## Identified risks

| Riesgo | Mitigación |
| ------ | ---------- |
| La migración inserta datos en una base compartida. | Es un `insert` aditivo; aplicarlo al proyecto remoto exige confirmación explícita del usuario. |
| Doble loop en desarrollo por React Strict Mode. | `destroy()` cancela `requestAnimationFrame` y quita los listeners; un criterio de aceptación comprueba la limpieza al salir. |
| Captura global del teclado. | Los listeners en `window` y el `preventDefault` en `Espacio` y flechas se quitan al desmontar. |
| `dt` enorme al reanudar o al volver a la pestaña. | Limitar `dt` a 0,05 s y reiniciar `lastTime` al reanudar; la cuenta atrás y el temporizador de la CPU usan tiempo de juego. |
| Re-renders del HUD en cada frame. | Emitir `onStats` solo cuando cambian `score`, `lives` o `level`. |
| `Espacio` o `Enter` activan el botón enfocado del HUD. | `blur` tras el clic en PAUSA y FIN, como en los otros juegos. |
| Velocidad distinta a 60 Hz y a 144 Hz. | Todo el movimiento y los temporizadores van por `dt`; sin paso por fotograma. |
| El gamepad virtual no llega al motor. | El motor escucha en `window` y acepta eventos sintéticos con `key` y `code`. |
| La bola atraviesa la paleta a 880 px/s (tunneling). | Subpasos de movimiento y comprobación de cruce del plano de la paleta. |
| La CPU resulta imbatible o inútil. | Parámetros por nivel en una sola función `cpuForLevel`; los topes dejan la CPU por debajo de la velocidad máxima de la bola y se ajustan al probar. |
| Rallies infinitos (bola siempre recta contra una CPU perfecta). | El ángulo depende del punto de impacto, la bola acelera con cada devolución y la CPU tiene error de puntería y retardo. |
| Una partida dura menos de 2 min o más de 10. | Un set dura de 1 a 2 min; con 3 vidas la partida queda en el rango de 2 a 10 min, y FIN permite cerrar. |
| Uso del nombre "Pong", marca registrada de un juego comercial. | Arte, reglas de torneo y rivales propios; el título en `games` se puede cambiar sin tocar el `id` (ver Decisions). |
| Assets: no hay carga que pueda fallar. | Todo se dibuja por código; sin dependencias nuevas. |
| Marcador de 7 segmentos ilegible al escalar el CRT. | Dígitos grandes (mínimo 64 px de alto internos) y revisión a tamaño escritorio y móvil. |

## What is **not** in this spec

Sonido, modo de dos jugadores o en red, poderes y golpe especial, movimiento horizontal de paletas, varias bolas, skins, control por ratón o táctil directo, dificultad seleccionable, ranking local, cambios en `scores` y un reproductor genérico. Cada uno, si llega, va en su propia spec.
