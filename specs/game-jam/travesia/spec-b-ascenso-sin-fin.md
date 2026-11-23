# GAME JAM — Travesía · Variante B: Ascenso sin fin

> **Status:** Borrador
> **Depends on:** SPEC 06, SPEC 07, SPEC 09, SPEC 12, SPEC 13, SPEC 15, SPEC 16
> **Date:** 2026-11-23
> **Objective:** Crear desde cero el juego original "TRAVESÍA" en su variante de scroll vertical infinito e integrarlo en Arcade Vault, con tarjeta en `/juego`, detalle en `/juego/travesia` y partida en `/juego/travesia/jugar` dentro del CRT de la plataforma, enviando puntuación, vidas y nivel al HUD y guardando la puntuación en `scores`.

## Why this spec exists

El tema de la game jam es "cruza la carretera y el río sin convertirte en papilla": el género clásico *cross-the-road*, en el que un personaje atraviesa carriles de tráfico y después un río saltando sobre plataformas móviles. Esta spec **no** recrea ningún juego comercial del género: el nombre, el personaje, el escenario, el arte y los niveles son propios.

**Idea base (común a las dos variantes):** Chispa, un pequeño robot mensajero de cartón y chapa, tiene que cruzar una avenida nocturna llena de tráfico y después un canal industrial. Un vehículo lo deja hecho chatarra y el agua lo cortocircuita.

**Qué hace distinta a esta Variante B ("Ascenso sin fin"):** es la lectura de *endless runner* vertical. La ciudad no se acaba: franjas de carretera, canal y vías se generan sin fin y la cámara **sube sola** empujando a Chispa. Chispa se mueve **libremente y de forma continua** (no por celdas), tiene un **impulso** que gasta energía para saltar por encima del peligro, y la puntuación premia avanzar deprisa con un **multiplicador de racha**. No hay muelles ni reloj, y quedarse atrás es la muerte. La Variante A ("Ruta de reparto") es lo opuesto: pantalla fija, salto de una celda por pulsación, 5 muelles por nivel y reloj por intento.

No existe juego de partida en `references/started-games/` ni assets reutilizables en `references/source-assets/` (solo hay sprites de frutas de Snake), así que todo se dibuja por código.

## Scope

**In:**

- Migración nueva que inserta la fila `travesia` en `public.games`:
  - `id = 'travesia'`, `title = 'TRAVESÍA'`, `category = 'ARCADE'`, `cover = 'cover-travesia'`, `color = 'magenta'`.
  - `short_description` y `long_description` en español, redactadas al implementar y coherentes con las reglas de esta variante.
  - La fila debe existir antes de guardar cualquier puntuación, porque `scores.game_id` es una FK a `games.id`.
- Miniatura nueva `.cover-travesia` en `app/globals.css`: franjas horizontales en perspectiva con trazos de neón cian y magenta y una flecha ascendente. **No** se reutiliza `.cover-rana` de la plantilla.
- Clase `.travesia-canvas` añadida a la regla compartida `.crt-screen .asteroids-canvas, .crt-screen .tetris-canvas, .crt-screen .arkanoid-canvas, .crt-screen .snake-canvas` de `app/globals.css`.
- Motor `app/juego/travesia/engine.ts`: TypeScript estricto, factory `createTravesiaGame(canvas, callbacks)`.
- Generador de franjas `app/juego/travesia/bands.ts`: funciones puras que producen la siguiente franja a partir de la zona, la franja anterior y un generador aleatorio con semilla inyectado (sin `Math.random` global dentro del generador).
- Reproductor `app/juego/travesia/travesia-player.tsx` (client component) y página `app/juego/travesia/jugar/page.tsx`, con el mismo patrón que `app/juego/snake/`.
- Un único canvas con resolución interna 800×600 (4:3), escalado por CSS dentro de `.crt-screen`.
- Mundo:
  - Mundo vertical infinito hecho de **franjas** de 50 px de alto y 800 px de ancho; en pantalla caben 12.
  - Tipos de franja: `acera` (segura), `carretera` (vehículos en un sentido), `canal` (agua con plataformas a la deriva), `vía` (un tren muy rápido que pasa tras un aviso luminoso de 1 s) y `mediana` (segura, con una pila de energía a veces).
  - Las franjas se generan por bloques: 1 acera, después 2–5 carreteras o 2–4 canales o 1–2 vías, y vuelta a empezar. La partida empieza con 3 aceras seguras.
  - Cada canal garantiza que entre plataformas consecutivas el hueco es menor que el alcance del impulso, para que siempre exista paso.
