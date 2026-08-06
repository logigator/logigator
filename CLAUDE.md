# CLAUDE.md

## Repository Layout

The repo root is a **shared Angular CLI workspace** + **Yarn 4 workspace** (corepack). Two members:

- `logigator-editor/` — Angular 22 editor (PixiJS 8, Tailwind 4), current focus
- `logigator-ui/` — `@logigator/ui`, in-house Angular component library replacing PrimeNG;
  path-mapped to its TypeScript source in dev (no build step). See `plans/logigator-ui.md`.

Two packages stay **independent** (own `yarn.lock`/`.yarnrc.yml`, *not* workspace members):

- `logigator-backend/` — Node.js/Express (TypeScript, TypeORM, Handlebars)
- `logigator-editor-legacy/` — Legacy Angular 17 editor (PixiJS 5), being replaced

## Dev Environment

Backend config files must be created from `.example` files in `logigator-backend/config/`.

## Commands

Editor + library: run **from the repo root** (Angular CLI targets / root Yarn scripts). The backend
is independent: run its commands from `logigator-backend/`.

### Workspace (editor + logigator-ui), from repo root
```bash
yarn build                          # ng build logigator-editor (production)
yarn test --watch=false             # Vitest (full editor suite, single run)
yarn test --watch=false --include='**/some.spec.ts'  # single test
yarn lint                           # ng lint (both projects)
yarn format:fix                     # Prettier
yarn build:ui                       # ng build logigator-ui (ng-packagr; publish deferred)
yarn test:ui                        # Vitest (logigator-ui)
```

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

