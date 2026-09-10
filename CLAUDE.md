# CLAUDE.md

## Repository Layout

The repo root is a **shared Angular CLI workspace** + **Yarn 4 workspace** (corepack). Seven members:

- `logigator-editor/` — Angular 22 editor (PixiJS 8, Tailwind 4), current focus
- `logigator-web/` — Angular 22 website, server-rendered (`@angular/ssr`), replacing the legacy pages
- `logigator-ui/` — `@logigator/ui`, in-house Angular component library
- `logigator-core/` — `@logigator/core`, rendering-free circuit code plus the origin-wide
  contracts; zero runtime dependencies
- `logigator-contract/` — `@logigator/contract`, the API surface as zod schemas; zod only
- `logigator-docs/` — `@logigator/docs`, the authored documentation: eleven pages of markdown in
  four locales, their screenshots, the page tree and the search matcher as pure data, plus the
  changelog and its parser; no dependencies at all
- `logigator-api/` — NestJS on Fastify, API only

**One shared-code rule:** the four libraries are never built. Every consumer compiles their
**source** through the root tsconfig `paths` mapping, and each application's bundler (Angular's for
the editor and the site, Rspack's for the API) inlines what it uses. No `dist/`, no `exports`, no
build ordering.

`logigator-editor`, `logigator-web` and `logigator-ui` are Angular CLI projects (`angular.json`);
the other three run on plain Yarn scripts. Each package holds the same config set: one primary
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

The compose `api` service **applies migrations before it starts the API**, so a fresh clone and a
pull that brings new ones both come up on their own — the environment doing it, never the server. A
migration generated while the stack runs lands on the next `docker compose restart api`, not on the
next rebuild, and a database left _ahead_ of the checked-out branch is dealt with by hand: no down
migrations exist, so it is `DATABASE_MIGRATION_CHECK=false` or a database dropped and migrated
again.

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
yarn test:web / test:ui / test:core / test:contract / test:docs / test:api
yarn test:e2e:api                   # API against real Postgres + Redis (needs DATABASE_URL, REDIS_URL)
yarn lint                           # eslint over all seven; lint:fix writes the fixes
yarn typecheck                      # tsc over core, contract, docs, api (specs included)
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
- `documentation/` — in-editor help. The pages themselves are `@logigator/docs`; this holds the
  editor's half of them — `docs-pages.ts` maps each id to its hashed markdown URL per language (`en`
  fallback, the changelog's hashed-import pattern) and to the title key it is shown under.
  `DocumentationService.open(pageId?, anchor?)` is the single deep-link entry point.
  `DocsSearchService` is the viewer's search field: it fetches all eleven pages of the active
  language once, indexes them through the member's matcher, and the results replace the content
  pane.
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
- **The production build ships its source maps**, and `logigator-web`'s does too. PostHog error
  tracking symbolifies a stack trace from the map the bundle's own `sourceMappingURL` names, so the
  `.map` files are part of the deployed artifact rather than something a release uploads out of
  band — which is what keeps the whole pipeline unchanged, the editor still being built inside the
  image. That makes `hidden` load-bearing: turning it on removes the comment and the traces go back
  to minified. `vendor` is on so a frame inside `pixi.js` resolves to its TypeScript rather than the
  published `.mjs`; `styles` is off, since no stack trace names a stylesheet. The one thing this
  cannot do is symbolify a crash reported after the next release replaced the hashed files.

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
  first byte, and handed to the browser through `TransferHandoffService`; `AuthProvidersService`
  (which sign-in methods `GET /meta` reports, so the Google button is drawn only where the round
  trip works); `auth-guards.ts` — `guestGuard` keeps a signed-in visitor off the sign-in pages,
  `authProvidersGuard` resolves the methods before one activates.
- `transfer/` — `TransferHandoffService`, the consume-once server → browser hand-off. Every API read
  a server render resolves goes through it; skipping it silently repeats the request after
  hydration. `contentSection()` is the pattern packaged: one listing a page's guard resolves,
  exposing `entries` / `failureKey` / `retry`, where a failed read **resolves to a translation key**
  rather than rejecting — a rejection transfers nothing, so hydration would repeat a request that
  already failed — and an empty list stays distinct from a failed one. The retry deliberately
  bypasses the hand-off: what it holds is the answer that failed.