- Cámara y presión:
  - Tras el primer movimiento, la cámara sube sola a `18 + 6 × (zona − 1)` px/s (tope 60 px/s).
  - Si Chispa está por encima de la mitad de la pantalla, la cámara acelera hasta mantenerlo en esa línea.
  - Si el borde inferior de la pantalla alcanza a Chispa, **la partida termina en el acto**, aunque le queden vidas ("la ciudad te alcanza").
- Movimiento de Chispa:
  - Movimiento libre y continuo en 8 direcciones a 170 px/s mientras se mantienen las flechas o `W` / `A` / `S` / `D`. No se alinea a ninguna rejilla.
  - Sobre una plataforma del canal, Chispa suma la velocidad de la plataforma a la suya.
  - No puede salir por los lados (se detiene en el borde). Ser arrastrado contra el borde por una plataforma lo tira al agua.
  - **Impulso** con `Espacio`: salto de 0,35 s en la dirección actual (hacia arriba si está quieto) que recorre 110 px. Durante el salto Chispa está en el aire: no le afectan vehículos, trenes ni agua. Al aterrizar se comprueba la superficie.
  - Barra de **energía** de 3 cargas dibujada en el canvas. El impulso gasta 1 carga. Las cargas se recuperan recogiendo **pilas** (aparecen en medianas y sobre plataformas) y 1 carga cada 6 s de forma pasiva.
- Daño y vidas:
  - Vidas = **3 celdas de blindaje**.
  - Un vehículo o un tren quita 1 celda; Chispa **no reaparece**: sigue donde está con 1,5 s de invulnerabilidad (parpadeo).
  - Caer al agua quita 1 celda y recoloca a Chispa en la última franja segura que pisó, con 1,5 s de invulnerabilidad. Si esa franja ya está fuera de pantalla, se usa la franja segura visible más baja; si no hay ninguna, la partida termina.
  - Sin celdas, la partida termina.
- Nivel = **zona**:
  - La zona sube cada 25 franjas de altura máxima alcanzada (`zona = floor(franjas / 25) + 1`), sin tope.
  - Zona 1: carreteras y canales. Zona 2: aparecen las vías. Zona 3: aparecen plataformas que se hunden (parpadeo de 0,6 s antes). Zona 4 en adelante: todo mezclado y más denso.
  - Cada zona cambia la paleta de neón (cian, magenta, verde, amarillo, en ciclo) y aumenta la velocidad de vehículos y plataformas: `base × min(2,2, 1 + 0,1 × (zona − 1))`.
- Puntuación:
  - +10 × multiplicador por cada franja nueva de altura máxima.
  - **Multiplicador de racha** ×1 a ×5: sube 1 cada vez que se alcanza una franja nueva menos de 1,2 s después de la anterior; vuelve a ×1 al pasar 1,2 s sin avanzar o al perder una celda. Se dibuja junto a Chispa.
  - +25 por pila recogida (aunque la energía esté llena).
  - +15 por **casi impacto**: pasar en el aire con el impulso por encima de un vehículo o un tren.
- Controles: flechas o `W` / `A` / `S` / `D` para moverse y `Espacio` para el impulso. La cámara arranca al primer movimiento. La pausa solo se activa con el botón PAUSA del HUD.
- Estilo visual: **neón vectorial sobre negro**, todo con trazos (`strokeRect`, `lineTo`) de 2 px y brillo, sin rellenos planos: carreteras como líneas de carril que se desplazan, vehículos como siluetas en contorno con estela, agua como líneas onduladas, trenes como un bloque de contorno largo, Chispa como un rombo magenta con antena. Muerte: explosión de segmentos de línea. La paleta cambia con cada zona.
- HUD de la plataforma: Jugador (`INVITADO`), Puntuación, Vidas (un `♥` por celda de blindaje, `—` al terminar) y Nivel (la zona).
- Botones del HUD: PAUSA / REANUDAR, FIN y SALIR.
- Fin de partida con `GameOverModal` y guardado con `saveScore({ gameId, name, score, level })`.
- Limpieza al desmontar: cancelar `requestAnimationFrame` y quitar los listeners de teclado.

**Out of scope (para specs futuras):**

- Sonido de cualquier tipo.
- Pantalla fija, salto por celdas, muelles de entrega y reloj por intento (es la Variante A).
- Semilla compartida o reto diario.
- Vidas extra, tienda o mejoras permanentes.
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
  lives: number; // celdas de blindaje, 0..3
  level: number; // zona, >= 1, sube cada 25 franjas, sin tope
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

Estado interno y generador:

