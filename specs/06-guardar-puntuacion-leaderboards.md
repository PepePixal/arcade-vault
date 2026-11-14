# SPEC 06 — Guardar puntuación y leaderboards reales

> **Status:** Aprobado
> **Depends on:** SPEC 01, SPEC 05
> **Date:** 2026-11-14
> **Objective:** Mostrar al terminar una partida de Asteroides un modal "FIN DEL JUEGO" que recoge el nombre del jugador y guarda su puntuación, alimentando el leaderboard del juego y el ranking global del Salón de la Fama a través de una capa `lib/scores` preparada para migrar a Supabase.

## Scope

**In:**

- Modal "FIN DEL JUEGO" sobre el canvas, según `references/guarda-puntuacion-juego.jpg`: título, "PUNTUACIÓN FINAL", puntuación grande, campo de nombre prellenado con `INVITADO`, botón `GUARDAR PUNTUACIÓN`, botón `JUGAR DE NUEVO` y botón `VOLVER AL VAULT`.
- Campo de nombre editable: máximo 12 caracteres, se convierte a mayúsculas, solo letras, números, espacio y guion. Se recuerda el último nombre usado (`localStorage`) como valor inicial de la siguiente partida; si no hay ninguno, `INVITADO`.
- Capa de datos `lib/scores/` con funciones asíncronas (`saveScore`, `getGameScores`, `getGlobalRanking`) y una implementación sobre `localStorage`. Los componentes solo conocen esta interfaz, nunca `localStorage`.
- Leaderboard por juego: la tabla de `app/juego/[id]/page.tsx` pasa a leer `getGameScores(id)` en lugar de `seededScores`.
- Salón de la Fama (`app/salon-de-la-fama/page.tsx`): las pestañas por juego pasan a ser funcionales, se agrega la pestaña `GLOBAL`, y podio y tabla leen de `lib/scores`.
- Ranking global: por jugador, la suma de su mejor puntuación en cada juego.
- Estado vacío ("Aún no hay puntuaciones") para los juegos sin partidas guardadas, incluidos los 8 juegos mock, y para el ranking global sin datos.
- El motor de Asteroides deja de dibujar el overlay "GAME OVER" en el canvas; el modal React lo reemplaza.
- Botón `JUGAR DE NUEVO` reinicia la partida desde el modal (nuevo método `restart()` en el motor). `VOLVER AL VAULT` navega a `/juego`.
- Después de guardar, el modal muestra confirmación y el botón de guardar queda deshabilitado para esa partida (una puntuación por partida).

**Out of scope (para specs futuras):**

- Supabase: tablas, RLS, lectura y escritura reales. Este spec solo deja la interfaz `lib/scores` lista para que un spec futuro cambie su implementación.
- Autenticación; el nombre es texto libre, sin cuentas ni verificación de identidad.
- Datos falsos: `seededScores`, `RECENT_ACTIVITY` y `TOP_PLAYERS_TODAY` de la home (`app/page.tsx`) no se tocan en este spec.
- Puntuaciones de los juegos mock (no son jugables).
- Detección de trampas, moderación de nombres o filtro de palabras.
- Límite de entradas por jugador, borrado o edición de puntuaciones guardadas.
- Paginación del leaderboard (se muestran las primeras N filas).
- Filtros por fecha (hoy, semana, histórico).

## Data model

```ts
// lib/scores/types.ts
export interface ScoreEntry {
  id: string;        // crypto.randomUUID()
  gameId: string;    // GAMES[].id, p. ej. "asteroides"
  name: string;      // 1–12 caracteres, mayúsculas, ya normalizado
  score: number;     // entero >= 0
  level: number;     // nivel alcanzado (viene de AsteroidsStats)
  createdAt: string; // ISO 8601
}

export interface GlobalRankingRow {
  rank: number;
  name: string;
  total: number;                       // suma de la mejor puntuación por juego
  games: number;                       // cantidad de juegos con puntuación
}

// lib/scores/index.ts (interfaz pública, sin saber de localStorage)
export type NewScore = Omit<ScoreEntry, "id" | "createdAt">;

export function saveScore(entry: NewScore): Promise<ScoreEntry>;
export function getGameScores(gameId: string, limit?: number): Promise<ScoreEntry[]>; // orden: score desc, createdAt asc
export function getGlobalRanking(limit?: number): Promise<GlobalRankingRow[]>;
```

Persistencia (implementación `localStorage`):

