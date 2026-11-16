# SPEC 09 — Tabla de juegos en Supabase

> **Status:** Implementado
> **Depends on:** SPEC 04, SPEC 05
> **Date:** 2026-11-16
> **Objective:** Crear en Supabase la tabla `games` (catálogo de juegos) con RLS de solo lectura y el juego `asteroides` como seed, como base para las tablas de puntuación por juego de specs futuras.

## Scope

**In:**
- Migración SQL que crea la tabla `public.games`.
- RLS activado en `games`: SELECT público (`anon` y `authenticated`), sin INSERT/UPDATE/DELETE desde cliente.
- Seed de la fila `asteroides`.
- Copia de la migración en `supabase/migrations/`.
- Tipos TypeScript generados en `lib/supabase/database.types.ts` y `createClient<Database>()` tipado en `lib/supabase/client.ts` y `lib/supabase/server.ts`.
- Verificación con `get_advisors` (security y performance).

**Out of scope (para specs futuras):**
- Tablas de puntuación por juego (`scores_asteroides`, etc.) y su vista de ranking global.
- Migrar `lib/scores` de `localStorage` a Supabase.
- Leer el catálogo desde la BD en la UI (`lib/data.ts` sigue siendo la fuente del front).
- Autenticación real de jugadores.

## Data model

Tabla `public.games`:

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `text` PK | Slug; coincide con `Game.id` de `lib/data.ts` (ej. `asteroides`) |
| `title` | `text not null` | |
| `short_description` | `text not null` | Equivale a `Game.short` |
| `long_description` | `text not null` | Equivale a `Game.long` |
| `category` | `text not null` | Check: `ARCADE`, `PUZZLE`, `SHOOTER`, `VERSUS` (`GameCategory`) |
| `cover` | `text not null` | Igual que `Game.cover` |
| `color` | `text not null` | Check: `cyan`, `magenta`, `green`, `yellow` |
| `score_table` | `text not null unique` | Nombre de la tabla de puntuación del juego (ej. `scores_asteroides`) |
| `created_at` | `timestamptz not null default now()` | |

Los valores del seed de `asteroides` se toman de la entrada existente en `GAMES` (`lib/data.ts`), sin reescribirlos.

## Implementation plan

1. Leer la entrada `asteroides` de `lib/data.ts` para el seed.
2. Aplicar la migración con `apply_migration`: `create table`, checks, `enable row level security`, policy `select` pública, seed.
3. Guardar el mismo SQL en `supabase/migrations/<timestamp>_create_games.sql`.
4. Generar tipos con `generate_typescript_types` → `lib/supabase/database.types.ts`; tipar los clientes con `Database`.
5. Ejecutar `get_advisors` (security y performance) y corregir avisos críticos.
6. Verificación: `list_tables` (tabla con RLS), SELECT con clave `anon` devuelve `asteroides`, INSERT/UPDATE/DELETE con `anon` rechazados, `npm run lint`, `npx tsc --noEmit`, `npm run build`.

## Acceptance criteria

- [ ] Existe `public.games` con las columnas y checks de la sección Data model.
- [ ] RLS activado; `anon` puede leer y no puede escribir.
- [ ] La fila `asteroides` existe y coincide con `lib/data.ts`.
- [ ] `supabase/migrations/` contiene la migración aplicada.
- [ ] `lib/supabase/database.types.ts` generado y los clientes usan `Database`.
- [ ] `get_advisors` sin errores críticos de seguridad en `games`.
- [ ] `npm run lint`, `npx tsc --noEmit` y `npm run build` pasan.

## Decisions

- **Sí (decisión del usuario):** una tabla `games` y una tabla de puntuación por juego (esta spec cubre solo `games`).
- **Sí (asumido):** `id` es el slug de texto, para que coincida con las rutas y con `GAMES[].id` sin mapeos.
- **Sí (asumido):** `score_table` guarda el nombre de la tabla de cada juego, para resolverla sin hardcodear en cada consulta.
- **Sí (asumido):** el catálogo del front sigue en `lib/data.ts`; la UI no lee de la BD en esta spec.
- **No:** no se crean tablas de puntuación ni se toca `lib/scores` aquí.

## Identified risks

- **Riesgo:** duplicar metadatos entre `lib/data.ts` y `games` y que diverjan. Mitigación: aceptado a corto plazo; una spec futura hace de la BD la única fuente.
- **Riesgo:** `score_table` es un nombre de tabla en texto y no tiene integridad referencial. Mitigación: `unique` + la spec de puntuaciones valida que la tabla exista.
- **Riesgo:** migración aplicada directo al proyecto remoto. Mitigación: es una tabla nueva y vacía, sin datos que perder; se revierte con `drop table`.

## What is **not** in this spec

Tablas de puntuación por juego, vista de ranking global, migración de `lib/scores` a Supabase, lectura del catálogo desde la BD y autenticación de jugadores. Cada uno, si llega, va en su propio spec.
