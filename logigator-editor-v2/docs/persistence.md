# Persistence Layer

The persistence layer turns a live `Project` into stored data and back. It covers
three storage targets that share the same in-memory model but differ in encoding and
durability:

- **Server API** (`source: 'server'`) — circuits are stored on the backend as
  `ProjectElement[]`, the legacy positional wire format (`t/p/q/r/i/o/n/s`). This API is
  **legacy and temporary**: it is conceptually **file-format version 0 over HTTP** (see
  [Server = legacy v0-over-HTTP](#server--legacy-v0-over-http)).
- **Browser local storage** (`source: 'browser'`) — circuits and custom-component
  library masters persist in **IndexedDB** without a server account, restored on reload
  via the `/local/:id` route. The stored blob **is the native file format**, so this
  target reuses the file codec wholesale.
- **Local files** — save-to-file / load-from-file use a **native, versioned** file
  format that mirrors the editor's own model (named options; wires as
  start/direction/length; embedded custom-component snapshots). A migration chain
  upgrades older files — including the legacy `logigator-editor` export — to the current
  version on load.

A file is **never a save target** — only an import source and an export sink. Saving
always dispatches to the server (API) or the browser (IndexedDB) depending on `source`;
importing a file converts it into a browser project, and any project can be exported.

`PersistenceService` is the single entry point for all targets; it owns the project
lifecycle (load → register → set as main → save). `ProjectMetadataStore` holds the
per-project bookkeeping (name, source, dirty state) that a bare `Project` does not.

> When the planned editor-native API lands, it will resemble the native file format — at
> which point it becomes a new file-format version plus one migration, and
> `persistence/server/` is deleted. The versioned format is built for exactly that.

## ⚠️ Two `version` axes — do not conflate

Two unrelated version concepts live in this layer:

1. **File-format version** — `CircuitFileV1.version`, `CURRENT_FILE_VERSION`, a
   migration's `from`/`to`, `detectVersion`. Legacy = `V0`, native current = `V1`
   (`CURRENT_FILE_VERSION = 1`). This is what the migration chain advances.
2. **Custom-component master / snapshot version** — `StoredBrowserComponent.version`,
   `SnapshotDefinition.source.version`, `CustomComponentDefinition.version`. A per-master
   **content revision counter**, bumped each time a library master is saved and copied
   into placed snapshots' provenance. **Unrelated to the file-format version.**

## Directory Layout

```
src/app/persistence/
├── persistence.service.ts        # Lifecycle entry point: API + browser load/save + file import/export
├── project-metadata.store.ts     # Per-project metadata + dirty tracking
├── persisted-circuit.types.ts    # Version bases: PersistedComponentV0/V1, PersistedCircuitV0/V1
├── serialized-circuit.ts         # Native body types (SerializedComponentBody/WireBody) + SnapshotDefinition + helpers
├── snapshots.ts                  # Universal snapshot codec (collect/serialize the native body + definitions[])
├── server/                       # ⚠️ TEMPORARY — legacy server (v0-over-HTTP) transport
│   └── server-circuit.codec.ts   # v0 ENCODER (Project → ProjectElement[]) + toCircuitFileV0 read adapter
├── browser/                      # Browser-local (IndexedDB) targets
│   ├── browser-project.types.ts  # StoredBrowserProject / StoredBrowserComponent records + summaries
│   ├── indexed-db-store.ts       # Shared IndexedDB connection + generic store wrapper (projects, components)
│   ├── browser-project.store.ts  # IndexedDB CRUD for saved projects
│   └── browser-component.store.ts# IndexedDB CRUD for library masters
└── file/                         # Native versioned file format + migrations
    ├── circuit-file.types.ts     # CircuitFileV0/V1 envelopes; CURRENT_FILE_VERSION; CurrentCircuitFile
    ├── circuit-file.errors.ts    # InvalidFileError, UnsupportedVersionError
    ├── circuit-file-migrator.ts  # detectVersion + migrateToCurrent (chain runner)
    ├── circuit-file.service.ts   # toJson / decode / deserialize / fromJson (the file codec)
    └── migrations/
        ├── migration.ts          # Migration<TIn,TOut> + MigrationContext
        ├── v0-to-v1.migration.ts # v0 (legacy) → v1 (registry-backed; reads legacyV0Slots)
        └── migrations.ts         # MIGRATIONS — the ordered chain
```

---

## Core Concepts

### The versioned type hierarchy

Each file-format version has a shared **payload base** (`persisted-circuit.types.ts`);
concrete transport **envelopes** add their own framing in their target folder:

```
── V0 (legacy positional; "v0 of the file format", also today's server wire shape) ──
PersistedComponentV0  = ProjectElement (t/p/q/r/i/o/n/s)    // components + wires intermixed
PersistedCircuitV0    = { elements?: PersistedComponentV0[] }
  ├── CircuitFileV0   extends PersistedCircuitV0 → { project: { name, elements } }   (legacy file import — PERMANENT)
  └── ServerCircuitV0 extends PersistedCircuitV0 → { elements, dependencies }        (old API transport — TEMPORARY)

── V1 (native current; named options, split components/wires) ──
PersistedComponentV1  = SerializedComponentBody    // { type, pos, options }
PersistedWireV1       = SerializedWireBody          // { pos, direction, length }
PersistedCircuitV1    = { components: PersistedComponentV1[]; wires: PersistedWireV1[]; definitions: SnapshotDefinition[] }
  └── CircuitFileV1   extends PersistedCircuitV1 → { version: 1, name }   (file + browser store this verbatim)
```

`PersistedCircuitV1` is the named **transport payload** (body + `definitions[]`) shared
by the file and browser targets — it makes "the browser store reuses the file format" an
explicit contract. V0's circuit is an intermixed positional element array; that
internal-shape difference from V1 is normal across versions.

### Two encodings, three targets

All targets ultimately produce/consume `Component` and `Wire` instances, but there are
only **two** serialized shapes — the legacy v0 wire format and the native v1 format. The
browser target reuses the native format, so it shares `CircuitFileService` end to end:

|           | Legacy v0 (`ProjectElement`)                                   | Native v1 (`CircuitFileV1`)                             |
| --------- | -------------------------------------------------------------- | ------------------------------------------------------- |
| Used by   | Server API (temporary)                                         | Browser storage **and** save/load-to-file               |
| Component | `{ t, p, i?, o?, r?, n?[], s? }` — options packed positionally | `{ type, pos, options }` — options keyed by config name |
| Wire      | `{ t: 0, p, q }` — endpoints                                   | `{ pos, direction, length }`                            |
| Customs   | dropped (v0 has none)                                          | embedded as `definitions[]` snapshots                   |
| Decode    | `v0ToV1` migration                                             | `CircuitFileService`                                    |
| Encode    | `server/server-circuit.codec` (temporary)                      | `CircuitFileService` + `snapshots.ts`                   |

### Name lives in metadata, not on `Project`

A `Project` has no `name`. The display name is held in `ProjectMetadataStore`. Export
reads it from there; import writes it back. Code must never reach for `project.name`.

### Clean-on-load

`Project.addComponent`/`addWire` do **not** push to the `ActionManager`, so a project
built by load/import starts non-dirty even though it was just populated. Dirty tracking
begins once the user performs an undoable action (see `ProjectMetadataStore`).

---

## Server = legacy v0-over-HTTP

**Folder:** `persistence/server/` — **⚠️ TEMPORARY, deleted when the native API ships.**

The server API transports `ProjectElement[]`, which is just file-format **v0** over the
wire. So its two halves are treated asymmetrically:

- **Decode is permanent.** A server read wraps its `{ name, elements }` response as a
  `CircuitFileV0` via `server.toCircuitFileV0(detail)` and feeds it to
  `CircuitFileService.decode`, which runs the **same `v0ToV1` migration** that legacy
  file import uses. There is no separate server decoder. Reads are therefore validated by
  the migration (malformed elements throw `InvalidFileError`); unknown component types are
  dropped with a warning; server `dependencies` are ignored (server custom-components are
  unsupported — reviving them is a future native-API version + migration).
- **Encode is throwaway.** `server-circuit.codec.ts` is the only place that packs a live
  `Project` back into the v0 wire shape (`ServerCircuitV0 = { elements, dependencies }`)
  for PUT/save. It reads each config's `legacyV0Slots` descriptor (below) **in reverse**
  for the `n`/`s` slots; `i`/`o`/`r` come straight from the component's first-class
  `numInputs`/`numOutputs`/`direction` fields, so fixed-arity types (e.g. NOT) still emit
  them without a descriptor entry. The file is `@deprecated`.

When the native-model API lands, `persistence/server/` and `ServerCircuitV0` are deleted;
`CircuitFileV0`, the `v0ToV1` migration, and the `legacyV0Slots` descriptors stay
(legacy old-editor **file** import is supported indefinitely).

### `legacyV0Slots` descriptor

Each built-in `ComponentConfig` carries a declarative `legacyV0Slots` mapping its named
options to the legacy positional slots — the single source of truth for both the
permanent decode and the temporary encode:

```ts
// rom.config.ts
legacyV0Slots: { r: 'direction', n: ['wordSize', 'addressSize'] }
// input.config.ts
legacyV0Slots: { r: 'direction', s: 'label', n: ['index'] }
```

- `r` / `i` / `o` — option populated from `element.r` / `i` / `o` (decode only; encode
  emits these from the component's first-class fields).
- `n: [...]` — options consuming `element.n[0]`, `n[1]`, … in **declaration order** (the
  one place an `n[]` transposition would corrupt data — pinned by a per-config test).
- `s` — the single option consuming `element.s`.
- Options not listed take their default on decode.

> **Frozen.** `legacyV0Slots` describes the _immutable_ legacy format and names **v1-era
> option keys**. If a live option is later renamed, do **not** edit the descriptor — add a
> `v1→v2` migration instead.

---

## File Format & Migrations (`persistence/file/`)

### Versioned, frozen types

`circuit-file.types.ts` defines the envelopes; the current version is
`CURRENT_FILE_VERSION = 1`:

```ts
interface CircuitFileV1 extends PersistedCircuitV1 {
  version: 1;
  name: string;
  // from PersistedCircuitV1: components, wires, definitions[]
}
```

Rules that keep the format maintainable:

- **Frozen per version.** These types intentionally do **not** alias the live
  `api/models` DTOs (which track the changing legacy API). A new version adds a new
  `CircuitFileV<N>` interface + migration and re-points `CurrentCircuitFile`; older
  `CircuitFileV<N>` types are never edited, so shipped files keep their meaning.
- **No instance `id`.** Files store no element ids; fresh ids are allocated on load
  (`Component.deserialize`/`Wire.deserialize` set an `id` only when one is passed — undo/
  redo passes one to preserve identity, file load omits it).
- **Self-contained.** A file embeds a frozen snapshot of every custom component it
  transitively uses in `definitions[]` (see [Snapshot codec](#snapshot--custom-component-codec)).

### Migration chain

`circuit-file-migrator.ts` runs the chain:

| Function                      | Behavior                                                                                                                                                                                                                                                                                              |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `detectVersion(data)`         | Integer `version` field → that number; missing/non-integer → `0` (legacy); non-object → `InvalidFileError`.                                                                                                                                                                                           |
| `migrateToCurrent(data, ctx)` | Newer-than-supported → `UnsupportedVersionError`. Otherwise walk `MIGRATIONS`, applying the entry whose `from` matches the current version until `CURRENT_FILE_VERSION`. Each entry advances to the **next** version, never straight to newest. An already-current document passes through untouched. |

`MIGRATIONS` (`migrations/migrations.ts`) is the ordered list; `v0ToV1` is the only entry
today, with future native `v1→v2…` steps appended.

**Migration rule:** a migration _may_ read the component registry (option metadata,
`legacyV0Slots`) and log via its `MigrationContext` (`{ componentProvider, logging }`),
but must **not** instantiate render objects. Decoding legacy positional slots into named
options needs the config schemas — that is the only reason the registry is in the
context. Native version→version migrations are pure data transforms and ignore it.

### `v0-to-v1.migration.ts`

The permanent v0→v1 decode — used by both legacy file import **and** server reads:

- Validates the envelope (`project.elements` is an array) → else `InvalidFileError`.
- Splits `elements`: `t === WIRE_TYPE_ID (0)` → `{ pos, direction, length }`; everything
  else → a named-option component body via the config's `legacyV0Slots` descriptor.
- Drops any element whose type is **unknown or has no `legacyV0Slots`** descriptor (with a
  warning), consistent with the editor's silent-drop behavior.
- Emits `definitions: []` — legacy sub-circuit definitions (the old `components` array)
  are not revived.

### `CircuitFileService`

**File:** `persistence/file/circuit-file.service.ts`

The native-format codec. A thin adapter over the universal snapshot codec
(`snapshots.ts`): encoding embeds a frozen snapshot of every custom the project uses and
rewrites the body to file-local type ids; decoding ingests those snapshots into the
registry and remaps back to session ids. It does not touch metadata or the
active-project lifecycle.

| Method                  | Description                                                                                                                                                                                                                                                                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `toJson(project, name)` | Encodes to a **current-version** JSON string: `collectSnapshots` + `serializeProjectBody`, then `remapComponentTypes` to file-local ids. Builds the v1 shape explicitly (not via `Component.serialize`).                                                                                                                                   |
| `decode(data)`          | Object-level entry: `migrateToCurrent` + `deserialize` → `{ name, components, wires }`. **Shared by file reads (`fromJson`) and server reads** (`server.toCircuitFileV0(detail)` wraps the API response).                                                                                                                                  |
| `deserialize(file)`     | Current document → `{ components, wires }`. **Sole structural validator for native files** (the migrator passes an already-current doc through untouched): broken elements throw `InvalidFileError`; unknown component types are dropped with a warning; ingests `definitions[]` and remaps file-local → session ids; fresh ids allocated. |
| `fromJson(content)`     | Convenience: `JSON.parse` (malformed → `InvalidFileError`) then `decode`.                                                                                                                                                                                                                                                                  |

### Error types

`circuit-file.errors.ts`: `InvalidFileError` (malformed JSON, invalid element, or an
unrecognizable envelope) and `UnsupportedVersionError` (file version newer than this
build supports). Both follow the `AuthRequiredError` convention (set `.name`).

---

## Snapshot / custom-component codec

**Files:** `persistence/serialized-circuit.ts`, `persistence/snapshots.ts`

The native document is self-contained: it embeds a frozen snapshot of every custom
component it (transitively) uses, so it can be loaded with no library present.

- **`serialized-circuit.ts`** — the native body types and pure helpers, with **no
  imports** so both the component layer (a definition's `circuit`) and the persistence
  layer can use them without an import cycle:
  - `SerializedComponentBody` `{ type, pos, options }`, `SerializedWireBody`
    `{ pos, direction, length }`, `SerializedCircuitBody` `{ components, wires }`.
  - `SnapshotDefinition extends SerializedCircuitBody` — a frozen custom: a **file-local**
    `type` id, `source?: { id, version }` provenance (the axis-2 master version), and the
    display fields (`name`, `symbol`, `numInputs`, …).
  - `cloneComponentBody` / `cloneCircuit` (deep copy) and `remapComponentTypes`
    (translate `type` ids through a map; ids absent from the map pass through).
- **`snapshots.ts`** — the universal codec, owning _which_ customs a document embeds and
  the session ↔ file-local type-id remap (but not a byte layout — each target encodes the
  body its own way):
  - `serializeProjectBody` / `serializeComponentBody` / `serializeWireBody` turn live
    instances into the native body.
  - `collectSnapshots(project, registry)` walks the customs a project transitively places
    (depth-first, body order), assigns **file-local** ids from `CUSTOM_TYPE_ID_BASE`,
    rewrites nested references to those ids, and returns
    `{ definitions, sessionToLocal }`. Deterministic and session-order-independent.
  - Ingesting them — registering snapshots + producing the file-local → session remap —
    is `CustomComponentRegistry.ingestSnapshots(defs)`, since it mutates the registry.

The `SerializedComponent`/`SerializedWire` snapshot used by **undo/redo** is a separate
in-memory shape, not a persistence format.

---

## Browser Storage (`persistence/browser/`)

Two IndexedDB object stores in one database (`logigator-editor`), opened through a shared
connection in `indexed-db-store.ts` (`IndexedDbStore<T>` is a thin promise wrapper; the
DB version is bumped only to **create** stores, never to migrate records — record upgrades
ride the file migration chain on load):

- **`projects`** — saved projects, via `BrowserProjectStore`.
- **`components`** — custom-component **library masters**, via `BrowserComponentStore`.

Each store owns id generation, timestamps, and `createdOn` preservation, so
`PersistenceService` only deals with `{ name/…, content }` — mirroring how it drives
`ProjectApiService` for the server target. The stores know nothing about `Project`,
metadata, or encoding; the **store is the discriminator** (no `type` field).

In both records, **`content` is a `CircuitFileService.toJson` string** — the native
versioned format (body + embedded `definitions[]`). This is the crux of the design: an
import is just "decode the file, then browser-save the re-encoded blob," every stored
document is self-contained, and the migration chain upgrades stored circuits on load for
free. Summary columns (`name`; for masters also `symbol`/`numInputs`/`labels`/…) are
duplicated out of `content` so listing does not parse every blob.

| Store                   | Record                   | Save params                                                                           |
| ----------------------- | ------------------------ | ------------------------------------------------------------------------------------- |
| `BrowserProjectStore`   | `StoredBrowserProject`   | `{ id?, name, content }`                                                              |
| `BrowserComponentStore` | `StoredBrowserComponent` | `{ id?, version, name, symbol, description, numInputs, numOutputs, labels, content }` |

Both expose `save` (upsert: no `id` → generate + stamp `createdOn`; existing `id` →
preserve it; always set `lastEdited`), `get(id)`, `list()` (summaries, newest first), and
`delete(id)`. Ids are RFC-4122 v4 from the `uuid` package (`v4`), avoiding
`crypto.randomUUID` which is restricted to secure contexts and unavailable on plain-http
dev hosts.

---

## `PersistenceService`

**File:** `persistence/persistence.service.ts`

Root-provided singleton; the single entry point for loading and saving. Race-token guards
(`_mainLoadToken`, `_shareLoadToken`) discard stale async loads; `_saveInFlight`
deduplicates concurrent saves.

| Method                                                                   | Description                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `loadProject(uuid)` / `loadProjectAsMain(uuid)`                          | GET from API → `circuitFile.decode(server.toCircuitFileV0(detail))` → register `source:'server'` → (As Main) set as main + update URL.                                                                                                                                                                                                                      |
| `loadLocalProject(id)` / `loadLocalProjectAsMain(id)`                    | Read from `projects` store → `circuitFile.fromJson` → register `source:'browser'` → (As Main) set as main + `/local/:id`. Shares `_mainLoadToken` with the server path (both own the single main slot).                                                                                                                                                     |
| `loadComponentForEdit(id)`                                               | Read a **library master** from the `components` store → build a Project from its self-contained circuit → reuse or `createMaster` its session type id → register `type:'comp', source:'browser'`. Returns the Project + master type id so the caller can open a tab.                                                                                        |
| `saveProject(project)`                                                   | No-op unless dirty. Dispatches on metadata: `comp`+`browser` → `_doBrowserComponentSave`; `server` → `server.serializeProject` + PUT (clears dirty only if no edit landed mid-round-trip; logs `VersionMismatch`); `browser` → `circuitFile.toJson` + `BrowserProjectStore.save` (a fresh draft is promoted to `/local/:id`). `share` is read-only → no-op. |
| `createProject(name, …)`                                                 | POST + initial PUT (`server.serializeProject`), register, set as main, update URL.                                                                                                                                                                                                                                                                          |
| `loadShare` / `loadShareAsMain` / `cloneShare`                           | Share read paths (`source:'share'`, dirty tracking disabled); decode via the same server v0 route.                                                                                                                                                                                                                                                          |
| `createAndSetEmptyProject()`                                             | Blank `source:'browser'` project with empty id, set as main. **Not written to storage** until the first save of a dirty project.                                                                                                                                                                                                                            |
| `exportProjectToJson(project)`                                           | Reads name from metadata, delegates to `circuitFile.toJson`. Source-agnostic. Returns the JSON string — triggering a download is a UI concern.                                                                                                                                                                                                              |
| `importProjectFromJson(content)`                                         | `circuitFile.fromJson` → build a Project → **adopt** any master-less embedded customs into the `components` library → register `source:'browser'` (clean) → **persist immediately** (re-encoded current-version) → set as main → `/local/:id`. **Throws** on an unreadable file (no fallback, unlike server loads).                                         |
| `listBrowserProjects` / `deleteBrowserProject` / `listBrowserComponents` | Browser-store listing/removal for the two stores.                                                                                                                                                                                                                                                                                                           |

### Flows

```
API load:     GET → ProjectElement[] → server.toCircuitFileV0 → v0ToV1 migration → circuitFile.decode → Project → register(server) → main
API save:     Project → server.serializeProject → ProjectElement[] → PUT (oldHash guard)
Browser load: IndexedDB record → circuitFile.fromJson → Project → register(browser) → main (/local/:id)
Browser save: Project → circuitFile.toJson → BrowserProjectStore.save (generate id on first save)
File import:  string → circuitFile.fromJson → Project → adopt customs → Browser save → main (/local/:id)
File export:  Project → circuitFile.toJson → JSON string (download)
```

All funnel through the same `Component`/`Wire` instances. The API uses the legacy v0
encoding (decoded through the migration); the browser target and files use the native v1
envelope — which is why a file import is simply "decode, then browser-save the re-encoded
blob."

---

## `ProjectMetadataStore`

**File:** `persistence/project-metadata.store.ts`

Root-provided singleton holding metadata a bare `Project` lacks.

`ProjectMetadata`: `{ id, name, type: 'project'|'comp', source:
'server'|'browser'|'share', hash, isPublic, link? }`.

`id` is the project's identifier **within its store**: the server uuid for
`'server'`/`'share'`, the generated IndexedDB id for `'browser'`, or `''` for a browser
project not yet written to storage (a fresh draft). `hash`/`isPublic`/`link` are inert for
browser projects.

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

Specs sit next to source. Pure logic (`detectVersion`, `migrateToCurrent`, the `v0ToV1`
migration) is testable with `TestBed.inject(ComponentProviderService)` and no
`setStaticDIInjector` (no render objects are built). Codecs that build `Component`/`Wire`
instances (`circuit-file.service.spec`, `server-circuit.codec.spec`,
`persistence.service.spec`) call `setStaticDIInjector(TestBed.inject(Injector))` and use
inline fixtures (no JSON imports).

The guardrails that pin the legacy mapping:

- **`server-circuit.codec.spec`** — decode→encode round-trips over every built-in type
  (NOT/AND/TEXT/ROM/INPUT/OUTPUT), rotations, distinct `n[]` values, and wires; an
  `i/o/n/s` transposition fails it.
- **`v0-to-v1.migration.spec`** — asserts decoded named options per type and **pins each
  `legacyV0Slots` descriptor exactly**, so a new built-in without one (which would
  silently drop on decode) is caught.
- **`circuit-file.service.spec`** — `toJson → fromJson → toJson` (normalized-equal) for
  multi-element circuits and 1-/2-deep nested customs (snapshot embedding + remap).

`browser-project.store.spec` runs against the **real** IndexedDB (Karma uses a real
browser), clearing records between tests rather than deleting the DB (which would block on
open connections). `persistence.service.spec` swaps in the in-memory stores from
`src/testing/fake-browser-stores.ts` (`useValue`) so the orchestration — import persists,
save dispatches by source, browser load reads back — is tested deterministically without
touching IndexedDB.