```ts
type BandKind = "sidewalk" | "road" | "canal" | "rail" | "median";

interface Hazard { x: number; width: number; speed: number; kind: "scooter" | "car" | "van" | "truck" | "train" }
interface Platform { x: number; width: number; speed: number; sinkPhase?: number }

interface Band {
  index: number;            // 0 = primera franja; crece hacia arriba
  kind: BandKind;
  dir: -1 | 1;
  hazards: Hazard[];        // road / rail
  platforms: Platform[];    // canal
  battery: { x: number } | null;
  railWarningUntil?: number; // tiempo de juego
}

interface Runner {
  x: number; y: number;      // posición en el mundo (px), y crece hacia arriba
  vx: number; vy: number;
  dash: { t: number; dirX: number; dirY: number } | null;
  energy: number;            // 0..3
  invulnerableUntil: number; // tiempo de juego
  lastSafeBand: number;
  maxBand: number;           // altura máxima, base de puntuación y zona
  streak: number;            // 1..5
  lastAdvanceAt: number;
}

// app/juego/travesia/bands.ts
export type Rng = () => number; // 0..1
export function createRng(seed: number): Rng;
export function nextBand(prev: Band, zone: number, rng: Rng): Band;
```

Convenciones:

- El motor no importa Supabase ni `lib/data.ts`, y no usa variables globales de módulo. El generador recibe el `Rng`; el motor crea uno nuevo con semilla aleatoria en `start` y en `restart`.
- Resolución interna fija 800×600. El mundo usa `y` hacia arriba; se convierte a coordenadas de canvas restando la posición de la cámara.
- Solo se mantienen en memoria las franjas visibles más 2 por encima y 2 por debajo; las que salen por abajo se descartan.
- Todo el movimiento es en px/s multiplicado por `dt`, con `dt` limitado a 50 ms; los temporizadores (impulso, invulnerabilidad, recarga de energía, aviso del tren, racha) usan tiempo de juego, que no avanza en pausa.
- Las teclas se leen como estado (pulsada / no pulsada) para el movimiento continuo; el impulso se dispara en el flanco de bajada de `Espacio` e ignora `event.repeat`.
- `onStats` solo se emite cuando cambian `score`, `lives` o `level`; energía y multiplicador se dibujan en el canvas.

## Implementation plan

1. Crear la migración `supabase/migrations/<timestamp>_add_game_travesia.sql` con el `insert` en `games`, la clase `.cover-travesia` y añadir `.travesia-canvas` a la regla compartida de `app/globals.css`. Aplicar la migración al proyecto remoto solo con confirmación explícita del usuario. Comprobación manual: la tarjeta TRAVESÍA aparece en `/juego` con su miniatura y `/juego/travesia` muestra la ficha.
2. Crear `app/juego/travesia/engine.ts` con el esqueleto: factory, bucle con `requestAnimationFrame` y `dt` limitado, movimiento libre de Chispa con teclas como estado, cámara que sube tras el primer movimiento, fin de partida al ser alcanzado por el borde inferior y `start`/`pause`/`resume`/`end`/`restart`/`destroy`. Crear `app/juego/travesia/travesia-player.tsx` y `app/juego/travesia/jugar/page.tsx` (`getGame("travesia")`, `notFound()` si es `null`). Comprobación manual: Chispa se mueve en diagonal y quedarse quieto acaba en `GameOverModal`.
3. Crear `app/juego/travesia/bands.ts` con el `Rng` con semilla y la generación por bloques de aceras, carreteras y canales, incluida la garantía de paso en los canales. Comprobación manual: tras 100 franjas no aparece ningún canal infranqueable con impulso.
4. Añadir peligros y daño: colisión con vehículos, agua, arrastre contra el borde, celdas de blindaje, invulnerabilidad y recolocación en la última franja segura. Comprobación manual: un coche quita un `♥` y Chispa sigue en su sitio parpadeando.
5. Añadir impulso, energía, pilas, recarga pasiva, puntuación con multiplicador de racha y casi impacto, zonas con vías, plataformas que se hunden y escalado de velocidad. Comprobación manual: tras 25 franjas el HUD muestra Nivel 02 y aparecen vías.
6. Añadir el dibujo final en neón vectorial con paleta por zona, barra de energía, multiplicador y efectos de muerte. Comprobación manual: aspecto correcto, sin caídas de fotogramas visibles y sin deformarse en el CRT.
7. Verificación: `npm run lint`, `npx tsc --noEmit`, `npm run build`, `get_advisors` de Supabase y recorrido manual completo (biblioteca → ficha → jugar → game over → guardar → leaderboard → salir).

## Acceptance criteria

