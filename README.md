# Logigator

**Build, simulate, and manage complex logic circuits — [logigator.com](https://logigator.com)**

[![CI logigator-backend](https://github.com/logigator/logigator/workflows/CI%20logigator-backend/badge.svg)](https://github.com/logigator/logigator/actions?query=workflow%3A%22CI+logigator-backend%22)
[![CI logigator-editor](https://github.com/logigator/logigator/workflows/CI%20logigator-editor/badge.svg)](https://github.com/logigator/logigator/actions?query=workflow%3A%22CI+logigator-editor%22)

Logigator is a browser-based logic circuit editor and simulator. Users can place gates and wires on a canvas, wire them together, run a simulation, and save/share their projects. The editor renders entirely on a PixiJS canvas; the backend persists projects and components as JSON and exposes a REST API consumed by the SPA.

---

## Table of Contents

- [Repository layout](#repository-layout)
- [Prerequisites](#prerequisites)
- [Local setup](#local-setup)
- [Configuration](#configuration)
- [Development workflow](#development-workflow)
- [Testing](#testing)
- [Architecture overview](#architecture-overview)
- [Contributing](#contributing)
- [License](#license)

---

## Repository layout

Three independent packages — no workspace manager:

| Package | Description | Stack |
|---|---|---|
| `logigator-backend/` | REST API + server-rendered pages | Node.js, Express, TypeORM, Handlebars |
| `logigator-editor-v2/` | Active canvas editor (**current focus**) | Angular 21, PixiJS 8, Tailwind 4, PrimeNG |
| `logigator-editor/` | Legacy editor (being replaced) | Angular 17, PixiJS 7 |

All packages use **Yarn 4** (managed via Corepack). Commands run inside Docker containers — do not run `yarn` directly on the host.

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

**2. Create config files**

Copy every `.example` file in `logigator-backend/config/` and remove the `.example` suffix:

```sh
for f in logigator-backend/config/*.example; do cp "$f" "${f%.example}"; done
```

Edit the copies as needed — see [Configuration](#configuration) for details.

**3. Add the development hostname**

Append to `/etc/hosts` (Linux/macOS) or `C:\Windows\System32\drivers\etc\hosts` (Windows):

```
127.0.0.1 logigator.test
```

**4. Start all services**

```sh
docker compose up
```

The stack starts an Apache reverse proxy on ports 80/443. Open `https://logigator.test` in your browser. Accept the self-signed certificate (the key/cert pair in `docker/development/` is pre-generated for local use only).

**Services started by `docker compose up`:**

| Service | Purpose | Exposed port |
|---|---|---|
| `proxy` | Apache HTTPS reverse proxy | 80, 443 |
| `backend` | Node.js API + dev server | — (proxied) |
| `editor` | Angular dev server (HMR) | — (proxied) |
| `mysql` | MySQL 8 database | 3306 (localhost only) |
| `redis` | Session / cache store | — (internal) |
| `redis_ui` | Rebrow Redis browser UI | 5001 |

---

## Configuration

All config files live in `logigator-backend/config/`. Create each from its `.example` counterpart.

### `environment.json`

```jsonc
{
  "context": "development",   // "development" or "production"
  "port": 3000,
  "editor": "resources/editor",
  "enableErrorReportsFile": false,
  "sendErrorReportsAsEmail": false,
  "reportErrorLogFile": "report-error-log.txt",
  "adminEmailAddresses": []
}
```

### `domains.json`

```jsonc
{
  "rootUrl": "http://logigator.test",
  "editor": "/editor"
}
```

### `ormconfig.json`

Database connection. The defaults match the MySQL container credentials in `docker-compose.yaml` — no changes needed for local development.

```jsonc
{
  "type": "mysql",
  "host": "mysql",
  "port": 3306,
  "username": "logigator",
  "password": "logigator",
  "database": "logigator"
}
```

### `passport.json`

OAuth credentials for social login. Leave the placeholder values to disable OAuth in development; fill them in to enable Google or Twitter login.

```jsonc
{
  "google": { "clientID": "--", "clientSecret": "--", "callbackURL": "http://logigator.test/..." },
  "twitter": { "consumerKey": "--", "consumerSecret": "--", "callbackURL": "http://logigator.test/..." }
}
```

### `nodemailer.json`

SMTP credentials for transactional email (password reset, etc.). Not required for local development unless you need to test email flows.

### `redis.json`

Redis connection URL. The default `redis://redis:6379` matches the Docker network — no changes needed locally.

### `session.json`

```jsonc
{
  "secret": "change-me-in-production",
  "maxAge": 2592000000   // 30 days in ms
}
```

Use a strong random string for `secret` in any non-local environment.

---

## Development workflow

All `yarn` commands are run via `docker compose exec`:

```sh
# Run a command in the editor container
docker compose exec editor yarn <command>

# Run a command in the backend container
docker compose exec backend yarn <command>
```

### Editor (`logigator-editor-v2`)

| Command | What it does |
|---|---|
| `yarn start` | Angular dev server with HMR |
| `yarn build` | Production build + PurgeCSS tree-shaking |
| `yarn test --watch=false` | Full Karma/Jasmine test suite (single run) |
| `yarn lint` | Angular ESLint + TypeScript strict checks |
| `yarn format:fix` | Prettier formatting |

Run a single test file:

```sh
docker compose exec editor yarn test --watch=false --include='**/quad-tree-container.spec.ts'
```

### Backend (`logigator-backend`)

| Command | What it does |
|---|---|
| `yarn start` | TypeScript watch + nodemon (dev) |
| `yarn build` | `tsc` + Gulp asset pipeline (production) |
| `yarn lint:backend` | ESLint on `src/` |
| `yarn migration:run` | Apply pending TypeORM migrations |
| `yarn migration:generate -- -n Name` | Generate a new migration from entity changes |
| `yarn migration:revert` | Roll back the last migration |

---

## Testing

Tests use **Karma + Jasmine**. Spec files sit next to their source files (e.g., `quad-tree-container.spec.ts` beside `quad-tree-container.ts`).

- Angular component specs use `TestBed`.
- Pure-logic specs (rendering math, grid utilities, action system) do not.

Run the full suite:

```sh
docker compose exec editor yarn test --watch=false
```

Karma is also reachable at `http://localhost:9876` while the editor container is running, which lets you open tests in a real browser.

---

## Architecture overview

### Editor (`logigator-editor-v2`)

The editor is an **Angular 21 SPA** where the circuit canvas is a **PixiJS 8** scene. Angular manages the UI shell (toolbar, panels, dialogs); PixiJS owns all circuit rendering.

Key layers in `src/app/`:

- **`components/`** — Circuit element model. Each gate/component extends `Component` (a PixiJS `Container` subclass). `ComponentProviderService` acts as the registry and factory. Gate implementations live in `component-types/`.
- **`project/`** — `Project` (extends PixiJS `Container`) is the root of the circuit state. `ProjectService` manages the active project and persistence.
- **`wires/`** — Wire model and rendering, separate from component objects.
- **`rendering/`** — PixiJS scene management: `QuadTreeContainer` for spatial indexing, `FloatingLayer` for transient objects (selection box, placement preview), `GraphicsProviderService` for shared texture/graphics caching.
- **`actions/`** — Command-pattern undo/redo via `ActionManager`. Every user operation is an `Action` subclass.
- **`work-mode/`** — Interaction FSM (select, place, delete, wire-routing modes).
- **`ui/`** — Angular component wrappers around the canvas and sidebar panels.

**Coordinate system:** `Project._gridSpace` has `scale = gridSize`, so all circuit objects use **grid units as their native PixiJS `position`** — no manual pixel↔grid conversion at the model layer. Visual children live inside a per-component `_visualSpace` container with `scale = 1/gridSize`, keeping pixel-authored geometry correct.

**Simulation** runs via the external `@logigator/logigator-simulation` npm package.

Detailed technical docs for each subsystem are in `logigator-editor-v2/docs/`:
`actions-system.md`, `component-system.md`, `project.md`, `rendering.md`, `ui.md`, `wires.md`, `work-mode.md`.

### Backend (`logigator-backend`)

Express server using **routing-controllers** (decorator routing), **TypeDI** (DI), **TypeORM** (MySQL), **Passport.js** (auth), and **Handlebars** (server-rendered pages).

- `src/controller/api/` — JSON REST API (projects, components, users, shares).
- `src/controller/frontend/` — Handlebars-rendered pages (home, auth, community).
- `src/database/entities/` — TypeORM entities. Circuit data is stored as JSON blobs in `ProjectFile`/`ComponentFile` — not decomposed into relational columns.
- `src/services/` — Business logic, email sending, Redis session caching.

The backend serves `logigator-editor-v2` as a static SPA at the editor subdomain. The SPA calls `/api/projects`, `/api/components`, etc. to load and save circuits.

---

## Contributing

1. Fork the repository and create a feature branch.
2. Keep changes scoped to a single package where possible.
3. Run `yarn lint` and `yarn test --watch=false` before opening a PR.
4. Open a pull request against `master`.

---

## License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.
