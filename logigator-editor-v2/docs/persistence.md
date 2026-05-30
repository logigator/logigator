# Persistence Layer

The persistence layer turns a live `Project` into stored data and back. It covers
three storage targets that share the same in-memory model but differ in encoding and
durability:

- **Server API** (`source: 'server'`) — circuits are stored on the backend as
  `ProjectElement[]`, the legacy positional wire format (`t/p/q/r/i/o/n/s`).
  `CircuitSerializer` is the single converter between a `Project` and that array.
- **Browser local storage** (`source: 'browser'`) — circuits persist in **IndexedDB**
  (`BrowserProjectStore`) without a server account, keyed by a generated id and
  restored on reload via the `/local/:id` route. The stored blob **is the native file
  format** (see below), so this target reuses the file codec wholesale.
- **Local files** — save-to-file / load-from-file use a **native, versioned** file
  format that mirrors the editor's own model (named options, wires as
  start/direction/length). A migration chain upgrades older files — including the
  legacy `logigator-editor` export — to the current version on load.

A file is **never a save target** — only an import source and an export sink. Saving
always dispatches to the server (API) or the browser (IndexedDB) depending on `source`;
importing a file converts it into a browser project, and any project (server or
browser) can be exported to a file.

`PersistenceService` is the single entry point for all three; it owns the project
lifecycle (load → register → set as main → save). `ProjectMetadataStore` holds the
per-project bookkeeping (name, source, dirty state) that a bare `Project` does not.

> The server API is still the _legacy_ API. When the planned editor-native API
> lands, it will resemble the native file format — at which point it becomes a new
> file-format version plus one migration, not a rewrite. The versioned format is
> built for exactly that.

## Directory Layout

```
src/app/persistence/
├── persistence.service.ts        # Lifecycle entry point: API + browser load/save + file import/export
├── project-metadata.store.ts     # Per-project metadata + dirty tracking
├── circuit-serializer.ts         # Project ↔ ProjectElement[] (legacy wire format, API)
├── browser/                      # Browser-local (IndexedDB) target
│   ├── browser-project.types.ts  # StoredBrowserProject record + BrowserProjectSummary
│   └── browser-project.store.ts  # IndexedDB CRUD (id/timestamp/createdOn ownership)
└── file/                         # Native versioned file format + migrations
    ├── circuit-file.types.ts     # Frozen per-version types; CURRENT_FILE_VERSION; CurrentCircuitFile
    ├── circuit-file.errors.ts    # InvalidFileError, UnsupportedVersionError
    ├── circuit-file-migrator.ts  # detectVersion + migrateToCurrent (chain runner)
    ├── circuit-file.service.ts   # toJson / parse / deserialize / fromJson (the file codec)
    └── migrations/
        ├── migration.ts          # Migration<TIn,TOut> + MigrationContext
        ├── legacy-to-v1.migration.ts  # legacy(0) → v1 (registry-backed)
        └── migrations.ts         # MIGRATIONS — the ordered chain
```

---

## Core Concepts

### Two encodings, three targets

All targets ultimately produce/consume `Component` and `Wire` instances, but there are
only **two** serialized shapes — the legacy API format and the native file format. The
browser target reuses the native format, so it shares `CircuitFileService` end to end:

|           | Legacy wire format (`ProjectElement`)                          | Native file format (`CircuitFileV1`)                    |
| --------- | -------------------------------------------------------------- | ------------------------------------------------------- |
| Used by   | Server API                                                     | Browser storage **and** save/load-to-file               |
| Component | `{ t, p, i?, o?, r?, n?[], s? }` — options packed positionally | `{ type, pos, options }` — options keyed by config name |
| Wire      | `{ t: 0, p, q }` — endpoints                                   | `{ pos, direction, length }`                            |
| Versioned | no                                                             | yes (`version` field)                                   |
| Converter | `CircuitSerializer`                                            | `CircuitFileService`                                    |

### Name lives in metadata, not on `Project`

A `Project` has no `name`. The display name is held in `ProjectMetadataStore`. Export
reads it from there; import writes it back. Code must never reach for `project.name`.

### Clean-on-load

`Project.addComponent`/`addWire` do **not** push to the `ActionManager`, so a project
built by load/import starts non-dirty even though it was just populated. Dirty tracking
only begins once the user performs an undoable action (see `ProjectMetadataStore`).

---

