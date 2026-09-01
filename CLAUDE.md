# CLAUDE.md

## Repository Layout

The repo root is a **shared Angular CLI workspace** + **Yarn 4 workspace** (corepack). Six members:

- `logigator-editor/` — Angular 22 editor (PixiJS 8, Tailwind 4), current focus
- `logigator-web/` — Angular 22 website, server-rendered (`@angular/ssr`), replacing the legacy pages
- `logigator-ui/` — `@logigator/ui`, in-house Angular component library
- `logigator-core/` — `@logigator/core`, rendering-free circuit code plus the origin-wide
  contracts; zero runtime dependencies
- `logigator-contract/` — `@logigator/contract`, the API surface as zod schemas; zod only
- `logigator-api/` — NestJS on Fastify, API only

**One shared-code rule:** the three libraries are never built. Every consumer compiles their
**source** through the root tsconfig `paths` mapping, and each application's bundler (Angular's for
the editor and the site, Rspack's for the API) inlines what it uses. No `dist/`, no `exports`, no
build ordering.

`logigator-editor`, `logigator-web` and `logigator-ui` are Angular CLI projects (`angular.json`);
the other two run on plain Yarn scripts. Each package holds the same config set: one primary
tsconfig (`tsconfig.json`, or `tsconfig.app.json`/`tsconfig.lib.json` where angular.json points at
it), `tsconfig.spec.json`, `eslint.config.mjs`, `vitest.config.ts`. Only the three applications
produce an artifact, in the root `dist/<project>/`.

Two deprecated packages stay **independent** (own `yarn.lock`/`.yarnrc.yml`, _not_ workspace
members): `logigator-backend/` (Express/TypeORM/Handlebars, still serving everything outside `/api`)
and `logigator-editor-legacy/` (Angular 17 editor).

## Dev Environment

Legacy backend config files must be created from `.example` files in `logigator-backend/config/`.
`logigator-api` needs no config files: env vars only, all defaulted (`logigator-api/.env.example`).

The dev compose stack runs both databases side by side until cutover — MySQL for the legacy backend,
**Postgres for `logigator-api`** — plus one Redis they share (the API namespaces its keys). Both are
published on localhost, so host-run tooling (`db:generate`, `db:migrate`, `test:e2e:api`) reaches
them at `postgresql://logigator:logigator@localhost:5432/logigator` and `redis://localhost:6379`.
`data/` holds both data directories and is ignored.

Caddy serves **`logigator-web` at the origin root**, so the legacy backend is off the dev origin
entirely — the same shape the Phase 6 cutover produces, and the reason the site owns the consent
bundle and the icons the other stacks link to by absolute path.

## Commands

Every workspace member runs **from the repo root**. Uniform surface: `<verb>:<package>` runs the
verb for one package, and the **bare verb runs it for every package that has it** — no `:all`
suffix, no bare shorthand for a single package (`test:*` is always a single run). Only the three
applications build; `typecheck` exists only where tsc is the sole type gate, since the Angular
projects are type-checked by their build and test targets.

```bash
yarn start:editor                   # ng serve  (start:editor:prod for the production config)
yarn start:web                      # ng serve, SSR in the dev server (same middleware as production)
yarn start:api                      # rspack --watch + node --watch (restarts on core edits too)
yarn build                          # = build:editor + build:api + build:web
yarn build:editor                   # production build → dist/logigator-editor
yarn build:api                      # rspack bundle → dist/logigator-api
yarn build:web                      # browser + server bundles → dist/logigator-web
yarn test                           # every package, single run each
yarn test:editor                    # add --include='**/some.spec.ts' for one file
yarn test:web / test:ui / test:core / test:contract / test:api
yarn test:e2e:api                   # API against real Postgres + Redis (needs DATABASE_URL, REDIS_URL)
yarn lint                           # eslint over all six; lint:fix writes the fixes
yarn typecheck                      # tsc over core, contract, api (specs included)
yarn format / format:fix            # Prettier over the whole repo
```

Database scripts run from the API package (`yarn workspace logigator-api run …`): `db:generate`
diffs the Drizzle schema into a new SQL migration under `logigator-api/drizzle/`, `db:check`
validates the migration history, `db:migrate` applies pending migrations through the bundled runner
— the same function the E2E harness and a release call, so no path applies DDL that CI has not.
`db:renormalize` re-normalizes documents an older format version wrote; with `--all`, it re-extracts
every derived row from the documents they came from.

`@logigator/ui` has no build script. The ng-packagr target in `angular.json` stays for an eventual
publish and because the unit-test builder reads its build options from it; nothing in CI runs it.

Legacy backend, from `logigator-backend/`: `yarn build` (tsc + Gulp), `yarn lint:backend`,
`yarn migration:run`, `yarn migration:generate -- -n Name`.