- `seo/` — `SeoService` (title, description, canonical, the four `hreflang` alternates plus
  `x-default`, and the Open Graph locale set) driven by a `TitleStrategy`, so it runs once per
  completed navigation, the server render included. Routes carry a `seo` data entry naming their
  title key. Each language version canonicalizes to **itself**, and the unprefixed URL is
  `x-default`'s alone. The language the head describes is read off the URL, not the translation
  service. It also emits the page's **JSON-LD graph**: one `<script>` holding a `@graph` whose
  nodes reference one another by `@id`, so the site is named once rather than in each. Site level
  is `WebSite` + `Organization`; a page adds its own through the route's `jsonLd` factory (the home
  page's is the editor as `SoftwareApplication`/`WebApplication` plus the explainer's
  `VideoObject`), and a two-step `BreadcrumbList` is derived from the URL unless the route sets
  `breadcrumb: false` — the 404 and `verify-email/:token`, whose crumb would name the token.
  `structured-data.ts` holds the node types and the serializer; it escapes every `<`, because 5d
  puts circuit names and usernames in the graph, and hands factories absolute URLs, a crawler
  having no document to resolve the build's `./media/…` imports against.
- `layout/` — the shell: the top bar, the compact navigation drawer, the footer, and the account
  menu. One 56px `bg-primary-400` bar at every width, the treatment the editor's title bar carries
  (the primary scale is scheme-independent, so bar and ink are the same in light and dark); its
  links wash black on hover rather than reaching for a scheme-following token. The bar carries no
  gear and no auth buttons: `user-menu/` fills `@logigator/ui`'s shared account control with the
  language and theme sections and the sign-in/sign-out rows, and it is there at every width, which
  leaves the drawer only the destinations the bar drops below `md`.
