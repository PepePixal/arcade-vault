# SPEC 17 — Gamepad virtual para móvil

> **Status:** Implementado
> **Depends on:** SPEC 05, SPEC 14, SPEC 15, SPEC 16
> **Date:** 2026-11-25
> **Objective:** Permitir jugar a todos los juegos de Arcade Vault en móviles táctiles (ancho < 768px) con un layout propio: barra compacta de stats, canvas a casi todo el ancho, gamepad virtual (cruceta + A + B) que emula el teclado y una fila con Skin · PAUSA · FIN.

## Why this spec exists

Los cuatro juegos (Asteroides, Tetris, Arkanoid, Snake) solo se controlan con teclado, así que en un móvil no se pueden jugar. Además el layout del reproductor (nav, `.player-hud`, marco CRT completo) deja poco espacio al canvas en una pantalla estrecha. Esta spec define una estructura móvil común y reutilizable, para que los juegos futuros la obtengan siguiendo el patrón de integración.

## Scope

**In:**

- Layout móvil, activo solo con `max-width: 767px` (por debajo del breakpoint `md` de Tailwind, 48rem). En ≥ 768px no cambia nada.
- En las páginas de partida (`.av-player`) en móvil se ocultan:
  - la barra de navegación `<nav class="av-nav">`;
  - el `<footer>` del layout raíz;
  - el `.player-hud` de escritorio.
- **Barra compacta de stats** (`MobileStatsBar`) encima del canvas: una sola línea con PUNTOS · VIDAS · NIVEL, con los mismos valores que el HUD de escritorio.
- **Canvas a casi todo el ancho:** se mantiene `.crt-screen` (scanlines, esquinas), el bisel de `.crt` baja a ~6px, se ajustan radios y sombra, y se oculta `.crt-bottom`. Se reduce el padding de `.av-player`.
- **Gamepad virtual** (`VirtualGamepad`) debajo del canvas, basado en el diseño de `references/gamepad-assets/` (`gamepad.html`, `gamepad-neon.png`): cruceta de 4 direcciones a la izquierda, botones B (cian) y A (magenta) a la derecha.
  - Cada botón despacha `KeyboardEvent` sintéticos en `window` (con `key` y `code` como un teclado real, `bubbles: true`): `keydown` al tocar, `keyup` al soltar.
  - Cruceta → `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`.
  - B → Espacio (`key: " "`, `code: "Space"`) en todos los juegos.
  - A → tecla propia de cada juego, declarada por el player:
    - Tetris: `KeyX` (rotar).
    - Arkanoid: `Enter` (lanzar).
    - Asteroides y Snake: sin acción → A se muestra atenuado y deshabilitado.
  - Auto-repeat como un teclado físico: tras ~170 ms pulsado, `keydown` con `repeat: true` cada ~50 ms hasta soltar.
  - Eventos de puntero (`pointerdown` / `pointerup` / `pointercancel` / `lostpointercapture`) con `setPointerCapture`; multitáctil (p. ej. cruceta + B a la vez).
  - Sin scroll, zoom, selección de texto ni menú contextual sobre el gamepad (`touch-action: none`, `user-select: none`, `-webkit-touch-callout: none`, `preventDefault` en `contextmenu`).
  - Estado visual de pulsado en cada botón.
- **Fila HUD móvil** debajo del gamepad, tres controles:
  1. `SkinSelect`: `<select>` nativo estilizado con CLÁSICO / NEÓN / RETRO; usa `SKIN_IDS` / `SKIN_LABELS` de `lib/skins.ts` y el mismo `changeSkin` del player (persistencia igual que hoy).
  2. PAUSA / REANUDAR (misma lógica que el botón de escritorio).
  3. FIN (misma lógica que el botón de escritorio; abre `GameOverModal`, desde donde se puede guardar, reiniciar o salir).
- Integración en los 4 players existentes: `asteroids-player.tsx`, `tetris-player.tsx`, `arkanoid-player.tsx`, `snake-player.tsx`.
- Documentar el patrón para juegos futuros en `.claude/skills/add-game/references/integration-blueprint.md` y en la sección "Game Integration Pattern" de `CLAUDE.md`.

**Not in:**

- Cambios en los motores (`engine.ts`): el gamepad solo emula teclado.
- Layout táctil en horizontal: un móvil en horizontal (≥ 768px de ancho) ve el layout de escritorio sin gamepad.
- Tablets, detección por `pointer: coarse` o user agent.
- Controles por gestos (swipe) o tocando el canvas.
- Vibración háptica, sonidos de botón, remapeo de botones por el usuario.
- Mandos físicos (Gamepad API).
- Cambios en la página de detalle, biblioteca, home o Salón de la Fama.

## Data model

No hay datos nuevos ni persistencia nueva. Solo tipos de UI:

