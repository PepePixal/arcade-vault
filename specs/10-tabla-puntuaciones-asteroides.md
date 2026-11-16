# SPEC 10 — Tabla de puntuaciones de Asteroides en Supabase

> **Status:** Implementado
> **Depends on:** SPEC 04, SPEC 06, SPEC 09
> **Date:** 2026-11-16
> **Objective:** Crear en Supabase la tabla `scores_asteroides` con RLS, checks de validación y la vista `global_scores` para el ranking global, como base para migrar `lib/scores` en una spec futura.

## Scope

**In:**
- Migración SQL que crea `public.scores_asteroides` con sus checks e índices.
- RLS activado: SELECT público, INSERT para `anon` y `authenticated`, sin UPDATE ni DELETE desde cliente.
- Vista `public.global_scores` (puntuaciones de todos los juegos con su `game_id`), creada con `security_invoker = true`.
- Copia de la migración en `supabase/migrations/`.
- Tipos regenerados en `lib/supabase/database.types.ts`.
- Verificación con `get_advisors` (security y performance).

**Out of scope (para specs futuras):**
- Migrar `lib/scores` de `localStorage` a Supabase (SPEC 11): la app y la UI no cambian en este spec.
- Importar a la tabla las puntuaciones que ya existen en `localStorage`: se descartan.
- Tablas de puntuación de otros juegos (los juegos mock no son jugables).
- Autenticación real, antitrampas y moderación de nombres.
- Realtime de Supabase y paginación.

## Data model

Tabla `public.scores_asteroides`:

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK, `default gen_random_uuid()` | Equivale a `ScoreEntry.id` |
| `name` | `text not null` | Check: 1 a 12 caracteres, solo `A-Z`, `0-9`, espacio y guion, sin espacios en los bordes. Misma regla que `normalizeName` en `lib/scores` |
| `score` | `integer not null` | Check: `>= 0` |
| `level` | `integer not null` | Check: `>= 1`. Viene de `AsteroidsStats.level` |
| `created_at` | `timestamptz not null default now()` | Equivale a `ScoreEntry.createdAt` |

Índices:
- `(score desc, created_at asc)`: leaderboard del juego, con el orden de SPEC 06.
- `(created_at desc)`: últimas puntuaciones y ranking de hoy (SPEC 08).
- `(name)`: agrupación por jugador en el ranking global.

Vista `public.global_scores`:

```sql
create view public.global_scores with (security_invoker = true) as
  select 'asteroides'::text as game_id, id, name, score, level, created_at
  from public.scores_asteroides;
-- Cada juego nuevo añade su `union all select '<slug>' ...`
```

Convenciones:
- `gameId` y `createdAt` de `ScoreEntry` se mapean desde `game_id` y `created_at` en la capa `lib/scores` (spec futura); este spec no la toca.
- La tabla guarda el nombre ya normalizado. El `check` refleja la regla de la app como segunda barrera.
- `games.score_table` (SPEC 09) ya vale `scores_asteroides`; no hay clave foránea por ser un nombre de tabla, no un valor.

## Implementation plan

1. Aplicar con `apply_migration` la creación de `scores_asteroides`: columnas, checks, índices, `enable row level security` y las policies (SELECT para `anon` y `authenticated`; INSERT para `anon` y `authenticated`).
2. Crear la vista `global_scores` con `security_invoker = true`.
3. Guardar el mismo SQL en `supabase/migrations/<version>_create_scores_asteroides.sql`, usando la `version` real que devuelve `list_migrations`.
4. Regenerar los tipos con `generate_typescript_types` y actualizar `lib/supabase/database.types.ts`.
5. Ejecutar `get_advisors` (security y performance) y corregir los avisos que dependan de este spec.
6. Verificación: `list_tables`; con rol `anon`, un INSERT válido funciona y los inválidos se rechazan; UPDATE y DELETE afectan 0 filas; SELECT sobre la vista; limpiar las filas de prueba (bloque `DO` con rollback, como en SPEC 09); `npm run lint`, `npx tsc --noEmit` y `npm run build`.

## Acceptance criteria