- `forms/` — the bridge from the contract's zod schemas to reactive forms, so a field's rules are
  the ones the API enforces: `zodValidator` puts a schema on a control and records the failing
  _issue codes_ (never zod's English message text), `fieldError` maps a code to a translation key
  and is driven by the **root** form's events, so a cross-field rule re-decides when the sibling is
  the field edited. `setServerError` parks a verdict only the server can reach — a taken address —
  outside the validator chain, so the next edit drops it. The body a form submits is the request
  schema's `safeParse` output, which is what makes `.trim().toLowerCase()` apply.
- `documents/` — how a circuit document is presented wherever one appears: `CircuitTiles` (the grid
  or the edge-to-edge rail) over `@logigator/ui`'s `LgCircuitTile`, plus the listing-row → tile
  mapping, and `web-circuit-preview` for a render shown outside a tile (an examples row, later a
  document's own page). Both pick the preview for the active theme in TypeScript — the two themes
  are separate renders, so a CSS-hidden second image would be downloaded for nothing; the tile does
  it because it takes one theme's ladder, the preview because it draws the `<picture>` itself
  through `@logigator/ui`'s exported `pictureFor`.
- `states/` — the shared empty and section-error objects (`web-empty-state`, `web-section-error`).
  There is no skeleton: every list is resolved by a guard, so the first byte carries content and a
  client-side navigation waits.
- `design/` — the design language's own visual devices, as components rather than markup a page
  repeats. `web-wire-run` is the orthogonal rule that steps and tees between two blocks; its
  1px borders are why it is not a scaled SVG.
- `pages/` — one folder per page; `pages/auth/` holds the four sign-in pages plus the card frame and
  the Google entry they share. `pages/home/` resolves its three listings through `contentSection()`
  - `homeContentGuard`.
    `pages/examples/` is the seed account's public projects, one row each — the render beside the
    description that teaches it, sides alternating — since a tile has nowhere to put a description;
    it is also where the **inner-page header** (h1 + lede in `page-wrap`, no eyebrow, the rule under
    it being the first row's) is set for the pages that follow. `pages/legal/` is the imprint and the
    privacy policy: one component for both, the document it draws named in route data, over markdown
    per locale in `content/<page>/<lang>.md`. `pages/docs/` is the editor's own manual, published:
    the index at `/:lang/docs` and one generated route per page under it, the topic tree beside the
    prose as real links, the pages and their screenshots coming from `@logigator/docs`. The index
    is also the search results page (`?q=`), the one surface wide enough for them.
    `pages/changelog/` is every release of the editor, the version and date beside the notes, over
    the same `@logigator/docs` markdown the editor's "what's new" dialog shows; the page draws the
    release headings itself, so each carries the `id` its feed entry links to. The 404 sets
    the response status through `RESPONSE_INIT`; a soft 404 would be indexable.

**Non-obvious details:**

- **Routing is `/:lang/…` for every page.** A `canMatch` guard rejects a first segment that is not a
  language, so `/nonsense` 404s instead of rendering the home page. An unprefixed URL is redirected
  by `server.ts` — a real `302`, since the target depends on the visitor's cookie and headers.
- **A language switch is a navigation.** `lang` is a route parameter, and `languageTableGuard` on
  it loads the table before the route activates, so the switch and the browser's back button both
  carry the translations with them and no page renders through its keys. Switching is therefore
  `navigateByUrl(urlInLanguage(lang, router.url))` plus the cookie write; nothing else calls
  `TranslationService.setActiveLang`. The prefix is part of every path, so `SiteLinks` are signals
  off the active language and anything else holding a prefixed string has to be too — a link left
  behind sends the next click back to the language just left. A document still opens in the
  language its URL names (`document-language.ts`, off `PlatformLocation`, so server and browser
  agree), which is what lets a server render answer one language per request.
- **Angular's HTTP transfer cache is off** (`withNoHttpTransferCache`): it treats the forwarded
  `cookie` header as an authorization header and skips such requests, and it keys on the URL after
  the interceptor has moved it onto the API's origin. Anything that must cross the server/browser
  boundary does so through an explicit `TransferState` key — `TransferHandoffService` for API reads,
  the translation loader's own key for the locale table.
- **Rendered pages answer `Cache-Control: no-store`** — every one is personalized by language, theme
  and session, and the account is in both the markup and the transfer state.
- **A one-shot mail token is redeemed from the browser, never from a render.** `verify-email/:token`
  fires its `POST` in `afterNextRender`; a server render happens for every crawler and every mail
  client that fetches a link to preview it, and any one of those would spend the token before the
  recipient clicked. `afterNextRender` is gated on the `ngServerMode` global rather than on
  `PLATFORM_ID`, which is what a spec has to set to exercise the server side.
- **A sign-in destination is a `returnUrl` query parameter**, validated by core's `safeReturnPath` on
  both sides — the site drops one it will not navigate to, and the API refuses to redirect to one,
  since its OAuth routes are unauthenticated and a caller-chosen target is an open redirect. Google
  carries it in the flow record the `state` names, not through Google.
- **`src/tailwind.css` is where the site's own design language lands**: `--font-mono` (Roboto Mono,
  the editor's canvas face), a `lattice` utility for the editor's dot ground, and `page-wrap` — the
  content column and its gutter, which the bar, the footer and every section share so they align.
  It publishes the gutter as `--page-gutter`, which is what lets the examples rail bleed past it by
  exactly that much. Everything else comes from `@logigator/ui`'s tokens; the site adds no colour.
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
  `SITE_ORIGIN` is then derived from the request URL rather than configured a second time. An
  untrusted `x-forwarded-*` is **deleted**, not ignored, so the list also names every proxy header
  the API hop passes on — `x-forwarded-for`, which the rate limiter buckets by. The scheme has to be
  trusted for the request URL to carry it, and the hop then reads that URL rather than the header,
  so a deployment told to trust nothing forwards nothing.
- **The consent bundle** is `vanilla-cookieconsent` plus `src/consent/cookieconsent-init.js`,
  concatenated by two `scripts` entries sharing one `bundleName` — non-injected bundles keep their
  name even under `outputHashing: all`. A bundle name may not contain a slash, so `server.ts`
  redirects `/js/cookieconsent.js` (the URL the editor injects, and a contract with it) to
  `/cookieconsent.js`. The stylesheet is the library's with the `--lg-*` tokens mapped over it, and
  the bundle links it in itself, so the editor gets the styles by loading the script and nothing
  else.
- **A legal page's text is a chunk, not a locale key.** `.md` is a `text` loader in the build, so
  each `pages/legal/content/<page>/<lang>.md` compiles into a dynamic-import chunk of its own on
  both bundles. The locale table stays the size of the interface's strings — the privacy policy
  alone is 60–75 kB per language, and that table travels in every page's first byte — while a guard
  awaits the import, so the server render carries the whole document and the browser downloads
  exactly the language it draws, hashed and cached past the visit. Nothing crosses through
  `TransferHandoffService`: what it would carry is that same text a second time. The imports are
  written out per language rather than assembled from a template literal, so `Record<LanguageId, …>`
  makes a missing file a compile error. `@logigator/ui`'s `lg-markdown` renders it, which is what
  puts `ngx-markdown` and `marked` in the site's dependencies and moved the initial budget to 900 kB
  (still eager, for the reason the auth pages are). The renderer emits no heading ids — a
  `#fragment` resolves against `headingSlug` of a heading's own text — so each locale's table of
  contents names its own slugs, and a spec holds every one of them to a heading that exists.
- **A documentation page is the same chunk-per-language shape**, one route per page generated from
  `@logigator/docs`'s tree rather than `docs/:id`: the title key, the breadcrumb ancestors and the
  markdown twin are then static route data, and an id that names no page falls to the 404 with its
  status. The page draws no heading of its own — the markdown opens with its own `# …` — and a
  `docs:<id>` cross link is **rewritten to a real href** through `lg-markdown`'s `assetUrls` rather
  than intercepted, so a crawler follows it; the click is still claimed and routed in-app.
- **Documentation search indexes the same chunks the pages are** — 16–19 kB gzipped per language,
  hashed, so it is paid once and the page a result opens is already downloaded. A generated index
  would be the prose a second time in the repository, stale on the next copy edit. A `?q=` render
  resolves its own results through a guard like every other list here, and hands them to the browser
  through `TransferHandoffService`; the index is **module state** (`pages/docs/doc-index.ts`), since
  a server request has its own injector and a provider-held one would be rebuilt per visitor. The
  field's form carries `action`/`method`, so search works with no JavaScript.
- **A reader arriving from a search sees the words marked in the document**, through the CSS
  Custom Highlight API rather than markup: `lg-markdown` takes a `highlightMatches` function (the
  matching rule is the consumer's, the library importing no `@logigator/docs`), turns what it
  reports into `Range`s and styles them with `::highlight()`. The terms are the `?q=` a result link
  carries, so a reload or a paste marks the same words.
- **A fragment scrolls off `lg-markdown`'s `ready`, not the router.** The renderer emits no heading
  ids, so `anchorScrolling` finds nothing and `scrollToHeading` matches `headingSlug` of a heading's
  own text instead — and the content is assigned asynchronously, so `ready` is the only point at
  which there is a heading to find.
- **Every documentation page has a raw-markdown twin at `/:lang/docs/<id>.md`**, answered by
  `server.ts` and named in the page's head as `<link rel="alternate" type="text/markdown">`. It runs
  the same destination rewrite the renderer does — `resolveMarkdownUrls`, which lives in
  `@logigator/ui/internal/markdown-urls` so the SSR host can apply it without pulling in Angular —
  but roots the URLs, markdown carrying no `<base href="/">`.
- **The changelog's Atom feed is `/:lang/changelog.atom`**, one feed per language, also answered by
  `server.ts` and named in the page's head beside the twin (`SeoService.setAlternate` is addressed
  by media type, the language alternates being matched by `hreflang`). Entry content is the release
  notes rendered by `marked` and **escaped as text** — `content type="html"`, never CDATA — and each
  entry's id is the release's heading on the page. Its feed-level name comes from the document's own
  `# …` rather than a locale key: it is generated outside the Angular app, and the markdown is
  already in the language the feed is for. It is also the one response whose body depends on the
  host it was asked for, which is what `request-origin.ts` is: the origin as `@angular/ssr` derives
  it (`createWebRequestFromNodeRequest` with the proxy headers `NG_TRUST_PROXY_HEADERS` names),
  refused for a host outside `NG_ALLOWED_HOSTS` so a `Host:` of someone's choosing cannot end up
  inside the feed's links. It refuses rather than allows what an unset list does not name — the
  build target sets no `allowedHosts`, so Angular's own list is empty until the variable fills it
  and a deployment that forgot it already answers nothing — leaving loopback alone, for the
  developer running the process directly.
- **PostHog is `posthog-js` behind a dynamic import**, in `analytics/analytics.service.ts` — the
  editor's service, trimmed to what a content site emits. A consent event for the `analytics`
  category is what loads the package and initialises it, so a declining session never downloads it
  and a server render never reaches the import. `app = 'website'` and the page's language are
  registered from `init`'s `loaded` callback, which runs before the timeout the session's own
  `$pageview` is captured from. `providePageviewTracking` adds the `$pageview` a router navigation
  makes, which stays in one document and would otherwise go uncounted.
  Stack traces are symbolified from the source maps the production build ships, as the editor's are.
  The SSR build emits maps for the server bundles as well, which nothing reads unless the Node
  process runs with `--enable-source-maps`.
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
  `form-field/` is the stringless label/hint/error scaffold around one projected control; it hands
  the consumer a `describedBy` through `exportAs` rather than writing attributes into projected
  content, so the wiring is in the server's first byte.
  `user-control/` is the account control both bars share — trigger, panel scaffold and section
  caption; the sections themselves are projected through a `#sections` template rather than
  `<ng-content>`, the panel's overlay being built again on every open.
  `circuit-tile/` is the one tile examples, community and my-area all use. The card is **not** an
  anchor: the author inside it is a destination of its own and anchors cannot nest, so the consumer
  projects two of them — `a[lgCircuitTileLink]`, an empty overlay stretched over the card, and
  `a[lgCircuitTileAuthor]`, lifted above it by `z-1` — and routes both itself, which is what keeps
  `@angular/router` out of the library. It takes one theme's preview ladder, not both, and the star
  count's screen-reader word is an input like every other string it shows.
- `internal/` — shared plumbing, not exported unless something outside genuinely needs the same
  rule: CDK-based `overlay`/`modal-overlay`, `focus-trap`, `key-manager`, `after-paint`, `caret`,
  `collapse`, `icon`, `picture` (the `<picture>`/`srcset` grouping the avatar and the circuit tile
  share, which turns an image ladder into one `<source>` per encoding in the caller's own preference
  order — `pictureFor` is in `public-api.ts` because a consumer drawing a preview of its own has to
  group it the same way, and a second copy of the rule would drift).
- `tokens/` — shared types (`LgSeverity`, `LgSize`, form-field tokens).
- `styles/theme.css` defines the `--lg-*` vars; `styles/theme.tw.css` maps them into Tailwind's
  `@theme` for the editor and the site.
- **Server-render safe**: nothing the library does at construction touches a browser global. The
  overlay-backed components (drawer, popover, menu, select, dialog, window) build their overlay when
  they open, and `internal/after-paint.ts` guards `requestAnimationFrame`, so a component reached by
  a server render emits its markup and nothing else. New components keep that shape — browser
  globals belong in event handlers and `afterNextRender`, never in a constructor or `ngOnInit`.

### Shared packages (@logigator/core, @logigator/contract, @logigator/docs)

Layering is one-directional — **core ← contract ← api** — and core knows nothing about any of them;
`@logigator/docs` sits beside them and depends on nothing at all. All three are consumed like
`@logigator/ui`: every consumer compiles their source through the root tsconfig `paths` mapping.
They are never built and have no `dist/`, `main` or `exports`.

- `logigator-core/src/` — `model/` (the shapes a document is made of, plus the
  `BuiltInComponentType`/`ComponentCategory`/`Direction`/`WireDirection` enums), `codecs/`
  (wire-chain, position-delta, persisted-definition), `format/` (`CURRENT_FILE_VERSION`, the
  `CircuitFileV0/V1` envelopes, the structural validator, the migration chain, the `.lgix`
  container, and `parseCircuitDocument` — the API's one ingest pipeline: migrate → validate → decode
  → catalog integrity → dependency extraction, `strict` on writes and `lenient` for the Phase 6
  migration), `catalog/` (one `ComponentMeta` per built-in — option schemas plus
  `ports`/`labels`/`body` as pure functions of the option values —, and `validateOptionValue`, the
  single definition of a legal option value), and `origin/` (the `preferences` cookie codec, the
  language set with its `Accept-Language` negotiation, and `safeReturnPath` — what every app on the
  origin has to agree about, here for the same reason as the rest: pure data with no platform of its
  own).
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
- `logigator-docs/src/` — `pages/<lang>/<id>.md`, `pages/<lang>/images/` and `changelog/<lang>.md`,
  plus `docs-structure.ts`
  (the section/page tree as ids, and the `DocPageId` union both viewers' targets are checked
  against), `images.ts` (the screenshot import map, written by the capture tool), `parseDocsLink`
  and `docs-search.ts` — the search matcher, so both viewers rank identically. It takes the
  renderer's `headingSlug` as an argument rather than reimplementing it: a second definition of
  that rule would send half the results to the top of the page.
  **The member imports no markdown**, and must not: the editor's loader emits a `.md` as a file and
  the website's as text, so each app writes its own import map out per page and language, the way
  `pages/legal/content/` is. The screenshots _are_ shared — both apps emit a picture through a
  `file` loader — which works because an app's ambient `*.png`/`*.gif` declaration is program-global
  and reaches library source. A page's title is a translation key in each app rather than the
  markdown's own `# …`: both viewers build their navigation before any body is loaded.
  `changelog.ts` is the changelog's own half of that split: the editor's dialog renders the document
  whole, so `parseChangelog` exists for the website, which draws one block per release and one feed
  entry per release. A `## <version> — <date>` heading that does not parse **throws** rather than
  being skipped — a mistyped date would otherwise drop a release out of one language silently.

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
  `migration-state.ts` is the startup gate: the pool lifecycle hook that proves the database
  reachable also proves it carries **exactly** the migrations the build ships, so a boot on a schema
  the code was not written against fails instead of answering requests. Drift is fatal in both
  directions — pending migrations, migrations the build does not carry (there are no down migrations
  to walk a schema back, so the fix is the matching build), and a migration whose file changed after
  it was applied, which only the recorded digest can catch. It is a gate, not a repair: nothing
  migrates on boot, since drizzle's migrator reads the applied set before opening its transaction
  and takes no lock, so replicas booting together would race on the same DDL.
  `DATABASE_MIGRATION_CHECK=false` forces a boot the check would refuse.
- `redis/` — one shared node-redis client, connected in a lifecycle hook (so unit specs can
  instantiate the graph without a server) and namespaced by `REDIS_KEY_PREFIX`.
- `session/` — `@fastify/cookie` + `@fastify/session` over a small in-repo Redis store; sliding
  expiry, `saveUninitialized: false`, a per-account index of session ids (so a credential change can
  end the sessions the old one opened), and `SessionService` owning sign-in (id regenerated first),
  sign-out, and the non-httpOnly `isAuthenticated` hint cookie the editor reads. **`rolling` is
  off**: a session that slid on every response costs a store write and two `Set-Cookie` headers each
  time to say what the last response said, so `touchIfStale` stamps `session.touchedAt` once per
  `SESSION_TOUCH_INTERVAL_MINUTES` and that write — the field being part of what `@fastify/session`
  hashes to decide whether to save — is what pushes the expiry out. The hint is written by an
  `onSend` hook registered after the plugin's, which is what lets it ask whether the session cookie
  is on this response and appear only beside it; a hint no session backs is cleared regardless, on
  the next request.
- `auth/` — local credentials (bcrypt via `@node-rs/bcrypt`, rehash-on-login when a stored hash
  predates the current cost), one-shot mail tokens in Redis, and Google sign-in through
  `openid-client` (code flow + PKCE, state/verifier server-side, linking only from inside an
  account). Where the browser lands afterwards travels in that same server-side flow record: the
  start route takes a `returnUrl`, keeps it only if core's `safeReturnPath` accepts it, and the
  callback redirects there on success and appends it beside `?error=` on failure — `redirect_uri` is
  this API's own callback and is registered with Google, so it cannot carry it, and a target read
  off the callback request would be an unauthenticated open redirect. `AuthGuard` +
  `@CurrentUser()` are exported, never global.
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
- **`migrate` and `renormalize` are the second and third Rspack entries**; a `CopyRspackPlugin` puts
  the migrations' `migration.sql` files in `dist/logigator-api/drizzle/`, since the runner reads them
  from disk and a release applies migrations with plain `node` — and so does the server's startup
  gate, which is why the folder is resolved in one place (`defaultMigrationsFolder`) rather than
  handed to the runner as an argument. The snapshots stay behind: they are drizzle-kit's input for
  generating the next migration, and drizzle-kit only ever _generates_ them. Unlike the migration
  runner, `renormalize` boots the real application container: rewriting documents through the same
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
builder; core, the contract, the docs member and the API run **plain Vitest** in Node (own
`vitest.config.ts`, no Angular, no jsdom; the API's specs boot Nest testing modules). The Node packages' configs alias
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
deleted afterwards. It also boots the database layer on its own (`startDatabaseLayer`), which is how
a spec watches the startup schema gate accept or reject a database it has tampered with. Only two
things differ from production: the mail transport is captured
(`test/mail-capture.ts`, so specs read the link a recipient would click) and bcrypt runs at its
minimum cost. `test/cookie-jar.ts` carries cookies across requests the way a browser would,
`test/circuits.ts` builds documents through core's own encoder rather than hand-written JSON (a
fixture gets the wire chain and the position deltas subtly wrong), `test/assets.ts` maps a served
URL back to its path on the volume, and `test/row-lock.ts` runs a request while an uncommitted
transaction holds the row it writes — the only way an injected request meets a concurrent write —
waiting for the block rather than sleeping so the interleaving is a fact of the run.
