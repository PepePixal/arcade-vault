# GAME JAM — Travesía · Variante A: Ruta de reparto

> **Status:** Borrador
> **Depends on:** SPEC 06, SPEC 07, SPEC 09, SPEC 12, SPEC 13, SPEC 15, SPEC 16
> **Date:** 2026-11-23
> **Objective:** Crear desde cero el juego original "TRAVESÍA" en su variante de saltos por rejilla e integrarlo en Arcade Vault, con tarjeta en `/juego`, detalle en `/juego/travesia` y partida en `/juego/travesia/jugar` dentro del CRT de la plataforma, enviando puntuación, vidas y nivel al HUD y guardando la puntuación en `scores`.

## Why this spec exists

El tema de la game jam es "cruza la carretera y el río sin convertirte en papilla": el género clásico *cross-the-road*, en el que un personaje atraviesa carriles de tráfico y después un río saltando sobre plataformas móviles. Esta spec **no** recrea ningún juego comercial del género: el nombre, el personaje, el escenario, el arte y los niveles son propios.

**Idea base (común a las dos variantes):** Chispa, un pequeño robot mensajero de cartón y chapa, tiene que cruzar una avenida nocturna llena de tráfico y después un canal industrial para entregar paquetes al otro lado. Un vehículo lo deja hecho chatarra y el agua lo cortocircuita.

**Qué hace distinta a esta Variante A ("Ruta de reparto"):** es la lectura de rejilla y pantalla fija. Chispa avanza **una celda por pulsación**, la pantalla no se mueve y el objetivo es llenar los **5 muelles de entrega** del borde superior con un reloj por intento. Se juega como un puzle de *timing*: observar, esperar el hueco y saltar. La Variante B ("Ascenso sin fin") es lo opuesto: movimiento libre continuo, scroll vertical forzado e infinito, impulso con energía y combos; no hay muelles ni reloj.

No existe juego de partida en `references/started-games/` ni assets reutilizables en `references/source-assets/` (solo hay sprites de frutas de Snake), así que todo se dibuja por código, como la serpiente de la SPEC 16.

## Scope

**In:**

- Migración nueva que inserta la fila `travesia` en `public.games`:
  - `id = 'travesia'`, `title = 'TRAVESÍA'`, `category = 'ARCADE'`, `cover = 'cover-travesia'`, `color = 'magenta'`.
  - `short_description` y `long_description` en español, redactadas al implementar y coherentes con las reglas de esta variante.
  - La fila debe existir antes de guardar cualquier puntuación, porque `scores.game_id` es una FK a `games.id`.
- Miniatura nueva `.cover-travesia` en `app/globals.css`: franjas horizontales de asfalto con líneas discontinuas abajo, franjas de agua arriba y un punto magenta (Chispa) en el centro. **No** se reutiliza `.cover-rana` de la plantilla.
- Clase `.travesia-canvas` añadida a la regla compartida `.crt-screen .asteroids-canvas, .crt-screen .tetris-canvas, .crt-screen .arkanoid-canvas, .crt-screen .snake-canvas` de `app/globals.css`.
- Motor `app/juego/travesia/engine.ts`: TypeScript estricto, factory `createTravesiaGame(canvas, callbacks)`.
- Definición de niveles `app/juego/travesia/levels.ts` (mismo patrón que `app/juego/arkanoid/levels.ts`): carriles, sentido, velocidad base y patrón de objetos de cada fila.
- Reproductor `app/juego/travesia/travesia-player.tsx` (client component) y página `app/juego/travesia/jugar/page.tsx`, con el mismo patrón que `app/juego/snake/`.
- Un único canvas con resolución interna 800×600 (4:3), escalado por CSS dentro de `.crt-screen`.
- Tablero de pantalla fija: rejilla de 16 columnas × 12 filas de 50 px.
  - Fila 0: muro con **5 muelles de entrega** (columnas 1, 4, 7, 10 y 13, cada muelle de 2 celdas de ancho visual pero 1 celda de destino centrada).
  - Filas 1–4: **canal** con 4 carriles de agua. Plataformas: barcazas largas (3–4 celdas), palés flotantes (2 celdas) y boyas en grupos de 2–3 que, desde el nivel 3, se hunden de forma periódica (aviso con parpadeo de 0,6 s).
  - Fila 5: muelle intermedio seguro.
  - Filas 6–10: **avenida** con 5 carriles en sentidos alternos: patinetes (1 celda, rápidos), coches (1 celda), furgonetas (2 celdas) y camiones (3 celdas, lentos).
  - Fila 11: acera de salida. En su franja inferior se dibuja la barra del reloj.
