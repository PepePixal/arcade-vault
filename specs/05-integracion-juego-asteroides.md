# SPEC 05 — Integración del juego Asteroides

> **Status:** Implementado
> **Depends on:** SPEC 01
> **Date:** 2026-11-13
> **Objective:** Integrar el juego Asteroids de `references/started-games/02-asteroids/` como el juego jugable "ASTEROIDES" de Arcade Vault, con tarjeta propia en `/juego`, detalle en `/juego/asteroides` y partida en `/juego/asteroides/jugar` dentro del CRT de la plataforma, enviándole puntuación, vidas y nivel al HUD de la plataforma.

## Scope

**In:**

- Nueva entrada `asteroides` en `GAMES` (`lib/data.ts`), con tarjeta/miniatura propia (clase de portada `cover-asteroides` en `app/globals.css`), visible en la biblioteca `/juego`.
- Página de detalle `/juego/asteroides`, resuelta por la ruta dinámica existente `app/juego/[id]/page.tsx` (sin ruta nueva).
- Partida jugable en `/juego/asteroides/jugar`: el canvas del juego corre dentro de `.crt-screen` del reproductor actual, manteniendo el estilo CRT de la plataforma.
- Port del motor de `game.js` a TypeScript como módulo sin acceso a `document`/`window` globales en su carga: `lib/games/asteroids/engine.ts`, que expone `createAsteroidsGame(canvas, callbacks)` con `start()`, `pause()`, `resume()`, `end()` y `destroy()`.
- Contrato de eventos del motor hacia la plataforma (puntuación, vidas, nivel, estado), consumido por un client component que actualiza el HUD de la plataforma en vivo.
- El HUD del canvas original (SCORE, NIVEL, iconos de vida) se elimina del dibujo; esa información se muestra solo en el HUD de la plataforma. Se conservan en el canvas la barra de Triple Shot y el overlay "GAME OVER".
- Botones del HUD de la plataforma funcionales para este juego: PAUSA (alterna pausa/reanudar), FIN (termina la partida actual y muestra GAME OVER) y SALIR (vuelve a `/juego/asteroides`).
- Al terminar la partida (vidas = 0 o FIN) se muestra el resultado final; nada se persiste.
- Controles originales: `←` `→` rotar, `↑` propulsar, `Espacio` disparar/reiniciar. Se previene el scroll de la página con `Espacio` y flechas mientras el juego está montado.
- Limpieza al desmontar (cancelar `requestAnimationFrame`, quitar listeners), para que navegar fuera no deje el loop corriendo.

**Out of scope (para specs futuras):**

- Persistencia de puntuaciones (Supabase, localStorage, ranking, Salón de la Fama). Decisión explícita del usuario: solo sesión.
- Autenticación; el jugador sigue mostrándose como `INVITADO`.
- Modificar el juego mock existente `rocas` (queda como está) ni los otros 7 juegos mock.
- Soporte táctil/móvil (el juego usa teclado). En pantallas sin teclado solo se garantiza que la página no se rompa.
- Nuevas mecánicas, power-ups o balance respecto al juego original (los power-ups Triple Shot y escudo se portan tal cual).
- Sonido.
- Cambios al reproductor de los demás juegos más allá de lo necesario para montar el juego real cuando `id === "asteroides"`.

## Data model

Nueva entrada en `GAMES` (misma forma que `Game`, sin campos nuevos):

```ts
{
  id: "asteroides",
  title: "ASTEROIDES",
  short: "...",      // texto breve, en español
  long: "...",       // texto largo, en español
  cat: "SHOOTER",
  cover: "cover-asteroides",
  color: "cyan" | "magenta" | "green" | "yellow", // a definir en la implementación
  best: 0,           // sin persistencia: no hay mejor puntuación real todavía
  plays: "0",
}
```

Contrato del motor hacia la plataforma:

```ts
// lib/games/asteroids/engine.ts
export type AsteroidsStatus = "playing" | "paused" | "gameover";

export interface AsteroidsStats {
  score: number;
  lives: number;
  level: number;
}

export interface AsteroidsCallbacks {
  onStats: (stats: AsteroidsStats) => void;   // cada vez que cambia score, lives o level
  onStatus: (status: AsteroidsStatus) => void;
  onGameOver: (finalStats: AsteroidsStats) => void;
}

export interface AsteroidsGame {
  start(): void;
  pause(): void;
  resume(): void;
  end(): void;      // fuerza game over (botón FIN)
  destroy(): void;  // cancela el loop y quita listeners
}

export function createAsteroidsGame(
  canvas: HTMLCanvasElement,
  callbacks: AsteroidsCallbacks,
): AsteroidsGame;
```