- Clave de scores: `arcade-vault:scores:v1`, valor JSON con `ScoreEntry[]`.
- Clave del último nombre: `arcade-vault:player-name:v1`, valor string.

Convenciones:

- Dos nombres son el mismo jugador si son iguales tras normalizar (mayúsculas, trim). No hay cuentas.
- Desempate en el ranking: mayor `total`; si empatan, la fecha más antigua de su mejor puntuación primero.
- Se aceptan puntuaciones de 0; no hay mínimo.

Contrato del motor (cambios sobre SPEC 05):

```ts
// lib/games/asteroids/engine.ts
export interface AsteroidsGame {
  // ...sin cambios
  restart(): void; // nueva partida: 3 vidas, nivel 1, puntuación 0
}
```

## Implementation plan

1. Crear `lib/scores/types.ts` y `lib/scores/index.ts` con la implementación `localStorage` (try/catch en lecturas y escrituras, validación del JSON leído, fallback a lista vacía). Probar con `saveScore` y `getGameScores` desde la consola del navegador.
2. Implementar `getGlobalRanking` en `lib/scores/` (mejor score por jugador y juego, suma, desempate). Probar con 2 jugadores y 2 `gameId` distintos.
3. Motor de Asteroides: agregar `restart()` y quitar el dibujo del overlay "GAME OVER" y su reinicio con `Espacio`. Verificar que la partida sigue pudiendo reiniciarse vía `restart()`.
4. Crear `components/game-over-modal.tsx`: modal con el diseño de la captura, campo de nombre con las reglas y estado "guardado". Recibe `score`, `onSave`, `onRestart`, `onExit`.
5. Integrar el modal en `components/asteroids-player.tsx`: se muestra cuando `status === "gameover"`, llama a `saveScore` en `onSave` con `gameId`, `name`, `score` y `level` de `onGameOver`, y conecta `JUGAR DE NUEVO` a `restart()` y `VOLVER AL VAULT` a `/juego`.
6. Conectar el leaderboard de `app/juego/[id]/page.tsx` a `getGameScores(id)` con estado vacío. Si la página es server component, extraer la tabla a un client component porque `localStorage` solo existe en el navegador.
7. Salón de la Fama: pestañas por juego funcionales, pestaña `GLOBAL` con `getGlobalRanking`, podio y tabla leyendo de `lib/scores`, estado vacío cuando no hay datos.
8. Verificación final: `npm run dev`, recorrido manual (jugar, guardar, ver tabla del juego y Salón de la Fama, recargar), `npm run lint`, `npx tsc --noEmit`.

## Acceptance criteria

- [ ] Al llegar a 0 vidas o pulsar FIN, aparece el modal "FIN DEL JUEGO" con la puntuación final de la partida.
- [ ] El canvas ya no dibuja el overlay "GAME OVER" ni reinicia la partida con `Espacio` mientras el modal está abierto.
- [ ] El campo de nombre aparece con `INVITADO` la primera vez y con el último nombre guardado en las partidas siguientes.
- [ ] El campo convierte a mayúsculas, rechaza caracteres fuera de letras, números, espacio y guion, y no admite más de 12 caracteres.
- [ ] Con el nombre vacío (o solo espacios) el botón `GUARDAR PUNTUACIÓN` está deshabilitado.
- [ ] Pulsar `GUARDAR PUNTUACIÓN` guarda una entrada en `arcade-vault:scores:v1` con `gameId: "asteroides"`, el nombre normalizado, la puntuación y el nivel, y muestra una confirmación.
- [ ] Tras guardar, el botón de guardar queda deshabilitado y no se puede guardar dos veces la misma partida.
- [ ] `JUGAR DE NUEVO` cierra el modal y empieza una partida con HUD en 3 vidas, nivel 1 y puntuación 0.
- [ ] `VOLVER AL VAULT` navega a `/juego`; sin guardar, la puntuación no se persiste.
- [ ] `/juego/asteroides` muestra la puntuación guardada en su leaderboard, ordenada de mayor a menor, y sigue mostrándola tras recargar la página.
- [ ] `/juego/[id]` de cualquier juego mock muestra el estado vacío en su leaderboard.
- [ ] `/salon-de-la-fama` muestra una pestaña por juego que cambia la tabla al pulsarla, y una pestaña `GLOBAL`.
- [ ] Con dos nombres y puntuaciones guardadas, la pestaña `GLOBAL` los ordena por la suma de su mejor puntuación por juego.
- [ ] Si un jugador guarda dos puntuaciones en Asteroides, el ranking global cuenta solo la mejor.
- [ ] Con `localStorage` vacío o bloqueado, ninguna página lanza error y los leaderboards muestran el estado vacío.
- [ ] Ningún componente fuera de `lib/scores/` lee o escribe `localStorage` para puntuaciones.
- [ ] `npm run lint` pasa sin errores.
- [ ] `npx tsc --noEmit` pasa sin errores.

