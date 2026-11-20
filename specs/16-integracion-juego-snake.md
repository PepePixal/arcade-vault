# SPEC 16 — Integración del juego Snake

> **Status:** Aprobado
> **Depends on:** SPEC 05, SPEC 06, SPEC 07, SPEC 09, SPEC 12, SPEC 13, SPEC 14, SPEC 15
> **Date:** 2026-11-20
> **Objective:** Crear el juego Snake desde cero e integrarlo como el juego jugable "SNAKE" de Arcade Vault, con tarjeta en `/juego`, detalle en `/juego/snake` y partida en `/juego/snake/jugar` dentro del CRT de la plataforma, enviando puntuación, vidas y nivel al HUD y guardando la puntuación en `scores`.

## Why this spec exists

A diferencia de Asteroides, Tetris y Arkanoid, Snake no tiene juego de partida: `references/started-games/` solo contiene `02-asteroids`, `03-tetris` y `04-arkanoid`, y lo único que existe son los sprites de frutas en `references/source-assets/snake-assets/` (`fruits.png` y `sprites.js`). Las reglas, la velocidad y el aspecto de la serpiente los define esta spec, y por eso hay más decisiones de diseño que en las specs 14 y 15. Además, Snake no tiene vidas ni niveles propios, así que el HUD de la plataforma se adapta como se indica en el modelo de datos.

## Scope

**In:**

- Migración nueva que inserta la fila `snake` en `public.games`:
  - `id = 'snake'`, `title = 'SNAKE'`, `category = 'ARCADE'`, `cover = 'cover-snake'`, `color = 'green'`.
  - `short_description` y `long_description` en español, redactadas al implementar.
  - Sin columna `score_table` (ya no existe desde SPEC 13).
  - La fila debe existir antes de guardar cualquier puntuación, porque `scores.game_id` es una FK a `games.id`.
- Miniatura: se reutiliza la clase `.cover-snake` que ya existe en `app/globals.css` (heredada de la plantilla). No se redibuja.
- Clase `.snake-canvas` añadida a la regla compartida `.crt-screen .asteroids-canvas, .crt-screen .tetris-canvas, ...` de `app/globals.css`.
- Asset propio en `public/snake/fruits.png`, copiado de `references/source-assets/snake-assets/fruits.png`.
- Atlas de sprites `app/juego/snake/sprites.ts`: port tipado de `references/source-assets/snake-assets/sprites.js`, con las 22 frutas y la ruta del PNG cambiada a `/snake/fruits.png`.
- Motor `app/juego/snake/engine.ts`: TypeScript estricto, encapsulado en la factory `createSnakeGame(canvas, callbacks)`.
- Reproductor `app/juego/snake/snake-player.tsx` (client component) y página `app/juego/snake/jugar/page.tsx`, con el mismo patrón que Arkanoid, Tetris y Asteroides.
- Un único canvas con resolución interna 800×600 (4:3), escalado por CSS dentro de `.crt-screen`.
- Reglas del juego:
  - Tablero de 20×15 celdas de 40 px.
  - La serpiente empieza con 3 segmentos, en el centro del tablero, mirando a la derecha y quieta.
  - La serpiente se mueve una celda por paso, sin giro de 180° sobre sí misma.
  - Una fruta aparece en una celda libre elegida al azar, con un sprite aleatorio de las 22 frutas.
  - Comer una fruta suma 10 puntos, hace crecer la serpiente un segmento y hace aparecer otra fruta.
  - El nivel sube cada 5 frutas (`nivel = floor(frutas / 5) + 1`), sin tope, y cada subida acelera la serpiente.
  - 1 vida: chocar con una pared o con el propio cuerpo termina la partida.
  - Si la serpiente ocupa las 300 celdas no queda sitio para la fruta y la partida termina.
- Controles: flechas o `W` / `A` / `S` / `D`. La serpiente arranca al primer movimiento válido. La pausa solo se activa con el botón PAUSA del HUD.
- Aspecto: cuerpo verde neón de celdas redondeadas, cabeza con ojos orientados según la dirección y frutas dibujadas con el atlas de sprites. Si el PNG no carga, la fruta se dibuja como un círculo de color.
- HUD de la plataforma: Jugador (`INVITADO`), Puntuación, Vidas y Nivel. Vidas muestra un `♥` mientras la partida está en curso y `—` al terminar.
- Botones del HUD: PAUSA / REANUDAR, FIN y SALIR.
- Fin de partida con `GameOverModal` y guardado con `saveScore({ gameId, name, score, level })`.
- Limpieza al desmontar: cancelar `requestAnimationFrame` y quitar los listeners de teclado.

**Out of scope (para specs futuras):**