Resolución interna del canvas: 800×600 (como el original), escalada con CSS para ajustarse al CRT.

## Implementation plan

1. Agregar la entrada `asteroides` a `GAMES` en `lib/data.ts` (mock `rocas` intacto) y la clase `.cover-asteroides` (con `::before`/`::after` si hace falta) en `app/globals.css`. Verificar que la tarjeta aparece en `/juego` y que `/juego/asteroides` renderiza el detalle.
2. Crear `lib/games/asteroids/engine.ts`: port de `references/started-games/02-asteroids/game.js` a TypeScript estricto (sin `any`), encapsulado en la factory `createAsteroidsGame` (el estado deja de ser global del módulo). Eliminar el dibujo de SCORE/NIVEL/vidas del canvas, conservar barra de Triple Shot y overlay GAME OVER. Emitir `onStats` / `onStatus` / `onGameOver` en los puntos donde cambian `score`, `lives`, `level` y `state`. Implementar `pause`/`resume`/`end`/`destroy`.
3. Crear `components/asteroids-player.tsx` (client component): monta el `<canvas width=800 height=600>` dentro de `.crt-screen`, instancia el motor en un `useEffect`, guarda `stats`/`status` en `useState` y destruye el motor al desmontar. Previene el scroll con `Espacio` y flechas mientras está montado.
4. Adaptar `app/juego/[id]/jugar/page.tsx` para que, cuando `game.id === "asteroides"`, renderice `AsteroidsPlayer` con el HUD de la plataforma (Jugador, Puntuación, Vidas, Nivel) alimentado por `stats`, y los botones PAUSA/FIN/SALIR funcionales. Para los demás juegos el reproductor mock actual queda sin cambios.
5. Estilos: asegurar que el canvas escalado cabe en `.crt-screen` sin deformarse (`aspect-ratio: 4/3`, `width: 100%`) y que el bloque de pie del CRT (`crt-bottom`) muestre el título correcto.
6. Verificación final: `npm run dev`, recorrido manual (biblioteca → tarjeta → detalle → JUGAR → partida completa hasta GAME OVER → reiniciar → SALIR), `npm run lint`, `npx tsc --noEmit`.

## Acceptance criteria

- [ ] `/juego` muestra la tarjeta ASTEROIDES con miniatura propia, distinta de la de ROCAS, y ambas conviven en el catálogo.
- [ ] `/juego/asteroides` muestra la página de detalle del juego con su título y descripción, y su botón JUGAR lleva a `/juego/asteroides/jugar`.
- [ ] `/juego/asteroides/jugar` muestra el canvas del juego dentro del CRT de la plataforma, y el juego corre a velocidad normal (no se acelera ni duplica tras navegar o recargar).
- [ ] Las teclas `←`, `→`, `↑` y `Espacio` rotan, propulsan y disparan la nave, y `Espacio`/flechas no hacen scroll de la página.
- [ ] La Puntuación del HUD de la plataforma sube con los valores del original (grande 20, mediano 50, pequeño 100) al destruir asteroides.
- [ ] Las Vidas del HUD de la plataforma empiezan en 3 y bajan en 1 cada vez que la nave es destruida.
- [ ] El Nivel del HUD de la plataforma empieza en 1 y sube al limpiar todos los asteroides.
- [ ] El canvas no dibuja SCORE, NIVEL ni iconos de vida; sí se mantiene la barra de Triple Shot cuando el power-up está activo.
- [ ] Al llegar a 0 vidas se muestra el overlay GAME OVER con el puntaje final, y `Espacio` reinicia la partida con HUD en 3 vidas, nivel 1 y puntuación 0.
- [ ] PAUSA congela el juego y el botón pasa a permitir reanudar; reanudar continúa sin saltos bruscos de movimiento.
- [ ] FIN termina la partida actual y muestra GAME OVER con el puntaje acumulado.
- [ ] SALIR navega a `/juego/asteroides` y, tras salir, no queda ningún loop ni listener de teclado activo (verificable: tras salir, `Espacio` hace scroll de nuevo y no hay errores en consola).
- [ ] Ningún dato de puntuación se guarda en Supabase ni en `localStorage`.
- [ ] `/juego/rocas/jugar` y el resto de juegos mock se siguen mostrando como antes.
- [ ] `npm run lint` pasa sin errores.
- [ ] `npx tsc --noEmit` pasa sin errores.

