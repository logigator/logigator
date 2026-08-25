# CLAUDE.md

## Repository Layout

The repo root is a **shared Angular CLI workspace** + **Yarn 4 workspace** (corepack). Five members:

- `logigator-editor/` — Angular 22 editor (PixiJS 8, Tailwind 4), current focus
- `logigator-ui/` — `@logigator/ui`, in-house Angular component library replacing PrimeNG.
  See `plans/logigator-ui.md`.
- `logigator-core/` — `@logigator/core`, rendering-free circuit code shared by the editor,
  the API and migration tooling; zero runtime dependencies.
- `logigator-contract/` — `@logigator/contract`, the API surface as zod schemas
  (server validation + typed clients); zod only.
- `logigator-api/` — NestJS on Fastify, the API-only replacement for `logigator-backend`.

**One shared-code rule:** the three libraries are never built. Every consumer compiles their
**source** through the root tsconfig `paths` mapping, and each application's bundler (Angular's for
the editor, Rspack's for the API) inlines what it uses. No `dist/`, no `exports`, no build ordering,
no stale output — an edit anywhere is picked up by everything that watches.

Only `logigator-editor` and `logigator-ui` are Angular CLI projects (`angular.json`); the other
three run on plain Yarn scripts (vitest, eslint, tsc, rspack). Each package holds the same config
set: one primary tsconfig (`tsconfig.json`, or `tsconfig.app.json`/`tsconfig.lib.json` where
angular.json points at it), `tsconfig.spec.json`, `eslint.config.mjs`, `vitest.config.ts`.
Only the two applications produce an artifact, and it lands in the root `dist/<project>/`. See
`plans/backend-rewrite.md`.

Two packages stay **independent** (own `yarn.lock`/`.yarnrc.yml`, _not_ workspace members):

- `logigator-backend/` — Node.js/Express (TypeScript, TypeORM, Handlebars), being replaced
- `logigator-editor-legacy/` — Legacy Angular 17 editor (PixiJS 5), being replaced

## Dev Environment

Legacy backend config files must be created from `.example` files in `logigator-backend/config/`.
`logigator-api` needs no config files: env vars only, all defaulted (`logigator-api/.env.example`).

The dev compose stack runs both databases side by side until cutover — MySQL for the legacy backend,
**Postgres for `logigator-api`** — plus one Redis they share (the API namespaces its keys). Both are
published on localhost, so host-run tooling (`db:generate`, `db:migrate`, `test:e2e:api`) reaches
them at `postgresql://logigator:logigator@localhost:5432/logigator` and `redis://localhost:6379`.
`data/` holds both data directories and is ignored.

## Commands

Every workspace member (editor, UI library, core, contract, API) runs **from the repo root** — the
Angular CLI targets and the root Yarn scripts. The legacy backend is independent: run its commands
from `logigator-backend/`.

### Workspace (all five members), from repo root

Uniform surface: `<verb>:<package>` runs the verb for one package, and the **bare verb runs it for
every package that has it** — there is no `:all` suffix and no bare shorthand for a single package
(`test:*` is always a single run). Not every package has every verb: only the two applications
build, and `typecheck` exists where tsc is the only type gate, since the Angular projects are
type-checked by their own build and test targets.

```bash
yarn start:editor                   # ng serve  (start:editor:prod for the production config)
yarn start:api                      # rspack --watch + node --watch (restarts on core edits too)
yarn build                          # = build:editor + build:api
yarn build:editor                   # production build → dist/logigator-editor
yarn build:api                      # rspack bundle → dist/logigator-api
yarn test                           # every package, single run each
yarn test:editor                    # add --include='**/some.spec.ts' for one file
yarn test:ui / test:core / test:contract / test:api
yarn test:e2e:api                   # API against real Postgres + Redis (needs DATABASE_URL, REDIS_URL)
yarn lint                           # eslint over all five; lint:fix writes the fixes
yarn typecheck                      # tsc over core, contract, api (specs included)
yarn format / format:fix            # Prettier over the whole repo
```

The API's database scripts run from its own package (`yarn workspace logigator-api run …`):
`db:generate` diffs the Drizzle schema into a new SQL migration under
`logigator-api/drizzle/`, `db:check` validates the migration history, and `db:migrate` applies
pending migrations through the bundled runner (`dist/logigator-api/migrate.js`) — the same function
the E2E harness and a release call, so no path applies DDL that CI has not. `db:renormalize` runs
the third bundle entry (`dist/logigator-api/renormalize.js`): bare, it re-normalizes documents an
older format version wrote; with `--all`, it re-extracts every derived row (counts, port surface,
dependency edges) from the documents they came from.

`@logigator/ui` has no build script — every consumer compiles its source. The ng-packagr target in
`angular.json` stays for an eventual publish and because the unit-test builder reads its build
options from it, so `ng build logigator-ui` still works; nothing in CI runs it.

### logigator-backend (from logigator-backend/)