- Sonido de cualquier tipo (ni archivos ni WebAudio).
- Obstáculos, frutas especiales o bonus, y cualquier otra variante de reglas.
- Paredes que se atraviesan y modo de 3 vidas.
- Tope de niveles o de velocidad distinto del definido aquí.
- Sprites propios de cabeza, cuerpo o cola (solo existen sprites de frutas).
- Soporte táctil o móvil, y control por ratón.
- Mostrar un mensaje distinto cuando se llena el tablero.
- Ranking local en `localStorage`.
- Cambios en el esquema de `scores`, en `lib/scores/index.ts` y en los reproductores de Asteroides, Tetris y Arkanoid.
- Redibujar la miniatura `.cover-snake`.
- Cualquier modificación de las specs anteriores.

## Data model

Esta spec no introduce tablas ni columnas nuevas. Reutiliza `games` (SPEC 09 y 12) y `scores` (SPEC 13), y solo añade una fila de datos:

```sql
insert into public.games (id, title, short_description, long_description, category, cover, color)
values ('snake', 'SNAKE', '...', '...', 'ARCADE', 'cover-snake', 'green');
```

Contrato del motor hacia la plataforma, con la misma forma que el de Asteroides, Tetris y Arkanoid:

```ts
// app/juego/snake/engine.ts
export type SnakeStatus = "playing" | "paused" | "gameover";

export interface SnakeStats {
  score: number;
  lives: number; // 1 en curso, 0 en game over
  level: number; // >= 1, sube cada 5 frutas, sin tope
}

export interface SnakeCallbacks {
  onStats: (stats: SnakeStats) => void;
  onStatus: (status: SnakeStatus) => void;
  onGameOver: (finalStats: SnakeStats) => void;
}

export interface SnakeGame {
  start(): void;
  pause(): void;
  resume(): void;
  end(): void;
  restart(): void;
  destroy(): void;
}

export function createSnakeGame(
  canvas: HTMLCanvasElement,
  callbacks: SnakeCallbacks,
): SnakeGame;
```

Estado interno y atlas:

```ts
type Cell = { x: number; y: number }; // 0..19, 0..14
type Direction = "up" | "down" | "left" | "right";

// app/juego/snake/sprites.ts
export interface Sprite { x: number; y: number; w: number; h: number }
export const FRUITS: Record<string, Sprite>; // 22 frutas, hoja de 3790x442 px
```

Convenciones:

- El motor no importa Supabase ni `lib/data.ts`, y no usa variables globales de módulo.
- Resolución interna fija 800×600. Celdas de 40 px, origen arriba a la izquierda.
- Paso del juego: la serpiente avanza una celda cada `max(60, 150 - (nivel - 1) * 10)` ms, de modo que el nivel 10 alcanza el mínimo de 60 ms.
- El bucle usa un acumulador de tiempo de juego, así que la velocidad es la misma a 60 Hz y a 144 Hz, y no avanza en pausa.
- Las frutas se dibujan dentro de la celda conservando la proporción del sprite, porque sus tamaños varían (de 110×160 a 170×160).
- Ruta del asset servida desde `public/`: `/snake/fruits.png`.

## Implementation plan

1. Crear la migración `supabase/migrations/<timestamp>_add_game_snake.sql` con el `insert` en `games`, y añadir `.snake-canvas` a la regla compartida de `app/globals.css`. Aplicar la migración al proyecto remoto solo con confirmación explícita del usuario. Comprobación manual: la tarjeta con `.cover-snake` aparece en `/juego` y `/juego/snake` muestra la ficha.
2. Copiar `fruits.png` a `public/snake/` y crear `app/juego/snake/sprites.ts` con las 22 frutas. Comprobación manual: el PNG se sirve en `/snake/fruits.png`.
3. Crear `app/juego/snake/engine.ts` con el esqueleto del juego: factory, bucle con acumulador de tiempo de juego y `dt` limitado, serpiente, controles de teclado, movimiento sin giro de 180°, choque con pared y con el cuerpo, fin de partida y `start`/`pause`/`resume`/`end`/`restart`/`destroy`. Crear también `app/juego/snake/snake-player.tsx` y `app/juego/snake/jugar/page.tsx` (`getGame("snake")`, `notFound()` si es `null`). Comprobación manual: se mueve la serpiente, se choca y aparece el `GameOverModal`.
4. Añadir la fruta al motor: aparición en celda libre, crecimiento, 10 puntos por fruta, nivel cada 5 frutas con aceleración y fin de partida con el tablero lleno. Comprobación manual: `onStats` refleja puntuación y nivel, y la serpiente acelera al subir de nivel.
5. Añadir el dibujo: serpiente de celdas redondeadas con ojos, frutas con el atlas de sprites y círculo de color si el PNG no carga. Comprobación manual: aspecto correcto y la fruta no se deforma.

## Acceptance criteria

