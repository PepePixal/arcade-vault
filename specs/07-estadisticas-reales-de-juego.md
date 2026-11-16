# SPEC 07 — Estadísticas reales de juego

> **Status:** Implementado
> **Depends on:** SPEC 06
> **Date:** 2026-11-16
> **Objective:** Reemplazar los valores mock "Mejor global" y "Partidas" del detalle de juego, y la "Mejor puntuación" de las tarjetas de la biblioteca, por estadísticas calculadas desde `lib/scores`.

## Scope

**In:**

- Nueva función `getGameStats(gameId)` en `lib/scores/` que devuelve la mejor puntuación y la cantidad de partidas guardadas de un juego.
- Hook de cliente `useGameStats(gameId)` en `components/use-game-stats.ts` que carga esas estadísticas tras montar el componente.
- Franja de estadísticas del detalle (`app/juego/[id]/page.tsx`): "Partidas" y "Mejor global" pasan a leer datos reales mediante un client component nuevo, `components/game-stats.tsx`. "Dificultad" queda como está.
- Tarjeta de la biblioteca (`components/game-card.tsx`): "MEJOR PUNTUACIÓN" pasa a leer datos reales con el mismo hook.
- Sin partidas guardadas, ambos valores muestran `—`; mientras cargan, también `—`.
- "Partidas" cuenta partidas guardadas (entradas de `lib/scores`), no partidas jugadas.
- Eliminar los campos `best` y `plays` del tipo `Game` y de los 9 juegos de `GAMES` en `lib/data.ts`, ahora sin uso.

**Out of scope (para specs futuras):**

- Contar partidas jugadas pero no guardadas (exige registrar cada partida al terminar, fuera de `lib/scores` actual).
- Supabase y cualquier sincronización entre dispositivos.
- `RECENT_ACTIVITY` y `TOP_PLAYERS_TODAY` de la home (`app/page.tsx`), que siguen con datos mock.
- El campo "Dificultad" del detalle.
- Abreviar números grandes (`12.4K`); se muestran completos con formato `es-ES`.
- Modificar `seededScores` y los datos de `PLAYERS`.

## Data model

```ts
// lib/scores/types.ts
export interface GameStats {
  best: number | null; // mejor puntuación guardada, null si no hay ninguna
  plays: number;       // cantidad de partidas guardadas (0 si no hay)
}

// lib/scores/index.ts
export function getGameStats(gameId: string): Promise<GameStats>;

// components/use-game-stats.ts
export function useGameStats(gameId: string): GameStats | null; // null mientras carga
```

Cambio en `lib/data.ts`: se eliminan `best: number` y `plays: string` de `Game` y sus valores en `GAMES`. No se introducen otros campos.

Convenciones:

- `best` es el máximo de `score` entre las entradas del juego; `0` es un valor válido si es la única puntuación guardada.
- Formato: `toLocaleString("es-ES")` para ambos números, igual que en SPEC 06.

## Implementation plan

1. Agregar `GameStats` a `lib/scores/types.ts`, reexportarlo desde `lib/scores/index.ts` e implementar `getGameStats` leyendo las entradas ya validadas (`readAll`). Probar con un `localStorage` simulado: sin datos, con una entrada con puntuación 0 y con varias entradas.
2. Crear `components/use-game-stats.ts`: hook con `useEffect`, cancelación al desmontar y fallback a `{ best: null, plays: 0 }` si la lectura falla.
3. Crear `components/game-stats.tsx` (fragmento con los bloques "Partidas" y "Mejor global" que reutiliza las clases de la franja) y usarlo en `app/juego/[id]/page.tsx` en lugar de los valores mock. La página sigue siendo server component.
4. Conectar `components/game-card.tsx` a `useGameStats(game.id)` para el valor de "MEJOR PUNTUACIÓN".
5. Eliminar `best` y `plays` del tipo `Game` y de los 9 juegos en `lib/data.ts`, y confirmar con `npx tsc --noEmit` que no queda ningún uso.
6. Verificación final: `npm run dev`, recorrido manual (biblioteca, detalle sin datos, guardar una partida, volver a ambas vistas), `npm run lint`, `npx tsc --noEmit`.

## Acceptance criteria

