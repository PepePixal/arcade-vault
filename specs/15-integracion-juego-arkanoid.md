# SPEC 15 — Integración del juego Arkanoid

> **Status:** Aprobado
> **Depends on:** SPEC 05, SPEC 06, SPEC 07, SPEC 09, SPEC 12, SPEC 13, SPEC 14
> **Date:** 2026-11-20
> **Objective:** Integrar el juego Arkanoid de `references/started-games/04-arkanoid/` como el juego jugable "ARKANOID" de Arcade Vault, con tarjeta en `/juego`, detalle en `/juego/arkanoid` y partida en `/juego/arkanoid/jugar` dentro del CRT de la plataforma, enviando puntuación, vidas y nivel al HUD y guardando la puntuación en `scores`.

## Why this spec exists

El `README.md` de la carpeta de partida dice "Esto todavía no está implementado", pero la carpeta contiene un juego completo (`game.js`, `levels.js`, `assets/spritesheet.js`, spritesheet PNG y 2 sonidos). El código manda sobre el README: esta spec porta ese código. Es el primer juego de la plataforma con sonido y con imágenes propias, y el primero controlado con el ratón, por lo que añade riesgos que Asteroides y Tetris no tenían.

## Scope

**In:**

- Migración nueva que inserta la fila `arkanoid` en `public.games`:
  - `id = 'arkanoid'`, `title = 'ARKANOID'`, `category = 'ARCADE'`, `cover = 'cover-arkanoid'`, `color = 'yellow'`.
  - `short_description` y `long_description` en español, redactadas al implementar.
  - Sin columna `score_table` (ya no existe desde SPEC 13).
  - La fila debe existir antes de guardar cualquier puntuación, porque `scores.game_id` es una FK a `games.id`.
- Clase `.cover-arkanoid` en `app/globals.css`, para la tarjeta y la ficha.
- Clase `.arkanoid-canvas` añadida a la regla compartida `.crt-screen .asteroids-canvas, .crt-screen .tetris-canvas` de `app/globals.css`.
- Assets propios en `public/arkanoid/`:
  - `spritesheet-breakout.png`.
  - `sounds/ball-bounce.mp3` y `sounds/break-sound.mp3`.
- Datos de niveles en `app/juego/arkanoid/levels.ts`: los 5 niveles de `levels.js` (velocidad de la bola, ancho de la paleta y patrón de ladrillos).
- Motor `app/juego/arkanoid/engine.ts`: port a TypeScript estricto de `references/started-games/04-arkanoid/game.js`, encapsulado en la factory `createArkanoidGame(canvas, callbacks)`.
- Reproductor `app/juego/arkanoid/arkanoid-player.tsx` (client component) y página `app/juego/arkanoid/jugar/page.tsx`, con el mismo patrón que Tetris y Asteroides.
- Un único canvas con resolución interna 800×600 (4:3), escalado por CSS dentro de `.crt-screen`.
- Mecánicas del juego de partida que se portan tal cual:
  - 5 niveles con los patrones, velocidades de bola y anchos de paleta de `levels.js`.
  - Cada ladrillo roto suma 10 puntos y lanza una animación de explosión de 150 ms.
  - 3 vidas por nivel: las vidas se reinician a 3 al empezar cada nivel.
  - Rebote de la bola en la paleta según el punto de impacto, en paredes, techo y ladrillos.
  - Perder la bola resta una vida y recoloca bola y paleta; con 0 vidas termina la partida.
  - Al limpiar un nivel aparece "Nivel N completado" y 1500 ms después empieza el siguiente.
  - En el nivel 5 los ladrillos bajan una fila cada 5000 ms; si uno alcanza la paleta, termina la partida.
  - Limpiar el nivel 5 termina la partida como victoria.
  - Sonidos de rebote y de ruptura de ladrillo.