## Architecture

### Frontend (logigator-editor)

Angular 22 standalone components + PixiJS 8 canvas.

**`src/app/` layers** (each has a doc at `logigator-editor/docs/<name>.md`):

- `components/` — circuit element model. Each extends `Component` (PixiJS `Container`); port/bounds
  math lives in the pure, lattice-exact `component-geometry.ts`. `ComponentProviderService` is the
  registry/factory. Each built-in's config is `configFromMeta(<name>Meta, …)` over the pure
  `ComponentMeta` in core, so identity, option schemas, arity, labels and body extent are declared
  once for both sides; port counts are derived and read-only — change an option to change the arity.
- `components/component-options/` — `ComponentOption` subclasses, each paired with an Angular
  renderer and one `OptionSchema` kind in core (schema owns the constraints, class the renderer and
  live value). The side-panel form is `*ngComponentOutlet` driven by `option.renderer`.
- `project/` — `Project` (PixiJS `Container`) owns circuit state; exposes `viewport`
  (`ViewportController`) and `topology` (`WireTopology` — wire-invariant integration plus the wire
  tool's join/split toggling), and keeps O(1) id → element maps beside the quad trees.
  `ProjectService` tracks loaded/active projects. `wire-repair.ts` + `WireRepairService` audit and
  heal invariant-violating boards; repairing is always user-initiated.
- `persistence/` — `PersistenceService` (facade: load/save dispatch, file import/export, main-slot
  lifecycle) over two symmetric gateways (`server/`, `browser/`); `PromotionService`,
  `ProjectMetadataStore` (name/source/dirty, `withDirtyGuard`). The cloud API transports the
  **native versioned document**, so the server gateway has no codec of its own — it encodes with
  `CircuitFileService.toDocument` and decodes with `CircuitFileService.decode`, exactly as a file
  does — and concurrency is the document's integer `version` (a `version_conflict` is a 409).
  `persistence/file/` holds `CircuitFileService`, the Angular adapter over core's format layer.
  Docs: `persistence.md`, `dependencies-and-promotion.md`.
- `wires/` — wire model and rendering.
- `connection-points/` — derived visual junction dots (≥3 cardinal directions filled + ≥1 element
  terminates). Not persisted, not selectable.
- `rendering/` — `RendererService` (the app's single lease-counted PixiJS renderer: board, watch
  canvases, minimap and image export are all targets of it), `QuadTreeContainer`, `FloatingLayer`,
  `GraphicsProviderService`, `DragCollisionState`. `sessions/` holds per-interaction `DragSession`
  implementations (convention: materialize final state in the live project, then
  `ActionManager.register`; `push` is for instantaneous non-gesture ops). `interaction/` is the DOM
  input layer: `PointerController` (per-canvas pointer/wheel/touch normalization with capture;
  PixiJS events are fully disabled), `WorkModeRouter` (dispatch, session lifecycle, the undo lock
  around live drags), and one `BoardTool` per work mode under `interaction/tools/`.
- `actions/` — command-pattern undo/redo via `ActionManager`: `push` runs `do()`, `register` records
  already-materialized state, `retract`/`coalesceTop` back the scissor-cut lifecycle, `locked` makes
  undo/redo inert during drags. `ActionContainer` groups actions atomically.
- `clipboard/` — copy serializes the selection into a `SerializedComponent[]`/`SerializedWire[]`
  snapshot; paste deserializes fresh instances (new ids) into a `PastePlacementSession` with
  collision checking. Cut = copy + delete in one undo step. A scissor cut registers its own history
  entry, which the committing delete or move coalesces away.
- `work-mode/` — interaction mode FSM.
- `simulation/` — `SimulationService` (facade) → `BoardCompilerService` (circuit →
  `BoardDescriptor` + link→render mapping, custom components flattened; retains a `WatchIndex`
  addressing every inner circuit) → `SimulationWorkerService` → `simulation.worker.ts` (owns the
  `@logigator/sim` WASM engine). `LinkStateApplier` lights up powered wires and ports. Owns the
  `SIMULATION` work mode (editing locked).
- `inspection/` — live inspection during simulation. An inspectable component's config declares an
  `inspection` factory returning a `ComponentInspection`; the view is a floating window on desktop
  and the shared non-modal bottom sheet on compact — except `compactPresentation: 'fullscreen'`
  entries (watches), which stay windows everywhere and render through a second `fullscreen` outlet.
  Data is pull-based via `SimulationService.frame$`. Two content kinds: the ROM data inspector
  (read-only hex editor) and the custom-component **watch**, a live canvas view of an instance's
  inner circuit with breadcrumb drill-down.
- `documentation/` — in-editor help. `docs-pages.ts` is the page registry (`DOC_SECTIONS` → derived
  `DocPageId` union; per-locale markdown under `assets/docs/<lang>/`, `en` fallback, loaded via the
  changelog's hashed-import pattern); `DocumentationService.open(pageId?, anchor?)` is the single
  deep-link entry point.
- `automation/` — programmatic control surface for scripts and agents, installed as
  `window.__logigator` where the `AUTOMATION_API` esbuild define is true (off in prod, and the
  define drops the module from the bundle rather than branching around it). `catalog.ts`
  derives the type/option catalog from `ComponentProviderService` (never hand-written) and validates
  values through core's `validateOptionValue`; `edit-ops.ts` owns the op schema and the validate →
  integrate → materialize → `register` path. `select()` **is** the select tool's marquee.
- `ui/` — Angular wrappers around canvas and sidebar panels.

**Non-obvious patterns:**

- `setStaticDIInjector()` in `app.config.ts` bootstraps a static Angular injector so model classes
  (`Component`, `Wire`) can call `inject()` without being Angular-managed.
- Grid coordinates — `Project._gridSpace` has `scale = gridSize`, so circuit objects use **grid
  units as native `position`**. Visual children in `Component._visualSpace` (`scale = 1/gridSize`)
  keep pixel-authored geometry. Snapping: `roundToGrid` / `roundToHalfGrid`.
- `@logigator/sim` — external npm package (separate repo, Rust→WASM) holding the simulation engine.
  It runs in a Web Worker; the engine free-runs (or self-paces in target mode) while the main thread
  pulls one snapshot per `requestAnimationFrame`. Compilation is synchronous: nets via union-find
  over `"x,y"` termination points, custom components flattened by cached template instantiation,
  dense link ids in emission order. Any `CompileDiagnostic` blocks entering simulation.
- One serialization across all three targets: the **API**, **browser storage** and **local files**
  all carry the **native, versioned** format (named options; wires as one SVG-path-style chain
  string `"x,y:e5s3;…"`; component positions (type,y,x)-sorted and delta-encoded), whose types,
  validator and container live in `@logigator/core`. A migration chain upgrades older files on load;
  only the newest version is ever saved. The legacy positional `ProjectElement[]` shape
  (`t/p/q/r/i/o/n/s`) is **file-format v0, read-only** — it decodes old-editor `.json` exports and is
  what the Phase 6 database migration reads legacy blobs with. `SerializedComponent`/
  `SerializedWire` are a separate in-memory snapshot used by undo/redo, not a persistence format.
- `src/testing/` — shared test fakes, in-memory stand-ins for the IndexedDB-backed stores.
- Language and theme are **origin-wide, not editor-local**: both are fields of the `preferences`
  cookie (`storage/preferences.service.ts`) that the backend's pages also read and write, so a
  switch on either side moves both. Everything else the editor persists (`logigator.*`) is
  localStorage and editor-only.

### Website (logigator-web)

Angular 22, standalone and zoneless like the editor, rendered per request by `@angular/ssr` and
served by a small Node process at the **origin root**. It replaces the legacy Handlebars pages as a
feature checklist, not a route map. Phase 5a laid the foundation — i18n, shell, consent, SEO head;
the pages themselves arrive in 5b–5f (`plans/backend-rewrite.md`).

**Entry points.** `src/main.ts` (browser), `src/main.server.ts` + `app.config.server.ts` (server),
`src/server.ts` (the Express host, which the CLI's dev server imports too, so a redirect or a static
path behaves the same in development).

**`src/app/` layers:**

- `translation/` — Transloco with the editor's typed tooling **duplicated and adapted**, not
  extracted: `@logigator/ui` cannot host it without gaining a Transloco dependency. Templates use
  `*webTranslate="let t"`; TypeScript goes through `TranslationService`. The language set and
  `Accept-Language` parsing come from `@logigator/core`; `language-url.ts` is the one place a
  `/de/…` prefix is added, stripped or swapped; `language-negotiation.ts` is the cookie-then-header order the SSR
  redirect uses. `TranslationLoaderService` loads a locale chunk and, on the server, leaves it in
  the transfer state, so the browser reads the table out of the HTML instead of fetching it again.
- `theming/` — the `dark-mode` class on `<html>`, applied during the server render, so the first
  byte carries the right scheme.
- `storage/` — `PreferencesService` over core's origin-wide cookie codec, which the SSR server also
  reads before the app exists; `CookieService` reads the request header on the server and
  `document.cookie` in the browser, and writes only in the browser.
- `api/` — `ApiBaseService` mirroring the editor's: contract-typed, every response validated at the
  boundary. `apiOriginInterceptor` is what makes a server render able to call the API — it rewrites
  the relative path onto `API_ORIGIN` and forwards the visitor's cookie. It is registered on both
  platforms and inert in the browser, where `API_ORIGIN` is not provided.
- `user/` — `SessionService`, resolved before the first render so the top bar is personalized in the
  first byte, and handed to the browser through an explicit transfer-state key.
- `seo/` — `SeoService` (title, description, canonical, the four `hreflang` alternates plus
  `x-default`) driven by a `TitleStrategy`, so it runs once per completed navigation, the server
  render included. Routes carry a `seo` data entry naming their title key.
- `layout/` — the shell: top bar, compact navigation drawer, footer, and the one settings panel
  (language + theme) both of them render.
- `pages/` — one folder per page. The 404 sets the response status through `RESPONSE_INIT`; a soft
  404 would be indexable.

**Non-obvious details:**

- **Routing is `/:lang/…` for every page.** A `canMatch` guard rejects a first segment that is not a
  language, so `/nonsense` 404s instead of rendering the home page. An unprefixed URL is redirected
  by `server.ts` — a real `302`, since the target depends on the visitor's cookie and headers.
- **A language switch is a document load**, so the active language is settled at bootstrap
  (`document-language.ts`, off `PlatformLocation`) and never changes within a document. That is what
  lets the server render one language per response and `SiteLinks` hold plain prefixed strings.
- **Angular's HTTP transfer cache is off** (`withNoHttpTransferCache`): it treats the forwarded
  `cookie` header as an authorization header and skips such requests, and it keys on the URL after
  the interceptor has moved it onto the API's origin. Anything that must cross the server/browser
  boundary does so through an explicit `TransferState` key.
- **Rendered pages answer `Cache-Control: no-store`** — every one is personalized by language, theme
  and session, and the account is in both the markup and the transfer state.
- **`public/` is for URLs that are contracts with something outside the app**; anything the app
  itself renders is `import`ed, so the build hashes it (`src/assets.d.ts` types the loader's URL
  imports, `SITE_LOGO` is the example). That is what the static handler's cache policy keys off:
  `media/` and the root bundles are `immutable`, everything else expires, matched **by position, not
  by the shape of a name** — a `public/` file called `feature-overview.png` also ends in eight
  characters after a dash, and pinning one of those forever is a mistake only a rename can undo. The
  set that stays unhashed is fixed by contract: the consent bundle and its translations, the
  favicons and `site.webmanifest` (Angular rewrites its own tags in `index.html`, not these), and
  `social-card.png`, whose absolute URL the editor's own Open Graph tags name.
- **`NG_ALLOWED_HOSTS` and `NG_TRUST_PROXY_HEADERS` are required behind Caddy.** Angular refuses a
  request whose `Host` it was not told to expect and only reads forwarded headers once trusted;
  `SITE_ORIGIN` is then derived from the request URL rather than configured a second time.
- **The consent bundle** is `vanilla-cookieconsent` plus `src/consent/cookieconsent-init.js`,
  concatenated by two `scripts` entries sharing one `bundleName` — non-injected bundles keep their
  name even under `outputHashing: all`. A bundle name may not contain a slash, so `server.ts`
  redirects `/js/cookieconsent.js` (the URL the editor injects, and a contract with it) to
  `/cookieconsent.js`. The stylesheet is the library's with the `--lg-*` tokens mapped over it, and
  the bundle links it in itself, so the editor gets the styles by loading the script and nothing
  else.
- **PostHog is `posthog-js` behind a dynamic import**, in `analytics/analytics.service.ts` — the
  editor's service, trimmed to what a content site emits. A consent event for the `analytics`
  category is what loads the package and initialises it, so a declining session never downloads it
  and a server render never reaches the import. `app = 'website'` and the page's language are
  registered from `init`'s `loaded` callback, which runs before the timeout the session's own
  `$pageview` is captured from. `providePageviewTracking` adds the `$pageview` a router navigation
  makes, which stays in one document and would otherwise go uncounted.
- **`@angular/platform-server`, `@angular/router` and `@angular/ssr` are pinned to exact versions**
  matching the framework and CLI already in the lockfile: Angular's intra-framework peer
  dependencies are exact, and a caret would float them ahead of `@angular/core`.
- **`@angular/router` is the real one here and a stub in the editor.** Yarn hoists the real package
  to the root and nests the stub under `logigator-editor/node_modules`; if that ever flips, the
  router lands in the editor bundle. `yarn build:editor` is the check.

### UI Library (logigator-ui)

`@logigator/ui` — in-house Angular 22 component library on Angular CDK; theming is **colors-only**
via `--lg-*` CSS variables. Path-mapped to source, so the editor and the site compile it from
TypeScript with no build step — it is _not_ a `package.json` dependency of either. One folder per component under
`components/`, all re-exported from `public-api.ts`; specs sit next to source.

- `components/` — declarative components, plus imperative services with their outlet components:
  `dynamic-dialog/` (`DialogService` → `DialogRef`/`DialogConfig`; `fullscreen` — optionally a live
  `Signal<boolean>` — turns the card into a viewport takeover), `confirm/`, `toast/` (`danger`
  severity maps to `error`). `navigation/` is `panel-menu`'s stateful, selectable sibling.
- `internal/` — shared, non-exported plumbing: CDK-based `overlay`/`modal-overlay`, `focus-trap`,
  `key-manager`, `after-paint`, `caret`, `collapse`, `icon`.
- `tokens/` — shared types (`LgSeverity`, `LgSize`, form-field tokens).
- `styles/theme.css` defines the `--lg-*` vars; `styles/theme.tw.css` maps them into Tailwind's
  `@theme` for the editor and the site.
- **Server-render safe**: nothing the library does at construction touches a browser global. The
  overlay-backed components (drawer, popover, menu, select, dialog, window) build their overlay when
  they open, and `internal/after-paint.ts` guards `requestAnimationFrame`, so a component reached by
  a server render emits its markup and nothing else. New components keep that shape — browser
  globals belong in event handlers and `afterNextRender`, never in a constructor or `ngOnInit`.

### Shared packages (@logigator/core, @logigator/contract)

Layering is one-directional — **core ← contract ← api** — and core knows nothing about any of them.
Both are consumed like `@logigator/ui`: every consumer compiles their source through the root
tsconfig `paths` mapping. They are never built and have no `dist/`, `main` or `exports`.

- `logigator-core/src/` — `model/` (the shapes a document is made of, plus the
  `BuiltInComponentType`/`ComponentCategory`/`Direction`/`WireDirection` enums), `codecs/`
  (wire-chain, position-delta, persisted-definition), `format/` (`CURRENT_FILE_VERSION`, the
  `CircuitFileV0/V1` envelopes, the structural validator, the migration chain, the `.lgix`
  container, and `parseCircuitDocument` — the API's one ingest pipeline: migrate → validate → decode
  → catalog integrity → dependency extraction, `strict` on writes and `lenient` for the Phase 6
  migration), `catalog/` (one `ComponentMeta` per built-in — option schemas plus
  `ports`/`labels`/`body` as pure functions of the option values —, and `validateOptionValue`, the
  single definition of a legal option value), and `origin/` (the `preferences` cookie codec and
  the language set with its `Accept-Language` negotiation — what every app on the origin has to
  agree about, here for the same reason as the rest: pure data with no platform of its own).
  Boundary rule: **core = data↔data, editor = live↔data** — snapshotting live PixiJS objects stays
  in the editor. Guarantees are enforced, not
  conventional: **zero runtime dependencies**, no `@angular/*`/`pixi.js`/`rxjs` import and no
  browser globals (`eslint.config.mjs` fence), plus a `tsc` that maps _no_ paths with
  `rootDir: "src"`, so neither a sibling-package import nor a relative escape compiles.
- `logigator-contract/src/` — request/response schemas per endpoint (`*.contract.ts`), inferred
  types via `z.infer`, no codegen. `error/api-request-error.ts` holds `ApiRequestError`,
  `InvalidResponseError` and `isApiError`: the error body is contract surface, while turning a
  given transport's failure into one of them is not, so that adapter stays in each client. zod and core are its only imports, fenced the same two ways.
  Response object schemas are `.loose()` on purpose: a client holding an older contract copy must
  tolerate fields the API added rather than reject or strip them. Clients can import the types only
  (`import type`) and pay nothing at runtime.

### API (logigator-api)

NestJS on the **Fastify adapter**, API only. Env vars are validated by a zod schema
(`src/config/env.ts`) once at bootstrap; the parsed object is passed into `AppModule.forEnv(env)` and
provided globally under the `ENV` token, so providers never read `process.env`. `GET /api/meta`
reports core's `CURRENT_FILE_VERSION` plus the sign-in methods the deployment offers and doubles as
the liveness probe; `GET /api/health/ready` probes Postgres and Redis (503 naming the failing one).

**`src/` layers:**

- `config/` — the zod env schema. Every variable is defaulted so a bare `docker compose up` works;
  rules that cannot be defaulted are enforced in the schema instead (production refuses the public
  development `SESSION_SECRET`, the Google credentials must be set together or not at all, and
  `TRUST_PROXY` must name a proxy wherever cookies are `Secure`). `TRUST_PROXY` takes Fastify's own
  vocabulary — `false`, `true`, a proxy-addr preset or an address/CIDR list — because trust has to
  be pinned to an address, not a hop count; bare digits are refused, since Fastify's matcher reads
  `1` as the address `0.0.0.1`. `COOKIE_SECURE`, `TRUST_PROXY` and the two OAuth URLs are _resolved_
  in a transform, so consumers read values rather than re-deriving rules.
- `database/` — Drizzle over `pg`. `schema/` is the DDL in TypeScript (tables + `defineRelations`
  for RQBv2), `drizzle/` the generated SQL migrations, `migrate.ts` the runner both the bundle entry
  and the E2E harness call. `DB` injects a typed `Database`; no entity classes, no lazy relations.
- `redis/` — one shared node-redis client, connected in a lifecycle hook (so unit specs can
  instantiate the graph without a server) and namespaced by `REDIS_KEY_PREFIX`.
- `session/` — `@fastify/cookie` + `@fastify/session` over a small in-repo Redis store; sliding
  expiry, `saveUninitialized: false`, a per-account index of session ids (so a credential change can
  end the sessions the old one opened), and `SessionService` owning sign-in (id regenerated first),
  sign-out, and the non-httpOnly `isAuthenticated` hint cookie the editor reads — written by an
  `onSend` hook so it slides with the session cookie and a hint no session backs is cleared on the
  next request.
- `auth/` — local credentials (bcrypt via `@node-rs/bcrypt`, rehash-on-login when a stored hash
  predates the current cost), one-shot mail tokens in Redis, and Google sign-in through
  `openid-client` (code flow + PKCE, state/verifier server-side, linking only from inside an
  account). `AuthGuard` + `@CurrentUser()` are exported, never global.
- `users/` — the caller's own account: profile, password, address change (gated by the current
  password, then confirmed by mail), avatar, deletion. A session alone is proof of intent for none
  of the three: it would otherwise be a complete takeover, since a new address confirms a password
  reset.
- `mail/` — nodemailer plus rendering functions, four locales, HTML and text; unset `SMTP_URL` logs
  the mail with its link instead of sending.
- `storage/` — images on a volume. Every upload is decoded and re-encoded by `ImageService`
  (sharp/libvips) rather than stored: the bytes and the declared content type are the client's word,
  and accepted formats are checked against what libvips _detects_, so an SVG it would happily
  rasterize is refused. Each asset becomes a fixed matrix of size × format declared once in
  `image-variants.ts`, written into one directory per asset under a two-hex shard of its id
  (`profile/a3/<uuid>/256.webp`). The row holds only that id, a fresh one per write, so URLs are
  immutable and a half-written asset is unnameable; deleting is removing the directory, which lets
  the matrix change without stranding what an older one named. The whole volume is served under
  **one URL root, `/files`**, because the legacy backend answers `/profile/…` and `/preview/…` from
  its own disk on the same origin until cutover. `OrphanSweepService` (nightly) deletes asset
  directories no row points at, sparing anything younger than `STORAGE_SWEEP_GRACE_MINUTES` — an
  upload in flight is a directory no row names yet.
- `documents/` — projects and components. **Every write goes through
  `CircuitDocumentService.ingest`**, which parses with core's `parseCircuitDocument` in strict mode
  and stores what parsing produced, so a row this server wrote is a document it can read. Everything
  else on a row is derived there and never taken from a client: counts, dependency edges, and a
  component's `numInputs`/`numOutputs`/`labels`. Two envelope fields belong to the server — the
  stored `document.name` is written from the row's column, and the client-asserted `attribution`
  chain is stripped, with only the immediate parent's id kept to resolve against real rows
  (`forkedFromId`, the attribution trust anchor). Concurrency is the integer `version` in the
  `WHERE` of one guarded `UPDATE` (409 `version_conflict`); it bumps for the document, name, symbol
  and description, never for visibility or a regenerated link. No write computes a column from a
  value it read in an earlier statement: a rename edits the document's own copy of the name through
  `jsonb_set` and increments `version` in SQL, so a save landing at the same moment keeps its
  circuit. `circuit-queries.ts` holds the reads over the half both tables share, **overloaded per
  table** because Drizzle's builder types are conditional on the table and cannot resolve against an
  unresolved type parameter. Previews are `PreviewService` (both themes in one multipart request,
  both replaced together; not an edit, so no version bump). `RenormalizeService` is the format-bump
  and re-extract job — keyset-paginated, one transaction per row, idempotent; it does not bump
  `version` but does put it in the `WHERE`, so a row a save reached first is skipped.
- `sharing/` — reading a document by its share link and cloning it. The link is a **capability**:
  the read needs no session and ignores `public`. A clone copies the whole transitive dependency
  graph (one recursive CTE with a path array as a cycle guard) and **rewrites every embedded
  snapshot's `source.id`** to the new copies; a snapshot whose master no longer exists loses its
  `source` instead. New ids are chosen before any insert, so insert order is irrelevant; copies go
  through the same write path, so their ports and edges are re-derived, and a copy is always private.
- `community/` — the public half: listings, stars, stargazers, public profiles. **Every predicate
  carries `public = true`**, which is why these queries live apart from the owner-scoped ones.
  Documents are addressed by their `link`, so regenerating the token takes the public page down with
  it. Star counts and "did the caller star it" are correlated subqueries (no counter column, no
  `GROUP BY` to keep in step with the select list); ranking is stars then edit time, so paging is
  stable. `@SessionUserId()` reads the session without requiring one — the reason `AuthGuard` is
  per-route rather than global.
- `reports/` — `POST /api/report-error`, keeping the path and field-by-field shape the editor sends.
  Unauthenticated and rate-limited; every report is one log line, and a configured `REPORT_MAIL_TO`
  also gets it with the circuit attached.
- `common/` — the error filter and `ApiException`, `ApiValidationPipe` (global, over NestJS's
  `StandardSchemaValidationPipe`: the framework validates whatever a route declares through
  `@Body({ schema })`/`@Query({ schema })`, and the subclass exists for the failure body alone,
  since the contract's error shape is what clients read), the Redis-backed `@RateLimit()` guard, the
  `UuidParam` pipe (every id is a `uuid` column and Postgres rejects a comparison against something
  that is not, so a mistyped path is a 404 rather than a 500), and locale resolution from the shared
  `preferences` cookie.
- `app.setup.ts` — the plugin registration and route prefix shared by `main.ts` and the E2E harness,
  so the specs exercise the same HTTP layer as production.

**Build: Rspack** (`rspack.config.mjs`), which is what lets the API compile the shared packages from
source like every other consumer. The config stays local rather than using the CLI's builder: that
assumes one entry where there are three, and its bare `nodeExternals()` would externalise the
workspace packages. The bundle is **ESM**, matching the `"type": "module"` on the package and the
ESM-only `@nestjs/*` packages; the settings mirror the CLI builder's own ESM branch.

**Non-obvious build details:**

- `builtin:swc-loader` needs `legacyDecorator` + `decoratorMetadata`, and the tsconfig keeps
  `experimentalDecorators`/`emitDecoratorMetadata` in step — Nest resolves constructor dependencies
  from `design:paramtypes`, so losing either breaks DI at runtime.
- **`tsconfig.json` is where the workspace aliases live**, and `resolve.tsConfig` points the bundler
  at it, so bundler and type checker cannot drift. `baseUrl` is declared _there_ rather than
  inherited: Rspack's resolver reads it relative to the file it is handed. The mapping is not the
  layering fence — `rootDir` is the repo and every member is symlinked into the root
  `node_modules`, so a relative escape type-checks. `eslint.config.mjs` is the fence in the API and
  the contract; `logigator-editor/package.json` declares `"exports": {}` so a bare deep import of
  editor source cannot resolve. Core's `rootDir: "src"` plus empty `paths` is the one structural one.
- **`webpack-node-externals` needs `allowlist: [/^@logigator\//]`** — Yarn symlinks workspace
  members into `node_modules`, so without it they are left as a runtime import of a package with no
  entry point.
- **The build emits `dist/logigator-api/package.json` holding `{ "type": "module" }`.** The artifact
  lands in the workspace's root `dist/` and would otherwise inherit the root manifest, which
  declares no type; without the marker every entry dies on its first `import`.
- **`sharp` stays external** and must: it is a native module, so leaving it a runtime import is the
  only thing that works. Nothing pins architectures in `.yarnrc.yml`, so the lockfile carries every
  prebuilt binary including `@img/sharp-linuxmusl-x64`, which an alpine runtime image needs.
- **No minification.** Nest reflects on class and function names, so mangling would break DI.
- **`output.clean` is off** and the dev loop watches the output _directory_
  (`node --watch --watch-path`): cleaning deletes and recreates `main.js`, which drops a file-level
  watch and silently stops restarts.
- Vitest discovers `tsconfig.json` **by convention** to pick up `emitDecoratorMetadata`; that is why
  the Node packages name their primary config `tsconfig.json`. Rename it and DI in specs breaks with
  `Cannot read properties of undefined`.
- `rootDir: ".."` in the Node packages that map `paths`: their programs legitimately contain
  sibling-package source, and tsc validates the inferred root even under `noEmit`.
- **`fastify` is pinned to the exact version `@nestjs/platform-fastify` depends on.** With two
  copies installed, a plugin's type augmentation lands on one and Nest's `register` reads the other,
  so `app.register(fastifyCookie)` fails to type-check.
- **`migrate` and `renormalize` are the second and third Rspack entries**; the deploy artifact ships
  `drizzle/` beside them, since the runner reads migration SQL from disk and a release applies
  migrations with plain `node`. drizzle-kit only ever _generates_ them. Unlike the migration runner,
  `renormalize` boots the real application container: rewriting documents through the same
  parse-and-extract path every other write uses is what keeps the derived tables from drifting.
- Drizzle is pinned to an exact `1.0.0-rc` build. RQBv2 `defineRelations`, the DDL-snapshot migration
  format and the consolidated zod integration are 1.0-only surfaces with no compat path from 0.45;
  bump the pin when 1.0 stable ships. Relations name their columns explicitly and through-relations
  carry matching aliases — a user has two relations to projects (owns, starred) and the builder
  refuses to guess.

### Legacy backend (logigator-backend)

Express with **routing-controllers**, **TypeDI**, **TypeORM** (MySQL), **Passport.js**,
**Handlebars** SSR. Answers everything outside `/api` until the Phase 6 cutover. Per-layer docs live
in `logigator-backend/docs/` (`controllers.md`, `entities.md`, `repositories.md`, `services.md`,
`middleware.md`, `form-validation.md`, `i18n.md`, `server-side-rendering.md`, `file-storage.md`,
plus cross-cutting `architecture.md`, `authentication.md`, `configuration.md`, `build-system.md`).

**Non-obvious patterns:**

- `useContainer` triple registration — the `typedi` Container is shared across
  `routing-controllers`, TypeORM and `class-validator`.
- `TranslationMiddleware` strips the `/en/` language prefix from `request.url` before routing, so
  controller routes stay clean (e.g. `/features`).
- `PersistedResource` — files on disk, not in the DB (circuit data included, as `ProjectFile`/
  `ComponentFile` JSON blobs). Lifecycle hooks manage CRUD, MD5 avoids unnecessary writes, and
  `_cacheable = true` subclasses regenerate UUID filenames on update for cache-busting.
- Lazy relation proxy properties — `classToPlain` cannot resolve `Promise<T>`, so controllers
  populate private `__property__` fields before serialization, gated by `@Expose` groups.
- Form errors flow `FormDataError` → `formErrorMiddleware` → session flash → Handlebars.

### Backend ↔ Frontend

Caddy serves `logigator-web` at the origin root and `logigator-editor` as a static SPA under
`/editor`. Both call `logigator-api` the same way; the site additionally calls it **from its server
render**, over the internal network with the visitor's session cookie forwarded.

The SPA calls `logigator-api` — `/api/projects`,
`/api/components`, `/api/share`, `/api/user` — importing its request/response types from
`@logigator/contract` and validating every response against those schemas at the boundary
(`api/services/api-base.service.ts`; a failure becomes an `ApiRequestError` carrying the API's own
`code`). Circuit data crosses the wire as the native versioned document and is stored as one JSONB
column. The editor can independently save and load circuits as **local files** in the same format.

## Testing

The editor, `logigator-web` and `@logigator/ui` run Vitest via Angular's `@angular/build:unit-test`
builder; core, the contract and the API run **plain Vitest** in Node (own `vitest.config.ts`, no Angular, no jsdom;
the API's specs boot Nest testing modules). The Node packages' configs alias
`@logigator/core`/`@logigator/contract` to their source, mirroring the tsconfig `paths` mapping, so
specs compile exactly what ships. Spec files always sit next to source. Angular specs use `TestBed`.

Shared editor helpers in `src/testing/`: `fake-browser-stores.ts` (in-memory IndexedDB stand-ins),
`factories.ts` (`makeAnd`, `makeNot`, `makeWire`, `makeInput`, `makeMoveEvent`), `action-mocks.ts`
(`makeAction`), `vitest-helpers.ts` (`arrayWithExactContents`).

The API additionally has an **E2E suite** (`logigator-api/test/*.e2e-spec.ts`, its own
`vitest.e2e.config.ts`, `yarn test:e2e:api`) that boots the real application through `app.setup.ts`
and drives it with injected requests. It is a separate script because it needs a real Postgres and
Redis: `yarn test:api` must stay runnable anywhere, and a suite that skipped itself without a
database would report green having tested nothing. `test/harness.ts` creates a throwaway database
per spec file and migrates it with the runner a release uses; Redis keys are namespaced per run and
deleted afterwards. Only two things differ from production: the mail transport is captured
(`test/mail-capture.ts`, so specs read the link a recipient would click) and bcrypt runs at its
minimum cost. `test/cookie-jar.ts` carries cookies across requests the way a browser would,
`test/circuits.ts` builds documents through core's own encoder rather than hand-written JSON (a
fixture gets the wire chain and the position deltas subtly wrong), `test/assets.ts` maps a served
URL back to its path on the volume, and `test/row-lock.ts` runs a request while an uncommitted
transaction holds the row it writes — the only way an injected request meets a concurrent write —
waiting for the block rather than sleeping so the interleaving is a fact of the run.