```bash
yarn build                        # tsc + Gulp asset pipeline
yarn lint:backend                 # ESLint on src/
yarn migration:run                # run pending TypeORM migrations
yarn migration:generate -- -n Name  # generate migration
```

## Architecture

### Frontend (logigator-editor)

Angular 22 standalone components + PixiJS 8 canvas.

**`src/app/` layers** (each has a doc at `logigator-editor/docs/<name>.md`):

- `components/` — Circuit element model. Each extends `Component` (PixiJS `Container`) with `connectionPoints`, `portStubs`, `portsChange$` Subject; port/bounds math lives in the pure `component-geometry.ts` (lattice-exact, unit-tested). `ComponentProviderService` is the registry/factory. Each built-in's config is `configFromMeta(<name>Meta, { create, … })` over the pure `ComponentMeta` in core, so identity, option schemas, arity, labels and body extent are declared once for both sides; `Component` reads that meta directly (a custom component hands the base an equivalent built from its definition), so port counts are derived and read-only — change an option to change the arity. Gate implementations in `component-types/`. Doc: `component-system.md`.
- `components/component-options/` — `ComponentOption` subclasses each paired with an Angular renderer and with one `OptionSchema` kind in core (the schema owns the constraints, the class the renderer and the live value); side-panel form is `*ngComponentOutlet` driven by `option.renderer`. Doc: `component-options.md`.
- `project/` — `Project` (PixiJS `Container`) owns circuit state; exposes `viewport` (`ViewportController` — all pan/zoom/camera state) and `topology` (`WireTopology` — wire-invariant integration + the wire tool's join/split toggling), and keeps O(1) id → element maps beside the quad trees. `ProjectService` tracks the loaded/active projects. `wire-repair.ts` + `WireRepairService` audit and heal invariant-violating boards (Edit-menu "Repair Wires"; loads audit and _offer_ the repair through a toast action — repairing is always user-initiated). Doc: `project.md`.
- `persistence/` — `PersistenceService` (facade: load/save dispatch + file import/export + main-slot lifecycle) over two symmetric gateways (`server/server-persistence.gateway.ts`, `browser/browser-persistence.gateway.ts`); `PromotionService` (upload-to-cloud + local-dependency queries), `ProjectMetadataStore` (name/source/dirty, `withDirtyGuard`); library lifecycle (preloads, orphan restore) is `custom-component/component-library.service.ts`. The legacy server API transports `ProjectElement[]` — _file-format v0 over HTTP_: reads route through the permanent `v0ToV1` migration, encode through the temporary `persistence/server/` codec (deleted when the native API ships). `persistence/file/` holds `CircuitFileService`, the Angular adapter over core's format layer — it builds the migration chain's `{ catalog, log }` context from the component registry and `LoggingService`. Docs: `persistence.md`; the custom-component dependency/promotion system (how documents carry the customs they use, cloud promotion, UUID mapping, orphans) is `dependencies-and-promotion.md`.
- `wires/` — Wire model and rendering. Doc: `wires.md`.
- `connection-points/` — Derived visual junction dots (≥3 cardinal directions filled + ≥1 element terminates). Pure visual sugar, not persisted or selectable. Doc: `connection-points.md`.
- `rendering/` — `RendererService` (the app's single lease-counted PixiJS renderer: the board and every watch canvas are render targets of it; minimap/image-export render to textures on it), `QuadTreeContainer` (spatial indexing), `FloatingLayer` (visual host for drag ghosts + negation preview), `GraphicsProviderService` (shared texture/graphics cache), `DragCollisionState` (shared collision for drag sessions). `sessions/` contains per-interaction `DragSession` implementations (convention: sessions materialize their final state in the live project, then `ActionManager.register` it — `push` is for instantaneous non-gesture ops). `interaction/` is the DOM input layer: `PointerController` (per-canvas pointer/wheel/touch normalization with capture; PixiJS events are fully disabled) + `WorkModeRouter` (dispatch + session lifecycle, incl. the undo lock around live drags) + `interaction/tools/` (one `BoardTool` per work mode: press → session, hover previews). Doc: `rendering.md`.
- `actions/` — Command-pattern undo/redo via `ActionManager` (`push` runs `do()`, `register` records already-materialized state; `retract`/`coalesceTop` back the scissor-cut lifecycle; `locked` makes undo/redo inert during drags). Each user operation is an `Action` subclass. `ActionContainer` groups multiple actions atomically. Doc: `actions-system.md`.
- `clipboard/` — `ClipboardService` (copy/cut/paste/delete). Copy serializes selected components and wires into a typed `SerializedComponent[]`/`SerializedWire[]` snapshot. Paste deserializes fresh instances (new IDs, copied geometry), then opens a `PastePlacementSession` where the user positions the pasted elements with collision checking; the router centres the group on the cursor, or on the view when there is none. Cut = copy + delete (folded into one undo step). A scissor cut (SELECT_EXACT) registers as its own history entry; the delete (or move) that commits it coalesces the two entries (`ActionManager.coalesceTop`) so cut + delete is one undo. No separate doc (covered by `rendering.md` and `actions-system.md`).
- `work-mode/` — Interaction mode FSM (selection, placement, deletion, wire routing). Doc: `work-mode.md`.
- `simulation/` — Runs the circuit. `SimulationService` (facade: lifecycle/run-controls/user-input) → `BoardCompilerService` (circuit → `BoardDescriptor` + link→render mapping, custom components flattened; also retains a `WatchIndex` of integer tables addressing every inner circuit for watches) → `SimulationWorkerService` (main-thread bridge) → `simulation.worker.ts` (owns the `@logigator/sim` WASM engine). `LinkStateApplier` lights up powered wires/ports; snapshots fan out to the board applier plus any registered watch appliers. Owns the `SIMULATION` work mode (editing locked). Doc: `simulation.md`.
- `inspection/` — Live component inspection during simulation. Tapping an inspectable component (its config declares an `inspection` factory returning a `ComponentInspection` — the option/action-analog model in `components/`) opens its view: a floating `@logigator/ui` window on desktop; on compact, the shared non-modal bottom sheet — except `compactPresentation: 'fullscreen'` entries (watches), which stay windows on every breakpoint and render as fullscreen takeovers through a second `fullscreen` window outlet (the app template swaps the two outlets per breakpoint; only sheet-bound entries re-home on flips). Data is pull-based via `SimulationService.frame$` (per applied snapshot). Two content kinds: the ROM data inspector (read-only hex editor, addressed word highlighted) and the custom-component **watch** (`inspection/watch/` + `components/custom/sub-circuit-watch.ts`) — a live, interactive canvas view of an instance's inner circuit: a fresh headless `Project` copy lit through the `WatchIndex` by a sparse applier, breadcrumb drill-down into nested customs, inner levers/buttons drive the engine, watch canvases render through the same shared app renderer as the board; input runs through the same `PointerController` as the board (a `PanSession` with a tap action as its tool). Doc: `inspection.md`.
- `documentation/` — In-editor help. `docs-pages.ts` is the page registry (`DOC_SECTIONS` → derived `DocPageId` union; per-locale markdown assets under `assets/docs/<lang>/`, `en` fallback, loaded via the changelog's hashed-import pattern); `DocumentationService.open(pageId?, anchor?)` is the single deep-link entry point (Help menus, `docs:<page-id>` cross links inside pages — classified by `doc-link.ts` —, hint "learn more" links via `Hint.docsPage`, About dialog). The viewer (`ui/dialogs/documentation-dialog/`) is a `LgNavigation` + `LgMarkdown` two-pane dialog on desktop and a fullscreen drill-down on compact (`DialogConfig.fullscreen` bound to `layout.isCompact`). No separate doc (covered by `ui.md`).
- `automation/` — Programmatic control surface for scripts/AI agents, installed as `window.__logigator` when `environment.debug.automationApi` is on (off in prod). `AutomationApiService` is the transport-agnostic facade over existing seams (catalog reads, `applyEdit` batches → one `ActionContainer`, file round-trip, `check()` diagnostics, simulation lifecycle + absolute `setInput` + port reads, camera, region selection — `select()` **is** the select tool's marquee, scissor cut included —, editor settings); `catalog.ts` derives the type/option catalog from `ComponentProviderService` (never hand-written), reading each config's `ComponentMeta` rather than probing instances, and validates option values through core's `validateOptionValue`; `edit-ops.ts` owns the op schema and the validate → integrate → materialize → `register` path. Doc: `automation.md`.
- `ui/` — Angular wrappers around canvas and sidebar panels. Doc: `ui.md`.

**Non-obvious patterns:**

- `setStaticDIInjector()` in `app.config.ts` — bootstraps static Angular injector so model classes (`Component`, `Wire`) can call `inject()` without being Angular-managed.
- Grid coordinates — `Project._gridSpace` has `scale = gridSize`, so circuit objects use **grid units as native `position`**. Visual children in `Component._visualSpace` (`scale = 1/gridSize`) keep pixel-authored geometry. Only remaining converter is `fromGrid` in `utils/grid.ts` (used inside `_visualSpace` and background grid). Snapping: `roundToGrid` / `roundToHalfGrid`.
- `@logigator/sim` — external npm package (separate repo, Rust→WASM) holding the simulation engine. It runs in a Web Worker; the engine free-runs (or self-paces in target mode) while the main thread pulls one delta/full snapshot per `requestAnimationFrame`. Compilation is synchronous: nets via union-find over `"x,y"` termination points, custom components flattened by cached template instantiation, dense link ids assigned in emission order. Any `CompileDiagnostic` blocks entering simulation. See `simulation.md`.
- Two serialization encodings: the **API** uses the legacy positional `ProjectElement[]` wire format (`t/p/q/r/i/o/n/s`) — _file-format v0 over HTTP_, decoded by the `v0ToV1` migration and encoded by the temporary `persistence/server/` codec; **local files** use a **native, versioned** format (named options; wires as one SVG-path-style chain string `"x,y:e5s3;…"` with relative chunk heads via core's `codecs/wire-chain.codec.ts`; component positions (type,y,x)-sorted and delta-encoded via core's `codecs/position-delta.codec.ts`), whose types, validator and container live in `@logigator/core` and whose editor-side codec/migration adapters are `persistence/file/`. Files have a `version` field (absent ⇒ legacy v0; native current = v1); a migration chain upgrades older files to the newest version on load, and only the newest version is ever saved. The built-in configs' `legacyV0Slots` descriptor is the single source of truth the v0 decode and encode share. `SerializedComponent`/`SerializedWire` are a _third_, separate in-memory snapshot used by undo/redo — not a persistence format.
- Paste flow — `ClipboardService.paste()` deserializes clipboard snapshots into fresh `Component`/`Wire` instances (new IDs, copied geometry), then calls `Project.startPasteSession()`, which emits on `pasteRequest$`; the `WorkModeRouter` positions the group (centred on the cursor, else on the middle of the grid view) and opens a `PastePlacementSession`. Pasting is a non-modal drag session: elements appear as tinted ghosts in the floating layer's `dragLayer`, follow the cursor, and check collision via `DragCollisionState`. `isDragging` stays false until the user clicks on one of the ghosts, at which point `beginDrag` locks in the anchor; releasing commits at the current position. Clicking off the ghost group cancels, as does Escape (both destroy the fresh instances). `SelectionMoveSession` shares `DragCollisionState` for its own collision check.
- `src/testing/` — shared test fakes (`FakeBrowserProjectStore`, `FakeBrowserComponentStore`). In-memory stand-ins for the IndexedDB-backed stores, extracted so both `persistence.service.spec` and `custom-component.service.spec` can use them without duplication.
- Language and theme are **origin-wide, not editor-local**: both are fields of the `preferences` cookie (`storage/preferences.service.ts`) that the backend's pages write and read as well, so a switch on either side moves both (see `ui.md`). Everything else the editor persists (`logigator.*` keys) is localStorage and editor-only.

### UI Library (logigator-ui)

`@logigator/ui` — in-house Angular 22 component library that replaced PrimeNG in editor. Built on Angular CDK; theming is **colors-only** via `--lg-*` CSS variables. Path-mapped to source in dev (root `tsconfig.json` maps `@logigator/ui` → `logigator-ui/src/public-api.ts`), so the editor compiles it from TypeScript with no build step — it is _not_ a `package.json` dependency of editor. Detailed plan: `plans/logigator-ui.md`.

**`logigator-ui/src/` layout** — one folder per component under `components/`, all re-exported from `public-api.ts`; shared helpers (`internal/`, `tokens/`) stay at `src/`:

- `components/` — one folder per component:
  - Declarative components: `button/`, `divider/`, `tag/`, `badge/`, `avatar/`, `card/`, `ripple/`, `icon-field/` (`LgIconField` + `LgInputIcon`), `input-text/`, `textarea/`, `toggle-switch/`, `checkbox/`, `select-button/`, `input-number/`, `slider/`, `tooltip/`, `popover/`, `select/`, `dialog/`, `drawer/`, `accordion/`, `tabs/`, `panel-menu/`, `navigation/` (`LgNavigation` — selectable page tree, `panel-menu`'s stateful sibling), `menu/` (`LgMenu` popup + `LgMenubar`), `paginator/`, `file-upload/`, `scroller/`.
  - Imperative services + their outlet components: `dynamic-dialog/` (`DialogService` → `DialogRef`/`DialogConfig`; `fullscreen` — optionally a live `Signal<boolean>` — turns the card into a viewport takeover), `confirm/` (`ConfirmationService` + `LgConfirmDialog`/`LgConfirmPopup`), `toast/` (`ToastService` + `LgToast`; `danger` severity maps to `error`).
- `internal/` — shared, non-exported plumbing: CDK-based `overlay`/`modal-overlay` foundation, `focus-trap`, `key-manager`, `after-paint`, `caret`, `collapse` (animated height-collapse region shared by accordion/panel-menu/navigation), `icon`.
- `tokens/` — shared types (`LgSeverity`, `LgSize`, form-field tokens).
- `styles/theme.css` defines the `--lg-*` vars; `styles/theme.tw.css` maps them into Tailwind's `@theme` for editor.

Specs sit next to source (Vitest, `yarn test:ui`). There is no build script — the library ships as source to its consumers; the ng-packagr target survives for an eventual publish (`ng build logigator-ui`).

### Shared packages (@logigator/core, @logigator/contract)

Layering is one-directional — **core ← contract ← api** — and core knows nothing about any of
them. Both are consumed exactly like `@logigator/ui`: **every consumer compiles their source**
through the root tsconfig `paths` mapping. They are never built, have no `dist/`, no `main`, no
`exports`; the editor's Angular build and the API's Rspack build each bundle the source they use,
and specs alias the same paths. One consumption model, so a change is picked up everywhere
without a build step.

- `logigator-core/src/` — the rendering-free half of the circuit code: `model/` (the shapes a
  document is made of — serialized bodies, persisted version bases, the legacy `ProjectElement`
  and dependency types, custom-component definitions, legacy-anchor conversion, and the
  `BuiltInComponentType`/`ComponentCategory`/`Direction`/`WireDirection` enums), `codecs/`
  (wire-chain, position-delta, persisted-definition), `format/` (`CURRENT_FILE_VERSION`, the
  `CircuitFileV0/V1` envelopes, errors, the structural validator, the migration chain +
  `migrateToCurrent`, `assembleCircuitFile`, the `.lgix` container, and
  `parseCircuitDocument` — the API's one ingest pipeline: migrate → validate → decode →
  catalog integrity → dependency extraction, `strict` on writes and `lenient` for the
  Phase 6 migration),
  `catalog/` (one `ComponentMeta` per built-in — option schemas plus `ports`/`labels`/`body` as
  pure functions of the option values —, `BUILT_IN_META`, and `validateOptionValue`, the single
  definition of a legal option value). Boundary
  rule: **core = data↔data, editor = live↔data** — snapshotting live PixiJS objects stays in the
  editor. Guarantees are enforced, not conventional: **zero runtime dependencies**, no
  `@angular/*`/`pixi.js`/`rxjs` import and no browser globals (`eslint.config.mjs` fence), plus a
  `tsc` that maps _no_ paths — so a sibling-package import fails — with `rootDir: "src"` making a
  relative escape fail too.
- `logigator-contract/src/` — request/response schemas per endpoint (`*.contract.ts`), inferred
  types via `z.infer`, no codegen. zod and core are its only imports (fenced the same two ways).
  Response object schemas are `.loose()` on purpose: a client holding an older contract copy must
  tolerate fields the API added rather than reject or silently strip them. Clients can import the
  types only (`import type`) and pay nothing at runtime.

### API (logigator-api)

NestJS on the **Fastify adapter**, API only — no SSR, no asset pipeline. Env vars validated by a
zod schema (`src/config/env.ts`) once at bootstrap; the parsed object is passed into
`AppModule.forEnv(env)` and provided globally under the `ENV` token, so providers never read
`process.env`. `GET /api/meta` reports core's `CURRENT_FILE_VERSION` plus the sign-in methods the
deployment offers; `GET /api/health/ready` probes Postgres and Redis (503 naming the failing one),
while `/api/meta` doubles as the liveness probe that reaches nothing.

**`src/` layers:**

- `config/` — the zod env schema. Every variable is defaulted so a bare `docker compose up` works;
  the rules that cannot be defaulted are enforced in the schema instead (production refuses the
  public development `SESSION_SECRET`, the Google credentials must be set together or not at all,
  and `TRUST_PROXY` must be at least 1 wherever cookies are `Secure` — the process serves plain
  HTTP, so untrusted forwarding headers make `@fastify/session` treat every request as insecure and
  write no session at all). `COOKIE_SECURE` and the two OAuth URLs are _resolved_ in a transform, so
  consumers read values rather than re-deriving rules.
- `database/` — Drizzle over `pg`. `schema/` is the DDL in TypeScript (tables + `defineRelations`
  for RQBv2), `drizzle/` the generated SQL migrations, `migrate.ts` the runner both the
  `migrate.js` bundle entry and the E2E harness call. `DB` injects a typed `Database`; there are no
  entity classes and no lazy relations.
- `redis/` — one shared node-redis client, connected in a lifecycle hook (so unit specs can
  instantiate the graph without a server) and namespaced by `REDIS_KEY_PREFIX`, because development
  shares one Redis with the legacy backend.
- `session/` — `@fastify/cookie` + `@fastify/session` over a small in-repo Redis store; sliding
  expiry, `saveUninitialized: false`, a per-account index of session ids (so a credential change can
  end the sessions the old one opened), and `SessionService` owning sign-in (id regenerated first),
  sign-out (which clears the session cookie itself) and the non-httpOnly `isAuthenticated` hint
  cookie the editor reads — written by an `onSend` hook rather than at sign-in, so it slides with the
  session cookie and a hint no session backs is cleared on the next request.
- `auth/` — local credentials (`AuthService`, bcrypt via `@node-rs/bcrypt`, rehash-on-login when a
  stored hash predates the current cost), one-shot mail tokens in Redis (`AuthTokenService`), and
  Google sign-in through `openid-client` (code flow + PKCE, state/verifier server-side, linking only
  from inside an account). `AuthGuard` + `@CurrentUser()` are exported, never global.
- `users/` — the caller's own account: profile, password, address change (gated by the current
  password, then confirmed by mail before it takes effect), avatar, deletion (one cascading
  statement). A session alone is proof of intent for none of the three: it would otherwise be a
  complete takeover, since a new address confirms a password reset.
- `mail/` — nodemailer plus rendering functions, four locales, HTML and text; unset `SMTP_URL` logs
  the mail with its link instead of sending.
- `storage/` — images on a volume, and the pipeline that produces them. Every upload is decoded
  and re-encoded by `ImageService` (sharp/libvips) rather than stored: the bytes and the declared
  content type are the client's word, and the accepted formats are checked against what libvips
  _detects_ (so the SVG it would happily rasterize is refused). Each asset becomes a fixed matrix
  of size × format — WebP plus a fallback, declared once in `image-variants.ts` because the upload
  path writes it and every response lists its URLs — written into one directory per asset under a
  two-hex shard of its id (`profile/a3/<uuid>/256.webp`). The row holds only that id, a fresh one
  per write, so URLs are immutable and a half-written asset is unnameable; deleting is removing the
  directory, which is what lets the matrix change without stranding what an older one named. The
  whole volume is served under **one URL root, `/files`** (`STORAGE_URL_PREFIX`), not one prefix per
  area, because the legacy backend answers `/profile/…` and `/preview/…` from its own disk on the
  same origin until cutover. `OrphanSweepService` (`@nestjs/schedule`, nightly) deletes asset
  directories no row points at, sparing anything younger than `STORAGE_SWEEP_GRACE_MINUTES` — an
  upload in flight is a directory no row names _yet_.
- `documents/` — projects and components: the caller's own stored circuits. **Every write goes
  through `CircuitDocumentService.ingest`**, which parses with core's `parseCircuitDocument` in
  strict mode and stores what parsing produced, so a row this server wrote is a document it can
  read. Everything else on a row is derived there and never taken from a client: the counts, the
  dependency edges (from the document's embedded `definitions[].source`), and a component's
  `numInputs`/`numOutputs`/`labels` (from the INPUT/OUTPUT plugs, via core's
  `deriveCircuitSummary`). Two envelope fields belong to the server — the stored `document.name` is
  written from the row's column, and the client-asserted `attribution` chain is stripped, with only
  the immediate parent's id kept to resolve against real rows (`forkedFromId`, the attribution trust
  anchor; reads walk it back with `forkLineage`). Concurrency is the integer `version` in the
  `WHERE` of one guarded `UPDATE` (409 `version_conflict`); it bumps for the document, the name, the
  symbol and the description, never for visibility or a regenerated link. No write computes a column
  from a value it read in an earlier statement: a rename edits the document's own copy of the name
  through `jsonb_set` and increments `version` in SQL (`rename-in-document.ts`), so a save landing at
  the same moment keeps its circuit and neither write has to guess. `circuit-queries.ts` holds
  the reads over the half both tables share, **overloaded per table** because Drizzle's builder types
  are conditional on the table and cannot resolve against an unresolved type parameter. Previews are
  `PreviewService` (both themes in one multipart request, both replaced together; not an edit, so no
  version bump). `RenormalizeService` is the format-bump _and_ re-extract job — keyset-paginated, one
  transaction per row, idempotent, and it does not bump `version` but does put it in the `WHERE`, so
  a row a save reached first is skipped rather than rewritten back — run as the third Rspack entry
  (`node renormalize.js [--all]`).
- `sharing/` — reading a document by its share link and cloning it. The link is a **capability**:
  the read needs no session and ignores `public`. A clone copies the whole transitive dependency
  graph (one recursive CTE with a path array as a cycle guard) and **rewrites every embedded
  snapshot's `source.id`** to the new copies — a snapshot whose master no longer exists loses its
  `source` instead. New ids are chosen before any insert, so insert order is irrelevant; copies go
  through the same write path, so their ports and edges are re-derived, and a copy is always private.
- `community/` — the public half: listings, stars, stargazers, public profiles. **Every predicate
  carries `public = true`**, which is why these queries live apart from the owner-scoped ones rather
  than being those with a flag flipped. Documents are addressed by their `link`, so regenerating the
  token takes the public page down with it. Star counts and "did the caller star it" are correlated
  subqueries (no counter column, no `GROUP BY` to keep in step with the select list); ranking is
  stars then edit time, so paging is stable. `@SessionUserId()` reads the session without requiring
  one — the reason `AuthGuard` is per-route rather than global.
- `reports/` — `POST /api/report-error`, keeping the path and the field-by-field shape the editor
  already sends (the old editor's positional `project` payload included). Unauthenticated and
  rate-limited; every report is one log line, and a configured `REPORT_MAIL_TO` also gets it with the
  circuit attached.
- `common/` — the error filter and `ApiException`, the zod validation pipe (a shim to delete when
  NestJS 12's `@Body({ schema })` lands), the Redis-backed `@RateLimit()` guard, the `UuidParam`
  pipe (every id is a `uuid` column, and Postgres rejects a comparison against something that is
  not — so a mistyped path is a 404 rather than a 500), and locale resolution from the shared
  `preferences` cookie.
- `app.setup.ts` — the plugin registration and route prefix shared by `main.ts` and the E2E
  harness, so the specs exercise the same HTTP layer as production.

**Build: Rspack** (`rspack.config.mjs`, following Rspack's NestJS guide), which is what lets the
API compile the shared packages from source like every other consumer. NestJS 12 replaces its
webpack builder with Rspack, so this is where upstream is going; when v12 lands, its CLI builder
may replace this config.

**Non-obvious build details:**

- `builtin:swc-loader` needs `legacyDecorator` + `decoratorMetadata`, and the tsconfig keeps
  `experimentalDecorators`/`emitDecoratorMetadata` in step — Nest resolves constructor
  dependencies from `design:paramtypes`, so losing either breaks DI at runtime.
- **`tsconfig.json` is where the workspace aliases live**, and `resolve.tsConfig` points the
  bundler at it, so bundler and type checker cannot drift. `baseUrl` is declared _there_ rather
  than inherited from the workspace config: Rspack's resolver reads it relative to the file it is
  handed. The mapping deliberately covers core and the contract only, but it is not the layering
  fence: `rootDir` is the repo, so a relative escape into a sibling package type-checks, and every
  workspace member is symlinked into the root `node_modules`. `eslint.config.mjs` is the fence in
  the API and the contract; `logigator-editor/package.json` declares `"exports": {}` so a bare deep
  import of editor source cannot resolve either. Core is the exception — its `rootDir: "src"` plus
  the empty `paths` really is structural.
- **`webpack-node-externals` needs `allowlist: [/^@logigator\//]`** — Yarn symlinks workspace
  members into `node_modules`, so without it they are treated as ordinary dependencies and left as
  a runtime `require` of a package with no entry point.
- **`sharp` stays external** and must: it is a native module, so `webpack-node-externals` leaving
  it a runtime `require` is the only thing that works. Nothing pins architectures in
  `.yarnrc.yml`, so the lockfile carries every prebuilt binary including
  `@img/sharp-linuxmusl-x64` — which is what an alpine runtime image needs.
- **No minification.** A long-running server gains nothing, and Nest reflects on class and
  function names, so mangling would break DI.
- **`output.clean` is off** and the dev loop watches the output _directory_
  (`node --watch --watch-path`): cleaning deletes and recreates `main.js`, which drops a
  file-level watch and silently stops restarts.
- Vitest discovers `tsconfig.json` **by convention** to pick up `emitDecoratorMetadata`; that is
  why the Node packages name their primary config `tsconfig.json` rather than `tsconfig.app.json`.
  Rename it and DI in specs breaks with `Cannot read properties of undefined`.
- `rootDir: ".."` in the Node packages that map `paths`: their programs legitimately contain
  sibling-package source, and tsc validates the inferred root even under `noEmit`.
- **`fastify` is pinned to the exact version `@nestjs/platform-fastify` depends on.** With two
  copies installed, a plugin's type augmentation lands on one and Nest's `register` reads the other,
  so `app.register(fastifyCookie)` fails to type-check.
- **`migrate` is a second Rspack entry**, and the deploy artifact ships `drizzle/` beside it: the
  runner reads migration SQL from disk (`__dirname/drizzle` by default, hence
  `node: { __dirname: false }`), so a release applies migrations with plain `node` and no dev
  tooling. drizzle-kit only ever _generates_ them.
- **`renormalize` is a third entry**, for the same reason, but unlike the migration runner it boots
  the real application container (`NestFactory.createApplicationContext`) — the point is to rewrite
  documents through the same parse-and-extract path every other write uses, and a second
  implementation of that path is what would let the derived tables drift.
- Drizzle is pinned to an exact `1.0.0-rc` build. RQBv2 `defineRelations`, the DDL-snapshot
  migration format and the consolidated zod integration are 1.0-only surfaces with no compat path
  from 0.45; bump the pin when 1.0 stable ships. Relations name their columns explicitly and the
  through-relations carry matching aliases — a user has two relations to projects (owns, starred)
  and the builder refuses to guess.

### Legacy backend (logigator-backend)

Express with **routing-controllers** (decorators), **TypeDI** (DI), **TypeORM** (MySQL), **Passport.js** (auth), **Handlebars** (SSR).

**`src/` layers:**

- `controller/` — `@JsonController('/api/...')` for REST JSON (wrapped `{ status, data }` by `ApiInterceptor`) and `@Controller('/...')` for Handlebars HTML pages. Doc: `controllers.md`.
- `database/entities/` — TypeORM entities: `@Exclude({toPlainOnly: true})` + `@Expose()` for safe serialization, lazy `Promise<T>` relations, serialization groups, `PersistedResource` base for filesystem file storage. Circuit data in `ProjectFile`/`ComponentFile` as disk JSON blobs. Doc: `entities.md`.
- `database/repositories/` — `PageableRepository<T>` with bounded `Page<T>` pagination, ownership-scoped queries, dependency graph traversal. Doc: `repositories.md`.
- `services/` — TypeDI singletons: `ConfigService`, `RedisService`, `EmailService`, `TranslationService`, `UserService`, `ShareCloningService`, `StandaloneViewService`. Doc: `services.md`.
- `middleware/` — Global: trailing slash redirect, language prefix routing, template data injection, dual JSON/HTML error handling. Action: form error flash, page title translation. Doc: `middleware.md`.
- `models/request/` — `class-validator` DTOs in `shared/`, `api/`, `frontend/`. `FormDataError` → `formErrorMiddleware` → session flash → Handlebars helpers pipeline. Doc: `form-validation.md`.
- `i18n/` — 4 languages (`en|de|es|fr`) with URL prefix routing (`/en/features`), dot-notation `TranslationService`, SEO hreflang alternates. Doc: `i18n.md`.
- `handlebars-helper/` — 17 custom helpers (link prefixing, cache-busted assets, form errors, conditions, dates). Templates in `resources/private/templates/`. Doc: `server-side-rendering.md`.
- `database/entities/persisted-resource.entity.ts` — Abstract base for filesystem files with MD5 change detection + TypeORM lifecycle hooks. Doc: `file-storage.md`.

**Cross-cutting docs** (all in `logigator-backend/docs/`):

- `architecture.md` — DI triple-registration, bootstrap sequence, dual JSON/HTML response architecture
- `authentication.md` — Passport.js (local + Google + Twitter OAuth), Redis sessions, API/frontend guards, `isAuthenticated` cookie
- `configuration.md` — `.json` / `.json.example` convention, 7 config files, env-determined behavior
- `build-system.md` — tsc + Gulp (SCSS → CSS, dual ES2015/ES5 JS bundles)

**Non-obvious patterns:**

- `useContainer` triple registration — `typedi` Container shared across `routing-controllers`, TypeORM, `class-validator`.
- Language prefix rewriting — `TranslationMiddleware` strips `/en/` from `request.url` before routing; controller routes stay clean (e.g. `/features`).
- Form error flash — `formErrorMiddleware` catches errors → session flash → redirect. `GlobalViewDataMiddleware` transfers to `res.locals` + clears session. Client JS mirrors via `data-error`/`data-val-data`.
- `PersistedResource` — files on disk, not DB. Lifecycle hooks manage CRUD. MD5 avoids unnecessary writes. `_cacheable = true` subclasses regenerate UUID filenames on update for cache-busting.
- `@Exclude({toPlainOnly: true})` class-level + selective `@Expose()` — defense-in-depth against leaking internal fields.
- Lazy relation proxy properties — `classToPlain` can't resolve `Promise<T>`, so controllers populate private `__property__` fields pre-serialization, gated by `@Expose` groups.

### Backend ↔ Frontend

Backend serves `logigator-editor` as a static SPA. SPA calls `/api/projects`, `/api/components`; circuit data crosses the wire as the legacy `ProjectElement[]` format and is stored server-side as serialized JSON via `ProjectFile`/`ComponentFile` entities. Independently, the editor can save/load circuits to/from **local files** in its own native versioned format (see `persistence.md`); these never touch the backend.

## Testing

The editor and `@logigator/ui` run Vitest via Angular's `@angular/build:unit-test` builder; core,
the contract and the API run **plain Vitest** in Node (own `vitest.config.ts`, no Angular, no
jsdom — they are framework-free, and the API's specs boot Nest testing modules). The Node
packages' configs alias `@logigator/core`/`@logigator/contract` to their source, mirroring the
tsconfig `paths` mapping, so specs compile exactly what ships. Spec files always sit next to
source. Angular specs use `TestBed`; pure-logic specs don't. Shared editor helpers in
`src/testing/`:

- `fake-browser-stores.ts` — `FakeBrowserProjectStore`, `FakeBrowserComponentStore` (in-memory IndexedDB stand-ins)
- `factories.ts` — `makeAnd`, `makeNot`, `makeWire`, `makeInput`, `makeMoveEvent` (circuit-element and pointer-event stubs)
- `action-mocks.ts` — `makeAction` (mocked `Action` with named `do`/`undo` spies)
- `vitest-helpers.ts` — `arrayWithExactContents` (asymmetric matcher replacing Jasmine's)

The API additionally has an **E2E suite** (`logigator-api/test/*.e2e-spec.ts`, its own
`vitest.e2e.config.ts`, `yarn test:e2e:api`) that boots the real application through
`app.setup.ts` and drives it with injected requests. It is a separate script because it needs a real
Postgres and Redis: `yarn test:api` must stay runnable anywhere, and a suite that skipped itself
without a database would report green having tested nothing. `test/harness.ts` creates a throwaway
database per spec file and migrates it with the runner a release uses; Redis keys are namespaced per
run and deleted afterwards. Only two things differ from production — the mail transport is captured
(`test/mail-capture.ts`, so specs read the link a recipient would click) and bcrypt runs at its
minimum cost. `test/cookie-jar.ts` carries cookies across requests the way a browser would,
`test/circuits.ts` builds documents through core's own encoder rather than hand-written JSON (a
fixture gets the wire chain and the position deltas subtly wrong), `test/assets.ts` maps a served
URL back to its path on the volume — the two are not the same string — and `test/row-lock.ts` runs a
request while an uncommitted transaction holds the row it writes, which is the only way an injected
request (they run one at a time) meets a concurrent write, and it waits for the block rather than
sleeping so the interleaving is a fact of the run.