- Controles: ratón sobre el canvas o `A` / `D` / `←` / `→` para mover la paleta; clic en el canvas, `Espacio` o `Enter` para lanzar la bola. La pausa solo se activa con el botón PAUSA del HUD.
- HUD de la plataforma: Jugador (`INVITADO`), Puntuación, Vidas y Nivel. Vidas muestra un `♥` por vida restante y `—` con 0.
- Botones del HUD: PAUSA / REANUDAR, FIN y SALIR.
- Fin de partida (derrota o victoria) con `GameOverModal` y guardado con `saveScore({ gameId, name, score, level })`.
- Limpieza al desmontar: cancelar `requestAnimationFrame` y quitar los listeners de teclado y de ratón.

**Out of scope (para specs futuras):**

- Selector de nivel (`levelSelect`): era una ayuda de desarrollo del juego de partida.
- Teclas `P`, `Espacio` y `Enter` para pausar o reanudar, y reanudar con clic en el canvas.
- Dibujar en el canvas el texto "Nivel / Score", las bolitas de vidas, los overlays "Fin del juego", "¡Ganaste!" y "Pausado" y el botón "Reiniciar": los sustituyen el HUD y el `GameOverModal` de la plataforma.
- Vidas acumuladas para toda la partida (se conserva el reinicio a 3 por nivel).
- Corregir que, tras perder una vida, la bola vuelve a velocidad 4 sin respetar la `ballSpeed` del nivel (se conserva el comportamiento del juego de partida).
- Mostrar un mensaje distinto para victoria y derrota en el `GameOverModal`.
- Control de volumen o silencio, soporte táctil o móvil, power-ups y ranking local en `localStorage`.
- Cambios en el esquema de `scores`, en `lib/scores/index.ts` y en los reproductores de Asteroides y Tetris.
- Cualquier modificación de las specs anteriores.

## Data model

Esta spec no introduce tablas ni columnas nuevas. Reutiliza `games` (SPEC 09 y 12) y `scores` (SPEC 13), y solo añade una fila de datos:

```sql
insert into public.games (id, title, short_description, long_description, category, cover, color)
values ('arkanoid', 'ARKANOID', '...', '...', 'ARCADE', 'cover-arkanoid', 'yellow');
```

Contrato del motor hacia la plataforma, con la misma forma que el de Asteroides y Tetris:

```ts
// app/juego/arkanoid/engine.ts
export type ArkanoidStatus = "playing" | "paused" | "gameover";

export interface ArkanoidStats {
  score: number;
  lives: number; // 3 al empezar cada nivel, 0 en game over por vidas
  level: number; // 1..5, siempre >= 1
}

export interface ArkanoidCallbacks {
  onStats: (stats: ArkanoidStats) => void;
  onStatus: (status: ArkanoidStatus) => void;
  onGameOver: (finalStats: ArkanoidStats) => void;
}

export interface ArkanoidGame {
  start(): void;
  pause(): void;
  resume(): void;
  end(): void;
  restart(): void;
  destroy(): void;
}

export function createArkanoidGame(
  canvas: HTMLCanvasElement,
  callbacks: ArkanoidCallbacks,
): ArkanoidGame;
```

Datos de niveles, con la forma de `levels.js`:

```ts
// app/juego/arkanoid/levels.ts
export interface LevelConfig {
  ballSpeed: number; // px/paso
  paddleWidth: number; // px
  pattern: string[]; // '1' = ladrillo, '0' = hueco; 10 columnas
}

export const LEVELS: LevelConfig[]; // 5 niveles
```

Convenciones:

- El motor no importa Supabase ni `lib/data.ts`, y no usa variables globales de módulo (el juego de partida usa `let state` y funciones globales; el port las encapsula en la factory).
- Resolución interna fija 800×600. Ladrillos de 74×28 px con hueco de 4 px, desplazados 60 px desde arriba; paleta de 14 px de alto y bola de radio 8.
- Ladrillos: colores `red`, `yellow`, `cyan`, `magenta`, `hotpink`, `green`, asignados por fila (`fila % 6`). El color `gray` del spritesheet no se usa.
- Las velocidades del juego de partida están en píxeles por paso a 60 pasos por segundo.
- Rutas de assets servidas desde `public/`: `/arkanoid/spritesheet-breakout.png`, `/arkanoid/sounds/ball-bounce.mp3`, `/arkanoid/sounds/break-sound.mp3`.

