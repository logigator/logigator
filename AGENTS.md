# AGENTS.md

This file is a map plus the rules that span files. The reasoning behind a single file lives in that
file's comments; read them before changing it.

## Repository Layout

The repo root is a **shared Angular CLI workspace** + **Yarn 4 workspace** (corepack). Seven members:

- `logigator-editor/` — Angular 22 editor (PixiJS 8, Tailwind 4), current focus
- `logigator-web/` — Angular 22 website, server-rendered (`@angular/ssr`)
- `logigator-ui/` — `@logigator/ui`, in-house Angular component library
- `logigator-core/` — `@logigator/core`, rendering-free circuit code and origin-wide contracts; zero
  runtime dependencies
- `logigator-contract/` — `@logigator/contract`, the API surface as zod schemas; zod only
- `logigator-docs/` — `@logigator/docs`, the documentation pages (markdown, four locales), their
  screenshots, the page tree, the search matcher and the changelog parser; no dependencies at all
- `logigator-api/` — NestJS on Fastify, API only

**One shared-code rule:** the four libraries are never built. Every consumer compiles their
**source** through the root tsconfig `paths` mapping, and each app's bundler inlines what it uses.
No `dist/`, no `exports`, no build ordering.

`logigator-editor`, `logigator-web` and `logigator-ui` are Angular CLI projects (`angular.json`); the
rest run on plain Yarn scripts. Each package has one primary tsconfig, `tsconfig.spec.json`,
`eslint.config.mjs` and `vitest.config.ts`. Only the three applications produce an artifact, in the
root `dist/<project>/`.

**The changelog** is `CHANGELOG.md` (English) plus `changelog/<lang>.md`, in Keep a Changelog 1.1
format, imported by the apps as `@logigator/changelog/<lang>.md`. Entries collect under
`## [Unreleased]`, which no app shows.

**The capture tool** (`logigator-editor/tools/screenshots`) is a standalone package with its own
lockfile, outside the workspace. It drives a real editor through `window.__logigator` and Playwright
to generate every image the product shows; one run is one **target** under `targets/` (`docs`,
`web`, `hero`, `examples`). Every image is lossless WebP through `lib/webp.ts`; `social-card.ts`
composes the site's PNG `og:image`. Its `yarn typecheck` is not run by CI. See its README.

**Dependency warnings that are correct:**

- `ngx-markdown`'s optional peers `marked-katex-extension` and `katex` are declared by the editor, the
  site and `@logigator/ui`. Without them `ng build` succeeds and the dev server 500s on every page.
- `yarn install` reports unmet `@codemirror/*` peers from `@milkdown/kit`'s Vue components, which
  nothing imports. Don't install CodeMirror or Vue to silence it.

## Dev Environment

`logigator-api` needs env vars only, all defaulted (`logigator-api/.env.example`).

The dev compose stack runs **Postgres** and Redis, published on localhost:
`postgresql://logigator:logigator@localhost:5432/logigator` and `redis://localhost:6379`. `data/`
holds the database and the API's storage volume and is ignored.

The compose `api` service **applies migrations before it starts**; a migration generated while the
stack runs lands on `docker compose restart api`. There are no down migrations, so a database ahead
of the branch needs `DATABASE_MIGRATION_CHECK=false` or a drop and re-migrate.

Caddy serves **`logigator-web` at the origin root**, the editor under `/editor` and the API under
`/api`. Dev runs production's `Caddyfile` behind the same `edge` as a local staging run;
`LOGIGATOR_EDITOR=dev_server` swaps the editor's bundle for its dev server.

## Commands

Every workspace member runs **from the repo root**. `<verb>:<package>` runs one package, the **bare
verb runs it for every package that has it** (no `:all`). Only the three applications build;
`typecheck` exists only where tsc is the sole type gate.

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
(Drizzle schema → new SQL migration in `logigator-api/drizzle/`), `db:check`, `db:migrate` (the same
runner the E2E harness and a release use), `db:renormalize` (re-normalize older-format documents;
`--all` re-extracts every derived row), `db:seed-examples` (writes `logigator-api/examples/` into
the seed account, idempotent; `--previews` re-uploads previews), `db:moderate` (lists open document
reports, readers' and the text analysis worker's, `hide`/`unhide <kind> <link>`, `resolve
<report-id>`; the only moderation surface, no admin role; hiding and unhiding mail the owner).

`@logigator/ui` has no build script; its ng-packagr target in `angular.json` must stay, because the
unit-test builder reads its build options from it.

