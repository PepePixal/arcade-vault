# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Arcade Vault** is an online gaming platform for competitive play, where users compete for the highest score. The project uses **Spec-Driven Development** (SDD) as its methodology, following the [fernando-skills](https://github.com/Klerith/fernando-skills) practices.

## Tech Stack

- **Next.js 16.3.4** with App Router (`app/` directory)
- **React 19.2.8** (latest)
- **TypeScript** (strict mode) with ES2017 target
- **Tailwind CSS 4** with PostCSS
- **ESLint 9** with Next.js config (web vitals + TypeScript)


## Project Structure

```
app/
├── layout.tsx          # Root layout with metadata, font setup (Geist)
├── page.tsx            # Home page
└── globals.css         # Global styles (Tailwind directives)

public/                 # Static assets (next.svg, vercel.svg, etc.)
eslint.config.mjs       # ESLint config (flat config format)
tsconfig.json           # TypeScript with path alias @/* -> ./
next.config.ts          # Next.js config (currently empty)
AGENTS.md               # Important Next.js 16 breaking changes
```

## Important: Next.js 16 Breaking Changes

This project uses **Next.js 16.3.4**, which has **breaking changes** from earlier versions. Before writing code:

1. Read `AGENTS.md` in this directory (auto-generated and re-added by `next dev`)
2. Check `node_modules/next/dist/docs/` for up-to-date Next.js API documentation
3. Pay attention to deprecation notices—APIs and conventions differ from training data

Do NOT rely on older Next.js patterns. Always verify in the project's local Next.js docs.

## TypeScript & Aliases

- **Path alias**: `@/*` → `./` (project root)
- **Strict mode**: Enabled (`noEmit: true`, `strict: true`)
- **jsx**: `react-jsx` (no `React` import needed)

## Development Workflow: Spec-Driven Design

This project follows SDD. Workflow:

1. **Explore** — investigate the problem and codebase
2. **Propose** — define the solution and its scope
3. **Spec** — write formal requirements and test scenarios
4. **Design** — describe architecture and approach
5. **Tasks** — break work into atomic, ordered items
6. **Apply** — implement following the spec and design
7. **Verify** — validate against spec; archive when done

Use `/sdd-*` commands in Claude Code (e.g., `/sdd-explore`, `/sdd-new`) to run phases.

## Styling & Theme

- Uses **Tailwind CSS 4** with the newer @tailwindcss/postcss plugin
- Layout has dark mode support (`.dark:` utilities)
- Geist font family (sans and mono variants from Google Fonts)
- Global styles in `app/globals.css`

## Linting

ESLint uses flat config format:

```bash
npm run lint
```

Config loads Next.js web-vitals and TypeScript rules from `eslint-config-next`. Global ignores: `.next/`, `out/`, `build/`, `next-env.d.ts`.

## Metadata & Build

- Home page metadata in `app/layout.tsx` (title, description)
- Build output goes to `.next/` (git-ignored)
- Static assets served from `public/`
- Always use /frontend-design to design the user interface.

## Common Tasks

### Add a new page
1. Create `app/[route]/page.tsx`
2. Export a default React component
3. Optionally add route-level metadata via `generateMetadata()` or `metadata`

### Run TypeScript check
```bash
npx tsc --noEmit
```

### View ESLint violations
```bash
npm run lint
```

### Update dependencies
```bash
npm install
```

## Notes for Future Work

- The project is freshly initialized from Create Next App. Core app structure is minimal.
- Focus on implementing game features per SDD specs.
- Remember to test against the breaking changes listed in AGENTS.md.
- Use TypeScript strictly—no `any` types without justification.