- Reglas:
  - Chispa empieza en la fila 11, columna 7, mirando hacia arriba.
  - Cada pulsación mueve a Chispa exactamente **una celda** (arriba, abajo, izquierda, derecha). El salto dura 120 ms de animación; durante el salto se guarda como máximo una pulsación más, que se ejecuta al aterrizar. Mantener la tecla pulsada **no** repite el salto.
  - Chispa no puede salir del tablero por los lados ni por abajo (el movimiento se ignora).
  - Sobre el agua, Chispa viaja con la plataforma en la que está.
  - Pierde una vida si: le toca un vehículo; aterriza en agua sin plataforma; la plataforma lo saca por un borde lateral; está sobre una boya cuando se hunde; salta al muro entre muelles o a un muelle ya ocupado; o el reloj del intento llega a 0.
  - Reloj por intento: 30 s. Se reinicia al perder una vida y al entregar en un muelle.
  - Al entregar en un muelle libre, ese muelle queda ocupado por un paquete y Chispa vuelve a la acera de salida.
  - **Nivel completado** cuando los 5 muelles están ocupados: se vacían, sube el nivel y empieza el siguiente.
- Niveles:
  - Niveles 1–4 definidos a mano en `levels.ts` (patrones distintos de carriles y plataformas).
  - A partir del nivel 5 se repite el patrón del nivel 4 con la velocidad escalada.
  - Velocidad de todos los objetos: `base × min(2, 1 + 0,12 × (nivel − 1))`.
  - Desde el nivel 3, las boyas se hunden. Desde el nivel 4, en un muelle libre al azar aparece cada cierto tiempo una **chispa eléctrica** durante 4 s que hace perder una vida si Chispa entra en ese muelle.
- Puntuación:
  - +10 por cada fila nueva alcanzada en el intento actual (volver atrás y avanzar de nuevo no suma).
  - +50 por entregar en un muelle.
  - +10 por cada segundo entero que quede en el reloj al entregar.
  - +500 × nivel al completar los 5 muelles.
  - **Paquete exprés**: de vez en cuando aparece una caja dorada sobre una barcaza; si Chispa la recoge (pasa por su celda) y la entrega en un muelle, suma +200 extra. Si pierde la vida, la caja se pierde.
- Vidas: 3. Al perder la última, la partida termina.
- Controles: flechas o `W` / `A` / `S` / `D`. La partida arranca al primer movimiento. La pausa solo se activa con el botón PAUSA del HUD.
- Estilo visual: **pixel art plano de 8 bits** dibujado por código con `fillRect` sobre la rejilla (sin trazos con brillo): asfalto gris oscuro con líneas discontinuas amarillas, agua azul con ondas de 2 px animadas, vehículos como bloques de colores planos con faros, Chispa como un robot cuadrado de 40 px con antena y ojo magenta orientado según la dirección. Animaciones de muerte: "chatarra" (piezas que saltan) en carretera y "cortocircuito" (chispas azules) en el agua, de 0,8 s, antes de reaparecer.
- HUD de la plataforma: Jugador (`INVITADO`), Puntuación, Vidas (un `♥` por vida, `—` al terminar, como Arkanoid y Asteroides) y Nivel.
- Botones del HUD: PAUSA / REANUDAR, FIN y SALIR.
- Fin de partida con `GameOverModal` y guardado con `saveScore({ gameId, name, score, level })`.
- Limpieza al desmontar: cancelar `requestAnimationFrame` y quitar los listeners de teclado.

**Out of scope (para specs futuras):**

- Sonido de cualquier tipo.
- Scroll vertical, generación procedural de carriles, movimiento libre o impulso (es la Variante B).
- Vidas extra por puntuación.
- Sprites en PNG o cualquier asset en `public/travesia/` (todo se dibuja por código; si en el futuro se añade un asset, irá en esa carpeta).
- Soporte táctil o móvil y control por ratón.
- Ranking local en `localStorage`.
- Cambios en el esquema de `scores`, en `lib/scores/index.ts` y en los reproductores de los otros juegos.
- Un reproductor genérico compartido.
- Cualquier modificación de las specs anteriores.

## Data model

Esta spec no introduce tablas ni columnas nuevas. Reutiliza `games` (SPEC 09 y 12) y `scores` (SPEC 13), y solo añade una fila de datos:

```sql
insert into public.games (id, title, short_description, long_description, category, cover, color)
values ('travesia', 'TRAVESÍA', '...', '...', 'ARCADE', 'cover-travesia', 'magenta');
```

Contrato del motor hacia la plataforma, con la misma forma que el de Snake, Arkanoid, Tetris y Asteroides:

