# GAME JAM — Pong (duelo contra CPU) · Variante B: Arena de poder

> **Status:** Borrador
> **Depends on:** SPEC 05, SPEC 06, SPEC 07, SPEC 09, SPEC 12, SPEC 13, SPEC 14, SPEC 15, SPEC 16, SPEC 17
> **Date:** 2026-11-28
> **Objective:** Crear desde cero un duelo de paletas contra la CPU, con id `pong`, e integrarlo como el juego jugable "PONG" de Arcade Vault (primer juego de la categoría VERSUS), con tarjeta en `/juego`, detalle en `/juego/pong` y partida en `/juego/pong/jugar` dentro del CRT. En esta variante el duelo es una **arena de combate**: cada bando tiene una base con vida, la paleta se mueve en dos ejes, existe un golpe cargado y aparecen objetos de poder. El motor envía puntuación, vidas y nivel al HUD y guarda la puntuación en `scores`.

## Why this spec exists

**Tema:** juego del To Do `references/game-suggestions-todo.md` (`pong`, 45/45): la única categoría vacía del catálogo es VERSUS, y el duelo de paletas es una mecánica instantánea y muy factible en canvas 2D. Catálogo actual: asteroides, tetris, arkanoid, snake y frogger, ninguno en VERSUS; magenta es el color pedido para este juego.

**Idea base (común a las dos variantes):** un duelo de paletas contra la CPU sobre una pista de 800×600, con bola que rebota y rival que reacciona. El juego se basa en la mecánica genérica de las paletas y la bola; la pista, el arte, las reglas y los objetos son propios. No hay recreación de ningún juego comercial.

**Qué hace distinta a la Variante B:** no hay marcador de sets. Cada bando tiene una **base con 5 puntos de vida**; un gol hiere la base rival y un gol propio hiere la tuya. La paleta se mueve en **dos ejes** dentro de su tercio de pista, el jugador tiene un **golpe cargado** (Espacio) y **objetos de poder** que flotan por el centro y se recogen con la bola. Se juega de forma más táctica y agresiva, con la puntuación por daño y combos. La Variante A, en cambio, es un Pong puro de un solo eje, en sets y con rivales por nivel.

## Scope

**In:**

- Migración nueva que inserta la fila `pong` en `public.games`:
  - `id = 'pong'`, `title = 'PONG'`, `category = 'VERSUS'`, `cover = 'cover-pong'`, `color = 'magenta'`.
  - `short_description` y `long_description` en español (borrador en el modelo de datos), ajustables al implementar.
  - Sin columna `score_table` (ya no existe desde SPEC 13).
  - La fila debe existir antes de guardar cualquier puntuación, porque `scores.game_id` es una FK a `games.id`.