- [ ] Existe una fila `id = 'travesia'` en `public.games` con `category = 'ARCADE'` y `color = 'magenta'`.
- [ ] `/juego` muestra la tarjeta TRAVESÍA con la miniatura `.cover-travesia`, distinta de las de los otros juegos.
- [ ] `/juego/travesia` muestra la ficha y su botón JUGAR lleva a `/juego/travesia/jugar`.
- [ ] `/juego/travesia/jugar` muestra el juego dentro del CRT sin deformarse, con 3 aceras iniciales y Chispa visible.
- [ ] El HUD empieza con Puntuación 0, Nivel 01 y `♥ ♥ ♥` en Vidas.
- [ ] La cámara está quieta hasta el primer movimiento y después sube sola.
- [ ] Mantener flechas o `W` / `A` / `S` / `D` mueve a Chispa de forma continua, también en diagonal.
- [ ] Ni las flechas ni `Espacio` hacen scroll en la página.
- [ ] `Espacio` lanza el impulso, gasta una carga de energía y Chispa atraviesa en el aire un coche o un tramo de agua sin daño.
- [ ] Sin energía, `Espacio` no hace nada; la energía se recupera con pilas y con el tiempo.
- [ ] Tocar un vehículo o un tren quita un `♥`, Chispa no reaparece y parpadea durante la invulnerabilidad sin perder más vidas.
- [ ] Caer al agua quita un `♥` y recoloca a Chispa en una franja segura.
- [ ] La vía muestra un aviso luminoso antes de que pase el tren.
- [ ] Si el borde inferior alcanza a Chispa, aparece el `GameOverModal` aunque queden vidas.
- [ ] Cada franja nueva de altura máxima suma 10 × multiplicador; avanzar rápido sube el multiplicador hasta ×5 y pararse o recibir daño lo devuelve a ×1.
- [ ] Recoger una pila suma 25 y saltar por encima de un vehículo con el impulso suma 15.
- [ ] Tras 25 franjas el HUD muestra Nivel 02, cambia la paleta y aparecen vías; tras 50, Nivel 03 y plataformas que se hunden.
- [ ] Ningún canal generado es imposible de cruzar con el impulso disponible.
- [ ] Al perder la tercera celda aparece el `GameOverModal` y Vidas muestra `—`.
- [ ] `P` y `Enter` no pausan ni reanudan el juego, y `Espacio` solo lanza el impulso.
- [ ] PAUSA congela cámara, tráfico y temporizadores, el botón pasa a REANUDAR y al reanudar nada salta de golpe.
- [ ] FIN termina la partida y muestra el `GameOverModal`.
- [ ] SALIR navega a `/juego/travesia` y no quedan loops ni listeners activos (`Espacio` vuelve a hacer scroll y no hay errores en consola).
- [ ] La velocidad de la cámara, del tráfico y de Chispa es la misma a 60 Hz y a 144 Hz.
- [ ] Guardar crea una fila en `scores` con `game_id = 'travesia'` y `level >= 1`, que aparece en el leaderboard, el Salón de la Fama y la actividad de la home.
- [ ] Reiniciar desde el `GameOverModal` deja Puntuación 0, Nivel 1, 3 vidas, energía llena y un mundo nuevo.
- [ ] El juego no escribe en `localStorage` y no reproduce sonido.
- [ ] Asteroides, Tetris, Arkanoid y Snake siguen funcionando igual.
- [ ] `get_advisors` de Supabase no muestra avisos de seguridad nuevos.
- [ ] `npm run lint`, `npx tsc --noEmit` y `npm run build` pasan sin errores.

## Decisions