```ts
// app/juego/travesia/engine.ts
export type TravesiaStatus = "playing" | "paused" | "gameover";

export interface TravesiaStats {
  score: number;
  lives: number; // 0..3
  level: number; // >= 1, sube al llenar los 5 muelles, sin tope
}

export interface TravesiaCallbacks {
  onStats: (stats: TravesiaStats) => void;
  onStatus: (status: TravesiaStatus) => void;
  onGameOver: (finalStats: TravesiaStats) => void;
}

export interface TravesiaGame {
  start(): void;
  pause(): void;
  resume(): void;
  end(): void;
  restart(): void;
  destroy(): void;
}

export function createTravesiaGame(
  canvas: HTMLCanvasElement,
  callbacks: TravesiaCallbacks,
): TravesiaGame;
```

Estado interno y niveles:

```ts
type Direction = "up" | "down" | "left" | "right";
type LaneKind = "road" | "water";
type ObjectKind = "scooter" | "car" | "van" | "truck" | "barge" | "pallet" | "buoy";

interface LaneDef {
  row: number;          // 1..4 agua, 6..10 carretera
  kind: LaneKind;
  dir: -1 | 1;          // -1 izquierda, 1 derecha
  speed: number;        // px/s base, antes del escalado por nivel
  pattern: { kind: ObjectKind; length: number; gapAfter: number }[]; // en celdas, se repite en bucle
}

interface MovingObject { kind: ObjectKind; x: number; row: number; length: number; sinkPhase?: number }

interface Player {
  col: number; row: number;      // celda lógica
  x: number;                     // px reales (se desplaza con la plataforma)
  hop: { from: Cell; to: Cell; t: number } | null;
  queued: Direction | null;      // máximo una pulsación encolada
  furthestRow: number;           // para puntuar filas nuevas
  carrying: boolean;             // paquete exprés
}

type Cell = { col: number; row: number }; // col 0..15, row 0..11
type DockState = "free" | "filled" | "spark";

// app/juego/travesia/levels.ts
export const LEVELS: LaneDef[][]; // 4 niveles definidos a mano
```

Convenciones:

- El motor no importa Supabase ni `lib/data.ts`, y no usa variables globales de módulo.
- Resolución interna fija 800×600, celdas de 50 px, origen arriba a la izquierda.
- Los objetos se mueven en px/s multiplicados por `dt`, con `dt` limitado a 50 ms, así que la velocidad es la misma a 60 Hz y a 144 Hz.
- El reloj del intento, los ciclos de hundimiento de boyas y la chispa de los muelles usan tiempo de juego, que no avanza en pausa.
- Colisión en carretera: solapamiento horizontal entre la caja de Chispa (con 8 px de margen interior) y la del vehículo en la misma fila. En el agua: el centro de Chispa debe estar sobre una plataforma visible.
- `onStats` solo se emite cuando cambian `score`, `lives` o `level`.

## Implementation plan

1. Crear la migración `supabase/migrations/<timestamp>_add_game_travesia.sql` con el `insert` en `games`, la clase `.cover-travesia` y añadir `.travesia-canvas` a la regla compartida de `app/globals.css`. Aplicar la migración al proyecto remoto solo con confirmación explícita del usuario. Comprobación manual: la tarjeta TRAVESÍA aparece en `/juego` con su miniatura y `/juego/travesia` muestra la ficha.
2. Crear `app/juego/travesia/engine.ts` con el esqueleto: factory, bucle con `requestAnimationFrame` y `dt` limitado, tablero fijo, Chispa con salto por celda y pulsación encolada, límites del tablero y `start`/`pause`/`resume`/`end`/`restart`/`destroy`. Crear `app/juego/travesia/travesia-player.tsx` y `app/juego/travesia/jugar/page.tsx` (`getGame("travesia")`, `notFound()` si es `null`). Comprobación manual: Chispa salta celda a celda, FIN muestra el `GameOverModal`.
3. Crear `app/juego/travesia/levels.ts` con los 4 niveles y añadir al motor los carriles de carretera, la colisión con vehículos, la pérdida de vida con animación de chatarra y la reaparición. Comprobación manual: un coche quita una vida y el HUD baja un `♥`.
4. Añadir el canal: plataformas que arrastran a Chispa, caída al agua, salida por un borde y boyas que se hunden desde el nivel 3. Comprobación manual: Chispa viaja sobre una barcaza y muere al saltar al agua.
5. Añadir muelles, reloj, puntuación completa, paquete exprés, subida de nivel con escalado de velocidad y chispa eléctrica en muelles desde el nivel 4. Comprobación manual: llenar los 5 muelles sube a Nivel 02 y la puntuación coincide con las reglas.
6. Añadir el dibujo final en pixel art plano: escenario, vehículos, plataformas, Chispa orientada, barra del reloj y animaciones de muerte. Comprobación manual: aspecto correcto y nada se deforma en el CRT.
7. Verificación: `npm run lint`, `npx tsc --noEmit`, `npm run build`, `get_advisors` de Supabase y recorrido manual completo (biblioteca → ficha → jugar → game over → guardar → leaderboard → salir).