## Architecture

### Editor (logigator-editor)

Angular 22, standalone + zoneless, PixiJS 8 canvas. Each `src/app/` layer has a doc at
`logigator-editor/docs/<name>.md`; read it before changing the layer.

- `components/` — element model (each a PixiJS `Container`), `ComponentProviderService` registry.
  Each built-in's config is `configFromMeta` over core's `ComponentMeta`; port counts are derived
  from options and read-only. Port math lives in the lattice-exact `component-geometry.ts`.
- `components/component-options/` — `ComponentOption` classes, each paired with a renderer and a
  core `OptionSchema` kind.
- `project/` — `Project` owns circuit state (`viewport`, `topology`, id maps beside the quad trees);
  `wire-repair.ts` heals invariant violations, always user-initiated.
- `persistence/` — `PersistenceService` over symmetric `server/` and `browser/` gateways. The cloud
  API carries the **native versioned document**, encoded/decoded by `CircuitFileService` exactly as a
  file is; concurrency is the document's integer `version` (409 `version_conflict`).
- `wires/`, `connection-points/` (derived junction dots, not persisted), `work-mode/` (mode FSM).
- `rendering/` — the app's single lease-counted renderer (`RendererService`), quad trees, drag
  sessions, and `interaction/` (DOM pointer input; PixiJS events are disabled). Session convention:
  materialize final state, then `ActionManager.register`; `push` is for instantaneous ops.
- `actions/` — undo/redo (`push`, `register`, `retract`/`coalesceTop`, `locked` during drags).
- `clipboard/` — snapshot copy, fresh-id paste through `PastePlacementSession`.
- `simulation/` — circuit → `BoardDescriptor` compiler → worker running `@logigator/sim` (external
  Rust→WASM package). Any `CompileDiagnostic` blocks entering simulation; editing is locked.
- `inspection/` — live inspection windows (desktop) / bottom sheet (compact); watches stay windows.
- `documentation/` — the in-editor viewer over `@logigator/docs`; `DocumentationService.open` is the
  one deep-link entry point.
- `automation/` — `window.__logigator`, compiled in only where the `AUTOMATION_API` define is true.
  The catalog is derived from `ComponentProviderService`, never hand-written; `select()` **is** the
  select tool's marquee.
- `ui/` — Angular panels and dialogs.

**Non-obvious:**

- `setStaticDIInjector()` lets model classes (`Component`, `Wire`) call `inject()`.
- Circuit objects use **grid units as native `position`** (`Project._gridSpace` scale = gridSize);
  visual children in `Component._visualSpace` keep pixel geometry.
- **pixi.js is patched** (`.yarn/patches/`) to skip culled render groups; `render-group-culling.spec.ts`
  fails if an upgrade drops it. A bump means regenerating the patch and clearing `.angular/cache`.
- **One serialization everywhere** (API, browser storage, files): core's native versioned format.
  Older versions migrate on load; only the newest is saved. v0 (legacy `ProjectElement[]`) is
  read-only. `SerializedComponent`/`SerializedWire` are the undo/clipboard snapshot, not a format.
- Language and theme are **origin-wide** fields of the `preferences` cookie, shared with every app
  on the origin; everything else (`logigator.*`) is editor-only localStorage.
- **Production builds ship public source maps** (editor and site) for PostHog symbolification;
  keep `hidden` off.
- Shared test fakes and factories live in `src/testing/`.

### Website (logigator-web)

Angular 22, standalone + zoneless, rendered per request by `@angular/ssr` behind a small Node host
(`src/server.ts`, which the dev server imports too). `src/app/` folders: `translation/`, `theming/`,
`storage/`, `api/`, `user/`, `transfer/`, `seo/`, `layout/`, `forms/`, `documents/`, `states/`,
`listings/`, `design/`, `pages/` (one folder per page).

**Rules that span files:**

- **Every page is `/:lang/…`.** A `canMatch` guard 404s a non-language first segment; `server.ts`
  `302`s an unprefixed URL. A language switch is a navigation (`urlInLanguage`); nothing else calls
  `setActiveLang`, and anything holding a prefixed path must be a signal off the active language.
- **Server reads cross to the browser only through `TransferHandoffService`** (Angular's HTTP
  transfer cache is off). Skipping it repeats the request after hydration. `contentSection()` is the
  packaged pattern: a failed read resolves to a translation key, never rejects.