- [ ] Existe una fila `id = 'snake'` en `public.games` con `category = 'ARCADE'` y `color = 'green'`.
- [ ] `/juego` muestra la tarjeta SNAKE con la miniatura `.cover-snake`, distinta de las de ASTEROIDES, TETRIS y ARKANOID.
- [ ] `/juego/snake` muestra la ficha con título y descripción, y su botón JUGAR lleva a `/juego/snake/jugar`.
- [ ] `/juego/snake/jugar` muestra el juego dentro del CRT sin deformarse, con tablero, serpiente de 3 segmentos y una fruta visibles.
- [ ] El HUD empieza con Puntuación 0, Nivel 01 y un `♥` en Vidas.
- [ ] La serpiente está quieta hasta pulsar una dirección válida y entonces empieza a moverse.
- [ ] Las flechas y `W` / `A` / `S` / `D` giran la serpiente, y ni las flechas ni `Espacio` hacen scroll en la página.
- [ ] Pulsar la dirección contraria a la actual no hace girar la serpiente ni termina la partida.
- [ ] Pulsar dos direcciones válidas dentro del mismo paso no permite un giro de 180° sobre sí misma.
- [ ] `P`, `Espacio` y `Enter` no pausan ni reanudan el juego.
- [ ] Comer una fruta suma exactamente 10 puntos y alarga la serpiente un segmento.
- [ ] La fruta nunca aparece sobre una celda ocupada por la serpiente.
- [ ] Cada fruta nueva usa un sprite de `fruits.png`, sin deformarse en su celda.
- [ ] Tras comer 5 frutas el HUD muestra Nivel 02 y la serpiente va más rápida; tras 10 frutas, Nivel 03.
- [ ] Chocar con cualquier pared termina la partida y muestra el `GameOverModal` con la puntuación final.
- [ ] Chocar con el propio cuerpo termina la partida y muestra el `GameOverModal`.
- [ ] Al terminar la partida Vidas muestra `—`.
- [ ] Si la serpiente ocupa las 300 celdas aparece el `GameOverModal`.
- [ ] PAUSA congela el juego, el botón pasa a REANUDAR y, al reanudar, la serpiente no avanza varias celdas de golpe.
- [ ] FIN termina la partida y muestra el `GameOverModal`.
- [ ] SALIR navega a `/juego/snake` y, tras salir, no quedan loops ni listeners de teclado activos (`Espacio` vuelve a hacer scroll y no hay errores en consola).
- [ ] La velocidad del juego es la misma en un monitor de 60 Hz y en uno de 144 Hz.
- [ ] Si `fruits.png` no carga, el juego sigue jugable y la fruta se ve como un círculo de color.
- [ ] Guardar la puntuación crea una fila en `scores` con `game_id = 'snake'` y `level >= 1`.
- [ ] El nuevo registro aparece en el leaderboard del juego, en el Salón de la Fama y en la actividad de la home.
- [ ] Reiniciar desde el `GameOverModal` deja Puntuación en 0, Nivel en 1, Vidas en 1 y la serpiente quieta de nuevo.
- [ ] El juego no escribe en `localStorage` y no reproduce ningún sonido.
- [ ] Asteroides, Tetris y Arkanoid se siguen jugando y guardando puntuaciones igual que antes.
- [ ] `get_advisors` de Supabase no muestra avisos de seguridad nuevos.
- [ ] `npm run lint`, `npx tsc --noEmit` y `npm run build` pasan sin errores.

## Decisions