```ts
// components/games/virtual-gamepad.tsx
export type VirtualKey = "up" | "down" | "left" | "right" | "space" | "enter" | "x";

// key / code dispatched for each virtual key
const KEY_EVENTS: Record<VirtualKey, { key: string; code: string }> = {
  up: { key: "ArrowUp", code: "ArrowUp" },
  down: { key: "ArrowDown", code: "ArrowDown" },
  left: { key: "ArrowLeft", code: "ArrowLeft" },
  right: { key: "ArrowRight", code: "ArrowRight" },
  space: { key: " ", code: "Space" },
  enter: { key: "Enter", code: "Enter" },
  x: { key: "x", code: "KeyX" },
};

interface VirtualGamepadProps {
  /** Key for button A; null disables it. B is always "space". */
  actionA: VirtualKey | null;
}
```

```ts
// components/games/mobile-stats-bar.tsx
interface MobileStatsBarProps { score: number; lives: number; level: number }

// components/games/skin-select.tsx — same contract as SkinPicker
interface SkinSelectProps { value: SkinId; onChange: (id: SkinId) => void }

// components/games/mobile-game-controls.tsx — gamepad + HUD row
interface MobileGameControlsProps {
  actionA: VirtualKey | null;
  skin: SkinId;
  onSkinChange: (id: SkinId) => void;
  isPaused: boolean;
  isGameOver: boolean;
  onTogglePause: () => void;
  onEnd: () => void;
}
```

Mapa del botón A por juego (constante en cada player):

| Juego | `actionA` | Acción |
|-------|-----------|--------|
| tetris | `"x"` | Rotar |
| arkanoid | `"enter"` | Lanzar bola |
| asteroides | `null` | — (deshabilitado) |
| snake | `null` | — (deshabilitado) |

## Implementation plan

1. **CSS base del layout móvil** en `app/globals.css`, dentro de `@media (max-width: 767px)`:
   - `body:has(.av-player) .av-nav` y `body:has(.av-player) .av-footer` → `display: none`.
   - `.av-player` con márgenes/padding mínimos; `.crt` a `width: 100%`, bisel ~6px, radios y sombra reducidos; `.crt-bottom` oculto.
   - Añadir `className="av-footer"` al `<footer>` de `app/layout.tsx`.
   - El sistema sigue igual en escritorio.
2. **Componentes compartidos** en `components/games/`: `virtual-gamepad.tsx`, `mobile-stats-bar.tsx`, `skin-select.tsx`, `mobile-game-controls.tsx` (todos client, ocultos en ≥ md con `md:hidden`). Estilos del gamepad portados de `references/gamepad-assets/gamepad.html` a `app/globals.css` con prefijo `.gp-*`, usando las variables y fuentes ya existentes (`--cyan`, `--magenta`, `--pixel`, `--mono`); no se cargan fuentes nuevas. Diseño UI con `/frontend-design`.
3. **Integración en Tetris** (piloto, el que más usa A y el auto-repeat): `.player-hud` con `max-md:hidden`, `MobileStatsBar` antes de `.crt`, `MobileGameControls` después con `actionA="x"`. `togglePause` / `endGame` se adaptan para aceptar llamadas sin `MouseEvent` (o se extrae la lógica a funciones sin evento). Verificación manual en móvil emulado.
4. **Integración en Arkanoid, Asteroides y Snake** con el mismo patrón y su `actionA`.
5. **Documentación:** blueprint de `add-game` y `CLAUDE.md` describen que todo player nuevo incluye `MobileStatsBar` + `MobileGameControls`, declara `actionA` y oculta `.player-hud` en móvil.
6. **Verificación final:** `npm run lint`, `npx tsc --noEmit`, `npm run build` y recorrido manual.

## Acceptance criteria