- **A page whose own read failed answers `503` + `Retry-After`** (`webPageUnavailable` on its
  error), never a `noindex` 200; `noindex` is for a missing or non-public document only.
- **Every list is resolved by a guard**, so there are no skeletons. Listing controls are links or
  `<form method="get">` writing the URL; listing routes need
  `runGuardsAndResolvers: 'paramsOrQueryParamsChange'`.
- **Rendered pages answer `Cache-Control: no-store`.**
- **Headers that are the same on every response live in the `Caddyfile`**; the site's CSP comes
  from `server.ts` with a nonce per request (`content-security-policy.ts`). The site's and the
  editor's CSPs are Report-Only until production reports are clean. Both report to
  `/api/csp-report` by `report-uri` and `report-to csp`; a response naming the group sends
  `Reporting-Endpoints` too, since a browser that reads `report-to` ignores `report-uri`.
- **A one-shot mail token is redeemed in the browser** (`afterNextRender`), never during a render:
  crawlers and mail previews render links too.
- **`returnUrl` is validated by core's `safeReturnPath`** on both site and API.
- **`public/` is only for URLs that are contracts** (favicons, `site.webmanifest`, `social-card.png`);
  everything the app renders is `import`ed so the build hashes it. Cache policy keys off position.
- **Behind Caddy, `NG_ALLOWED_HOSTS` and `NG_TRUST_PROXY_HEADERS` are required**; untrusted
  `x-forwarded-*` headers are deleted.
- **Each language version canonicalizes to itself**; the unprefixed URL is `x-default` only.
- **`/community/` must never be closed in `robots.txt`**; `noindex` on non-public documents is what
  keeps them out. `pages/community/search-indexing.ts` is the one indexing rule, read by both the
  page and the sitemap; a document `awaitingCheck` is never indexed.
- **Markdown (legal pages, docs, changelog) is a per-language `text`-loader chunk**, not a locale
  key. Import maps are written out per language so a missing file is a compile error.
- **Pages stay eager** (the initial budget stops measuring under lazy routes).
- Kind naming: the API says `component`, routes say `components`; mapped only in
  `pages/community/community-kind.ts` (site) and `routing/document-kind.ts` (editor).