- Miniatura: clase nueva `.cover-pong` en `app/globals.css`, con paletas, una bola con estela y una barra de vida, en magenta y cian. La plantilla `.cover-duelo` ya existe pero es genérica; se toma como base visual y no se reutiliza tal cual.
- Clase `.pong-canvas` añadida a la regla compartida `.crt-screen .asteroids-canvas, .crt-screen .tetris-canvas, .crt-screen .arkanoid-canvas, .crt-screen .snake-canvas` de `app/globals.css`.
- Motor `app/juego/pong/engine.ts`: TypeScript estricto, encapsulado en la factory `createPongGame(canvas, callbacks)`.
- Reproductor `app/juego/pong/pong-player.tsx` (client component) y página `app/juego/pong/jugar/page.tsx` (`getGame("pong")`, `notFound()` si es `null`), con el patrón de Snake y Tetris, incluido el patrón móvil de la SPEC 17 (`player-hud max-md:hidden!`, `MobileStatsBar` antes de `.crt`, `MobileGameControls` después, `ACTION_A = null`, el golpe va en el botón B = Espacio).
- Un único canvas con resolución interna 800×600 (4:3), escalado por CSS dentro de `.crt-screen`.
- Reglas del juego:
  - **Arena:** 800×600 con una franja superior de 48 px reservada a las barras de vida y la energía. La zona de juego es 800×552. La paleta del jugador (16×88 px) se mueve en el tercio izquierdo (x entre 24 y 240) y la de la CPU en el tercio derecho (x entre 560 y 776). Las paletas no salen de su tercio ni de la pista.
  - **Bases y daño:** cada bando tiene 5 puntos de vida. Un gol (la bola cruza el borde del bando) quita 1 punto a ese bando; un gol con golpe cargado quita 2.
  - **Rondas y nivel:** cuando la base de la CPU llega a 0 se gana la ronda: Nivel +1 (sin tope), la base de la CPU se rellena a 5 y se vuelve a empezar con una CPU más fuerte, y el jugador recupera 1 punto de vida (máximo 5). Cuando la base del jugador llega a 0 la partida termina.
  - **Saque:** cuenta atrás de 1 s con la bola en el centro, que sale hacia quien recibió el último gol (el primero, hacia el jugador). Velocidad inicial 380 px/s.
  - **Bola:** rebota en las paredes superior e inferior de la zona de juego. En la paleta, el ángulo de salida depende del punto de impacto (±55°), y además la velocidad horizontal de la paleta en ese instante se suma al ángulo (efecto de "empuje"). Cada devolución acelera la bola un 4 % hasta 820 px/s. La velocidad vuelve a 380 px/s en cada saque.
  - **Golpe cargado:** una barra de energía de 0 a 100. Cada devolución normal del jugador carga 20; al llegar a 100 la paleta brilla. Pulsando `Espacio` con la bola a menos de 70 px del frente de la paleta, y con la energía llena, la devolución es un **golpe cargado**: la bola sale recta hacia la CPU a 1,5 × la velocidad actual (máximo 1000 px/s), con estela de fuego, y gasta toda la energía. Si se pulsa `Espacio` sin energía llena o sin bola cerca, no pasa nada (sin penalización).
  - **Objetos de poder:** cada 8 s de juego (si no hay ninguno) aparece un objeto en el centro de la pista, que deriva despacio en vertical. Se recoge cuando la bola lo toca. Lo recibe el bando que golpeó la bola por última vez. Tipos: **ANCHA** (paleta +50 % de altura durante 8 s), **MULTI** (aparece una segunda bola durante 10 s o hasta que se marque un gol) y **ESCUDO** (una barrera que absorbe el siguiente gol en su lado y desaparece). Máximo 1 objeto en pantalla y 1 efecto de cada tipo por bando.
  - **Varias bolas:** MULTI crea una bola extra. Un gol de la bola extra también hiere la base. La bola extra desaparece al marcarse un gol, al acabar su efecto o al cambiar de ronda. El saque nuevo solo ocurre cuando no queda ninguna bola.
  - **CPU por nivel:** la CPU se mueve en los dos ejes dentro de su tercio, persigue la altura prevista de la bola con error y retardo, y se adelanta o retrocede según la distancia. Velocidad de paleta `min(500, 230 + (nivel - 1) * 30)` px/s, error `max(10, 60 - (nivel - 1) * 8)` px y retardo `max(50, 200 - (nivel - 1) * 20)` ms. Desde el Nivel 3 usa también el golpe cargado, con la misma regla de energía, y desde el Nivel 4 aprovecha los objetos de poder.
- Puntuación:
  - +50 por cada devolución del jugador.
  - +200 por cada punto de daño a la base de la CPU (+400 si el gol viene de un golpe cargado, que quita 2).
  - +100 por recoger un objeto de poder.
  - +1000 × nivel al ganar una ronda, más +150 por cada punto de vida que le quede a tu base.
  - Combo: si el jugador marca 2 o más goles seguidos sin recibir ninguno, cada gol del combo multiplica el daño en puntos por el número de goles seguidos (tope ×4). Recibir un gol rompe el combo.