- [ ] Con viewport de 390×844 (emulación móvil) en `/juego/<id>/jugar` de los 4 juegos no se ven `.av-nav`, el footer ni `.player-hud`.
- [ ] En ese viewport se ve, de arriba abajo: barra de stats, canvas, gamepad, fila Skin · PAUSA · FIN, sin scroll horizontal.
- [ ] El canvas ocupa al menos el 90% del ancho del viewport en 390px.
- [ ] La barra de stats muestra los mismos PUNTOS, VIDAS y NIVEL que el HUD de escritorio y se actualiza durante la partida.
- [ ] Cruceta: en los 4 juegos mueve/gira igual que las flechas del teclado.
- [ ] Mantener pulsada izquierda/derecha en Tetris mueve la ficha de forma continua; mantener ↑ o B no rota ni deja caer más de una vez.
- [ ] B: dispara en Asteroides, caída instantánea en Tetris, lanza la bola en Arkanoid.
- [ ] A: rota en Tetris, lanza la bola en Arkanoid; en Asteroides y Snake aparece deshabilitado y no hace nada.
- [ ] Se puede pulsar cruceta y B a la vez (p. ej. girar y disparar en Asteroides).
- [ ] Tocar o mantener el gamepad no hace scroll, zoom, selección de texto ni abre menú contextual.
- [ ] Al soltar un botón (o perder el puntero/cancelar el toque) se envía `keyup` y la acción continua se detiene (p. ej. la nave deja de girar).
- [ ] El `<select>` de skin cambia el skin en vivo y la elección persiste al recargar (igual que los chips de escritorio).
- [ ] PAUSA pausa y cambia a REANUDAR; FIN termina la partida y abre el modal de fin; ambos quedan deshabilitados en game over.
- [ ] Desde el modal de fin se puede guardar la puntuación, reiniciar y salir.
- [ ] Con viewport ≥ 768px el reproductor se ve y funciona exactamente como antes (nav, footer, HUD, marco CRT completo, sin gamepad).
- [ ] El resto de páginas (home, biblioteca, detalle, Salón de la Fama) mantienen nav y footer en móvil.
- [ ] Ningún `engine.ts` cambia.
- [ ] El blueprint de `add-game` y `CLAUDE.md` documentan el patrón móvil.
- [ ] `npm run lint`, `npx tsc --noEmit` y `npm run build` pasan.

## Decisions

**Tomadas:**

- **Emulación de teclado con `KeyboardEvent` sintéticos** en lugar de una API nueva en el motor: cero cambios en los 4 motores y cualquier juego futuro que use teclado funciona sin más. Los motores escuchan en `window` y leen `key` (Arkanoid) o `code` (resto), por eso se envían ambos.
- **Botón A con mapa por juego** declarado en el player; deshabilitado cuando el juego no lo usa, para no dar la sensación de un botón roto.
- **Auto-repeat emulado** (~170 ms / ~50 ms, `repeat: true`): imita el teclado físico; Tetris ya ignora `e.repeat` para rotar y caída instantánea.
- **Fila inferior Skin · PAUSA · FIN** (sin SALIR): FIN abre el modal de fin de partida, que ya ofrece salir; así se puede guardar la puntuación en móvil.
- **Barra compacta de stats** encima del canvas: el jugador no pierde la puntuación, vidas y nivel al ocultar el HUD.
- **Detección solo por ancho < 768px** (breakpoint `md` de Tailwind), diseño pensado para vertical.
- **Marco CRT mínimo**: se conserva la estética (scanlines, esquinas) con bisel ~6px y sin `.crt-bottom`.
- **`<select>` nativo** para el skin: selector del sistema en móvil, accesible y sin lógica de menú propia.
- **Ocultar nav y footer con CSS** (`body:has(.av-player)` dentro de la media query) en vez de cambiar el layout raíz o crear un route group: un único punto de cambio y sin tocar la estructura de rutas.
- **Componentes compartidos** en `components/games/` para que los juegos futuros solo los monten.

**Descartadas:**

- API `press(button)` en el contrato del motor: más tipada, pero obliga a modificar los 4 motores y el blueprint.
- Detección por `(pointer: coarse)` o user agent: más cobertura (tablets, horizontal), pero el gamepad en horizontal deja poco alto al canvas y complica el layout.
- Menú de skin personalizado: más código (foco, cierre al tocar fuera) sin ventaja clara.
- Marco CRT completo o sin marco: el primero quita ~60px de ancho; el segundo pierde la estética de la plataforma.
- A = pausa en todos los juegos: duplicaría el botón PAUSA.

## Identified risks

- **Móvil en horizontal** (≥ 768px) ve el layout de escritorio sin gamepad y no se puede jugar por tacto. Aceptado; se documenta y puede abordarse en otra spec.
- **Ventana de escritorio estrecha** (< 768px) también muestra el layout móvil. Aceptado: el gamepad funciona igual con ratón y el teclado sigue activo.
- **`:has()`**: soportado en navegadores móviles actuales (Safari 15.4+, Chrome 105+). En navegadores antiguos la nav simplemente seguiría visible.
- **Altura disponible**: en móviles bajos (p. ej. 360×640) stats + canvas + gamepad + fila pueden superar la altura; se acepta scroll vertical, pero el gamepad debe tener tamaño táctil mínimo (~44px por botón).
- **Botón táctil soltado fuera** sin `pointerup`: se cubre con `pointercancel` / `lostpointercapture`; si no se enviara `keyup`, una tecla se quedaría "pegada" (p. ej. la nave girando).
- **Foco**: los botones del gamepad no deben quedarse con foco, para que Espacio/Enter del teclado no los "pulse" en una ventana estrecha de escritorio.

## What is **not** in this spec

- Layout táctil en horizontal y tablets.
- Gestos sobre el canvas, vibración, sonidos de interfaz o remapeo de botones.
- Soporte de mandos físicos (Gamepad API).
- Cambios en motores, base de datos o páginas que no sean de partida.