- **The share dialog is one dialog in two apps** (`pages/my/dialogs/share-document-dialog` and the
  editor's `ui/dialogs/share-dialog`). Change both together.
- `@angular/platform-server`, `@angular/router` and `@angular/ssr` are **pinned exactly**. The
  router is real here and a stub in the editor; `yarn build:editor` catches a hoisting flip.
- PostHog loads only after an `analytics` consent grant (dynamic import).
- **Community reads pass the page language as `lang`**; `name`/`description` come back resolved.
  Machine text is fetched on click in the browser and never rendered on the server or placed in
  the transfer state.

### UI Library (logigator-ui)

`@logigator/ui`: Angular 22 on CDK, path-mapped to source (not a package dependency). Theming is
**colors only** via `--lg-*` variables (`styles/theme.css`, mapped into Tailwind by
`styles/theme.tw.css`). One folder per component under `components/`, all re-exported from
`public-api.ts`; `internal/` is shared plumbing, exported only when a consumer needs the same rule.

- **Server-render safe**: nothing touches a browser global at construction; overlays build on open.
  Browser globals belong in event handlers and `afterNextRender`.
- **No strings of its own and no router**: consumers pass every word and route links themselves
  (`lg-circuit-tile` takes projected anchors for that reason).
- **The markdown field** (`markdown-field/`, lazy Milkdown chunk in `internal/rich-markdown/`, the
  only place `@milkdown/*` is imported) keeps the projected `<textarea>` as the control in both modes.
  The rules in its source comments are load-bearing: never serialize an unedited document, no
  `@milkdown/plugin-listener`, `remark-preserve-empty-line` filtered out.
- **Rendered markdown and the editing surface share `internal/prose-styles.ts`**, and both
  components need `ViewEncapsulation.None`. A member's prose (`data-user-content`) is styled as a
  quoted fragment, with headings moved two levels down.

### Shared packages (core, contract, docs)

Layering is one-directional, **core ← contract ← api**; `@logigator/docs` depends on nothing.

- `logigator-core/src/` — `model/`, `codecs/`, `format/` (file versions, validator, migration chain,
  `.lgix`, and `parseCircuitDocument`, the API's one ingest pipeline), `catalog/` (one
  `ComponentMeta` per built-in, `validateOptionValue`), `origin/` (preferences and consent cookie
  codecs, languages, `safeReturnPath`). **core = data↔data, editor = live↔data.** Zero runtime
  dependencies and no framework or browser imports, enforced by its eslint fence and a `tsc` with
  no `paths` and `rootDir: "src"`.
- `logigator-contract/src/` — schemas per endpoint, types via `z.infer`. Response schemas are
  `.loose()` on purpose, so older clients tolerate added fields.
- `logigator-docs/src/` — pages, images, `docs-structure.ts`, `images.ts` (written by the capture
  tool), `docs-search.ts`, `changelog.ts`. **It imports no markdown**: each app writes its own import
  map. Page titles are each app's translation keys. The changelog parser throws on a `## …` heading
  or a `### …` section it doesn't know (`### <CHANGE_EMOJI> <CHANGE_SECTION_TITLES>`, e.g. `### ✨ Added`);
  `changelog-documents.spec.ts` holds every translation to English's releases and entry counts,
  and the newest release to the editor's version.
- **Consent is one question for the whole origin**: codec, categories, `CONSENT_REVISION` and text
  are core's (`origin/`). Locale files import their language **by path**
  (`@logigator/core/consent-text/de`) so all four don't land in the main bundle. Changing what a
  category covers is a revision bump.

### API (logigator-api)

NestJS on the **Fastify adapter**. Env vars are parsed once by the zod schema in `src/config/env.ts`
and provided under the `ENV` token; providers never read `process.env`. `GET /api/meta` is the
liveness probe; `GET /api/health/ready` checks Postgres and Redis. `src/` layers: `config/`,
`database/` (Drizzle over `pg`, `schema/`, `migrate.ts`, startup migration gate), `redis/`,
`session/`, `auth/`, `users/`, `mail/`, `storage/` (images, `share-card/`), `documents/`, `sharing/`,
`community/`, `reports/` (error reports and document reports), `moderation/` (verdicts,
`MachineModerationService`, the `db:moderate` service), `translation/` (detection and translation
rules, machine texts), `text-analysis/` (the one OpenRouter call that detects, translates and
moderates: client, prompt, worker), `common/`, plus `app.setup.ts` (shared by `main.ts`
and the E2E harness).

**Invariants:**

- **Every document write goes through `CircuitDocumentService.ingest`** (core's parser, strict).
  Counts, dependency edges and component ports are derived there, never taken from a client.
- **Concurrency is `version` in the `WHERE` of one guarded `UPDATE`.** No write computes a column
  from a value read in an earlier statement.
- **A document's link is its address, not a capability**: `private` resolves for its owner alone,
  `unlisted` for whoever holds the link, `public` for everyone, listed and indexed. Link reads use
  the one predicate `linkResolvesFor`; every listing carries `visibility = 'public'`. Stars are
  public-only. Rotating a link is refused while public; visibility changes never touch the link.
- **A hidden document (`hidden_at`) is owner-only whatever its visibility**: `linkResolvesFor` and
  every listing predicate exclude it, its stars stop counting, the text analysis worker skips it, and
  dependents and clones keep its snapshot but not its master. The hidden state reaches its owner
  alone (owned summaries, and `hidden` on their own detail read). `db:moderate` sets it, and so
  does `MachineModerationService` for a severe verdict the model is certain of, only with
  `MODERATION_AUTO_HIDE` on; every machine hide has an open report and is mailed to
  `REPORT_MAIL_TO` and the owner. A text a moderator cleared (`moderated_digest`) gets no machine
  action until it or a version changes.
- **While text analysis runs, a public document is listed only once its current text is
  checked**: a verdict was obtained for it (`checked_digest`, written in the statement that settles
  or counts the call) or a moderator cleared it (`moderated_digest`). `documents/text-check.ts` is
  the one rule: the listing predicate carries its negation, and the community detail and owned
  summaries answer it as `awaitingCheck`, which the site's `noindex` reads. An edit of the name or
  description moves the digest past both, a version write clears both and restarts a parked
  text's failure count, and a text parked without any verdict gets a machine report whose resolution checks it. The link resolves
  throughout.
- **Uploads are decoded and re-encoded** by sharp, never stored as sent; the volume is served under
  one root, `/files`.
- **Nothing purges the CDN**: the edge holds a `/files` file a day (`CDN-Cache-Control`) and a
  browser a year, so a deleted file stops being served within a day.
- **The startup gate refuses a database whose applied migrations differ from the build's**, in
  either direction. Nothing migrates on boot.
- **Migrations are expand/contract.** A deploy's `migrate` runs while the previous API still serves,
  so each migration leaves that API working: add first; drop, rename or tighten in a later release.
  A previous API restarted in that window is refused by the gate.
- `AuthGuard` is per-route, never global.
- **`POST /api/csp-report` is a plain Fastify route in a plugin of its own**
  (`reports/csp-report.route.ts`), so its content-type parsers and 16 KB limit reach no other route.
  It answers an empty `204`, opens no session (`config.sessionless`), and logs only what
  `CspReportLog`'s dedupe and caps let through, with opaque path segments hidden.
- **Changing how an account signs in or where its mail goes** (password, address, Google link and
  unlink, deletion) takes the current password, or a sign-in from the last ten minutes where there
  is none; `ReauthenticationService` is the one check.
- **Machine-translated text leaves the API only through
  `GET /api/community/{kind}/:link/translation/:lang`**, never on a document or listing response. A
  translation, and a detected language, is served only while its digest matches the document's
  generated `text_digest`. Nothing private is ever sent to OpenRouter. The text analysis call that
  translates also returns a moderation verdict, kept even when the translation is refused;
  `TEXT_ANALYSIS_ENABLED=false` stops both.
- **The model and its routing are the OpenRouter preset's**; the request carries no `provider`,
  sampling or `reasoning` field. `marked` is used to check translations only: the API still stores
  every description as the source it was given.

**Build: Rspack** (`rspack.config.mjs`), ESM output, entries for the server plus `migrate`,
`renormalize`, `seed-examples` and `moderate`. Its comments explain each setting; the ones that
break silently:

- `tsconfig.json` holds the workspace aliases (`resolve.tsConfig` points at it), and Vitest finds it
  **by name** for `emitDecoratorMetadata`. Rename it and DI breaks.
- `legacyDecorator` + `decoratorMetadata` in swc must stay in step with the tsconfig; **no
  minification** (Nest reflects on names); `webpack-node-externals` needs the `@logigator/`
  allowlist; `sharp` stays external; `output.clean` stays off (the watcher loses `main.js`).
- `fastify` is pinned to `@nestjs/platform-fastify`'s exact version, and Drizzle to an exact `1.0.0-rc`.

## Commit Messages

The subject is `[area] what the commit does`, a present-tense verb phrase that completes "This
commit …": lowercase, no full stop, at most 72 characters.

```
[editor] keep the selection when a rotated group is pasted
```

- **Areas are a closed list:** `editor`, `web`, `api`, `ui`, `core`, `contract`, `docs`,
  `screenshots`, `workspace` (tooling, CI, dependencies, anything repository-wide). Older areas in
  the history (`backend`, `components`, `build`, …) are retired. Dependabot writes `[workspace]`.
- **Two areas are `[editor+ui]`**, never a comma or a space. More than two is `[workspace]` or a
  split into one commit per area.
- **The body is optional** and follows a blank line, wrapped at 72: what the code does and why.
  Prose for one idea, `- ` bullets for several independent ones. A subject that says it all has no
  body.
- **No untracked files** (plans, notes) and **no call sites** of the changed code are named.

## Releasing

The product version is the root `package.json`'s (every member stays `0.0.0`); the editor and the
site read it into `environment.version`. A release commit bumps it and turns
`## [Unreleased]` into `## [<version>] - <date>` in all four changelog files (plus the compare
links in `CHANGELOG.md`). Pushing the `v<version>` tag runs `release.yaml`:
its first job waits for the tagged commit's CI and refuses it unless every workflow run passed (push
the commit to a branch first), `.github/scripts/release-notes.mjs` refuses a tag that
disagrees with the version or the changelogs, the `web`, `api` and `origin` images are pushed, then
the GitHub Release is created with the English notes.

## Testing

The editor, site and `@logigator/ui` run Vitest through Angular's `@angular/build:unit-test`
builder with `TestBed`; core, contract, docs and the API run plain Vitest in Node. Specs sit next to
source. Editor helpers live in `src/testing/`.

The API's **E2E suite** (`logigator-api/test/*.e2e-spec.ts`, `yarn test:e2e:api`) boots the real app
through `app.setup.ts` against real Postgres and Redis (a throwaway database per spec file, migrated
by the release runner). It is separate so `yarn test:api` runs anywhere. Mail is captured and bcrypt
runs at minimum cost; `test/` holds the cookie jar, circuit builders (through core's encoder) and
the row-lock helper.
