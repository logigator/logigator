# Persistence Layer

The persistence layer turns a live `Project` into stored data and back. It covers
two distinct storage targets that share the same in-memory model but use different
on-disk encodings:

- **Server API** — circuits are stored on the backend as `ProjectElement[]`, the
  legacy positional wire format (`t/p/q/r/i/o/n/s`). `CircuitSerializer` is the
  single converter between a `Project` and that array.
- **Local files** — save-to-file / load-from-file use a **native, versioned** file
  format that mirrors the editor's own model (named options, wires as
  start/direction/length). A migration chain upgrades older files — including the
  legacy `logigator-editor` export — to the current version on load.

`PersistenceService` is the single entry point for both; it owns the project
lifecycle (load → register → set as main → save). `ProjectMetadataStore` holds the
per-project bookkeeping (name, source, dirty state) that a bare `Project` does not.

> The server API is still the *legacy* API. When the planned editor-native API
> lands, it will resemble the native file format — at which point it becomes a new
> file-format version plus one migration, not a rewrite. The versioned format is
> built for exactly that.

## Directory Layout

```
src/app/persistence/
├── persistence.service.ts        # Lifecycle entry point: API load/save + file import/export
├── project-metadata.store.ts     # Per-project metadata + dirty tracking
├── circuit-serializer.ts         # Project ↔ ProjectElement[] (legacy wire format, API)
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

### Two encodings, one model

Both targets ultimately produce/consume `Component` and `Wire` instances. They differ
only in the serialized shape:

| | Legacy wire format (`ProjectElement`) | Native file format (`CircuitFileV1`) |
| --- | --- | --- |
| Used by | Server API | Save-to-file / load-from-file |
| Component | `{ t, p, i?, o?, r?, n?[], s? }` — options packed positionally | `{ type, pos, options }` — options keyed by config name |
| Wire | `{ t: 0, p, q }` — endpoints | `{ pos, direction, length }` |
| Versioned | no | yes (`version` field) |
| Converter | `CircuitSerializer` | `CircuitFileService` |

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

| Method | Description |
| --- | --- |
| `serializeProject(project)` | `{ elements: ProjectElement[], dependencies: [] }`. Components → reserved fields (`direction→r`, `numInputs→i`, `numOutputs→o`) plus `n[]`/`s` slots in config order; wires → `t:0` with `p`/`q` endpoints. |
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
  components: { type: number; pos: [number, number]; options: Record<string, unknown> }[];
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

| Function | Behavior |
| --- | --- |
| `detectVersion(data)` | Integer `version` field → that number; missing/non-integer → `0` (legacy); non-object → `InvalidFileError`. |
| `migrateToCurrent(data, ctx)` | Newer-than-supported version → `UnsupportedVersionError`. Otherwise walk `MIGRATIONS`, applying the entry whose `from` matches the current version until `CURRENT_FILE_VERSION`. No matching step → `InvalidFileError`. An already-current document passes through untouched. |

`MIGRATIONS` is an ordered list (`migrations/migrations.ts`); `legacy→v1` is the first
entry, with future native `v1→v2…` steps appended.

**Migration rule:** a migration *may* read the component registry (option metadata) and
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

| Method | Description |
| --- | --- |
| `toJson(project, name)` | Encodes the project to a **current-version** JSON string. Builds the v1 shape explicitly (does not reuse the evolving `Component.serialize`), so the frozen format stays pinned. |
| `parse(content)` | `JSON.parse` (malformed → `InvalidFileError`) then `migrateToCurrent`. Returns a current-version document. |
| `deserialize(file)` | Current document → `{ components, wires }`. **Sole structural validator for native files** (the migrator passes an already-current doc through untouched): structurally broken elements throw `InvalidFileError`; unknown component types are dropped with a warning; elements get fresh ids. |
| `fromJson(content)` | Convenience: `parse` + `deserialize` → `{ name, components, wires }`. |

### Error types

`circuit-file.errors.ts`: `InvalidFileError` (malformed JSON, invalid element, or an
unrecognizable envelope) and `UnsupportedVersionError` (file version newer than this
build supports). Both follow the `AuthRequiredError` convention (set `.name`).

---

## `PersistenceService`

**File:** `persistence/persistence.service.ts`

Root-provided singleton; the single entry point for loading and saving. Race-token
guards (`_mainLoadToken`, `_shareLoadToken`) discard stale async server loads;
`_saveInFlight` deduplicates concurrent saves.

| Method | Description |
| --- | --- |
| `loadProject(uuid)` / `loadProjectAsMain(uuid)` | GET from API → `deserializeProject` → register `source:'server'` → (As Main) set as main + update URL. |
| `saveProject(project)` | No-op unless dirty and `source:'server'`. `serializeProject` → PUT. Clears dirty only if no edit landed during the round-trip; logs `VersionMismatch`. |
| `createProject(name, …)` | POST + initial PUT, register, set as main, update URL. |
| `loadShare` / `loadShareAsMain` / `cloneShare` | Share read paths (`source:'share'`, dirty tracking disabled). |
| `createAndSetEmptyProject()` | Blank local project, set as main. |
| `exportProjectToJson(project)` | Reads name from metadata, delegates to `CircuitFileService.toJson`. Returns the JSON string — triggering a download is a UI concern. |
| `importProjectFromJson(content)` | `CircuitFileService.fromJson` → build a new `Project`, register `source:'local'` (clean), set as main. **Throws** on an unreadable file (no fallback, unlike server loads); does not call `location.go` (no server uuid). |

### Flows

```
API load:   GET → ProjectElement[] → CircuitSerializer.deserialize → Project → register(server) → main
API save:   Project → CircuitSerializer.serialize → ProjectElement[] → PUT (oldHash guard)
File load:  string → JSON.parse → migrateToCurrent (detectVersion-driven chain) → decode → Project → register(local) → main
File save:  Project → encode current {version,name,components,wires} → JSON string
```

All four funnel through the same `Component`/`Wire` instances; the API uses the legacy
`ProjectElement[]` encoding, files use the native versioned envelope.

---

## `ProjectMetadataStore`

**File:** `persistence/project-metadata.store.ts`

Root-provided singleton holding metadata a bare `Project` lacks.

`ProjectMetadata`: `{ serverUuid, name, type: 'project'|'comp', source:
'server'|'local'|'share', hash, isPublic, link? }`.

| Method | Description |
| --- | --- |
| `register(project, metadata, trackDirty=true)` | Stores metadata; when `trackDirty`, subscribes to `project.actionManager.actionChange$` to auto-mark dirty. Shares register with `trackDirty:false`. |
| `getMetadata` / `getHandleByUuid` / `remove` | Lookup and teardown. |
| `markDirty` / `clearDirty` / `isDirty` | Dirty flag (Angular signal). |
| `dirtyVersion` | Monotonic counter used by `saveProject` to detect edits that land during a save. |
| `updateHash` | Updates the optimistic-concurrency hash after a successful save. |

---

## Testing

Specs sit next to source. Pure logic (`detectVersion`, `migrateToCurrent`, the legacy
migration) is testable with `TestBed.inject(ComponentProviderService)` and no
`setStaticDIInjector` (no render objects are built). Codecs that build `Component`/`Wire`
instances (`circuit-file.service.spec`, `persistence.service.spec`,
`circuit-serializer.spec`) call `setStaticDIInjector(TestBed.inject(Injector))` and use
inline fixtures (no JSON imports). The round-trip test (build → `toJson` → `fromJson` →
re-`toJson`, normalized-equal) covers every built-in component type plus wires.