## Decisions

- **Sí (decisión del usuario):** `localStorage` detrás de la interfaz `lib/scores`. Los leaderboards muestran datos reales desde ya y la migración a Supabase consiste en reemplazar la implementación, sin tocar componentes. Se descartó guardar solo en memoria (se pierde al recargar) y solo capturar el nombre (el modal quedaría sin efecto visible).
- **Sí (decisión del usuario):** reemplazar `seededScores` por datos reales en los leaderboards de juego y Salón de la Fama. Se descartó mezclar reales y falsas para no confundir datos inventados con partidas verdaderas; a cambio los leaderboards empiezan vacíos.
- **Sí (decisión del usuario):** ranking global como pestaña `GLOBAL` del Salón de la Fama, no como ruta nueva. Una sola página para ambos rankings y sin tocar el Nav.
- **Sí (decisión del usuario):** global = suma de la mejor puntuación por jugador y juego. Se descartó la lista plana de partidas (domina el juego de puntajes más altos) y la suma de todas las partidas (premia jugar mucho, no jugar bien).
- **Sí (decisión del usuario):** el modal reemplaza al overlay "GAME OVER" del canvas. Una sola pantalla de fin; el motor sigue sin conocer la plataforma.
- **Sí (decisión del usuario):** nombre editable, máximo 12 caracteres, prellenado con `INVITADO` y recordando el último usado.
- **Sí (decisión del usuario):** solo Asteroides tiene datos reales; los 8 juegos mock muestran estado vacío, porque no son jugables.
- **Sí (asumido, a confirmar al revisar la spec):** una puntuación por partida (el botón se deshabilita tras guardar), para evitar duplicados accidentales.
- **Sí (asumido):** jugador = nombre normalizado, sin cuentas. Dos personas con el mismo nombre se cuentan como una; se resolverá con Auth en un spec futuro.
- **Sí (asumido):** `VOLVER AL VAULT` va a `/juego` (la biblioteca), y se permite salir sin guardar.
- **Sí (asumido):** `restart()` en el motor en vez de remontar el componente, para conservar el canvas y los listeners sin reiniciar el efecto de React.
- **Sí (previsión de futuro, indicada por el usuario):** las puntuaciones se almacenarán y leerán de Supabase. Por eso `lib/scores` es asíncrono desde ya aunque `localStorage` sea síncrono, y `ScoreEntry` ya incluye `id`, `gameId` y `createdAt`, que mapean directo a una tabla.
- **No:** Supabase, Auth ni antitrampas en este spec; cada uno merece el suyo.

## Identified risks

- **`localStorage` es local al navegador:** los rankings no se comparten entre usuarios ni dispositivos y se pueden manipular desde la consola. Aceptado: es el paso previo a Supabase.
- **Hidratación SSR:** `localStorage` no existe en el servidor; leerlo en un server component rompe el build. Mitigación: las tablas son client components que cargan en `useEffect` y muestran un estado de carga breve.
- **`localStorage` bloqueado o JSON corrupto:** modo privado o datos manipulados. Mitigación: try/catch, validar forma de cada entrada y caer a lista vacía.
- **Teclado dentro del modal:** el motor captura flechas y `Espacio` en `window`; escribir un nombre con espacios no debe disparar la nave ni hacer scroll. Mitigación: con el modal abierto el motor ya está en `gameover`, y el campo de texto no propaga las teclas al motor.
- **Cambio de contrato del motor:** `restart()` y la eliminación del overlay modifican SPEC 05. Se resuelve en este spec y el criterio de aceptación de reinicio cubre la regresión.

## What is **not** in this spec

- Supabase, tablas, RLS y sincronización entre dispositivos.
- Autenticación y cuentas de usuario.
- Datos de actividad reciente y top del día en la home.
- Puntuaciones para los juegos mock.
- Filtros por fecha, paginación y antitrampas.

Cada uno, si llega, va en su propio spec.