## Implementation plan

1. Crear la migración `supabase/migrations/<timestamp>_add_game_arkanoid.sql` con el `insert` en `games`, y añadir `.cover-arkanoid` y `.arkanoid-canvas` a `app/globals.css`. Aplicar la migración al proyecto remoto solo con confirmación explícita del usuario. Comprobación manual: la tarjeta aparece en `/juego` y `/juego/arkanoid` muestra la ficha.
2. Copiar a `public/arkanoid/` el spritesheet y los 2 sonidos, y crear `app/juego/arkanoid/levels.ts` con los 5 niveles. Comprobación manual: el PNG y los mp3 se sirven en las URLs de `public/`.
3. Crear `app/juego/arkanoid/engine.ts` con el esqueleto del juego: factory, bucle con paso fijo a 60 Hz y `dt` limitado, paleta (ratón y teclado), bola, lanzamiento, rebote en paredes y paleta, vidas, fin de partida y `start`/`pause`/`resume`/`end`/`restart`/`destroy`. Crear también `app/juego/arkanoid/arkanoid-player.tsx` y `app/juego/arkanoid/jugar/page.tsx` (`getGame("arkanoid")`, `notFound()` si es `null`). Comprobación manual: se puede jugar con paleta y bola, perder las 3 vidas y ver el `GameOverModal`.
4. Añadir ladrillos al motor: creación desde el patrón del nivel, colisión, 10 puntos por ladrillo, paso entre niveles con "Nivel N completado", reinicio de vidas por nivel y victoria al limpiar el nivel 5. Comprobación manual: se pasa del nivel 1 al 2 y `onStats` refleja nivel y puntuación.
5. Añadir el dibujo con el spritesheet (paleta, bola, ladrillos y explosiones) y los 2 sonidos. Si el PNG no carga, dibujar rectángulos y círculos de color y seguir jugando. Comprobación manual: aspecto igual al juego de partida y sonido al rebotar y romper.
6. Añadir el descenso de ladrillos del nivel 5, que se congela con la pausa. Comprobación manual: en el nivel 5 los ladrillos bajan cada 5 s y, si tocan la paleta, termina la partida.
7. Verificación: recorrido manual completo, `npm run lint`, `npx tsc --noEmit`, `npm run build` y `get_advisors` de Supabase.

## Acceptance criteria

