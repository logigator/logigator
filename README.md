# Logigator

**Build, simulate, and manage complex logic circuits — [logigator.com](https://logigator.com)**

[![CI logigator-editor](https://github.com/logigator/logigator/workflows/CI%20logigator-editor/badge.svg)](https://github.com/logigator/logigator/actions?query=workflow%3A%22CI+logigator-editor%22)
[![CI logigator-api](https://github.com/logigator/logigator/workflows/CI%20logigator-api/badge.svg)](https://github.com/logigator/logigator/actions?query=workflow%3A%22CI+logigator-api%22)
[![CI format](https://github.com/logigator/logigator/workflows/CI%20format/badge.svg)](https://github.com/logigator/logigator/actions?query=workflow%3A%22CI+format%22)

Logigator is a browser-based logic circuit editor and simulator. Users can place gates and wires on a canvas, wire them together, run a simulation, and save/share their projects. The editor renders entirely on a PixiJS canvas; the backend persists projects and components as JSON and exposes a REST API consumed by the SPA.

---

## Table of Contents

- [Repository layout](#repository-layout)
- [Prerequisites](#prerequisites)
- [Local setup](#local-setup)
- [Configuration](#configuration)
- [Development workflow](#development-workflow)
- [Testing](#testing)
- [Production stack](#production-stack)
- [Architecture overview](#architecture-overview)
- [Contributing](#contributing)
- [License](#license)

---

## Repository layout

The repo root is a **Yarn 4 + Angular CLI workspace** (managed via Corepack), and every package is a member:

| Package               | Workspace member | Description                                                                                                                         | Stack                                             |
| --------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `logigator-editor/`   | ✅               | Active canvas editor (**current focus**)                                                                                            | Angular 22, PixiJS 8, Tailwind 4, `@logigator/ui` |
| `logigator-ui/`       | ✅               | `@logigator/ui` — in-house component library (replaces PrimeNG)                                                                     | Angular 22, Angular CDK                           |
| `logigator-core/`     | ✅               | `@logigator/core` — rendering-free circuit code (file format, model, catalog) shared by the editor, the API and migration tooling   | Plain TypeScript, zero runtime dependencies       |
| `logigator-contract/` | ✅               | `@logigator/contract` — the API surface as zod schemas, imported by the server for validation and by its clients for typed requests | TypeScript, zod                                   |
| `logigator-api/`      | ✅               | API-only backend                                                                                                                    | NestJS on Fastify, PostgreSQL + Drizzle           |
| `logigator-web/`      | ✅               | Website, server-rendered per request                                                                                                | Angular 22, `@angular/ssr`, `@logigator/ui`       |
| `logigator-docs/`     | ✅               | `@logigator/docs` — the documentation pages, their screenshots and the changelog parser, shared by the editor and the website       | Plain TypeScript, no dependencies                 |

**The three libraries are never built.** Every consumer — the editor, the API, and the test runners — compiles their TypeScript source through workspace path mapping, and each application's bundler inlines what it uses. So there is no build ordering, no `dist/` to go stale, and none of them is a `package.json` dependency of its consumers. Commands run inside Docker containers — do not run `yarn` directly on the host.

---

## Prerequisites

- [Docker](https://docs.docker.com/engine/install/) with the Compose plugin

That is the only host-level dependency. Node, Yarn, and all other tooling run inside the containers.

---

## Local setup

**1. Clone the repository**

```sh
git clone https://github.com/logigator/logigator.git
cd logigator
```

**2. Add the development hostname**

Append to `/etc/hosts` (Linux/macOS) or `C:\Windows\System32\drivers\etc\hosts` (Windows):

```
127.0.0.1 logigator.test
```

**3. Start all services**

```sh
docker compose up
```

The stack starts a Caddy reverse proxy on ports 80/443 with automatic self-signed certificates for local development. Open `https://logigator.test` in your browser.

**Services started by `docker compose up`:**

| Service    | Purpose                                      | Exposed port          |
| ---------- | -------------------------------------------- | --------------------- |
| `proxy`    | Caddy HTTPS reverse proxy                    | 80, 443               |
| `deps`     | One-shot `yarn install` for the workspace    | —                     |
| `editor`   | Editor dev server (HMR)                      | — (proxied)           |
| `web`      | Website dev server, server-rendered          | — (proxied)           |
| `api`      | API in watch mode, migrated before it starts | 3001 (localhost only) |
| `postgres` | PostgreSQL                                   | 5432 (localhost only) |
| `redis`    | Sessions and cache                           | 6379 (localhost only) |

---

## Configuration

The API is configured by environment variables alone — see `logigator-api/.env.example`. Every variable has a default that suits the dev stack, and the whole set is validated at startup; copy the file to `logigator-api/.env` to override any of them. The editor and the website need no configuration.

---

## Development workflow

All `yarn` commands are run via `docker compose exec`:

```sh
# Run a command in the editor container
docker compose exec editor yarn <command>
```

### Workspace (editor, UI library, shared packages, API)

The `editor` and `api` containers both mount the whole workspace root, so these root Yarn scripts run inside either:

| Command                                                                     | What it does                                                                  |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `yarn start:editor`                                                         | Angular dev server with HMR (`start:editor:prod` for the production config)   |
| `yarn start:api`                                                            | API in watch mode, restarting on core/contract edits too, on `127.0.0.1:3001` |
| `yarn build`                                                                | Both applications: editor production build + API bundle                       |
| `yarn build:editor`                                                         | Editor production build into `dist/logigator-editor/`                         |
| `yarn build:api`                                                            | Rspack bundle into `dist/logigator-api/`                                      |
| `yarn test`                                                                 | Every package's suite, single run each                                        |
| `yarn test:editor` / `test:ui` / `test:core` / `test:contract` / `test:api` | One package's Vitest suite                                                    |
| `yarn typecheck`                                                            | `tsc` over each shared package and the API, specs included                    |
| `yarn lint`                                                                 | ESLint across every workspace member (`lint:fix` writes the fixes)            |
| `yarn format` / `format:fix`                                                | Prettier over the whole repo                                                  |

A **bare verb runs it for every package that has it**, and `<verb>:<package>` runs it for one (`test:*` is always a single run) — there is no `:all` suffix and no bare shorthand for a single package. Not every package has every verb: only the two applications build, and `typecheck` covers the three packages where `tsc` is the only type gate, the Angular projects being type-checked by their own build and test targets. `@logigator/ui` has no build script at all, since every consumer compiles its source.

The shared packages are type-checked with **no consumer in the program and no path mappings**, which is what catches an Angular, PixiJS or sibling-package import leaking into shared code — a relative escape fails on `rootDir` too. Their ESLint configs fence the same imports by name.

Run a single test file:

```sh
docker compose exec editor yarn test:editor --include='**/quad-tree-container.spec.ts'
```

---

## Testing

Tests use **Vitest** via Angular's `@angular/build:unit-test` builder. Spec files sit next to their source files (e.g., `quad-tree-container.spec.ts` beside `quad-tree-container.ts`).

- Angular component specs use `TestBed`.
- Pure-logic specs (rendering math, grid utilities, action system) do not.

Shared test helpers in `logigator-editor/src/testing/`:

- `fake-browser-stores.ts` — in-memory IndexedDB stand-ins
- `factories.ts` — circuit-element and pointer-event stubs
- `action-mocks.ts` — mocked `Action` with named `do`/`undo` spies
- `vitest-helpers.ts` — asymmetric matchers and generator helpers

Run the full suite:

```sh
docker compose exec editor yarn test
```

---

## Production stack

`docker-compose.production.yaml` is the production stack: the website, the API and the editor behind one Caddy origin (`Caddyfile.production`), built from the `web`, `api` and `proxy` targets of the `Dockerfile`. Cloudflare is the edge. On the server it reaches the stack through a Cloudflare Tunnel, so nothing publishes a port; locally, an `edge` Caddy stands in for it and terminates TLS for `logigator.test` with the same `tls internal` certificate the dev stack uses.

The profile picks the edge, and the API's secrets come from the same `.env` next to the compose file:

```sh
# .env — a local staging run
COMPOSE_PROFILES=local
SESSION_SECRET=<32+ characters>

# .env — the server, in addition
COMPOSE_PROFILES=tunnel
LOGIGATOR_VERSION=<release, e.g. 2.3.0>
SITE_HOST=logigator.com
POSTGRES_PASSWORD=<…>
CLOUDFLARE_TUNNEL_TOKEN=<…>
```

Locally, the stack builds its images from the working tree:

```sh
docker compose -f docker-compose.production.yaml up -d --build
```

On the server, it runs the images the release workflow publishes for each `v*` tag (`ghcr.io/logigator/logigator-web`, `-api` and `-proxy`):

```sh
docker compose -f docker-compose.production.yaml pull
docker compose -f docker-compose.production.yaml up -d --no-build
```

The tunnel's public hostname points at `http://proxy:8080` in the Cloudflare dashboard. Every `up` migrates the database and seeds the examples before the API starts.

**Services started by the production stack:**

| Service    | Purpose                                               | Exposed port             |
| ---------- | ----------------------------------------------------- | ------------------------ |
| `tunnel`   | `cloudflared`, Cloudflare's way in (profile `tunnel`) | — (dials out)            |
| `edge`     | Caddy HTTPS in place of Cloudflare (profile `local`)  | 80, 443 (localhost only) |
| `proxy`    | Caddy origin: routing, the editor bundle, `/files`    | — (internal)             |
| `web`      | Website (SSR)                                         | — (proxied)              |
| `api`      | API                                                   | — (proxied)              |
| `migrate`  | One-shot: migrations and example seed                 | —                        |
| `postgres` | PostgreSQL                                            | — (internal)             |
| `redis`    | Sessions and cache                                    | — (internal)             |

Both compose files sit in the repo root and therefore share the Compose project name `logigator`, which has two consequences:

- **The two stacks cannot run at the same time.** `proxy`, `web`, `api`, `postgres`, and `redis` are service names in both, so starting one recreates those containers from the other's definitions. Bring the dev stack down first. Compose also warns about orphan containers left by the other stack — expected, and do not pass `--remove-orphans`, which deletes them.
- **The `caddy_data` volume is shared, deliberately.** The internal CA stores its local root there, so both stacks serve certificates from the CA the browser already trusts. Isolating the stack under its own project name would mint a second CA and trigger a new trust warning.

---

## Architecture overview

### Editor (`logigator-editor`)

The editor is an **Angular 22 SPA** where the circuit canvas is a **PixiJS 8** scene. Angular manages the UI shell (toolbar, panels, dialogs); PixiJS owns all circuit rendering.

Key layers in `src/app/`:

- **`components/`** — Circuit element model. Each gate/component extends `Component` (a PixiJS `Container` subclass); port/bounds math lives in the pure, unit-tested `component-geometry.ts`. `ComponentProviderService` acts as the registry and factory. Gate implementations live in `component-types/`; side-panel form controls in `component-options/`.
- **`project/`** — `Project` (extends PixiJS `Container`) is the root of the circuit state, exposing `viewport` (pan/zoom/camera) and `topology` (wire invariants). `ProjectService` tracks the loaded/active projects.
- **`persistence/`** — Load/save dispatch, file import/export, and cloud promotion. The server API transports the legacy positional format; local files use a native, versioned format with a migration chain.
- **`wires/`** — Wire model and rendering, separate from component objects.
- **`connection-points/`** — Derived visual junction dots (not persisted or selectable).
- **`rendering/`** — PixiJS scene management: the single lease-counted renderer, `QuadTreeContainer` for spatial indexing, `FloatingLayer` for transient objects (drag ghosts, previews), `GraphicsProviderService` for shared texture/graphics caching, plus the DOM input layer (`PointerController` + `WorkModeRouter` + per-tool sessions).
- **`clipboard/`** — Copy/cut/paste/delete, with paste opening an interactive placement session.
- **`actions/`** — Command-pattern undo/redo via `ActionManager`. Every user operation is an `Action` subclass.
- **`work-mode/`** — Interaction FSM (select, place, delete, wire-routing, simulation modes).
- **`simulation/`** — Compiles the circuit into a board, runs it on a WebAssembly engine in a Web Worker, and lights up powered wires/ports on the canvas.
- **`inspection/`** — Live component inspection during simulation (ROM data inspector, interactive custom-component watches).
- **`documentation/`** — In-editor help pages (per-locale markdown, deep-linked from menus and hints).
- **`ui/`** — Angular component wrappers around the canvas and sidebar panels.

**Coordinate system:** `Project._gridSpace` has `scale = gridSize`, so all circuit objects use **grid units as their native PixiJS `position`** — no manual pixel↔grid conversion at the model layer. Visual children live inside a per-component `_visualSpace` container with `scale = 1/gridSize`, keeping pixel-authored geometry correct.

**Simulation** runs the external `@logigator/sim` WASM engine inside a Web Worker. The active circuit is compiled into a board (nets, units, link ids), the engine free-runs in the worker, and the main thread pulls per-frame state snapshots to repaint powered wires/ports. See `simulation.md`.

Detailed technical docs for each subsystem are in `logigator-editor/docs/`:
`actions-system.md`, `component-system.md`, `component-options.md`, `connection-points.md`, `custom-components.md`, `dependencies-and-promotion.md`, `inspection.md`, `persistence.md`, `project.md`, `rendering.md`, `simulation.md`, `ui.md`, `wires.md`, `work-mode.md`.

### UI library (`logigator-ui`)

`@logigator/ui` is an in-house **Angular 22 + Angular CDK** component library. Each component lives in its own folder under `logigator-ui/src/` (`button/`, `dialog/`, `select/`, `menu/`, …) and is re-exported from `public-api.ts`. Imperative services — `DialogService` (dynamic dialogs), `ConfirmationService`, and `ToastService` (toasts) — sit alongside the declarative components, with shared overlay/focus plumbing in `internal/` and design tokens in `tokens/`.

Theming is **colors-only** via `--lg-*` CSS variables: `styles/theme.css` defines them and `styles/theme.tw.css` maps them into Tailwind's `@theme`. The editor imports the library straight from TypeScript source through workspace path mapping (`@logigator/ui` → `logigator-ui/src/public-api.ts`), so it is _not_ a `package.json` dependency of the editor and changes are picked up with no build step.

### Shared packages (`logigator-core`, `logigator-contract`)

`@logigator/core` holds the rendering-free half of the circuit code — the versioned native file format, its migration chain, the codecs, and the component catalog — so the editor, the API and the migration tooling agree on one implementation instead of three. Its boundary rule is **data to data**: turning live PixiJS objects into documents (and back) stays in the editor. It has zero runtime dependencies and no framework or renderer imports, enforced by an ESLint import fence plus a standalone `tsc` run that sees no consumer.

`@logigator/contract` describes the API surface as zod schemas. The server validates incoming requests with them; clients infer their request/response types from the same source, so a contract change fails at type-check time with no codegen step. It may import core, never the server.

Both are consumed from source through workspace path mapping (`@logigator/core` → `logigator-core/src/public-api.ts`), exactly like `@logigator/ui`. Editing a core source file therefore reaches every consumer with no build step: the editor's dev server rebuilds, and `yarn start:api` restarts the API in well under a second.

### API (`logigator-api`)

**NestJS on the Fastify adapter** — API only: no server-side rendering, no asset pipeline. Configuration comes from environment variables validated by a zod schema at bootstrap (`src/config/env.ts`), so a misconfigured deployment fails at startup rather than on the first request that needs a value. `GET /api/meta` reports the circuit-file format version the server accepts, taken from `@logigator/core`.

The build is **Rspack** (`rspack.config.mjs`, following [Rspack's NestJS guide](https://rspack.rs/guide/tech/nestjs)) into `dist/logigator-api/`, which is what lets the API compile the shared packages from source like every other consumer. NestJS 12 replaces its webpack builder with Rspack, so this is the direction upstream is taking; when v12 lands its CLI builder may replace this config.

Details worth knowing: `builtin:swc-loader` runs with `legacyDecorator` + `decoratorMetadata` because Nest resolves constructor dependencies from `design:paramtypes`; `tsconfig.json` owns the workspace aliases and the bundler reads them from there, so the two cannot drift; dependencies stay external except the workspace packages, which must be allowlisted past `webpack-node-externals` (Yarn symlinks them into `node_modules`); and minification stays off, since a long-running server gains nothing and Nest reflects on class names.

---

## Contributing

1. Fork the repository and create a feature branch.
2. Keep changes scoped to a single package where possible.
3. Run `yarn lint`, `yarn typecheck` and `yarn test` before opening a PR.
4. Open a pull request against `master`.

---

## License

This project is licensed under the **GNU Affero General Public License v3.0** — see the [LICENSE](LICENSE) file for details.