- **Sí (decisión del usuario):** tratar Snake como juego desde cero; no hay carpeta de partida. **No:** inventar un `references/started-games/05-snake/` solo para portarlo.
- **Sí (decisión del usuario):** 1 vida con muerte clásica (pared o cuerpo). El HUD muestra un `♥` y `—` al morir. **No:** 3 vidas, que añade reaparición y estado extra; **No:** paredes atravesables.
- **Sí (decisión del usuario):** 10 puntos por fruta y nivel cada 5 frutas con aceleración, sin tope. **No:** nivel fijo en 1; **No:** tope de niveles.
- **Sí (decisión del usuario):** tablero de 20×15 celdas de 40 px. **No:** 32×24 celdas de 25 px, que deja las frutas demasiado pequeñas.
- **Sí (decisión del usuario):** sprite de fruta aleatorio entre los 22 en cada aparición. **No:** una fruta por nivel, ni solo manzana.
- **Sí (decisión del usuario):** controles con flechas y `W` / `A` / `S` / `D`, arrancando al primer movimiento. **No:** arrancar con `Espacio`, ni solo flechas.
- **Sí (decisión del usuario):** la pausa es solo el botón PAUSA, como en Asteroides, Tetris y Arkanoid.
- **Sí (decisión del usuario):** id `snake`, categoría `ARCADE`, color `green`, rutas `/juego/snake` y `/juego/snake/jugar`, y reutilizar `.cover-snake` tal como está. **No:** redibujar la miniatura.
- **Sí (decisión del usuario):** serpiente dibujada por código con celdas redondeadas y ojos orientados. **No:** bloques planos ni degradado por segmento.
- **Sí (decisión del usuario):** sin sonido ni extras. El sonido y las variantes de reglas van en otras specs.
- **Sí (asumido):** velocidad inicial de 150 ms por celda, 10 ms menos por nivel y mínimo de 60 ms. Son valores de partida que se ajustan al probar; el usuario no los fijó.
- **Sí (asumido):** la serpiente empieza con 3 segmentos, en el centro, mirando a la derecha, y la primera tecla `←` se ignora por ser un giro de 180°.
- **Sí (asumido):** se encola como máximo una dirección por paso, para que dos pulsaciones rápidas no provoquen un giro de 180° dentro del mismo paso.
- **Sí (asumido):** llenar el tablero termina la partida con `onGameOver` y el mismo `GameOverModal`, sin mensaje de victoria.
- **Sí (asumido):** `Espacio` y las flechas hacen `preventDefault` mientras el juego está montado, para evitar el scroll de la página. `Enter` recupera su comportamiento normal.
- **Sí (asumido):** `scores.level` guarda el nivel alcanzado, que siempre es >= 1.
- **Sí (asumido):** el motor usa un acumulador a tiempo de juego, que no avanza en pausa, en lugar de `setInterval` o de un paso por fotograma, para que la velocidad no dependa del monitor.
- **Sí (asumido):** el motor vive en `app/juego/snake/engine.ts`, el atlas en `sprites.ts` y el asset en `public/snake/`. Son nombres elegidos por esta spec, no confirmados por el usuario.
- **Sí (asumido):** un reproductor propio por juego, siguiendo el patrón de los otros tres. **No:** un reproductor genérico, que sería una refactorización fuera de esta spec.
- **Nota:** `references/integration-blueprint.md`, que cita la skill `add-game`, no existe en el repositorio. Esta spec se basa en la SPEC 15 y en el código actual de `app/juego/`.

## Identified risks

| Riesgo | Mitigación |
| ------ | ---------- |
| La migración inserta datos en una base compartida. | Es un `insert` aditivo; aplicarlo al proyecto remoto exige confirmación explícita del usuario. |
| Doble loop en desarrollo por React Strict Mode. | `destroy()` cancela `requestAnimationFrame` y quita los listeners; un criterio de aceptación comprueba la limpieza al salir. |
| Captura global del teclado. | Los listeners y el `preventDefault` en `Espacio` y flechas se quitan al desmontar. |
| `dt` enorme al reanudar o al volver a la pestaña. | Limitar `dt` y reiniciar `lastTime` al reanudar. |
| Re-renders del HUD en cada frame. | Emitir `onStats` solo cuando cambian `score`, `lives` o `level`. |
| `Espacio` o `Enter` activan el botón enfocado del HUD. | `blur` tras el clic en PAUSA y FIN, como en los otros juegos. |
| Dos pulsaciones rápidas dentro de un mismo paso provocan un giro de 180° y una muerte injusta. | Validar cada dirección contra la última dirección movida, y encolar como máximo una por paso. |
| La velocidad inicial o la aceleración resultan injugables. | Los valores son asumidos y están en una sola constante del motor; se ajustan en la verificación manual. |
| Elegir una celda libre en un tablero casi lleno se vuelve lento o entra en bucle. | Elegir al azar entre la lista de celdas libres, no reintentar posiciones al azar. |
| `fruits.png` (3790×442 px) pesa más de lo necesario para 22 sprites de 40 px. | Aceptado en esta spec; optimizar el PNG va en otra spec si el tiempo de carga molesta. |
| El PNG tarda en cargar o falla. | Arrancar el bucle sin esperar; si falla, dibujar un círculo de color y seguir jugando. |
| El motor termina de cargar el PNG después de `destroy()`. | Ignorar la carga y no tocar el canvas si el motor ya fue destruido. |
| Las recortes del atlas (`sprites.js`) vienen de un análisis de píxeles y pueden cortar mal alguna fruta. | Revisar las 22 frutas a ojo en la verificación manual y corregir las coordenadas del atlas si alguna se corta. |

## What is **not** in this spec

Sonido, obstáculos, frutas especiales, paredes atravesables, modo de 3 vidas, tope de niveles, sprites propios de cuerpo y cabeza, soporte táctil o control por ratón, mensaje de victoria al llenar el tablero, ranking local, miniatura nueva, cambios en `scores` y un reproductor genérico. Cada uno, si llega, va en su propia spec.
