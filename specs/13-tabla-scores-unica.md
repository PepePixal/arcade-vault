# SPEC 13 — Tabla única `scores`

> **Status:** Implementada
> **Depends on:** SPEC 09, SPEC 10, SPEC 11, SPEC 12
> **Date:** 2026-11-19
> **Objective:** Sustituir las tablas de puntuaciones por juego (`scores_asteroides`) por una única tabla `scores` que referencia a `games` mediante `game_id`, eliminando la vista `global_scores`, el mapa `SCORE_TABLES` y la columna `games.score_table`.

## Scope.

**In:**
- Migración nueva que crea la tabla `scores`:
  - `id uuid primary key default gen_random_uuid()`
  - `game_id text not null references games(id) on delete cascade`
  - `player_name text not null`, con los mismos checks que hoy tiene `name` en `scores_asteroides`: longitud entre 1 y 12, `^[A-Z0-9 -]+$` y `player_name = btrim(player_name)`.
  - `score integer not null check (score >= 0)`
  - `level integer not null check (level >= 1)`
  - `user_id uuid null references auth.users(id) on delete set null`
  - `created_at timestamptz not null default now()`
- Índices: `(game_id, score desc, created_at)`, `created_at` y `player_name`.
- RLS activo, con política de lectura pública y de inserción pública (como `scores_asteroides`), y `grant select, insert` explícito, porque `20261118104350_restrict_default_table_privileges.sql` revoca los privilegios por defecto.
- Migración de datos: copiar las filas de `scores_asteroides` a `scores` con `game_id = 'asteroides'`.
- Eliminación, en el mismo migración y en este orden: la vista `global_scores`, la tabla `scores_asteroides` y la columna `games.score_table`.
- Regenerar `lib/supabase/database.types.ts`.
- `lib/scores/index.ts`:
  - Eliminar `SCORE_TABLES` y `getScoreTable`.
  - `saveScore`, `getGameScores` y `getGameStats` leen y escriben en `scores` filtrando por `game_id`.
  - `fetchAllScores` y `getRecentScores` leen `scores` directamente, sin la vista.
  - `toScoreEntry` mapea `player_name` a `name`, para que la UI no cambie.
  - Se reutilizan `sanitizeName`, `normalizeName`, `rankPlayers` y `NAME_MAX_LENGTH` sin cambios.

**Out of scope (para specs futuras):**
- Autenticación real. `user_id` queda en `null` hasta que exista; hoy `app/auth/page.tsx` es un formulario simulado.
- Ranking o estadísticas por usuario.
- Cambios visuales en leaderboard, Salón de la Fama o home.
- Añadir juegos nuevos.
- Cambios en `lib/games.ts`: `GAME_COLUMNS` ya excluye `score_table`.

## Data model

```sql
create table public.scores (
  id          uuid primary key default gen_random_uuid(),
  game_id     text not null references public.games(id) on delete cascade,
  player_name text not null
    check (char_length(player_name) between 1 and 12
           and player_name ~ '^[A-Z0-9 -]+$'
           and player_name = btrim(player_name)),
  score       integer not null check (score >= 0),
  level       integer not null check (level >= 1),
  user_id     uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);
```

Convenciones:
- `game_id` es una clave foránea real. Evita puntuaciones huérfanas y reemplaza la convención `games.score_table`.
- Los datos existentes se conservan con `game_id = 'asteroides'`.

## Implementation plan

1. Crear la migración con la tabla, los índices, RLS, las políticas y los grants.
2. En la misma migración, copiar `scores_asteroides` a `scores`, y después eliminar `global_scores`, `scores_asteroides` y `games.score_table`.
3. Regenerar `lib/supabase/database.types.ts` con `mcp__supabase__generate_typescript_types`.
4. Actualizar `lib/scores/index.ts` según el scope. Antes de tocar nada, revisar `lib/scores/types.ts` para confirmar que la forma de `ScoreEntry` no cambia.
5. Verificación: `npx tsc --noEmit`, `npm run lint` y `npm run build`.

## Acceptance criteria

- [ ] Existe `public.scores` con FK a `games(id)` y `user_id` nullable referenciando `auth.users`.
- [ ] `scores_asteroides`, `global_scores` y `games.score_table` ya no existen.
- [ ] El número de filas de `scores` con `game_id = 'asteroides'` es igual al número de filas que tenía `scores_asteroides` antes de la migración.
- [ ] Guardar una puntuación de Asteroides crea una fila con `game_id = 'asteroides'` y `level` informado.
- [ ] El leaderboard, las estadísticas del juego, el Salón de la Fama y la actividad de la home muestran los mismos datos y el mismo aspecto que antes.
- [ ] RLS está activo y `get_advisors` no muestra avisos de seguridad nuevos.
- [ ] `npm run lint`, `npx tsc --noEmit` y `npm run build` pasan.

## Decisions

- **Sí (decisión del usuario):** se mantiene la columna `level`, aunque la tabla del curso no la incluye, porque la app la muestra y la usa.
- **Sí (asumido):** `user_id` es nullable con FK a `auth.users`, porque la app todavía no tiene autenticación real.
- **Sí (asumido):** los datos existentes se migran en lugar de empezar de cero.
- **Sí (asumido):** `on delete cascade` en `game_id`. Alternativa: `restrict`, que impide borrar un juego con puntuaciones.
- **Sí (asumido):** una sola tabla en lugar de una por juego. La vista `global_scores` deja de ser necesaria, porque basta con consultar `scores` directamente.
- **No:** mantener `scores_asteroides` o la vista en paralelo como respaldo.

## Identified risks

- **Riesgo:** la migración es destructiva (elimina tabla, vista y columna). Mitigación: los datos se copian antes de borrar, y la aplicación en el proyecto remoto requiere confirmación explícita del usuario.
- **Riesgo:** `user_id` queda siempre en `null` hasta que exista autenticación. Mitigación: aceptado; la columna está preparada para cuando llegue.
- **Riesgo:** `on delete cascade` borra puntuaciones si se elimina un juego. Mitigación: aceptado por ahora; si se prefiere protegerlas, cambiar a `restrict`.
- **Riesgo:** las specs 09 a 12 describen el esquema anterior. Mitigación: este spec las supersede en lo relativo a puntuaciones; no se modifican.
- **Riesgo:** el cambio en `lib/scores` puede romper consumidores que dependen de la vista. Mitigación: el mapper conserva la forma de `ScoreEntry`, y la verificación recorre todas las pantallas que consumen puntuaciones.

## What is **not** in this spec

Autenticación, ranking por usuario, cambios visuales, nuevos juegos y cualquier modificación de las specs anteriores. Cada uno, si llega, va en su propio spec.