- [ ] Existe una fila `id = 'arkanoid'` en `public.games` con `category = 'ARCADE'` y `color = 'yellow'`.
- [ ] `/juego` muestra la tarjeta ARKANOID con miniatura propia, distinta de las de ASTEROIDES y TETRIS.
- [ ] `/juego/arkanoid` muestra la ficha con título y descripción, y su botón JUGAR lleva a `/juego/arkanoid/jugar`.
- [ ] `/juego/arkanoid/jugar` muestra el juego dentro del CRT sin deformarse, con paleta, bola y ladrillos visibles.
- [ ] El HUD empieza con Puntuación 0, Nivel 01 y tres `♥` en Vidas.
- [ ] Antes de lanzar, la bola se mueve pegada a la paleta; el clic en el canvas, `Espacio` y `Enter` la lanzan.
- [ ] Mover el ratón sobre el canvas centra la paleta bajo el puntero, también con el canvas escalado por CSS.
- [ ] `A` / `←` y `D` / `→` mueven la paleta, y ni `Espacio`, ni las flechas hacen scroll en la página.
- [ ] `P`, `Espacio` y `Enter` no pausan ni reanudan el juego.
- [ ] Romper un ladrillo suma exactamente 10 puntos y reproduce el sonido de ruptura y la explosión.
- [ ] La bola reproduce el sonido de rebote al chocar con paredes, techo y paleta.
- [ ] Perder la bola resta un `♥` del HUD y recoloca bola y paleta sin lanzarla.
- [ ] Con 0 vidas aparece el `GameOverModal` con la puntuación final y Vidas muestra `—`.
- [ ] Al limpiar todos los ladrillos del nivel 1 aparece "Nivel 1 completado" y 1,5 s después empieza el nivel 2 con tres vidas y la paleta más estrecha.
- [ ] Los 5 niveles usan los patrones de `levels.js`.
- [ ] En el nivel 5 los ladrillos bajan una fila cada 5 s y, si alcanzan la paleta, aparece el `GameOverModal`.
- [ ] Limpiar el nivel 5 muestra el `GameOverModal` con la puntuación final y nivel 5.
- [ ] PAUSA congela el juego, el botón pasa a REANUDAR y, al reanudar, la bola no salta ni los ladrillos del nivel 5 bajan de golpe.
- [ ] FIN termina la partida y muestra el `GameOverModal`.
- [ ] SALIR navega a `/juego/arkanoid` y, tras salir, no quedan loops ni listeners de teclado o ratón activos (`Espacio` vuelve a hacer scroll y no hay errores en consola).
- [ ] La velocidad del juego es la misma en un monitor de 60 Hz y en uno de 144 Hz.
- [ ] Guardar la puntuación crea una fila en `scores` con `game_id = 'arkanoid'` y `level >= 1`.
- [ ] El nuevo registro aparece en el leaderboard del juego, en el Salón de la Fama y en la actividad de la home.
- [ ] Reiniciar desde el `GameOverModal` deja Puntuación en 0, Nivel en 1 y Vidas en 3.
- [ ] El juego no escribe en `localStorage`.
- [ ] Asteroides y Tetris se siguen jugando y guardando puntuaciones igual que antes.
- [ ] `get_advisors` de Supabase no muestra avisos de seguridad nuevos.
- [ ] `npm run lint`, `npx tsc --noEmit` y `npm run build` pasan sin errores.

## Decisions

- **Sí (decisión del usuario):** id `arkanoid`, categoría `ARCADE`, color `yellow`, rutas `/juego/arkanoid` y `/juego/arkanoid/jugar`, y clase `.cover-arkanoid`. **No:** `PUZZLE` ni `green`; `yellow` contrasta con `cyan` (Asteroides) y `magenta` (Tetris).
- **Sí (decisión del usuario):** portar las vidas tal cual, 3 por nivel con reinicio al empezar cada nivel. **No:** vidas acumuladas para toda la partida, porque cambia las reglas del juego de partida.
- **Sí (decisión del usuario):** copiar el spritesheet y los 2 sonidos a `public/` y portar dibujo y sonido. **No:** formas de canvas sin assets, que pierden el aspecto original, ni quitar el sonido.
- **Sí (decisión del usuario):** controles con ratón y teclado (`A` / `D` / flechas), lanzamiento con clic, `Espacio` o `Enter`. **No:** la tecla `P`, el selector de nivel ni el control solo por teclado.
- **Sí (decisión del usuario):** la pausa es solo el botón PAUSA, como en Asteroides y Tetris.
- **Sí (asumido):** limpiar el nivel 5 termina la partida con `onGameOver` y el mismo `GameOverModal`, que solo recibe la puntuación. Un mensaje de victoria distinto va en otra spec.
- **Sí (asumido):** `scores.level` guarda el nivel alcanzado (1 a 5), también en la victoria.
- **Sí (asumido):** se conserva el comportamiento del juego de partida en la velocidad de la bola tras perder una vida (vuelve a 4), aunque el nivel pida más. Corregirlo va en otra spec.
- **Sí (asumido):** el texto "Nivel N completado" se sigue dibujando en el canvas, porque la plataforma no tiene un aviso equivalente. El resto de textos del canvas los sustituye el HUD y el `GameOverModal`.
- **Sí (asumido):** el motor usa un paso fijo a 60 Hz con acumulador. El juego de partida avanza un paso por fotograma y en un monitor de 144 Hz iría 2,4 veces más rápido. **No:** reescribir las velocidades en píxeles por segundo, que cambiaría los valores de `levels.js`.
- **Sí (asumido):** los temporizadores del nivel (transición, descenso del nivel 5 y explosiones) cuentan tiempo de juego y no `performance.now()` directo, para que la pausa los congele. El juego de partida no los congelaba porque su pausa era distinta.
- **Sí (asumido):** `Enter` y `Espacio` solo hacen `preventDefault` mientras la bola no está lanzada. Una vez lanzada, `Enter` recupera su comportamiento normal.
- **Sí (asumido):** el motor vive en `app/juego/arkanoid/engine.ts`, los niveles en `levels.ts` y los assets en `public/arkanoid/`. Son nombres elegidos por esta spec, no confirmados por el usuario.
- **Sí (asumido):** un reproductor propio por juego, siguiendo el patrón de Asteroides y Tetris. **No:** un reproductor genérico, que sería una refactorización fuera de esta spec.
- **No:** `README.md` de `04-arkanoid` como fuente de verdad. Dice "no implementado", pero el código sí lo está.