## `CircuitSerializer`

**File:** `persistence/circuit-serializer.ts`

Converts between a `Project` and `ProjectElement[]` (the legacy wire format the API
stores). `WIRE_TYPE_ID = 0` is the canonical type id for wires.

| Method                         | Description                                                                                                                                                                                                             |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `serializeProject(project)`    | `{ elements: ProjectElement[], dependencies: [] }`. Components → reserved fields (`direction→r`, `numInputs→i`, `numOutputs→o`) plus `n[]`/`s` slots in config order; wires → `t:0` with `p`/`q` endpoints.             |
| `deserializeProject(elements)` | `{ components, wires }`. Looks up each `element.t` in `ComponentProviderService`. **Unknown type ids are dropped with a `LoggingService.warn`** (not an error). Wire positions get the `+0.5` half-grid offset on load. |

> `deserializeProject` is **not** crash-proof on malformed input — it indexes
> `element.p[0]` and `element.q!` unconditionally. The server API is trusted; file
> input is validated upstream before any equivalent indexing (see below).

### `buildOptionValues` (shared)

`buildOptionValues(element, config): Record<string, unknown>` maps an element's
positional option slots (reserved `r`/`i`/`o`, the `n[]` array, the single `s`) to
**named** option values keyed by the config's option names — the inverse of how the
serializer packs them. It is pure: it reads only the config's option metadata (key
order, `wireSlot`, default `value`) and constructs **no** render objects.

`CircuitSerializer._buildOptions` wraps it (cloning each value into a `ComponentOption`
instance); the **legacy→v1 migration** calls it directly (keeping the raw values). This
keeps the slot→value semantics in one place.

---

## File Format & Migrations (`persistence/file/`)

### Versioned, frozen types

`circuit-file.types.ts` defines the format. The current version is
`CURRENT_FILE_VERSION = 1`:

```ts
interface CircuitFileV1 {
	version: 1;
	name: string;
	components: {
		type: number;
		pos: [number, number];
		options: Record<string, unknown>;
	}[];
	wires: { pos: [number, number]; direction: number; length: number }[];
}
```

Rules that keep the format maintainable:

- **Frozen per version.** These types intentionally do **not** alias the live
  `api/models` DTOs (which track the changing legacy API). A new version adds a new
  `CircuitFileV<N>` interface + migration and re-points `CurrentCircuitFile`; older
  `CircuitFileV<N>` types are never edited, so shipped files keep their meaning.
- **No instance `id`.** Files store no element ids; fresh ids are allocated on load
  (`Component.deserialize`/`Wire.deserialize` accept an optional `id` and only set it
  when present — undo/redo passes one to preserve identity, file load omits it).
- The legacy (`V0`) shape is **copied** into this file (the old editor is a separate
  project and the shape is frozen historical data).

### Migration chain

`circuit-file-migrator.ts` runs the chain:

| Function                      | Behavior                                                                                                                                                                                                                                                                      |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `detectVersion(data)`         | Integer `version` field → that number; missing/non-integer → `0` (legacy); non-object → `InvalidFileError`.                                                                                                                                                                   |
| `migrateToCurrent(data, ctx)` | Newer-than-supported version → `UnsupportedVersionError`. Otherwise walk `MIGRATIONS`, applying the entry whose `from` matches the current version until `CURRENT_FILE_VERSION`. No matching step → `InvalidFileError`. An already-current document passes through untouched. |

`MIGRATIONS` is an ordered list (`migrations/migrations.ts`); `legacy→v1` is the first
entry, with future native `v1→v2…` steps appended.

**Migration rule:** a migration _may_ read the component registry (option metadata) and
log via its `MigrationContext` (`{ componentProvider, logging }`), but must **not**
instantiate render objects. Decoding legacy positional slots into named options needs
the config schemas — that is the only reason the registry is in the context. Native
version→version migrations are pure data transforms and ignore the context.

### `legacy-to-v1.migration.ts`

Converts the old `logigator-editor` export (no `version` field) into `CircuitFileV1`:

- Validates the envelope (`project.elements` is an array) → else `InvalidFileError`.
- Each element is structurally validated and widened to a `ProjectElement`
  (`toApiElement`); a corrupt element (e.g. a wire with no end position) throws
  `InvalidFileError` rather than crashing downstream.
