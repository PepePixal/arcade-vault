# SPEC 01 — MVP visual de Arcade Vault (pantallas sin lógica de juego)

> **Status:** Aprobado
> **Depends on:** —
> **Date:** 2026-09-08
> **Objective:** Migrar las 5 pantallas del template de referencia (Biblioteca, Detalle, Reproductor, Auth, Salón de la Fama) a rutas reales de Next.js App Router, con el tema visual neón/CRT portado y sin ninguna lógica de juego.

## Scope

**In:**

- 5 rutas App Router: `/` (Biblioteca), `/juego/[id]` (Detalle), `/juego/[id]/jugar` (Reproductor), `/auth` (Auth), `/salon-de-la-fama` (Salón de la Fama).
- Componente `Nav` compartido montado en `app/layout.tsx`, con menú hamburguesa mobile funcional (abrir/cerrar).
- Navegación real entre pantallas: cards de juego → Detalle, botón JUGAR → Reproductor, links del Nav, botones "volver".
- Datos mock (`GAMES`, `CATS`, `PLAYERS`, `seededScores`) portados a TypeScript tipado.
- Tema visual completo (grid animado, scanlines, glows, paleta neón) portado a `app/globals.css` como CSS global con custom properties.
- Fuentes "Press Start 2P" y "JetBrains Mono" cargadas con `next/font/google`.
- Pantalla Reproductor como HUD estático (layout completo, valores fijos de ejemplo), sin `setInterval` ni loop de puntaje.
- Rutas y textos de UI en español, igual que el template de referencia.

**Out of scope (para specs futuras):**

- Lógica de juego real (canvas, física, colisiones) para cualquiera de los 8 juegos.
- Buscador funcional en Biblioteca (filtrado por texto).
- Filtro funcional por categoría (chips) en Biblioteca.
- Tabs funcionales en Salón de la Fama (cambio de juego/leaderboard).
- Formulario de Auth funcional (validación, registro, guardado de sesión).
- Persistencia real de puntuaciones (`onSaveScore`, scores en localStorage).
- Backend, autenticación real, base de datos.
- Diseño responsive exhaustivo más allá de lo que ya trae el template de referencia.

## Data model

Se portan las estructuras de `references/templates/data.jsx` a TypeScript, sin cambios de forma, solo tipado:

```ts
// lib/data.ts
export type GameCategory = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";

export interface Game {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: GameCategory;
  cover: string;
  color: "cyan" | "magenta" | "green" | "yellow";
  best: number;
  plays: string;
}

export interface ScoreRow {
  rank: number;
  name: string;
  score: number;
  date: string;
}

export const GAMES: Game[] = [ /* los 8 juegos del template de referencia */ ];
export const CATS: string[] = ["TODOS", "ARCADE", "PUZZLE", "SHOOTER", "VERSUS"];
export const PLAYERS: string[] = [ /* nombres del template de referencia */ ];
export function seededScores(seed: number, count?: number): ScoreRow[] { /* mismo algoritmo determinístico del template */ }
```

`seededScores` se mantiene como generador determinístico (pseudoaleatorio con seed), para que Detalle y Salón de la Fama muestren leaderboards estáticos y consistentes en cada render.

## Implementation plan

1. Configurar fuentes: reemplazar los `<link>` de Google Fonts por `next/font/google` (Press Start 2P, JetBrains Mono) en `app/layout.tsx`, junto a las Geist existentes.
2. Portar el tema a `app/globals.css`: custom properties (`--bg`, `--cyan`, `--magenta`, etc.), fondo animado (`.av-bg`), scanlines y el resto de clases de `references/templates/styles.css`.
3. Crear `lib/data.ts` con los datos mock tipados (`GAMES`, `CATS`, `PLAYERS`, `seededScores`).
4. Crear `components/nav.tsx`: puerto de `nav.jsx`, con estado local para abrir/cerrar el menú mobile. El botón "Iniciar Sesión" siempre navega a `/auth` (sin lógica de sesión).
5. Montar `Nav` y el footer en `app/layout.tsx`, reemplazando el layout actual.
6. Crear `components/game-card.tsx`: puerto de la card de `biblioteca.jsx`, incluyendo el efecto tilt al mover el mouse (interacción visual, no de datos).
7. Crear `app/page.tsx` (Biblioteca): grilla completa de `GAMES`; buscador y chips de categoría se renderizan pero no filtran.
8. Crear `app/juego/[id]/page.tsx` (Detalle): info del juego + leaderboard vía `seededScores`; botón JUGAR navega a `/juego/[id]/jugar`.
9. Crear `app/juego/[id]/jugar/page.tsx` (Reproductor): HUD estático con valores fijos, pantalla CRT decorativa, sin `setInterval`. Botón SALIR navega a `/juego/[id]`.
10. Crear `app/auth/page.tsx`: formulario con tabs "Iniciar sesión" / "Crear cuenta" (el cambio de tab es UI, no dato); los botones navegan a `/` sin guardar sesión.
11. Crear `app/salon-de-la-fama/page.tsx`: podio + tabla con `seededScores` del primer juego de `GAMES`; chips de juego se renderizan sin acción de cambio de tab.
12. Verificación final: `npm run lint`, `npx tsc --noEmit`, y recorrido manual navegando las 5 pantallas.