- `components/` — Circuit element model. Each extends `Component` (PixiJS `Container`) with `connectionPoints`, `portStubs`, `portsChange$` Subject; port/bounds math lives in the pure `component-geometry.ts` (lattice-exact, unit-tested). `ComponentProviderService` is the registry/factory. Gate implementations in `component-types/`. Doc: `component-system.md`.
- `components/component-options/` — `ComponentOption` subclasses each paired with an Angular renderer; side-panel form is `*ngComponentOutlet` driven by `option.renderer`. Doc: `component-options.md`.
- `project/` — `Project` (PixiJS `Container`) owns circuit state; exposes `viewport` (`ViewportController` — all pan/zoom/camera state) and `topology` (`WireTopology` — wire-invariant integration + the wire tool's join/split toggling), and keeps O(1) id → element maps beside the quad trees. `ProjectService` tracks the loaded/active projects. `wire-repair.ts` + `WireRepairService` audit and heal invariant-violating boards (Edit-menu "Repair Wires"; loads audit and *offer* the repair through a toast action — repairing is always user-initiated). Doc: `project.md`.
- `persistence/` — `PersistenceService` (facade: load/save dispatch + file import/export + main-slot lifecycle) over two symmetric gateways (`server/server-persistence.gateway.ts`, `browser/browser-persistence.gateway.ts`); `PromotionService` (upload-to-cloud + local-dependency queries), `ProjectMetadataStore` (name/source/dirty, `withDirtyGuard`); library lifecycle (preloads, orphan restore) is `custom-component/component-library.service.ts`. The legacy server API transports `ProjectElement[]` — *file-format v0 over HTTP*: reads route through the permanent `v0ToV1` migration, encode through the temporary `persistence/server/` codec (deleted when the native API ships). `persistence/file/` holds the **native versioned file format** + a migration chain (v0→v1, …) for save-to-file / load-from-file. Docs: `persistence.md`; the custom-component dependency/promotion system (how documents carry the customs they use, cloud promotion, UUID mapping, orphans) is `dependencies-and-promotion.md`.
- `wires/` — Wire model and rendering. Doc: `wires.md`.
- `connection-points/` — Derived visual junction dots (≥3 cardinal directions filled + ≥1 element terminates). Pure visual sugar, not persisted or selectable. Doc: `connection-points.md`.
- `rendering/` — `RendererService` (the app's single lease-counted PixiJS renderer: the board and every watch canvas are render targets of it; minimap/image-export render to textures on it), `QuadTreeContainer` (spatial indexing), `FloatingLayer` (visual host for drag ghosts + negation preview), `GraphicsProviderService` (shared texture/graphics cache), `DragCollisionState` (shared collision for drag sessions). `sessions/` contains per-interaction `DragSession` implementations (convention: sessions materialize their final state in the live project, then `ActionManager.register` it — `push` is for instantaneous non-gesture ops). `interaction/` is the DOM input layer: `PointerController` (per-canvas pointer/wheel/touch normalization with capture; PixiJS events are fully disabled) + `WorkModeRouter` (dispatch + session lifecycle, incl. the undo lock around live drags) + `interaction/tools/` (one `BoardTool` per work mode: press → session, hover previews). Doc: `rendering.md`.
- `actions/` — Command-pattern undo/redo via `ActionManager` (`push` runs `do()`, `register` records already-materialized state; `retract`/`coalesceTop` back the scissor-cut lifecycle; `locked` makes undo/redo inert during drags). Each user operation is an `Action` subclass. `ActionContainer` groups multiple actions atomically. Doc: `actions-system.md`.
- `clipboard/` — `ClipboardService` (copy/cut/paste/delete). Copy serializes selected components and wires into a typed `SerializedComponent[]`/`SerializedWire[]` snapshot. Paste deserializes fresh instances (new IDs, copied geometry), then opens a `PastePlacementSession` where the user positions the pasted elements with collision checking; the router centres the group on the cursor, or on the view when there is none. Cut = copy + delete (folded into one undo step). A scissor cut (SELECT_EXACT) registers as its own history entry; the delete (or move) that commits it coalesces the two entries (`ActionManager.coalesceTop`) so cut + delete is one undo. No separate doc (covered by `rendering.md` and `actions-system.md`).
- `work-mode/` — Interaction mode FSM (selection, placement, deletion, wire routing). Doc: `work-mode.md`.
- `simulation/` — Runs the circuit. `SimulationService` (facade: lifecycle/run-controls/user-input) → `BoardCompilerService` (circuit → `BoardDescriptor` + link→render mapping, custom components flattened; also retains a `WatchIndex` of integer tables addressing every inner circuit for watches) → `SimulationWorkerService` (main-thread bridge) → `simulation.worker.ts` (owns the `@logigator/sim` WASM engine). `LinkStateApplier` lights up powered wires/ports; snapshots fan out to the board applier plus any registered watch appliers. Owns the `SIMULATION` work mode (editing locked). Doc: `simulation.md`.
- `inspection/` — Live component inspection during simulation. Tapping an inspectable component (its config declares an `inspection` factory returning a `ComponentInspection` — the option/action-analog model in `components/`) opens its view: a floating `@logigator/ui` window on desktop; on compact, the shared non-modal bottom sheet — except `compactPresentation: 'fullscreen'` entries (watches), which stay windows on every breakpoint and render as fullscreen takeovers through a second `fullscreen` window outlet (the app template swaps the two outlets per breakpoint; only sheet-bound entries re-home on flips). Data is pull-based via `SimulationService.frame$` (per applied snapshot). Two content kinds: the ROM data inspector (read-only hex editor, addressed word highlighted) and the custom-component **watch** (`inspection/watch/` + `components/custom/sub-circuit-watch.ts`) — a live, interactive canvas view of an instance's inner circuit: a fresh headless `Project` copy lit through the `WatchIndex` by a sparse applier, breadcrumb drill-down into nested customs, inner levers/buttons drive the engine, watch canvases render through the same shared app renderer as the board; input runs through the same `PointerController` as the board (a `PanSession` with a tap action as its tool). Doc: `inspection.md`.
- `documentation/` — In-editor help. `docs-pages.ts` is the page registry (`DOC_SECTIONS` → derived `DocPageId` union; per-locale markdown assets under `assets/docs/<lang>/`, `en` fallback, loaded via the changelog's hashed-import pattern); `DocumentationService.open(pageId?, anchor?)` is the single deep-link entry point (Help menus, `docs:<page-id>` cross links inside pages — classified by `doc-link.ts` —, hint "learn more" links via `Hint.docsPage`, About dialog). The viewer (`ui/dialogs/documentation-dialog/`) is a `LgNavigation` + `LgMarkdown` two-pane dialog on desktop and a fullscreen drill-down on compact (`DialogConfig.fullscreen` bound to `layout.isCompact`). No separate doc (covered by `ui.md`).
- `automation/` — Programmatic control surface for scripts/AI agents, installed as `window.__logigator` when `environment.debug.automationApi` is on (off in prod). `AutomationApiService` is the transport-agnostic facade over existing seams (catalog reads, `applyEdit` batches → one `ActionContainer`, file round-trip, `check()` diagnostics, simulation lifecycle + absolute `setInput` + port reads, camera, region selection — `select()` **is** the select tool's marquee, scissor cut included —, editor settings); `catalog.ts` derives the type/option catalog from `ComponentProviderService` (never hand-written) and owns option-value validation; `edit-ops.ts` owns the op schema and the validate → integrate → materialize → `register` path. Doc: `automation.md`.
- `ui/` — Angular wrappers around canvas and sidebar panels. Doc: `ui.md`.

**Non-obvious patterns:**

- `setStaticDIInjector()` in `app.config.ts` — bootstraps static Angular injector so model classes (`Component`, `Wire`) can call `inject()` without being Angular-managed.
- Grid coordinates — `Project._gridSpace` has `scale = gridSize`, so circuit objects use **grid units as native `position`**. Visual children in `Component._visualSpace` (`scale = 1/gridSize`) keep pixel-authored geometry. Only remaining converter is `fromGrid` in `utils/grid.ts` (used inside `_visualSpace` and background grid). Snapping: `roundToGrid` / `roundToHalfGrid`.
- `@logigator/sim` — external npm package (separate repo, Rust→WASM) holding the simulation engine. It runs in a Web Worker; the engine free-runs (or self-paces in target mode) while the main thread pulls one delta/full snapshot per `requestAnimationFrame`. Compilation is synchronous: nets via union-find over `"x,y"` termination points, custom components flattened by cached template instantiation, dense link ids assigned in emission order. Any `CompileDiagnostic` blocks entering simulation. See `simulation.md`.
- Two serialization encodings: the **API** uses the legacy positional `ProjectElement[]` wire format (`t/p/q/r/i/o/n/s`) — *file-format v0 over HTTP*, decoded by the `v0ToV1` migration and encoded by the temporary `persistence/server/` codec; **local files** use a **native, versioned** format (named options; wires as one SVG-path-style chain string `"x,y:e5s3;…"` with relative chunk heads via `persistence/wire-chain.codec.ts`; component positions (type,y,x)-sorted and delta-encoded via `persistence/position-delta.codec.ts`) under `persistence/file/`. Files have a `version` field (absent ⇒ legacy v0; native current = v1); a migration chain upgrades older files to the newest version on load, and only the newest version is ever saved. The built-in configs' `legacyV0Slots` descriptor is the single source of truth the v0 decode and encode share. `SerializedComponent`/`SerializedWire` are a *third*, separate in-memory snapshot used by undo/redo — not a persistence format.
- Paste flow — `ClipboardService.paste()` deserializes clipboard snapshots into fresh `Component`/`Wire` instances (new IDs, copied geometry), then calls `Project.startPasteSession()`, which emits on `pasteRequest$`; the `WorkModeRouter` positions the group (centred on the cursor, else on the middle of the grid view) and opens a `PastePlacementSession`. Pasting is a non-modal drag session: elements appear as tinted ghosts in the floating layer's `dragLayer`, follow the cursor, and check collision via `DragCollisionState`. `isDragging` stays false until the user clicks on one of the ghosts, at which point `beginDrag` locks in the anchor; releasing commits at the current position. Clicking off the ghost group cancels, as does Escape (both destroy the fresh instances). `SelectionMoveSession` shares `DragCollisionState` for its own collision check.
- `src/testing/` — shared test fakes (`FakeBrowserProjectStore`, `FakeBrowserComponentStore`). In-memory stand-ins for the IndexedDB-backed stores, extracted so both `persistence.service.spec` and `custom-component.service.spec` can use them without duplication.

### UI Library (logigator-ui)

`@logigator/ui` — in-house Angular 22 component library that replaced PrimeNG in editor. Built on Angular CDK; theming is **colors-only** via `--lg-*` CSS variables. Path-mapped to source in dev (root `tsconfig.json` maps `@logigator/ui` → `logigator-ui/src/public-api.ts`), so the editor compiles it from TypeScript with no build step — it is *not* a `package.json` dependency of editor. Detailed plan: `plans/logigator-ui.md`.

**`logigator-ui/src/` layout** — one folder per component under `components/`, all re-exported from `public-api.ts`; shared helpers (`internal/`, `tokens/`) stay at `src/`:

- `components/` — one folder per component:
  - Declarative components: `button/`, `divider/`, `tag/`, `badge/`, `avatar/`, `card/`, `ripple/`, `icon-field/` (`LgIconField` + `LgInputIcon`), `input-text/`, `textarea/`, `toggle-switch/`, `checkbox/`, `select-button/`, `input-number/`, `slider/`, `tooltip/`, `popover/`, `select/`, `dialog/`, `drawer/`, `accordion/`, `tabs/`, `panel-menu/`, `navigation/` (`LgNavigation` — selectable page tree, `panel-menu`'s stateful sibling), `menu/` (`LgMenu` popup + `LgMenubar`), `paginator/`, `file-upload/`, `scroller/`.
  - Imperative services + their outlet components: `dynamic-dialog/` (`DialogService` → `DialogRef`/`DialogConfig`; `fullscreen` — optionally a live `Signal<boolean>` — turns the card into a viewport takeover), `confirm/` (`ConfirmationService` + `LgConfirmDialog`/`LgConfirmPopup`), `toast/` (`ToastService` + `LgToast`; `danger` severity maps to `error`).
- `internal/` — shared, non-exported plumbing: CDK-based `overlay`/`modal-overlay` foundation, `focus-trap`, `key-manager`, `after-paint`, `caret`, `collapse` (animated height-collapse region shared by accordion/panel-menu/navigation), `icon`.
- `tokens/` — shared types (`LgSeverity`, `LgSize`, form-field tokens).
- `styles/theme.css` defines the `--lg-*` vars; `styles/theme.tw.css` maps them into Tailwind's `@theme` for editor.

Specs sit next to source (Vitest, `yarn test:ui`). Build is `ng build logigator-ui` (ng-packagr; publishing deferred).

### Backend (logigator-backend)

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

Vitest via Angular's `@angular/build:unit-test` builder. Spec files sit next to source. Angular specs use `TestBed`; pure-logic specs don't. Shared helpers in `src/testing/`:

- `fake-browser-stores.ts` — `FakeBrowserProjectStore`, `FakeBrowserComponentStore` (in-memory IndexedDB stand-ins)
- `factories.ts` — `makeAnd`, `makeNot`, `makeWire`, `makeInput`, `makeMoveEvent` (circuit-element and pointer-event stubs)
- `action-mocks.ts` — `makeAction` (mocked `Action` with named `do`/`undo` spies)
- `vitest-helpers.ts` — `arrayWithExactContents` (asymmetric matcher replacing Jasmine's)