## Acceptance criteria

- [ ] Existe una fila `id = 'travesia'` en `public.games` con `category = 'ARCADE'` y `color = 'magenta'`.
- [ ] `/juego` muestra la tarjeta TRAVESÍA con la miniatura `.cover-travesia`, distinta de las de los otros juegos.
- [ ] `/juego/travesia` muestra la ficha y su botón JUGAR lleva a `/juego/travesia/jugar`.
- [ ] `/juego/travesia/jugar` muestra el tablero dentro del CRT sin deformarse, con acera, avenida, muelle intermedio, canal y 5 muelles visibles.
- [ ] El HUD empieza con Puntuación 0, Nivel 01 y `♥ ♥ ♥` en Vidas.
- [ ] Nada se mueve hasta la primera pulsación de una dirección; después el tráfico y el reloj arrancan.
- [ ] Cada pulsación de flecha o `W` / `A` / `S` / `D` mueve a Chispa exactamente una celda; mantener la tecla no repite el salto.
- [ ] Ni las flechas ni `Espacio` hacen scroll en la página.
- [ ] Chispa no sale del tablero por los lados ni por abajo.
- [ ] Tocar un vehículo quita una vida y muestra la animación de chatarra.
- [ ] Sobre una plataforma, Chispa se desplaza con ella; caer al agua o ser sacado por un borde quita una vida.
- [ ] Desde el nivel 3, una boya parpadea antes de hundirse y quita una vida si Chispa está encima al hundirse.
- [ ] Avanzar a una fila nueva suma 10; volver atrás y repetir la fila no suma.
- [ ] Entregar en un muelle libre suma 50 + 10 por segundo restante, ocupa el muelle y devuelve a Chispa a la salida.
- [ ] Saltar al muro o a un muelle ocupado quita una vida.
- [ ] Si el reloj llega a 0, se pierde una vida y el reloj se reinicia.
- [ ] Llenar los 5 muelles suma 500 × nivel, vacía los muelles y el HUD muestra el nivel siguiente con el tráfico más rápido.
- [ ] Entregar con el paquete exprés suma 200 extra; perder la vida con él lo hace desaparecer.
- [ ] Al perder la tercera vida aparece el `GameOverModal` con la puntuación final y Vidas muestra `—`.
- [ ] `P`, `Espacio` y `Enter` no pausan ni reanudan el juego.
- [ ] PAUSA congela tráfico y reloj, el botón pasa a REANUDAR y al reanudar nada salta de golpe.
- [ ] FIN termina la partida y muestra el `GameOverModal`.
- [ ] SALIR navega a `/juego/travesia` y no quedan loops ni listeners activos (`Espacio` vuelve a hacer scroll y no hay errores en consola).
- [ ] La velocidad del tráfico y del reloj es la misma a 60 Hz y a 144 Hz.
- [ ] Guardar crea una fila en `scores` con `game_id = 'travesia'` y `level >= 1`, que aparece en el leaderboard, el Salón de la Fama y la actividad de la home.
- [ ] Reiniciar desde el `GameOverModal` deja Puntuación 0, Nivel 1, 3 vidas y los muelles vacíos.
- [ ] El juego no escribe en `localStorage` y no reproduce sonido.
- [ ] Asteroides, Tetris, Arkanoid y Snake siguen funcionando igual.
- [ ] `get_advisors` de Supabase no muestra avisos de seguridad nuevos.
- [ ] `npm run lint`, `npx tsc --noEmit` y `npm run build` pasan sin errores.

## Decisions

