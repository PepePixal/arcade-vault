# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Arcade Vault** is an online gaming platform where players compete for the highest score. It ships four playable browser games (Asteroides, Tetris, Arkanoid, Snake), per-game leaderboards and stats, a global Hall of Fame, and live activity on the home page, all backed by **Supabase**.

The project follows **Spec-Driven Development** using the [fernando-skills](https://github.com/Klerith/fernando-skills) practices (`/spec` and `/spec-impl`). UI copy and routes are in Spanish; code, identifiers and comments are in English.

## Tech Stack

- **Next.js 16.3.4** with App Router (`app/`)
- **React 19.2.8**
- **TypeScript** (strict mode, ES2017 target)
- **Tailwind CSS 4** via `@tailwindcss/postcss`
- **Supabase** (`@supabase/ssr`, `@supabase/supabase-js`): Postgres database for games and scores
- **Resend**: contact form emails (`app/api/contact/route.ts`)
- **ESLint 9** (flat config, Next.js web vitals + TypeScript)

## Project Structure

```
app/
├── layout.tsx, page.tsx, globals.css, error.tsx
├── acerca-de/             # About + contact form
├── api/contact/route.ts   # POST: sends the contact form through Resend
├── auth/                  # Auth screen
├── juego/
│   ├── page.tsx           # Game library (search + category filters)
│   ├── [id]/page.tsx      # Game detail: stats + leaderboard (reads `games`)
│   └── <game>/            # One folder per game: asteroides, tetris, arkanoid, snake
│       ├── engine.ts      # Pure canvas engine
│       ├── <game>-player.tsx  # Client player: HUD, controls, game over modal
│       └── jugar/page.tsx # Server page: getGame(id) → notFound() or player
├── salon-de-la-fama/      # Global Hall of Fame
└── supabase-check/        # Supabase connectivity diagnostic page

components/
├── games/      # game-card, library, game-leaderboard, game-stats, game-over-modal, use-game-stats,
│               # skin-picker, mobile-stats-bar, mobile-game-controls, virtual-gamepad, skin-select
├── hall-of-fame/
├── home/       # home-view, home-activity (real recent activity)
└── layout/nav.tsx

lib/
├── data.ts         # Game / GameCategory types, HOME_STATS
├── games.ts        # Game catalog from the `games` table (SERVER ONLY)
├── scores/         # Public score API (client): saveScore, getGameScores, getGameStats,
│                   # getGlobalRanking, getTodayRanking, getRecentScores, player-name helpers
└── supabase/       # client.ts (browser), server.ts (cookies), middleware.ts, database.types.ts

proxy.ts            # Next 16 "proxy" (former middleware): refreshes the Supabase session
specs/              # Numbered specs NN-slug.md + .spec-config.yml
supabase/migrations/  # SQL migrations (games, scores, privileges, one row per game)
references/         # Design templates, original started-games, source assets (not built),
                    # implemented-games.md, game-suggestions-todo.md (game-planner memory)
```

## Important: Next.js 16 Breaking Changes

This project uses **Next.js 16.3.4**, which has **breaking changes** from earlier versions. Before writing code:

1. Read `AGENTS.md` in this directory (auto-generated and re-added by `next dev`)
2. Check `node_modules/next/dist/docs/` for up-to-date Next.js API documentation
3. Pay attention to deprecation notices—APIs and conventions differ from training data

Known example: middleware lives in `proxy.ts` and exports `proxy()`, not `middleware()`. Route `params` are a `Promise` and must be awaited.

## Data Layer (Supabase)

- **`games`** table: the game catalog (`id, title, short_description, long_description, category, cover, color`). `category` ∈ `ARCADE|PUZZLE|SHOOTER|VERSUS`, `color` ∈ `cyan|magenta|green|yellow`. Library, detail page, home and Hall of Fame all read it.
- **`scores`** table: single shared table for every game, filtered by `game_id` (FK to `games.id`). Constraints: `score >= 0`, `level >= 1`. Per-game score tables and `games.score_table` no longer exist (removed in spec 13).
- `lib/games.ts` uses the cookie-based server client → import it only from server components.
- `lib/scores` uses the browser client → components depend only on its async functions, never on Supabase directly. Only the last player name stays in `localStorage`.
- Regenerate `lib/supabase/database.types.ts` after schema changes (Supabase MCP `generate_typescript_types`).
- Supabase MCP is configured in `.mcp.json`. **Applying a migration to the remote project requires explicit user confirmation.** Run Supabase advisors after any migration.

### Environment variables

Copy `.env.template` to `.env.local` (gitignored, never commit it):

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_DB_PASSWORD`, `RESEND_API_KEY`, `CONTACT_TO_EMAIL`.

## Game Integration Pattern

Every game follows the same contract (full detail in `.claude/skills/add-game/references/integration-blueprint.md`; the code wins over that file):

1. **Engine** `app/juego/<id>/engine.ts`: factory `createXGame(canvas, callbacks)` returning `start, pause, resume, end, restart, destroy`. Callbacks: `onStats`, `onStatus`, `onGameOver`. No module globals, no Supabase or `lib/data.ts` imports. Fixed internal canvas resolution, scaled by CSS.
2. **Player + page**: `<id>-player.tsx` (client, platform HUD, PAUSA / FIN / SALIR, `GameOverModal`, `saveScore`) and `jugar/page.tsx` (server, `getGame(id)` + `notFound()`).
3. **Catalog**: one migration inserting the row in `public.games`. No new route and no new score table.
4. **Styles**: `.cover-<id>` in `app/globals.css`; the canvas fits `.crt-screen`. Game assets go in `public/<id>/`.
5. **Mobile** (< 768px, spec 17): the player hides the desktop HUD with `className="player-hud max-md:hidden!"` (the `!` is required: unlayered `.player-hud` CSS beats Tailwind utilities), renders `<MobileStatsBar>` right before `.crt` and `<MobileGameControls>` right after, and declares `const ACTION_A: VirtualKey | null` (the key for button A, or `null` to disable it; B is always Space, the D-pad sends arrows). PAUSA / FIN logic lives in event-free functions shared by the desktop HUD and the mobile controls. The virtual gamepad dispatches synthetic `KeyboardEvent`s (`key` + `code`) on `window`, so engines need no changes but must listen on `window`. Nav, footer and CRT frame adapt via CSS (`body:has(.av-player)`).

## Development Workflow: Spec-Driven Development

Specs live in `specs/NN-slug.md` (currently 01–17). Project skills in `.claude/skills/`:

| Command | What it does |
|---------|-------------|
| `/spec <feature>` | Guided spec designer. Asks clarifying questions, builds the spec section by section from `template.md`, saves it with state `Borrador`. Never writes code. |
| `/spec-impl <NN-slug>` | Implements a spec only if its state means "Approved". Creates/switches to branch `spec-NN-slug` (controlled by `AutoCreateBranch` in `specs/.spec-config.yml`) and implements step by step with diff review pauses. |
| `/add-game <name>` | Generates ONLY the spec to integrate a new game (from `references/started-games/` or from scratch), following the integration blueprint. |

Project agents in `.claude/agents/`:

| Agent | What it does |
|-------|-------------|
| `game-planner` | Plans and decides which new game fits the platform. Reads the real catalog, scores 1–3 candidates (main weight: category diversity, 2D canvas feasibility, recognition as a classic) and recommends one. Its memory is the To Do list `references/game-suggestions-todo.md` (`[ ]` pending, `[x]` implemented, `[-]` discarded); it reads it before suggesting and never repeats a pending or discarded game. Never writes code or specs; next step is `/add-game <id>`. |
| `game-jam` | Invents a new original game from a given theme and writes two alternative specs of the same game (same `id` and integration contract, different game design: mechanics, controls, scoring, lives/level mapping, visual style) in `specs/game-jam/<game-id>/spec-a-<slug>.md` and `spec-b-<slug>.md`, with status `Borrador` and no `NN` number. Never writes code. Next step: pick one, move it to `specs/NN-<slug>.md`, approve it and run `/spec-impl`. |
| `skin-designer` | Audits that every game has the three skins `clasico` (current look), `neon` and `retro`, all readable on the dark platform background. Unlike the other agents, it **writes code**: shared `lib/skins.ts` (types + `localStorage` persistence) and `components/games/skin-picker.tsx`, plus per game `app/juego/<id>/skins.ts`, palette-driven `engine.ts` with `setSkin()`, and the picker in the player HUD. Implements one game per run; if several games lack skins and none was named, it only reports and asks which one. Runs lint, tsc and build; never commits. |
| `mobile-porter` | Audits that every game follows the spec 17 mobile pattern (`player-hud max-md:hidden!`, `MobileStatsBar` before `.crt`, `MobileGameControls` after it, `ACTION_A`, event-free `pauseOrResume` / `finishGame`, engine listening on `window`) and ports one new game per run, using `tetris-player.tsx` as reference. **Writes code** only in the game's player; never touches `engine.ts`, shared mobile components or mobile CSS (stops and reports if the engine is incompatible). If several games fail and none was named, it only reports and asks which one. Runs lint, tsc and build; never commits. |

Typical flow: `game-planner` (choose the game) → `/spec` (or `/add-game`) → review → mark the spec as approved → `/spec-impl` → verify → PR to `main`. Game jam flow: `game-jam` with a theme → pick spec A or B → move it to `specs/NN-<slug>.md` → approve → `/spec-impl`.

Other conventions:
- **Always use `/frontend-design` to design the user interface.**
- Commits: conventional commits (or the project's `spec-NN-...` style), never AI attribution.

## Verification

Before closing a spec or PR:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

Plus a manual walkthrough of the affected flow (e.g. for a game: library → detail → play → game over → save → leaderboard → exit). There is no automated test suite yet.

## TypeScript & Aliases

- **Path alias**: `@/*` → `./` (project root)
- **Strict mode**: Enabled (`noEmit: true`, `strict: true`)
- **jsx**: `react-jsx` (no `React` import needed)
- No `any` without justification; narrow DB string columns to union types (see `lib/games.ts`).

## Styling & Theme

- Tailwind CSS 4 plus custom retro/CRT classes in `app/globals.css` (`.cover-*`, `.crt-screen`, per-game canvas classes)
- Geist font family (sans and mono)
- Visual references in `references/templates/`

## Common Tasks

### Run the app
```bash
npm run dev   # http://localhost:3000
```

### Add a new page
1. Create `app/[route]/page.tsx` exporting a default component
2. Optionally add `metadata` or `generateMetadata()`

### Add a new game
Optionally ask the `game-planner` agent which game to add, then run `/add-game <name>`, approve the spec, then `/spec-impl <NN-slug>`.
