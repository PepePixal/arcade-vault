# SPEC 02 — Home (landing)

> **Status:** Implementado
> **Depends on:** SPEC 01
> **Date:** 2026-09-09
> **Objective:** Portar la pantalla Home (landing con hero, features, preview de juegos, stats, actividad y precios) desde `references/templates/home-about/home.jsx`, reubicando la Biblioteca de `/` a `/juego` y actualizando el Nav.

## Scope

**In:**

- Nueva ruta `/` → Home (landing): hero, sección "Por qué Arcade Vault", preview de 6 juegos, stats, actividad en vivo (ticker + top jugadores), pricing/FAQ y CTA final.
- Biblioteca (contenido actual de `app/page.tsx`) migra de `/` a `/juego`, sin cambios de comportamiento respecto a SPEC 01.
- Animaciones "reveal on scroll" (`IntersectionObserver` + clase `.reveal`/`.in`) en las secciones de Home, igual que el template.
- Nuevas constantes mock en `lib/data.ts` tipadas: stats de Home, ticker de actividad reciente, top jugadores del día.
- Actualización de `components/nav.tsx`: agregar link "Inicio" (`/`) y cambiar el href de "Biblioteca" a `/juego`. El logo sigue apuntando a `/` (ahora Home).
- Porte del CSS de `references/templates/home-about/styles.css` a `app/globals.css`: clases de Home (`.home-*`, `.feature-*`, `.mini-*`, `.stat-*`, `.activity-*`, `.tick-*`, `.top-*`, `.pricing-*`, `.price-*`, `.pc-*`, `.faq-*`, `.final-*`).

**Out of scope (para specs futuras):**

- Pantalla "Acerca de" (`about.jsx` del template): hero de misión, highlights, divisor animado y formulario de contacto. Se implementa en un spec futuro propio.
- El link "Acerca de" en el Nav queda fuera hasta que exista la página; no se agrega ahora para no linkear a una ruta inexistente.
- Datos reales de actividad en vivo (ticker y top jugadores siguen siendo mock estático, no websockets ni polling).
- Cualquier lógica de juego real (sigue fuera, como en SPEC 01).
- Cambios al comportamiento ya existente de Biblioteca, Detalle, Reproductor, Auth o Salón de la Fama más allá de la ruta de Biblioteca.

## Data model

Se agregan nuevas constantes a `lib/data.ts` (no se modifican las existentes `GAMES`, `CATS`, `PLAYERS`, `seededScores`):

```ts
// lib/data.ts (adiciones)

export interface HomeStat {
  n: string; // valor grande, ej. "12+"
  u: string; // unidad/label pixel, ej. "JUEGOS"
  s: string; // subtítulo, ej. "Y CONTANDO"
}

export interface ActivityEntry {
  p: string; // jugador
  g: string; // juego
  s: number; // puntaje
  t: string; // hace X min
  c: "cyan" | "magenta" | "green" | "yellow";
}

export interface TopPlayerEntry {
  r: number; // rank
  p: string; // jugador
  s: number; // puntaje
}

export const HOME_STATS: HomeStat[] = [ /* mismos 3 bloques del template */ ];
export const RECENT_ACTIVITY: ActivityEntry[] = [ /* mismas 7 filas del template */ ];
export const TOP_PLAYERS_TODAY: TopPlayerEntry[] = [ /* mismas 5 filas del template */ ];
```

## Implementation plan

1. Portar a `app/globals.css` las clases de Home listadas en Scope, desde `references/templates/home-about/styles.css`.
2. Agregar `HomeStat`, `ActivityEntry`, `TopPlayerEntry` y sus constantes (`HOME_STATS`, `RECENT_ACTIVITY`, `TOP_PLAYERS_TODAY`) a `lib/data.ts`.
3. Crear `app/juego/page.tsx` con el contenido actual de `app/page.tsx` (Biblioteca), sin cambios de lógica.
4. Reescribir `app/page.tsx` como Home: hero con siluetas flotantes decorativas, sección features (4 tarjetas con ícono pixel), preview de 6 juegos (`GAMES.slice(0, 6)`) con mini-cards que navegan a `/juego/[id]`, sección stats (`HOME_STATS`), sección actividad (`RECENT_ACTIVITY` + `TOP_PLAYERS_TODAY`, con link a `/salon-de-la-fama`), sección pricing/FAQ con CTA a `/auth`, y CTA final a `/juego`. Usar `IntersectionObserver` para las clases `.reveal`/`.in` en cada sección.
5. Actualizar `components/nav.tsx`: agregar link "Inicio" (`/`); cambiar el href de "Biblioteca" a `/juego`; actualizar `isActive` para reflejar las rutas nuevas. Aplicar el mismo cambio en el panel mobile. No agregar "Acerca de" (fuera de alcance).
6. Revisar que ningún link interno roto quede apuntando a la vieja ruta `/` como Biblioteca (Detalle, Reproductor, Salón, Auth, Nav).
7. Verificación final: `npm run dev`, recorrido manual por las 6 pantallas (Home, Biblioteca, Detalle, Reproductor, Auth, Salón), `npm run lint`, `npx tsc --noEmit`.