## Identified risks

| Riesgo | Mitigación |
| ------ | ---------- |
| La migración inserta datos en una base compartida. | Es un `insert` aditivo; aplicarlo al proyecto remoto exige confirmación explícita del usuario. |
| Doble loop en desarrollo por React Strict Mode. | `destroy()` cancela `requestAnimationFrame` y quita los listeners; un criterio de aceptación comprueba la limpieza al salir. |
| Captura global del teclado. | Los listeners y el `preventDefault` en `Espacio`, `Enter` y flechas se quitan al desmontar. |
| `dt` enorme al reanudar. | Limitar `dt` y reiniciar `lastTime` al reanudar. |
| Re-renders del HUD en cada frame. | Emitir `onStats` solo cuando cambian `score`, `lives` o `level`. |
| `Espacio` o `Enter` activan el botón enfocado del HUD. | `blur` tras el clic en PAUSA y FIN, como en Asteroides y Tetris. |
| El ratón se lee con `clientX - rect.left`, sin escala, y el canvas se escala por CSS dentro del CRT, así que la paleta no seguiría al puntero. | Convertir con `canvas.width / rect.width`; un criterio de aceptación lo comprueba con el canvas escalado. |
| El ratón queda escuchado tras salir del juego. | Quitar el listener de `mousemove` y de `click` del canvas en `destroy()`. |
| El juego de partida avanza por fotograma y va más rápido en monitores de más de 60 Hz. | Bucle de paso fijo a 60 Hz con acumulador y `dt` limitado. |
| El juego de partida usa `performance.now()` para transición, descenso y explosiones, y la pausa no los congela. | Medir esos temporizadores con tiempo de juego acumulado, que no avanza en pausa. |
| El audio puede rechazarse por la política de autoplay del navegador. | Reproducir solo tras un gesto del usuario y capturar la promesa rechazada de `play()` sin romper el bucle. |
| Un `new Audio(...)` por evento acumula objetos. | Reutilizar un pequeño conjunto de instancias por sonido o liberar las usadas. |
| El spritesheet tarda en cargar o falla. | Arrancar el bucle al cargar; si falla, dibujar rectángulos y círculos de color y seguir jugando. |
| El motor termina de cargar el PNG después de `destroy()`. | Ignorar la carga y no tocar el canvas si el motor ya fue destruido. |
| Se pierden aristas de colisión: la bola puede atravesar un ladrillo a la velocidad del nivel 5. | Portar la detección de círculo contra rectángulo del juego de partida y comprobar el nivel 5 en la verificación manual. |
| La victoria llama a `onGameOver` y se confunde con una derrota. | Documentado como decisión asumida; el `GameOverModal` solo muestra la puntuación. |

## What is **not** in this spec

Selector de nivel, tecla `P` y pausa por teclado o clic, textos y botón "Reiniciar" dibujados en el canvas, vidas acumuladas, corrección de la velocidad de la bola tras perder una vida, mensaje de victoria distinto, control de volumen, soporte táctil o móvil, power-ups, ranking local, cambios en `scores` y un reproductor genérico. Cada uno, si llega, va en su propia spec.