- **Sí (asumido):** juego original "TRAVESÍA" con el robot mensajero Chispa, una avenida nocturna y un canal industrial. **No:** rana, río con troncos y tortugas, nombre o niveles de ningún juego comercial del género.
- **Sí (asumido):** id `travesia`, rutas `/juego/travesia` y `/juego/travesia/jugar`. **No:** `cruce`, que ya figura como sugerencia pendiente del `game-planner` en `references/game-suggestions-todo.md` y así no se mezclan ambas pistas.
- **Sí (asumido):** categoría `ARCADE` aunque `VERSUS` (0 juegos) es la menos poblada: un juego de cruzar carriles en solitario no encaja en VERSUS, SHOOTER ni PUZZLE. **No:** forzar la categoría.
- **Sí (asumido):** color `magenta`. Los cuatro colores se usan una vez en el catálogo; magenta no está en ningún ARCADE (Arkanoid es `yellow` y Snake `green`).
- **Sí (asumido):** miniatura nueva `.cover-travesia`. **No:** reutilizar `.cover-rana`, cuyo dibujo remite al personaje del juego comercial.
- **Sí (asumido):** pantalla fija con rejilla 16×12 de 50 px y salto de una celda por pulsación, sin repetición al mantener.
- **Sí (asumido):** 5 muelles; llenarlos completa el nivel. **No:** puntuar solo por distancia (es la Variante B).
- **Sí (asumido):** 3 vidas; Vidas muestra un `♥` por vida como Arkanoid y Asteroides.
- **Sí (asumido):** reloj de 30 s por intento, que se reinicia al morir y al entregar.
- **Sí (asumido):** puntuación +10 por fila nueva, +50 por muelle, +10 por segundo restante, +500 × nivel por completar y +200 por paquete exprés.
- **Sí (asumido):** 4 niveles a mano en `levels.ts` y repetición escalada del 4 en adelante, con multiplicador de velocidad tope ×2.
- **Sí (asumido):** boyas que se hunden desde el nivel 3 y chispa eléctrica en muelles desde el nivel 4.
- **Sí (asumido):** se encola como máximo una pulsación durante el salto de 120 ms.
- **Sí (asumido):** pixel art plano dibujado por código, sin assets. **No:** neón vectorial con brillo (es la Variante B).
- **Sí (asumido):** la pausa es solo el botón PAUSA, como en los otros cuatro juegos.
- **Sí (asumido):** un reproductor propio por juego siguiendo `app/juego/snake/snake-player.tsx`. **No:** un reproductor genérico.
- **Sí (asumido):** sin sonido ni vidas extra.
- **Nota:** `.claude/skills/add-game/references/integration-blueprint.md` existe y se ha seguido junto con el código actual de `app/juego/snake/`, que manda sobre el blueprint.

## Identified risks

| Riesgo | Mitigación |
| ------ | ---------- |
| La migración inserta datos en una base compartida. | Es un `insert` aditivo; aplicarlo al proyecto remoto exige confirmación explícita del usuario. |
| Doble loop en desarrollo por React Strict Mode. | `destroy()` cancela `requestAnimationFrame` y quita los listeners; un criterio de aceptación comprueba la limpieza al salir. |
| Captura global del teclado. | Los listeners y el `preventDefault` en `Espacio` y flechas se quitan al desmontar, como en `snake-player.tsx`. |
| `dt` enorme al reanudar o al volver a la pestaña hace saltar el tráfico o vacía el reloj. | Limitar `dt` a 50 ms y reiniciar `lastTime` al reanudar. |
| Re-renders del HUD en cada frame. | Emitir `onStats` solo cuando cambian `score`, `lives` o `level`; el reloj se dibuja en el canvas, no en el HUD. |
| `Espacio` o `Enter` activan el botón enfocado del HUD. | `blur` tras el clic en PAUSA y FIN. |
| Velocidad distinta a 60 Hz y a 144 Hz. | Movimiento en px/s por `dt` y temporizadores en tiempo de juego. |
| Carga de assets. | No hay assets: todo se dibuja por código, sin esperas de carga. |
| La auto-repetición del teclado al mantener una tecla provoca saltos en cadena. | Ignorar eventos con `event.repeat`. |
| Chispa, arrastrado por una plataforma, queda entre dos columnas y el siguiente salto lateral resulta injusto. | Al aterrizar en tierra firme, ajustar `x` a la columna más cercana; sobre el agua, saltar desde la `x` real. |
| Un patrón de carriles deja huecos imposibles de cruzar en el canal. | Patrones definidos a mano en `levels.ts` con `gapAfter` acotado; revisar cada nivel en la verificación manual. |
| Morir en el mismo fotograma por dos causas suma dos vidas perdidas. | Un único estado `dying` que ignora colisiones hasta reaparecer. |
| Las velocidades asumidas hacen el nivel 1 demasiado fácil o difícil. | Velocidades base en `levels.ts`, ajustables en la verificación manual. |

## What is **not** in this spec

Sonido, scroll vertical, generación procedural, movimiento libre, impulso, vidas extra, sprites en PNG, soporte táctil o ratón, ranking local, cambios en `scores` y un reproductor genérico. Cada uno, si llega, va en su propia spec.