- Components → named options via `buildOptionValues`; wires → `{ pos, direction, length }`.
- **Unsupported component types are dropped** (with a warning), and **legacy
  sub-circuit definitions are ignored** — v2 has no custom-component support yet,
  consistent with the serializer's silent-drop behavior.

### `CircuitFileService`

**File:** `persistence/file/circuit-file.service.ts`

The file codec. It does not touch metadata or the active-project lifecycle.

| Method                  | Description                                                                                                                                                                                                                                                                                   |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `toJson(project, name)` | Encodes the project to a **current-version** JSON string. Builds the v1 shape explicitly (does not reuse the evolving `Component.serialize`), so the frozen format stays pinned.                                                                                                              |
| `parse(content)`        | `JSON.parse` (malformed → `InvalidFileError`) then `migrateToCurrent`. Returns a current-version document.                                                                                                                                                                                    |
| `deserialize(file)`     | Current document → `{ components, wires }`. **Sole structural validator for native files** (the migrator passes an already-current doc through untouched): structurally broken elements throw `InvalidFileError`; unknown component types are dropped with a warning; elements get fresh ids. |
| `fromJson(content)`     | Convenience: `parse` + `deserialize` → `{ name, components, wires }`.                                                                                                                                                                                                                         |

### Error types

`circuit-file.errors.ts`: `InvalidFileError` (malformed JSON, invalid element, or an
unrecognizable envelope) and `UnsupportedVersionError` (file version newer than this
build supports). Both follow the `AuthRequiredError` convention (set `.name`).

---

## Browser Storage (`persistence/browser/`)

`BrowserProjectStore` is a thin promise wrapper over **IndexedDB** (one DB
`logigator-editor`, one object store `projects` keyed by `id`, a `lastEdited` index for
ordered listing). It owns every storage concern — id generation, timestamps and
preserving `createdOn` across updates — so `PersistenceService` only deals with
`{ name, content }`, mirroring how it drives `ProjectApiService` for the server target.
The store knows nothing about `Project`, metadata or encoding.

A `StoredBrowserProject` is `{ id, name, type: 'project', createdOn, lastEdited, content }`,
where **`content` is a `CircuitFileService.toJson` string** — the native versioned file
format. This is the crux of the design: an import is just "decode the file, then
browser-save the re-encoded blob," and the file migration chain upgrades stored circuits
on load for free.

| Method                              | Description                                                                                                                                  |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `save({ id?, name, content })`      | Upsert. No `id` → generate one + stamp `createdOn`; existing `id` → preserve `createdOn`. Always sets `lastEdited`. Returns the full record. |
| `get(id)` / `list()` / `delete(id)` | Read one, list summaries (newest first, no `content`), remove.                                                                               |

Ids are RFC-4122 v4 built from `crypto.getRandomValues` (not `crypto.randomUUID`, which
is restricted to secure contexts and unavailable on plain-http dev hosts).

## `PersistenceService`

**File:** `persistence/persistence.service.ts`

Root-provided singleton; the single entry point for loading and saving. Race-token
guards (`_mainLoadToken`, `_shareLoadToken`) discard stale async server loads;
`_saveInFlight` deduplicates concurrent saves.

| Method                                                | Description                                                                                                                                                                                                                                                                                                                                                     |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `loadProject(uuid)` / `loadProjectAsMain(uuid)`       | GET from API → `deserializeProject` → register `source:'server'` → (As Main) set as main + update URL.                                                                                                                                                                                                                                                          |
| `loadLocalProject(id)` / `loadLocalProjectAsMain(id)` | Read from IndexedDB → `CircuitFileService.fromJson` → register `source:'browser'` → (As Main) set as main + `/local/:id`. Shares `_mainLoadToken` with the server path (both own the single main slot). Rejects/falls back if no record exists.                                                                                                                 |
| `saveProject(project)`                                | No-op unless dirty. Dispatches on `source`: `'server'` → `serializeProject` + PUT (clears dirty only if no edit landed during the round-trip; logs `VersionMismatch`); `'browser'` → `CircuitFileService.toJson` + `BrowserProjectStore.save` (a fresh draft is promoted: an id is generated and the URL becomes `/local/:id`). `'share'` is read-only → no-op. |
| `createProject(name, …)`                              | POST + initial PUT, register, set as main, update URL.                                                                                                                                                                                                                                                                                                          |
| `loadShare` / `loadShareAsMain` / `cloneShare`        | Share read paths (`source:'share'`, dirty tracking disabled).                                                                                                                                                                                                                                                                                                   |
| `createAndSetEmptyProject()`                          | Blank `source:'browser'` project with empty id, set as main. **Not written to storage** until the first save of a dirty project (no empty-draft litter).                                                                                                                                                                                                        |
| `listBrowserProjects()` / `deleteBrowserProject(id)`  | Browser-store listing/removal (a project-picker UI is not built yet — server projects lack one too).                                                                                                                                                                                                                                                            |
| `exportProjectToJson(project)`                        | Reads name from metadata, delegates to `CircuitFileService.toJson`. Source-agnostic (works for server and browser projects). Returns the JSON string — triggering a download is a UI concern.                                                                                                                                                                   |
| `importProjectFromJson(content)`                      | `CircuitFileService.fromJson` → build a new `Project` → register `source:'browser'` (clean) → **persist immediately** to IndexedDB (re-encoded current-version) → set as main → `/local/:id`. **Throws** on an unreadable file (no fallback, unlike server loads). Importing is the one path that writes a fresh draft up front.                                |