- **Sí (asumido):** juego original "TRAVESÍA" con el robot mensajero Chispa, una avenida nocturna, canales y vías. **No:** rana, río con troncos y tortugas, nombre o niveles de ningún juego comercial del género.
- **Sí (asumido):** id `travesia`, rutas `/juego/travesia` y `/juego/travesia/jugar`. **No:** `cruce`, que ya figura como sugerencia pendiente del `game-planner` en `references/game-suggestions-todo.md`.
- **Sí (asumido):** categoría `ARCADE` aunque `VERSUS` (0 juegos) es la menos poblada: un juego de cruzar carriles en solitario no encaja en VERSUS, SHOOTER ni PUZZLE.
- **Sí (asumido):** color `magenta`. Los cuatro colores se usan una vez en el catálogo; magenta no está en ningún ARCADE.
- **Sí (asumido):** miniatura nueva `.cover-travesia`. **No:** reutilizar `.cover-rana`.
- **Sí (asumido):** mundo infinito generado por bloques con `Rng` con semilla inyectado y garantía de paso en canales. **No:** niveles hechos a mano (es la Variante A).
- **Sí (asumido):** movimiento libre continuo en 8 direcciones a 170 px/s. **No:** salto por celda.
- **Sí (asumido):** impulso con `Espacio`, 3 cargas de energía, pilas y recarga pasiva cada 6 s.
- **Sí (asumido):** cámara forzada que termina la partida al alcanzar a Chispa, aunque le queden vidas.
- **Sí (asumido):** 3 celdas de blindaje como Vidas, sin reaparición tras un golpe y con 1,5 s de invulnerabilidad.
- **Sí (asumido):** Nivel = zona, cada 25 franjas, sin tope, con paleta y peligros nuevos por zona.
- **Sí (asumido):** puntuación +10 × multiplicador (×1 a ×5) por franja nueva, +25 por pila y +15 por casi impacto. **No:** bonus por tiempo ni por entregas (es la Variante A).
- **Sí (asumido):** neón vectorial con trazos y brillo, dibujado por código. **No:** pixel art plano (es la Variante A).
- **Sí (asumido):** `Espacio` es una tecla de juego (impulso), a diferencia de Snake; el reproductor sigue haciendo `preventDefault` en ella y `blur` en los botones.
- **Sí (asumido):** la pausa es solo el botón PAUSA, como en los otros cuatro juegos.
- **Sí (asumido):** un reproductor propio por juego siguiendo `app/juego/snake/snake-player.tsx`. **No:** un reproductor genérico.
- **Sí (asumido):** sin sonido, sin semilla compartida y sin vidas extra.
- **Nota:** `.claude/skills/add-game/references/integration-blueprint.md` existe y se ha seguido junto con el código actual de `app/juego/snake/`, que manda sobre el blueprint.

## Identified risks

| Riesgo | Mitigación |
| ------ | ---------- |
| La migración inserta datos en una base compartida. | Es un `insert` aditivo; aplicarlo al proyecto remoto exige confirmación explícita del usuario. |
| Doble loop en desarrollo por React Strict Mode. | `destroy()` cancela `requestAnimationFrame` y quita los listeners; un criterio de aceptación comprueba la limpieza al salir. |
| Captura global del teclado. | Los listeners y el `preventDefault` en `Espacio` y flechas se quitan al desmontar. |
| `dt` enorme al reanudar o al volver a la pestaña hace que la cámara alcance a Chispa de golpe. | Limitar `dt` a 50 ms y reiniciar `lastTime` al reanudar. |
| Re-renders del HUD en cada frame. | Emitir `onStats` solo cuando cambian `score`, `lives` o `level`; energía y multiplicador van en el canvas. |
| `Espacio` activa el botón enfocado del HUD en vez del impulso. | `blur` tras el clic en PAUSA y FIN y `preventDefault` en `keydown` y `keyup` de `Espacio`. |
| Velocidad distinta a 60 Hz y a 144 Hz. | Movimiento en px/s por `dt` y temporizadores en tiempo de juego. |
| Carga de assets. | No hay assets: todo se dibuja por código. |
| Teclas "pegadas" si la ventana pierde el foco con una flecha pulsada. | Limpiar el estado de teclas en `blur` de la ventana y al pausar. |
| El generador crea un canal o una secuencia imposible de cruzar. | Restricción explícita de hueco máximo en `nextBand` y comprobación manual de 100 franjas; el generador es puro y se puede probar aislado. |
| `shadowBlur` en muchos trazos hunde los fotogramas. | Limitar el brillo a Chispa, trenes y vehículos cercanos, o dibujar el brillo con un segundo trazo semitransparente en lugar de `shadowBlur`. |
| La cámara forzada hace las partidas demasiado cortas o demasiado largas. | Velocidad de cámara y escalado en constantes del motor, ajustables en la verificación manual para partidas de 2 a 10 minutos. |
| Recolocación tras caer al agua sin franja segura visible. | Regla explícita: se usa la franja segura visible más baja; si no hay, la partida termina. |
| Crecimiento de memoria en partidas largas. | Descartar las franjas que salen por abajo y mantener solo la ventana visible más 2 por cada lado. |
| Golpes dobles en el mismo fotograma. | La invulnerabilidad empieza en el primer impacto y las colisiones se ignoran hasta que termina. |

## What is **not** in this spec

Sonido, pantalla fija, salto por celdas, muelles y reloj, semilla compartida o reto diario, vidas extra o mejoras, sprites en PNG, soporte táctil o ratón, ranking local, cambios en `scores` y un reproductor genérico. Cada uno, si llega, va en su propia spec.