## Acceptance criteria

- [x] `/` muestra la Home (hero, features, preview de juegos, stats, actividad, pricing, CTA final), no la Biblioteca.
- [x] `/juego` muestra la grilla completa de los 8 juegos (contenido que antes estaba en `/`), con buscador y chips visibles (sin filtrar, igual que SPEC 01).
- [x] Click en una mini-card de Home navega a `/juego/[id]` con el `id` correcto.
- [x] Botón "VER TODOS LOS JUEGOS" y CTA final de Home navegan a `/juego`.
- [x] Botones "CREAR CUENTA" y "EMPEZAR GRATIS" de Home navegan a `/auth`.
- [x] Link "VER SALÓN →" en la sección de actividad navega a `/salon-de-la-fama`.
- [x] Las secciones de Home aparecen con animación reveal al hacer scroll (clase `.in` se agrega al entrar en viewport).
- [x] El Nav muestra los links Inicio, Biblioteca, Salón de la Fama (sin "Acerca de"), en desktop y en el panel mobile.
- [x] El link "Biblioteca" del Nav apunta a `/juego` y se marca activo en `/juego` y en `/juego/[id]`.
- [x] El logo del Nav navega a `/` (Home).
- [x] `npm run lint` pasa sin errores.
- [x] `npx tsc --noEmit` pasa sin errores.

## Decisions

- **Sí:** Home toma la ruta raíz `/` y la Biblioteca se muda a `/juego`. Decisión explícita del usuario; técnicamente válido en Next.js App Router tener `app/juego/page.tsx` (listado) conviviendo con `app/juego/[id]/page.tsx` (detalle) sin colisión de rutas.
- **No:** dejar la Biblioteca en `/` y poner Home en `/inicio`. Se descartó porque se aleja de la intención del template (Home como landing/entrada del sitio) y no era la preferencia del usuario.
- **No:** implementar "Acerca de" en este spec. El usuario pidió explícitamente dejarla para un spec futuro propio.
- **No:** agregar el link "Acerca de" al Nav en este spec. Consecuencia directa de la decisión anterior — no tiene sentido linkear a una ruta que no existe todavía.
- **Sí:** nuevos mocks de Home (`HOME_STATS`, `RECENT_ACTIVITY`, `TOP_PLAYERS_TODAY`) centralizados en `lib/data.ts`, siguiendo el mismo patrón que `GAMES`/`CATS`/`PLAYERS` de SPEC 01, en vez de inline en el componente.
- **Sí:** animaciones reveal-on-scroll portadas igual que el template (mismo `IntersectionObserver`, mismo umbral `0.12`). Es parte del look & feel ya validado, sin lógica de negocio.
- **Sí:** el logo del Nav sigue apuntando a `/`, que ahora es Home en vez de Biblioteca — comportamiento estándar de "logo = inicio del sitio", sin cambios en el componente más allá del contenido del link "Biblioteca".

## Identified risks

- Migrar `/` de Biblioteca a Home puede dejar bookmarks o links externos rotos si alguien ya guardó `/` esperando la Biblioteca. Mitigación: no aplica en este proyecto (aún no tiene usuarios reales); no se agrega redirect porque no fue solicitado.
- El ticker de actividad (`RECENT_ACTIVITY`) es una lista estática: si se recarga la página, los "hace X min" no avanzan ni se recalculan. Aceptado porque es mock visual, igual que `seededScores` en SPEC 01.
