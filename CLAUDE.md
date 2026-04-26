# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Layout

Three independent packages — no workspace manager (no nx/turbo/lerna):

- `logigator-backend/` — Node.js/Express server (TypeScript, TypeORM, Handlebars templates)
- `logigator-editor/` — Legacy Angular 17 editor (PixiJS 7) — being replaced
- `logigator-editor-v2/` — Active Angular 21 editor (PixiJS 8, Tailwind 4, PrimeNG) — current focus

All packages use **Yarn 4** (corepack). Commands run inside Docker containers — do not run yarn directly on the host.

## Dev Environment

```bash
docker compose up   # starts Apache proxy, backend, editor-v2 dev server, MySQL, Redis
# Add to /etc/hosts: 127.0.0.1 logigator.test
```

Backend config files must be created from `.example` files in `logigator-backend/config/`.

The two service names that matter for exec:
- `editor` → logigator-editor-v2
- `backend` → logigator-backend

## Commands

All yarn commands run via `docker compose exec <service> yarn <command>`.

### logigator-editor-v2
```bash
docker compose exec editor yarn build          # production build + PureCSS tree-shaking
docker compose exec editor yarn test           # Karma + Jasmine (full suite)
docker compose exec editor yarn lint           # Angular ESLint + TypeScript strict
docker compose exec editor yarn format:fix     # Prettier
```

Run a single test file:
```bash
docker compose exec editor yarn test --include='**/quad-tree-container.spec.ts'
```

### logigator-backend
```bash
docker compose exec backend yarn build                              # tsc + Gulp asset pipeline
docker compose exec backend yarn lint:backend                      # ESLint on src/
docker compose exec backend yarn migration:run                     # run pending TypeORM migrations
docker compose exec backend yarn migration:generate -- -n Name     # generate migration
```

## Architecture

### Frontend (logigator-editor-v2)

Angular 21 standalone components + PixiJS 8 for canvas rendering.

**Key layers in `src/app/`:**

- `components/` — Circuit element model. Each component extends `Component` (which extends PixiJS `Container`). `ComponentProviderService` acts as a registry/factory. Specific gate implementations live in `component-types/`.
- `project/` — `Project` class (extends PixiJS `Container`) owns the circuit state. `ProjectService` manages the active project and persistence.
- `wires/` — Wire model and rendering, separate from components.
- `rendering/` — PixiJS scene management: `QuadTreeContainer` for spatial indexing of many elements, `FloatingLayer` for transient objects (selection box, placement preview), `GraphicsProviderService` for shared texture/graphics caching.
- `actions/` — Command pattern undo/redo via `ActionManager`. Each user operation is an `Action` subclass.
- `work-mode/` — Interaction mode FSM (selection, placement, deletion, wire routing).
- `ui/` — Angular component wrappers around the canvas and sidebar panels.

**Non-obvious patterns:**

- `setStaticDIInjector()` — bootstraps a static reference to Angular's injector so that model classes (`Component`, `Wire`, etc.) can call `inject()` without being Angular-managed. Used in `app.config.ts`.
- Grid coordinates vs. pixel coordinates — all circuit data is stored in grid units. `utils/` has conversion helpers. Grid snapping applies to all placements.
- `@logigator/logigator-simulation` — circuit simulation runs via this external npm package (separate repo, likely WASM). It is not in this monorepo.

### Backend (logigator-backend)

Express server with **routing-controllers** (decorator-based routing), **TypeDI** (DI container), **TypeORM** (MySQL), **Passport.js** (auth), **Handlebars** (legacy server-rendered pages).

- `src/controller/api/` — JSON REST API for projects, components, users, shares
- `src/controller/frontend/` — Handlebars-rendered pages (home, auth, community)
- `src/database/entities/` — TypeORM entities; circuit data itself is stored in `ProjectFile`/`ComponentFile` as JSON blobs (not raw DB columns)
- `src/services/` — Business logic, email, Redis session caching

### Backend ↔ Frontend interaction

The backend serves `logigator-editor-v2` as a static SPA at the editor domain. The SPA calls `/api/projects`, `/api/components`, etc. Project/component circuit data is serialized JSON stored via `ProjectFile`/`ComponentFile` entities.

## Testing

Tests use Karma + Jasmine. Spec files sit next to their source files (e.g., `quad-tree-container.spec.ts` next to `quad-tree-container.ts`). Angular component specs use `TestBed`; pure-logic specs do not.