## Decisions

- **Sí (decisión del usuario):** agregar ASTEROIDES como juego nuevo y dejar el mock ROCAS. Se descartó reemplazarlo para no tocar el catálogo existente; a cambio quedan dos tarjetas de concepto parecido, aceptado por el usuario.
- **Sí (decisión del usuario):** detalle en `/juego/asteroides` y juego en `/juego/asteroides/jugar`, siguiendo la estructura `[id]` / `[id]/jugar` ya existente. Se descartó correr el juego directamente en `/juego/asteroides` porque exigía una excepción a esa estructura.
- **Sí (decisión del usuario):** puntuaciones solo de sesión, sin persistencia. Se descartó `localStorage` y Supabase: SPEC 04 dejó la conexión lista pero sin tablas ni Auth, y un ranking real merece su propio spec.
- **Sí (decisión del usuario):** quitar el HUD del canvas y mostrar score/vidas/nivel solo en el HUD de la plataforma, con PAUSA y FIN funcionales. Evita información duplicada y cumple el pedido de que el juego "proporcione" esos datos a la plataforma.
- **Sí (asumido, a confirmar al revisar la spec):** portar `game.js` a un módulo TypeScript con callbacks en vez de incrustarlo en un `<iframe>`. Un iframe aislaría el estilo y el canvas, y no permitiría alimentar el HUD de la plataforma de forma limpia; el usuario pidió explícitamente mantener estilo y canvas del proyecto.
- **Sí (asumido):** resolución interna 800×600 escalada por CSS, para no cambiar la jugabilidad (velocidades y colisiones están calculadas en esas coordenadas).
- **Sí (asumido):** categoría `SHOOTER`, `best: 0` y `plays: "0"`, ya que no hay datos reales de partidas; el color de acento se decide en la implementación según contraste con las demás tarjetas.
- **Sí (previsión de futuro, indicada por el usuario):** el proyecto se integrará con Supabase para guardar y obtener usuarios, puntuaciones, etc. Este spec no lo implementa, pero el diseño lo deja preparado: el motor no conoce la plataforma y solo emite `onStats`/`onStatus`/`onGameOver`. El punto de enganche para guardar una puntuación es `onGameOver(finalStats)` en `AsteroidsPlayer`, sin tocar el motor. El jugador `INVITADO` se reemplazará por el usuario autenticado, y `best`/`plays` de `GAMES` pasarán a leerse de la base de datos. Hasta entonces, el motor no debe importar nada de Supabase ni de `lib/data.ts`.
- **No:** soporte táctil y sonido en este spec; se pueden agregar después sin cambiar el contrato del motor.

## Identified risks

- **Doble loop en dev:** React Strict Mode monta y desmonta los efectos dos veces en desarrollo; si `destroy()` no cancela `requestAnimationFrame` y quita los listeners, el juego correrá dos veces (movimiento duplicado). Cubierto por el criterio de aceptación de velocidad normal y limpieza al salir.
- **Captura global del teclado:** el original usa `window.addEventListener`; si no se limpia, `Espacio` y las flechas quedan bloqueados en el resto del sitio. Cubierto por el criterio de SALIR.
- **Pausa y `dt`:** al reanudar, el primer frame puede recibir un `dt` enorme y teletransportar objetos. El original ya limita `dt` a 0.05 s; el port debe conservar ese límite y reiniciar `lastTime` al reanudar.
- **Re-renders del HUD:** emitir `onStats` en cada frame provocaría renders innecesarios; debe emitirse solo cuando cambian score, lives o level.
- **Dos juegos de asteroides en el catálogo (ROCAS y ASTEROIDES):** puede confundir a los usuarios; riesgo aceptado, resoluble en un spec futuro de curación del catálogo.