- [ ] Existe `public.scores_asteroides` con las columnas, checks e índices de la sección Data model.
- [ ] RLS activado: `anon` puede leer e insertar, y no puede actualizar ni borrar.
- [ ] Un INSERT válido como `anon` se acepta.
- [ ] Se rechazan nombre vacío, de más de 12 caracteres, en minúsculas o con caracteres fuera de `A-Z`, `0-9`, espacio y guion; `score` negativo y `level` menor que 1.
- [ ] UPDATE y DELETE como `anon` afectan 0 filas.
- [ ] La vista `global_scores` devuelve las filas de `scores_asteroides` con `game_id = 'asteroides'` y respeta la RLS de la tabla.
- [ ] `supabase/migrations/` contiene la migración aplicada, con la `version` real.
- [ ] `lib/supabase/database.types.ts` incluye `scores_asteroides` y la vista.
- [ ] `get_advisors` no muestra errores críticos nuevos de seguridad en las tablas y vistas de este spec.
- [ ] La tabla queda sin filas de prueba al terminar.
- [ ] `lib/scores` y la UI no cambian: la app sigue usando `localStorage`.
- [ ] `npm run lint`, `npx tsc --noEmit` y `npm run build` pasan.

## Decisions

- **Sí (decisión del usuario):** una tabla de puntuación por juego (`scores_asteroides`), con `games` como catálogo (SPEC 09).
- **Sí (decisión del usuario):** este spec cubre solo la base de datos. Hacer que la app lea y escriba en Supabase va en un spec aparte, para que la app siga funcionando entre uno y otro.
- **Sí (decisión del usuario):** INSERT directo desde el navegador con RLS y checks en las columnas. Se descartó un route handler con validación en servidor: más código y sin ganancia real mientras no haya autenticación. Consecuencia aceptada: las puntuaciones son falsificables, igual que en SPEC 06.
- **Sí (decisión del usuario):** el ranking global se alimenta de la vista SQL `global_scores`; la suma de la mejor puntuación por jugador y juego seguirá en TypeScript, reutilizando `rankPlayers`. Se descartó calcularlo solo en cliente, que obliga a leer cada tabla por juego.
- **Sí (decisión del usuario):** las puntuaciones que ya están en `localStorage` se descartan. Son datos locales de pruebas y evitar la importación ahorra lógica y duplicados.
- **Sí (asumido):** `level` se conserva porque ya forma parte de `ScoreEntry` y viene del motor de Asteroides.
- **Sí (asumido):** el `check` del nombre replica la regla de `normalizeName` como segunda barrera; la normalización sigue haciéndose en la app.
- **Sí (asumido):** la vista usa `security_invoker = true` para no saltarse la RLS de las tablas que une.
- **Tradeoff aceptado:** cada juego nuevo exige su migración y ampliar la vista `global_scores`. Una tabla única con `game_id` evitaría eso, pero se mantuvo la decisión de tablas por juego.
- **No:** `lib/scores`, autenticación, antitrampas ni tablas de otros juegos en este spec.

## Identified risks

- **Riesgo:** INSERT anónimo falsificable y expuesto a spam. Mitigación: aceptado a corto plazo; los checks acotan los valores y un spec futuro añadirá autenticación y validación en servidor.
- **Riesgo:** la vista `global_scores` queda desactualizada si un juego nuevo no la amplía. Mitigación: cada spec de un juego nuevo incluye ampliar la vista entre sus pasos.
- **Riesgo:** el `check` del nombre diverge de `normalizeName` si cambia uno y no el otro. Mitigación: la spec que migre `lib/scores` verificará que ambas reglas coinciden.
- **Riesgo:** migración aplicada directo al proyecto remoto. Mitigación: tablas y vista nuevas, sin datos que perder; se revierte con `drop view` y `drop table`.
- **Riesgo:** el aviso de seguridad sobre `public.rls_auto_enable()` sigue abierto. Mitigación: es ajeno a este spec; se trata aparte.

## What is **not** in this spec

Migrar `lib/scores` a Supabase, importar datos de `localStorage`, tablas de otros juegos, autenticación, antitrampas, Realtime y paginación. Cada uno, si llega, va en su propio spec.