- Controles: flechas ↑/↓/←/→ o `W` / `A` / `S` / `D` para mover la paleta en los dos ejes, `Espacio` para el golpe cargado. La pausa solo se activa con el botón PAUSA del HUD.
- Aspecto: arena neón de estilo synthwave. Fondo violeta oscuro con cuadrícula en perspectiva, línea central con pulsos, paletas con halo (cian para el jugador, magenta para la CPU), bola con estela y partículas, anillo de onda y pequeña sacudida de pantalla en los golpes cargados, barras de vida de base de 5 segmentos y barra de energía en la franja superior. Los objetos de poder se dibujan como cápsulas con letra (A, M, E). Sin imágenes ni assets.
- HUD de la plataforma: Jugador (`INVITADO`), Puntuación, Vidas y Nivel. **Vidas** muestra los puntos de vida de la base del jugador (de `♥` a `♥♥♥♥♥`; `—` al terminar). Nivel muestra la ronda en dos dígitos.
- Botones del HUD: PAUSA / REANUDAR, FIN y SALIR.
- Fin de partida con `GameOverModal` y guardado con `saveScore({ gameId, name, score, level })`.
- Limpieza al desmontar: cancelar `requestAnimationFrame` y quitar los listeners de teclado.

**Out of scope (para specs futuras):**

- Sonido de cualquier tipo (ni archivos ni WebAudio).
- Modo de dos jugadores humanos y cualquier multijugador en red.
- Marcador de sets, rivales con nombre y torneo clásico (es la Variante A).
- Más tipos de objetos de poder, obstáculos fijos en la pista y jefes finales.
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
  'Duelo de paletas contra la CPU con golpe cargado y objetos de poder.',
  'Arena de paletas contra la CPU. Cada bando protege una base de 5 puntos de vida: mueve la paleta en dos ejes, carga el golpe con tus devoluciones, recoge objetos de poder con la bola y destruye la base rival para pasar a la siguiente ronda.',
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
  lives: number; // vida de la base del jugador: 5 al empezar, 0 en game over
  level: number; // >= 1, sube 1 por ronda ganada, sin tope
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
type Side = "player" | "cpu";
type PowerKind = "wide" | "multi" | "shield";

interface Paddle {
  x: number; y: number; w: number; h: number;
  vx: number; vy: number;
  minX: number; maxX: number;      // tercio de pista del bando
  wideTimer: number;               // ms restantes de ANCHA
}

interface Ball {
  x: number; y: number; vx: number; vy: number; r: number;
  lastHitBy: Side | null;
  charged: boolean;                // golpe cargado en vuelo
  extra: boolean;                  // bola de MULTI
  trail: { x: number; y: number }[];
}

interface PowerUp { kind: PowerKind; x: number; y: number; vy: number }

interface ArenaState {
  balls: Ball[];
  baseHp: Record<Side, number>;    // 0..5
  energy: number;                  // 0..100, solo del jugador (la CPU lleva la suya)
  shield: Record<Side, boolean>;
  powerUp: PowerUp | null;
  spawnTimer: number;              // ms hasta el siguiente objeto
  multiTimer: number;              // ms restantes de MULTI
  combo: number;                   // goles seguidos del jugador
  serveTimer: number;              // ms de cuenta atrás del saque
  keys: { up: boolean; down: boolean; left: boolean; right: boolean };
  shake: number;                   // intensidad de la sacudida, decae con dt
}