### Flows

```
API load:     GET → ProjectElement[] → CircuitSerializer.deserialize → Project → register(server) → main
API save:     Project → CircuitSerializer.serialize → ProjectElement[] → PUT (oldHash guard)
Browser load: IndexedDB record → CircuitFileService.fromJson → Project → register(browser) → main (/local/:id)
Browser save: Project → CircuitFileService.toJson → BrowserProjectStore.save (generate id on first save)
File import:  string → CircuitFileService.fromJson → Project → register(browser) → Browser save → main (/local/:id)
File export:  Project → CircuitFileService.toJson → JSON string (download)
```

All funnel through the same `Component`/`Wire` instances. The API uses the legacy
`ProjectElement[]` encoding; the browser target and files both use the native versioned
envelope — which is why a file import is simply "decode, then browser-save the
re-encoded blob."

---

## `ProjectMetadataStore`

**File:** `persistence/project-metadata.store.ts`

Root-provided singleton holding metadata a bare `Project` lacks.

`ProjectMetadata`: `{ id, name, type: 'project'|'comp', source:
'server'|'browser'|'share', hash, isPublic, link? }`.

`id` is the project's identifier **within its store**: the server uuid for
`'server'`/`'share'` projects, the generated IndexedDB id for `'browser'` projects, or
`''` for a browser project not yet written to storage (a fresh draft). `hash`/`isPublic`/
`link` are inert for browser projects.

| Method                                         | Description                                                                                                                                          |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `register(project, metadata, trackDirty=true)` | Stores metadata; when `trackDirty`, subscribes to `project.actionManager.actionChange$` to auto-mark dirty. Shares register with `trackDirty:false`. |
| `getMetadata` / `getHandleById` / `remove`     | Lookup and teardown.                                                                                                                                 |
| `markDirty` / `clearDirty` / `isDirty`         | Dirty flag (Angular signal).                                                                                                                         |
| `dirtyVersion`                                 | Monotonic counter used by `saveProject` to detect edits that land during a save.                                                                     |
| `updateHash`                                   | Updates the optimistic-concurrency hash after a successful server save.                                                                              |
| `updateId`                                     | Sets the store id after a project is first written (e.g. a fresh browser draft promoted into IndexedDB on save).                                     |

---

## Testing

Specs sit next to source. Pure logic (`detectVersion`, `migrateToCurrent`, the legacy
migration) is testable with `TestBed.inject(ComponentProviderService)` and no
`setStaticDIInjector` (no render objects are built). Codecs that build `Component`/`Wire`
instances (`circuit-file.service.spec`, `persistence.service.spec`,
`circuit-serializer.spec`) call `setStaticDIInjector(TestBed.inject(Injector))` and use
inline fixtures (no JSON imports). The round-trip test (build → `toJson` → `fromJson` →
re-`toJson`, normalized-equal) covers every built-in component type plus wires.

`browser-project.store.spec` runs against the **real** IndexedDB (Karma uses a real
browser), clearing records between tests rather than deleting the DB (which would block
on still-open connections). `persistence.service.spec` swaps in an in-memory fake
`BrowserProjectStore` (`useValue`) so the orchestration — import persists, save
dispatches by source, browser load reads back — is tested deterministically without
touching IndexedDB.