- [ ] `getGameStats("asteroides")` devuelve `{ best: null, plays: 0 }` sin partidas guardadas.
- [ ] Tras guardar partidas de 500 y 900 puntos, devuelve `{ best: 900, plays: 2 }`.
- [ ] Una única partida guardada con 0 puntos devuelve `{ best: 0, plays: 1 }`.
- [ ] `/juego/asteroides` muestra en "Partidas" y "Mejor global" los valores reales, con formato `es-ES`, y siguen ahí tras recargar.
- [ ] `/juego/rocas` (cualquier juego mock) y Asteroides sin partidas muestran `—` en "Partidas" y en "Mejor global".
- [ ] La tarjeta de Asteroides en `/juego` muestra la mejor puntuación real, y las demás tarjetas muestran `—`.
- [ ] Tras guardar una puntuación nueva, al volver al detalle y a la biblioteca los valores se actualizan sin recargar manualmente.
- [ ] "Dificultad" y el resto del detalle no cambian.
- [ ] Con `localStorage` vacío o bloqueado, ninguna página lanza error y se ve `—`.
- [ ] `best` y `plays` ya no existen en `lib/data.ts` ni se referencian en ningún archivo.
- [ ] `npm run lint` pasa sin errores.
- [ ] `npx tsc --noEmit` pasa sin errores.

## Decisions

- **Sí (decisión del usuario):** "Partidas" cuenta partidas guardadas. Es el único dato real disponible sin tocar el motor ni el modal. Se descartó contar partidas jugadas porque exige registrar cada partida al terminar, lo que amplía el alcance a `asteroids-player` y al modelo de datos. Limitación documentada: una partida abandonada sin guardar no suma.
- **Sí (decisión del usuario):** sin datos se muestra `—` en ambos valores. Mantiene el layout y evita sugerir una puntuación de 0 que no existe. Se descartó mostrar `0` y ocultar el bloque.
- **Sí (decisión del usuario):** la tarjeta de la biblioteca también pasa a datos reales. Es el mismo dato (`best`); dejarlo mock dejaría la plataforma inconsistente entre biblioteca y detalle.
- **Sí (decisión del usuario):** eliminar `best` y `plays` de `Game` y de `GAMES`. Evita que se reutilicen por error y deja de haber números inventados en el código.
- **Sí (asumido, a confirmar al revisar la spec):** un hook compartido (`useGameStats`) en vez de cargar las estadísticas de todos los juegos de una vez. La biblioteca hace 9 lecturas de `localStorage` por render, que es despreciable; una función de lote se puede agregar cuando exista una base de datos real.
- **Sí (asumido):** abreviar números (`12.4K`) queda fuera; los mocks usaban ese formato, pero los datos reales se muestran completos.
- **Sí (previsión de futuro, indicada por el usuario):** las puntuaciones vendrán de Supabase. `getGameStats` es asíncrono y vive en `lib/scores/`, así que ese cambio sustituirá solo la implementación, sin tocar componentes. Con una base de datos, la consulta natural será un `count` y un `max` en lugar de leer todas las entradas.
- **No:** partidas jugadas no guardadas, Supabase y la home en este spec; cada uno merece el suyo.

## Identified risks

- **Hidratación SSR:** `localStorage` no existe en el servidor. Mitigación: los valores se cargan en `useEffect` y se muestra `—` hasta tenerlos, así que el HTML del servidor y el del primer render del cliente coinciden.
- **Valores desactualizados:** la tarjeta o el detalle podrían mostrar datos viejos tras guardar una partida. Mitigación: el hook lee al montar, y al navegar desde el juego los componentes se montan de nuevo.
- **Cambio de tipo `Game`:** eliminar campos rompe cualquier consumidor que no se haya detectado. Mitigación: `npx tsc --noEmit` y la búsqueda de usos forman parte del plan (paso 5).
- **Una partida abandonada no suma a "Partidas":** puede parecer un conteo bajo. Aceptado y documentado como limitación de este spec.

## What is **not** in this spec

- Contar partidas jugadas sin guardar.
- Supabase y sincronización entre dispositivos.
- Datos de actividad reciente y top del día de la home.
- El campo "Dificultad".
- Abreviación de números grandes.

Cada uno, si llega, va en su propio spec.