interface CpuProfile {
  paddleSpeed: number; aimError: number; reactionMs: number;
  usesSmash: boolean; usesPowerUps: boolean;
}
function cpuForLevel(level: number): CpuProfile; // fórmulas del Scope
```

Convenciones:

- El motor no importa Supabase ni `lib/data.ts`, y no usa variables globales de módulo. Escucha el teclado en `window` (el gamepad virtual despacha `KeyboardEvent` sintéticos allí) y reconoce las teclas por `e.code` / `e.key`, incluido `Space` para el golpe.
- Resolución interna fija 800×600, origen arriba a la izquierda.
- Bucle con `requestAnimationFrame` y `dt` limitado a 0,05 s. Movimiento de las bolas con subpasos para evitar el tunneling a 1000 px/s. Todos los temporizadores (objetos, efectos, saque, sacudida, retardo de la CPU) son de tiempo de juego: no avanzan en pausa y son iguales a 60 Hz y a 144 Hz.
- El golpe cargado se evalúa en el evento `keydown` de `Space` (sin repetición, se ignora `e.repeat`), no por fotograma.
- Las partículas y la estela tienen un tope fijo (por ejemplo 64 partículas y 12 puntos de estela por bola) para que el coste por fotograma sea constante.
- `onStats` se emite solo cuando cambian `score`, `lives` o `level`; la energía, las barras de vida y los efectos se dibujan en el canvas y no pasan por el HUD de React.
- Sin assets: la carpeta `public/pong/` no se crea en esta variante.

## Implementation plan

1. Crear la migración `supabase/migrations/<timestamp>_add_game_pong.sql` con el `insert` en `games`, añadir `.cover-pong` y añadir `.pong-canvas` a la regla compartida de `app/globals.css`. Aplicar la migración al proyecto remoto solo con confirmación explícita del usuario. Comprobación manual: la tarjeta con `.cover-pong` aparece en `/juego`, el filtro VERSUS ya muestra un juego y `/juego/pong` muestra la ficha.
2. Crear `app/juego/pong/engine.ts` con el esqueleto: factory, bucle con `dt` limitado, listeners de teclado en `window`, paleta del jugador con movimiento en dos ejes dentro del tercio, una bola con rebotes (subpasos) y saque con cuenta atrás, `start`/`pause`/`resume`/`end`/`restart`/`destroy`. Crear también `app/juego/pong/pong-player.tsx` (con el patrón móvil de la SPEC 17) y `app/juego/pong/jugar/page.tsx`. Comprobación manual: la paleta se mueve en los dos ejes sin salir del tercio, la bola rebota y FIN muestra el `GameOverModal`.
3. Añadir la CPU y las bases: `cpuForLevel`, seguimiento en dos ejes con error y retardo, gol que quita vida a la base, ronda ganada con Nivel +1 y recuperación de 1 vida, game over con la base a 0. Comprobación manual: `onStats` refleja Vidas y Nivel, los goles quitan 1 punto de vida y ganar la ronda sube el Nivel.
4. Añadir el golpe cargado: energía del jugador, `keydown` de `Space`, ventana de 70 px, bola con velocidad ×1,5 y daño doble, y el uso del golpe por la CPU desde el Nivel 3. Comprobación manual: la barra de energía se llena con devoluciones y `Espacio` lanza el golpe solo con energía llena y la bola cerca.
5. Añadir objetos de poder: aparición cada 8 s, recogida con la bola, ANCHA, MULTI (bola extra) y ESCUDO, con los límites indicados. Comprobación manual: cada objeto aparece, se recoge y aplica su efecto al último que golpeó la bola, y la bola extra desaparece como se describe.
6. Añadir puntuación y combo: 50 por devolución, 200 por daño, 400 por daño de golpe cargado, 100 por objeto, bonus de ronda y combo hasta ×4. Comprobación manual: la puntuación del HUD coincide con las reglas y el combo se rompe al recibir un gol.
7. Añadir el dibujo: arena synthwave, barras de vida, barra de energía, estelas, partículas, onda y sacudida en golpe cargado, cápsulas de objetos y mensajes de ronda. Comprobación manual: aspecto correcto, el tope de partículas mantiene el rendimiento y nada se deforma dentro del CRT.
8. Verificación final: `npm run lint`, `npx tsc --noEmit`, `npm run build`, `get_advisors` de Supabase (seguridad) y recorrido completo (biblioteca → ficha → jugar → game over → guardar → leaderboard → salir), en escritorio y con viewport móvil de 390×844. Comprobación: todos los criterios de aceptación.

## Acceptance criteria

- [ ] Existe una fila `id = 'pong'` en `public.games` con `category = 'VERSUS'` y `color = 'magenta'`.
- [ ] `/juego` muestra la tarjeta PONG con la miniatura `.cover-pong`, distinta de las de los demás juegos, y el filtro VERSUS la lista.
- [ ] `/juego/pong` muestra la ficha con título y descripción, y su botón JUGAR lleva a `/juego/pong/jugar`.
- [ ] `/juego/pong/jugar` muestra la arena dentro del CRT sin deformarse, con las dos paletas, la bola, las barras de vida de las bases y la barra de energía.
- [ ] El HUD empieza con Puntuación 0, Nivel 01 y `♥♥♥♥♥` en Vidas.
- [ ] Al empezar hay una cuenta atrás de saque y la bola no se mueve hasta que termina.
- [ ] Las flechas y `W` / `A` / `S` / `D` mueven la paleta del jugador en los dos ejes, y la paleta no sale de su tercio de pista ni de la zona de juego.
- [ ] Ni las flechas ni `Espacio` hacen scroll en la página.
- [ ] La bola rebota en las paredes y en las paletas, y el ángulo de salida depende del punto de impacto y de la velocidad de la paleta.
- [ ] La bola no atraviesa una paleta a la velocidad máxima ni a 144 Hz.
- [ ] Un gol de la CPU quita 1 punto a la base del jugador y el HUD actualiza Vidas; un gol del jugador quita 1 punto a la base de la CPU.
- [ ] Cada devolución del jugador suma 50 y carga 20 de energía; con la energía a 100 la paleta brilla.
- [ ] `Espacio` con energía llena y la bola a menos de 70 px lanza un golpe cargado (bola recta, ×1,5 de velocidad, estela de fuego) y vacía la energía.
- [ ] `Espacio` sin energía llena o sin bola cerca no hace nada y no penaliza.
- [ ] Un gol con golpe cargado quita 2 puntos a la base rival y suma 400 en lugar de 200.
- [ ] Aparece un objeto de poder cada 8 s si no hay otro, y se recoge al tocarlo con la bola.
- [ ] ANCHA agranda la paleta del último que golpeó la bola durante 8 s, MULTI añade una bola extra y ESCUDO absorbe el siguiente gol en su lado.
- [ ] Recoger un objeto suma 100.
- [ ] Dos goles seguidos del jugador activan el combo y multiplican los puntos de daño (tope ×4); recibir un gol lo rompe.
- [ ] Vaciar la base de la CPU gana la ronda: Nivel +1, bonus de ronda, la base de la CPU vuelve a 5 y el jugador recupera 1 punto de vida (máximo 5).
- [ ] Desde el Nivel 3 la CPU usa el golpe cargado, y la CPU del Nivel 5 es claramente más rápida y precisa que la del Nivel 1.
- [ ] Con la base del jugador a 0 aparece el `GameOverModal` con la puntuación final y Vidas muestra `—`.
- [ ] `P` y `Enter` no pausan ni reanudan el juego, y `Espacio` solo lanza el golpe.
- [ ] PAUSA congela el juego (bolas, temporizadores, objetos y efectos), el botón pasa a REANUDAR y, al reanudar, nada salta de posición.
- [ ] FIN termina la partida y muestra el `GameOverModal`.
- [ ] SALIR navega a `/juego/pong` y, tras salir, no quedan loops ni listeners de teclado activos (`Espacio` vuelve a hacer scroll y no hay errores en consola).
- [ ] La velocidad del juego y la duración de los efectos son las mismas en un monitor de 60 Hz y en uno de 144 Hz.
- [ ] Guardar la puntuación crea una fila en `scores` con `game_id = 'pong'` y `level >= 1`.
- [ ] El nuevo registro aparece en el leaderboard del juego, en el Salón de la Fama y en la actividad de la home.
- [ ] Reiniciar desde el `GameOverModal` deja Puntuación en 0, Nivel en 1, Vidas en 5, sin objetos ni bolas extra, y con cuenta atrás de saque.
- [ ] Con viewport de 390×844 se ven `MobileStatsBar` y `MobileGameControls`, la cruceta mueve la paleta, el botón B lanza el golpe y el botón A aparece deshabilitado.
- [ ] El juego no escribe en `localStorage` y no reproduce ningún sonido.
- [ ] Los demás juegos se siguen jugando y guardando puntuaciones igual que antes.
- [ ] `get_advisors` de Supabase no muestra avisos de seguridad nuevos.
- [ ] `npm run lint`, `npx tsc --noEmit` y `npm run build` pasan sin errores.

## Decisions

- **Sí (asumido):** id `pong`, categoría `VERSUS` y color `magenta`, tal y como indica la entrada del To Do; rutas `/juego/pong` y `/juego/pong/jugar`.
- **Sí (asumido):** título en `games` = `PONG` (mayúsculas y corto, como `SNAKE` y `TETRIS`); "(duelo contra CPU)" queda como subtítulo en las descripciones. **No:** `Pong (duelo contra CPU)` en el campo `title`, demasiado largo para la tarjeta.
- **Sí (asumido):** `Pong` es el nombre genérico del género y también marca registrada en el mundo comercial; el juego no copia arte, sonido ni reglas propias de ningún título comercial. Si se prefiere evitar el nombre, cambiar `title` en la migración sin tocar el `id`.
- **Sí (asumido):** juego desde cero, sin carpeta en `references/started-games/` ni assets en `references/source-assets/`.
- **Sí (asumido):** base con 5 puntos de vida por bando en lugar de marcador de sets; Vidas del HUD = vida de la base del jugador (1 a 5) y Nivel = ronda. **No:** vidas fijas de 3; **No:** sets a 5 puntos (Variante A).
- **Sí (asumido):** movimiento en dos ejes dentro del tercio de pista del bando. **No:** movimiento libre por toda la pista, que anularía la defensa del lado.
- **Sí (asumido):** golpe cargado con `Espacio`, energía por devoluciones y ventana de 70 px. **No:** carga manteniendo pulsada la tecla.
- **Sí (asumido):** tres objetos de poder (ANCHA, MULTI y ESCUDO), aparición cada 8 s, recogida con la bola y efecto para el último que golpeó. Son valores de partida que se ajustan al probar.
- **Sí (asumido):** fórmulas de puntuación (50 / 200 / 400 / 100, ronda 1000 × nivel + 150 por vida, combo hasta ×4) y de dificultad de la CPU. Van en constantes del motor y se ajustan al probar.
- **Sí (asumido):** ganar una ronda cura 1 punto de vida (máximo 5), para que una partida pueda prolongarse sin ser inevitable perder. Sin tope de niveles.
- **Sí (asumido):** la pausa es solo el botón PAUSA, como en Snake, Tetris y Arkanoid; `P` y `Enter` no pausan, y `Espacio` queda reservado al golpe.
- **Sí (asumido):** aspecto neón synthwave con estelas, partículas y sacudida, todo dibujado por código y con topes fijos de partículas. **No:** sprites ni imágenes.
- **Sí (asumido):** `ACTION_A = null` en el gamepad móvil; el golpe va en el botón B, que siempre es `Espacio`.
- **Sí (asumido):** `Espacio` y las flechas hacen `preventDefault` mientras el juego está montado, para evitar el scroll. `Enter` recupera su comportamiento normal.
- **Sí (asumido):** `scores.level` guarda la ronda alcanzada, que siempre es >= 1.
- **Sí (asumido):** el motor vive en `app/juego/pong/engine.ts` y el reproductor en `pong-player.tsx`. **No:** un reproductor genérico.
- **Sí (asumido):** las skins `clasico` / `neon` / `retro` quedan fuera de esta spec; las añade `skin-designer` en el flujo `/spec-impl-game`. El aspecto de esta variante ya es neón, así que esa skin tendrá poca diferencia con la base.
- **Sí (asumido):** sin sonido ni extras.

## Identified risks

| Riesgo | Mitigación |
| ------ | ---------- |
| La migración inserta datos en una base compartida. | Es un `insert` aditivo; aplicarlo al proyecto remoto exige confirmación explícita del usuario. |
| Doble loop en desarrollo por React Strict Mode. | `destroy()` cancela `requestAnimationFrame` y quita los listeners; un criterio de aceptación comprueba la limpieza al salir. |
| Captura global del teclado. | Los listeners en `window` y el `preventDefault` en `Espacio` y flechas se quitan al desmontar. |
| `dt` enorme al reanudar o al volver a la pestaña. | Limitar `dt` a 0,05 s y reiniciar `lastTime` al reanudar; todos los temporizadores usan tiempo de juego. |
| Re-renders del HUD en cada frame. | Emitir `onStats` solo cuando cambian `score`, `lives` o `level`; energía, barras y efectos se dibujan en el canvas. |
| `Espacio` o `Enter` activan el botón enfocado del HUD. | `blur` tras el clic en PAUSA y FIN, y `preventDefault` en `keydown` y `keyup` de `Espacio`; la tecla de golpe es la que más riesgo tiene de activar un botón enfocado. |
| Velocidad distinta a 60 Hz y a 144 Hz. | Todo va por `dt`; sin paso por fotograma ni `setInterval`. |
| El gamepad virtual no llega al motor, y el botón B (Espacio) no dispara el golpe. | El motor escucha en `window` y acepta eventos sintéticos con `key` y `code`; probar el golpe con el botón B en el viewport móvil. |
| Un `keydown` repetido de `Espacio` dispara golpes en cadena. | Ignorar `e.repeat`; el golpe consume toda la energía. |
| La bola atraviesa la paleta a 1000 px/s (tunneling), sobre todo con la paleta en movimiento horizontal. | Subpasos de movimiento y comprobación contra la paleta barrida durante el paso. |
| Bola atrapada en una paleta que avanza (paleta empuja la bola dentro de sí misma). | Tras un rebote, recolocar la bola fuera de la paleta y marcar un breve periodo sin colisión con esa paleta. |
| Con MULTI y ESCUDO la lógica de goles se vuelve inconsistente (doble gol, gol con escudo, bola extra sin dueño). | Una sola función `resolveGoal(ball, side)` que gestiona escudo, daño, combo y retirada de la bola; criterios de aceptación específicos. |
| Demasiadas reglas hacen confuso el juego. | Objetos limitados a 3 tipos y a 1 en pantalla, y mensajes breves en pista al recoger un objeto; se revisa en la verificación manual. |
| La CPU resulta imbatible o inútil con golpe cargado y objetos. | Parámetros por nivel en una sola función `cpuForLevel`; golpe desde el Nivel 3 y objetos desde el Nivel 4, y se ajustan al probar. |
| Partículas, estelas y brillos penalizan el rendimiento en equipos modestos. | Topes fijos (64 partículas, 12 puntos de estela) y `shadowBlur` solo en los elementos principales. |
| La sacudida de pantalla marea o corta el CRT. | Intensidad pequeña, decae rápido y se aplica solo al contenido del canvas; no mueve el marco. |
| Una partida dura menos de 2 min o más de 10. | Una ronda dura unos 1-2 min y la curación es solo de 1 punto, así que la partida cae en el rango de 2 a 10 min; FIN permite cerrar. |
| Uso del nombre "Pong", marca registrada de un juego comercial. | Arte, reglas de arena, golpe y objetos propios; el título en `games` se puede cambiar sin tocar el `id` (ver Decisions). |
| Assets: no hay carga que pueda fallar. | Todo se dibuja por código; sin dependencias nuevas. |

## What is **not** in this spec

Sonido, modo de dos jugadores o en red, marcador por sets y torneo clásico, más objetos de poder, obstáculos o jefes, skins, control por ratón o táctil directo, dificultad seleccionable, ranking local, cambios en `scores` y un reproductor genérico. Cada uno, si llega, va en su propia spec.
