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
yarn lint                           # eslint over all five; lint:fix writes the fixes
yarn typecheck                      # tsc over core, contract, api (specs included)
yarn format / format:fix            # Prettier over the whole repo
```

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

- `components/` — Circuit element model. Each extends `Component` (PixiJS `Container`) with `connectionPoints`, `portStubs`, `portsChange$` Subject; port/bounds math lives in the pure `component-geometry.ts` (lattice-exact, unit-tested). `ComponentProviderService` is the registry/factory. Each built-in's config is `configFromMeta(<name>Meta, { create, … })` over the pure `ComponentMeta` in core, so identity, option schemas, arity, labels and body extent are declared once for both sides; `meta-parity.spec.ts` guards the classes against their meta until the geometry getters go. Gate implementations in `component-types/`. Doc: `component-system.md`.
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
`process.env`. `GET /api/meta` reports core's `CURRENT_FILE_VERSION`.

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