## Acceptance criteria

- [ ] `npm run dev` levanta la app sin errores en consola.
- [ ] `/` muestra la grilla de los 8 juegos con card, badge de categoría y mejor puntuación.
- [ ] Click en una card o en su botón JUGAR navega a `/juego/[id]` con el `id` correcto.
- [ ] `/juego/[id]` muestra info del juego y un leaderboard de 10 filas generado por `seededScores`.
- [ ] Botón "JUGAR AHORA" en Detalle navega a `/juego/[id]/jugar`.
- [ ] `/juego/[id]/jugar` muestra el HUD (jugador, puntuación, vidas, nivel) con valores fijos; el puntaje no cambia solo con el tiempo.
- [ ] Botón "SALIR" en Reproductor vuelve a `/juego/[id]`.
- [ ] `/auth` muestra el formulario con tabs "Iniciar sesión" / "Crear cuenta"; el click en cada tab cambia el contenido visible.
- [ ] `/salon-de-la-fama` muestra podio (top 3) y tabla completa con `seededScores` del primer juego.
- [ ] El menú hamburguesa en mobile abre y cierra el panel lateral.
- [ ] Los links del Nav (Biblioteca, Salón de la Fama) navegan a sus rutas correspondientes.
- [ ] `npm run lint` pasa sin errores.
- [ ] `npx tsc --noEmit` pasa sin errores.

## Decisions

- **Sí:** rutas reales de App Router (`/juego/[id]`, etc.) en vez de un router por hash. Es el patrón idiomático de Next.js y el proyecto ya usa App Router.
- **No:** replicar el hash-router de `app.jsx`. Iría contra la arquitectura ya elegida del proyecto.
- **Sí:** portar `styles.css` como CSS global con custom properties, y usar Tailwind solo para utilidades nuevas. Rehacer scanlines, glows y grid animado en utilidades Tailwind es mucho trabajo por ninguna ganancia visual.
- **No:** reescribir todo el tema en `theme.extend` de Tailwind. Descartado por costo/beneficio.
- **Sí:** navegación entre pantallas funcional (routing real), pero buscador, filtros, tabs y login sin lógica de datos. Es un MVP visual: se prueba el layout y el flujo de pantallas, no el comportamiento de datos.
- **No:** dejar toda la app 100% estática incluyendo la navegación. Un MVP sin poder pasar de pantalla no sirve para revisar el diseño.
- **Sí:** Reproductor sin `setInterval` de puntaje falso. El pedido explícito fue "sin ningún juego"; un loop que suma puntos solo simula gameplay, aunque sea falso.
- **Sí:** menú hamburguesa mobile funcional (abrir/cerrar). Es estado de UI/layout, no dato de negocio.
- **Sí:** `seededScores` se porta con su mismo algoritmo determinístico (no `Math.random()` puro), para que el leaderboard no cambie en cada render.
- **Sí:** slugs de ruta en español (`/juego/[id]`, `/salon-de-la-fama`), coherente con el resto del copy en español.
- **Sí:** fuentes con `next/font/google` en vez de `<link>` tags, siguiendo el patrón que ya usa el proyecto con Geist.

## What is **not** in this spec

- Lógica de juego real para cualquiera de los 8 juegos (canvas, física, colisiones, puntaje real).
- Buscador y filtro por categoría funcionales en Biblioteca.
- Tabs funcionales en Salón de la Fama.
- Formulario de Auth funcional (validación, registro, sesión persistida).
- Guardado real de puntuaciones.
- Backend, base de datos, autenticación real.

Cada uno de estos, si se implementa, va en su propio spec.
