# Persistence Layer

The persistence layer turns a live `Project` into stored data and back. Three
targets share one encoding — the **native versioned document**:

- **Server API** (`source: 'server'`) — `logigator-api` stores the document
  verbatim in a JSONB column.
- **Browser storage** (`source: 'browser'`) — projects and custom-component
  library masters in IndexedDB, restored on reload via `/local/:id`.
- **Local files** — `.lgix` export/import, plus a permanent read path for the
  legacy old-editor `.json`.

A file is **never a save target** — only an import source and an export sink.
Saving dispatches to the server or the browser depending on `source`; importing
a file converts it into a browser project, and any project can be exported.

`PersistenceService` is the facade — project lifecycle (load → register → main
→ save) over two symmetric gateways, `ServerPersistenceGateway` and
`BrowserPersistenceGateway`. Moving documents _between_ targets is
`PromotionService`; the bookkeeping a bare `Project` lacks (name, source, dirty,
cloud version) is `ProjectMetadataStore`.

Because every target holds the same bytes, a format bump is one migration plus a
coordinated deploy: the API normalizes every write to the newest version, so
editor and server must agree on what that version is.

## ⚠️ Three `version` axes — do not conflate

1. **File-format version** — `CircuitFileV1.version`, `CURRENT_FILE_VERSION`, a
   migration's `from`/`to`, `detectVersion`. Legacy = `0`, current = `1`. This
   is what the migration chain advances.
2. **Custom-component master version** — `StoredBrowserComponent.version`,
   `SnapshotDefinition.source.version`. A per-master content revision counter,
   bumped on each master save and copied into placed snapshots' provenance.
3. **`.lgix` container version** — `LGIX_CONTAINER_VERSION`, the byte framing
   around the gzipped JSON. Bumped only when the framing changes; the JSON
   inside still carries its own file-format version.

A fourth counter, the cloud document's optimistic-concurrency `version`, is not
a format version at all — see
[Concurrency](#concurrency-is-a-counter-the-server-owns).

## The core boundary

The data↔data half — document types, codecs, structural validator, migration
chain and the `.lgix` container — lives in **`@logigator/core`** (`model/`,
`codecs/`, `format/`), shared with the API and the migration tooling. The editor
keeps the live↔data half: snapshotting a `Project` (`snapshots.ts`) and building
PixiJS instances (`circuit-builder.ts`). Boundary rule: **core = data↔data,
editor = live↔data**.

`parseCircuitDocument` is the API's ingest pipeline, not the editor's: the
editor's load path is deliberately lenient and healing, and it needs live
instances rather than a body. Two of its policy lines still matter here —
board-level invariants are **not** checked (that is Repair Wires' job), and
`strict`, the mode every API write runs in, rejects an illegal option value
rather than normalizing it.

`MigrationContext` is `{ catalog, log }` — a `type → ComponentMeta` lookup and a
log sink, both plain functions, which is what lets the chain run anywhere:
`CircuitFileService` answers from the component registry and logs to
`LoggingService`, the server from `builtInMeta` into its parse result.

Custom-component **library** lifecycle (preloads, alias hydration, logout
teardown, orphan restore) is `custom-component/component-library.service.ts`;
see [`dependencies-and-promotion.md`](dependencies-and-promotion.md).

---

## Core Concepts

### Why the compact encodings

Repeated JSON structure is free after gzip; what gzip cannot remove is the
entropy of absolute coordinates. Both persisted encodings therefore sort
elements spatially and store positions relative to the previous element — ~3–4×
smaller gzipped per section. Wires become one SVG-path-style chain string
(`wire-chain.codec.ts`); components sort by (type, y, x) with delta positions
(`position-delta.codec.ts`). The in-memory wire model stays canonical
(`WireDirection` H/V, positive length, `pos` at the west/north endpoint) no
matter which end the chain walk entered from, and decoding normalizes back.

Both encoders reorder elements, so the document's element order is the
**emission order**. `toDocument()` returns it as `wireOrder`/`componentOrder`
for consumers aligning per-element data with the document
(`ProjectDump.wireIds`/`componentIds`). Embedded definitions get the same
treatment via `persisted-definition.codec.ts`, without order bookkeeping.

### Legacy v0 is read-only

`CircuitFileV0` (the intermixed positional `ProjectElement[]`), the `v0ToV1`
migration and the `legacyV0Slots` descriptors decode an old-editor `.json`
export — supported indefinitely — and are what the Phase 6 database migration
reads the legacy backend's stored blobs with. Nothing writes v0.

### Name lives in metadata, not on `Project`

A `Project` has no `name`. The display name is held in `ProjectMetadataStore`.
Export reads it from there; import writes it back. Code must never reach for
`project.name`.

### Clean-on-load

`Project.addComponent`/`addWire` do **not** push to the `ActionManager`, so a
project built by load or import starts non-dirty even though it was just
populated. Dirty tracking begins at the user's first undoable action.

---

## Server = the native document over HTTP

**Folder:** `persistence/server/` — one file, `server-persistence.gateway.ts`.

The cloud target has no codec of its own: a read hands the gateway a
`CurrentCircuitFile` and it calls `CircuitFileService.decode`; a write calls
`CircuitFileService.toDocument`. The gateway owns the _conversation_ —
transport, metadata, instance build — not a format. So a cloud save and a
`.lgix` export produce identical documents.

### Concurrency is a counter the server owns

Every stored circuit carries an integer `version`. A read hands one back (kept
in `ProjectMetadata.version`), a save presents it, and the server's `UPDATE`
carries it in the `WHERE`, so a write that lost the race matches no row and
answers `409` with `code: 'version_conflict'` rather than being merged. The
gateway adopts the version the response returns; the editor never invents one.

A counter rather than a hash of the stored bytes, precisely because a format
bump rewrites every stored document and must not read as a conflict. Metadata
edits bump it too: a rename (and a component's symbol or description) is content
the server stamps, so those `PATCH`es answer with a version to adopt. Visibility
and a regenerated share link do not bump it.

### What the server owns, not the client

A create carries its document, so promoting a draft, uploading a stored local
project and promoting a library master are each **one** `POST` — no
create-then-save with an unwind path for the half that failed. An absent
document _is_ an empty board server-side.

A component's port surface (`numInputs`/`numOutputs`/`labels`) is not sent: the
INPUT and OUTPUT plugs placed in the circuit are what its ports _are_, so a
client's declaration could only disagree with the document beside it. The same
rule takes the document's `name` from the row and strips the client-asserted
attribution chain. **Fork lineage** therefore has no request field: the chain
rides inside the uploaded document, and the server checks its last entry (the
immediate parent — the chain is root-first) against its own rows. A tampered
chain can lose attribution; it cannot forge it.

### Errors are codes, not statuses

Failures come back as `{ code, message, details? }`, which `ApiBaseService`
turns into an `ApiRequestError`. The save path branches on `code`:
`unauthorized` flips the editor to signed-out (the session expired under a
still-true auth cookie), `version_conflict` asks the user to reload, anything
else surfaces the server's own message. Responses are validated against their
`@logigator/contract` schema on the way in, so a shape mismatch is a named
boundary failure, not an `undefined` deep inside the decode.

`GET /api/components` is paged and capped, so `preloadServerMasters` walks until
it has the whole library. None of those requests carries a circuit: a master's
body is fetched lazily on first placement or edit-open and cached per session
(`_masterCircuitCache`, invalidated by a save). The cache holds the clean
persisted body, never the live working copy, so discarded edits are not
resurrected on reopen.

### `legacyV0Slots` descriptor

Each built-in's `ComponentMeta` maps its named options to the legacy positional
slots — the single source of truth for the v0 decode, e.g. the ROM's
`{ s: 'data', n: ['wordSize', 'addressSize'] }`. `i`/`o` and `s` each name one
option; `n: [...]` names the options consuming `element.n[0]`, `n[1]`, … in
**declaration order**, the one place a transposition would corrupt data (pinned
by a per-config test). `r` never needs an entry — it always carries the
first-class `direction`. Unlisted options take their default, and even an empty
descriptor matters: its presence marks the type as existing in v0.

> **Frozen.** The descriptor describes the _immutable_ legacy format but names
> **v1-era option keys**. If a live option is renamed, do **not** edit the
> descriptor — add a `v1→v2` migration instead.

### Legacy-anchor conversion (`legacy-anchor.ts` in core)

The old editor anchors a component by its body's **top-left corner**, held fixed
across rotation; this editor anchors by the **rotation pivot**. The two coincide
only for `Direction.E`, so a rotated component's `p` must be re-anchored when
crossing the v0 boundary or it lands offset. `legacyAnchorToPivot` decodes,
taking its width from the frozen `LEGACY_BODY_WIDTHS` map so no render object is
instantiated; `pivotToLegacyAnchor` reverses it for the Phase 6 database
migration. Customs (`t ≥ CUSTOM_TYPE_ID_BASE`) are absent from that map, so
`legacyCustomBodySize` supplies their extent instead — the frozen
`CUSTOM_BODY_GRID_WIDTH` by the port span. The migration threads a file-local
id → port-count map through, so nested customs re-anchor too.

---

## File Format & Migrations (`persistence/file/`)

`CircuitFileV1` extends the shared payload `PersistedCircuitV1` (`components`,
`wires`, `definitions[]`) with `version: 1`, `name` and an optional
`attribution` chain.

- **Frozen per version.** These types deliberately alias no live API DTO. A new
  version adds a new `CircuitFileV<N>` + migration and re-points
  `CurrentCircuitFile`; older interfaces are never edited, so shipped files keep
  their meaning.
- **No instance `id`.** Files store no element ids; fresh ones are allocated on
  load. (`Component.deserialize`/`Wire.deserialize` take an `id` only when
  passed one — undo/redo does, to preserve identity.)
- **Self-contained.** A file embeds a frozen snapshot of every custom it
  transitively uses (see [Snapshot codec](#snapshot--custom-component-codec)).

### Migration chain

`detectVersion` treats a missing or non-integer `version` field as `0` (legacy)
and a non-object as `InvalidFileError`. `migrateToCurrent` refuses anything
newer than supported, then walks `MIGRATIONS` — each entry advances to the
**next** version, never straight to newest — and ends in
`validateCurrentCircuitFile`, the single structural pass over the current shape.
Downstream code therefore indexes into the document without shape checks, and
everything structurally wrong fails uniformly as `InvalidFileError`. The
validator keeps the decode tolerances: absent sections, unchecked `name`,
element-wise negation sanitizing, unvalidated option _values_.

**Migration rule:** a migration _may_ read catalog data (option schemas,
`legacyV0Slots`) and log through its `MigrationContext`, but must **not**
instantiate render objects. Decoding legacy positional slots into named options
is the only reason `catalog` is in the context; native version→version
migrations are pure data transforms and ignore it.

`v0ToV1` is the only entry today. It splits `elements` into chain-encoded wires
(`t === 0`) and named-option bodies, drops with a warning any element whose type
is unknown or has no descriptor, and revives both sub-circuit sources into
`definitions[]` — the old file's inline `components` array and the legacy
transport's embedded snapshots — so the result is indistinguishable from a
native load.

`assembleCircuitFile` is the write half: body + definitions → document.

### `CircuitFileService`

The native-format codec, a thin adapter over `snapshots.ts`: encoding embeds a
frozen snapshot of every custom the project uses and rewrites the body to
file-local type ids; decoding ingests those snapshots and remaps back to session
ids. It touches neither metadata nor the active-project lifecycle.

| Method                          | Notes                                                           |
| ------------------------------- | --------------------------------------------------------------- |
| `toDocument(project, name, …?)` | The encoder. Returns `{ file, wireOrder, componentOrder }`.     |
| `toJson(…)`                     | `toDocument` stringified.                                       |
| `decode(data)`                  | Migrate + `deserialize`. Shared by file reads and server reads. |
| `deserialize(file)`             | Validated document → instances + `skippedCustom`.               |
| `fromJson(content)`             | `JSON.parse` (malformed → `InvalidFileError`) then `decode`.    |
| `decodeToBody(FromData)`        | Migrate + ingest → body, **no PixiJS instances**. Preload path. |

The load-side invariant lives in `_toSessionBody`: a custom-range type id
resolves **only** through the snapshot remap, never falling through to its own
value. File-local and session custom ids both count up from
`CUSTOM_TYPE_ID_BASE`, so a missing snapshot would otherwise alias an unrelated
session type. Such elements drop and are **counted** — the codec owns no UI, so
the load entry points surface the count via `load-warnings.ts`.

`circuit-file.errors.ts` holds `InvalidFileError` (malformed JSON or an
unrecognizable envelope), `CircuitIntegrityError` (parses, but names something
the catalog lacks or an out-of-range value; `strict` parsing only) and
`UnsupportedVersionError`.

### `.lgix` container

**File:** `logigator-core/src/format/lgix-container.ts`

Exported files are not raw JSON. The `toJson` output is wrapped in a
gzip-compressed, magic-byte-framed binary container written to `<name>.lgix`:

```
offset 0   "LGIX"                4 bytes   magic
offset 4   container version     1 byte    (= LGIX_CONTAINER_VERSION)
offset 5   flags                 1 byte    bit0..: compression algorithm (0 = gzip)
offset 6   gzip(utf8(json))      …         the CircuitFileService JSON string
```

- **Compression** is the platform `CompressionStream`/`DecompressionStream` — no
  dependency, and (unlike `crypto.subtle`) **not** secure-context-gated, so it
  works on plain-http LAN dev hosts.
- **Integrity is corruption detection only.** Header fields validate the framing
  and gzip's CRC32 trailer makes `decodeLgix` reject a corrupted or truncated
  payload. There is **no keyed check**: a client-only SPA ships its own
  verification logic and key, so nothing resists a determined forger.
- **Share re-import defense lives in the UI, not the format.** Since the check
  cannot be enforced client-side, the control is policy: `EditorMenuService`
  hides Export to File for read-only `source:'share'` documents and
  `exportProjectToFile` throws for them as defense in depth.
- **Import accepts both `.lgix` and plain `.json`**, branching on the magic, so
  the permanent legacy `.json` import keeps working.

Only the file boundary uses the container: gzip is a transport concern. The
IndexedDB store holds the plain `toJson` string, and the API stores the same
document in a column the database compresses at rest.

---

## Snapshot / custom-component codec

**Files:** `serialized-circuit.ts` (core), `persistence/snapshots.ts`

The native document is self-contained: it embeds a frozen snapshot of every
custom component it transitively uses, so it loads with no library present.

`serialized-circuit.ts` has **no imports**, so both the component layer (a
definition's `circuit`) and the persistence layer can use it without an import
cycle. It holds the in-memory body shapes, `SnapshotDefinition` (a frozen
custom: a **file-local** `type` id, `source?: { id, version, origin? }`
provenance, display fields) and pure helpers. `snapshots.ts` owns _which_
customs a document embeds and the session ↔ file-local type-id remap — not a
byte layout, since each target encodes the body its own way.

The transitive-closure walk, file-local numbering, provenance resolution,
nesting/recursion and how every transport carries these snapshots are in
**[`dependencies-and-promotion.md`](dependencies-and-promotion.md)**.

`SerializedComponent`/`SerializedWire` (undo/redo) are a separate in-memory
shape, not a persistence format.

---

## Browser Storage (`persistence/browser/`)

Two object stores in one IndexedDB database (`logigator-editor`), opened through
the shared connection in `storage/indexed-db-store.ts`: `projects`
(`BrowserProjectStore`) and `components` — library **masters** —
(`BrowserComponentStore`). A third, `componentIdMap`, holds the durable old→new
id map written on component promotion.

- The DB version is bumped only to **create** stores, never to migrate records:
  record upgrades ride the file migration chain on load.
- In both records **`content` is a `CircuitFileService.toJson` string**. This is
  the crux: an import is just "decode the file, then browser-save the re-encoded
  blob", every stored document is self-contained, and stored circuits get the
  migration chain for free. Summary columns (`name`, and for masters
  `symbol`/`numInputs`/`labels`/…) are duplicated out of `content` so listing
  does not parse every blob.
- The **store is the discriminator** — no `type` field. Each store owns id
  generation, timestamps and `createdOn` preservation, so callers deal only in
  `{ name/…, content }`.
- Ids are RFC-4122 v4 from the `uuid` package, not `crypto.randomUUID`, which is
  restricted to secure contexts and unavailable on plain-http dev hosts.

---

## `PersistenceService`

**File:** `persistence/persistence.service.ts`

The load-as-main entry points share one `_loadAsMain` skeleton: a single race
token discards stale async loads (they all fill the one main slot, so starting
any abandons a pending load of the others), a stale result is disposed, and a
failure toasts and falls back to a blank draft. `_saveInFlight` deduplicates
concurrent saves. Per-target work lives in the two gateways; the facade
dispatches on metadata `source`/`type`.

Behavior beyond what the method names say:

- **`saveProject`** is a no-op unless dirty, and always for `share` (read-only).
  Dispatch: `comp`+`browser` → `browser.saveComponent`; `server` → the server
  gateway (PUT against the metadata `version`; a `version_conflict` toasts and
  stays dirty); `browser` → `browser.saveProject`, promoting a fresh draft to
  `/local/:id`. Every path runs under `withDirtyGuard`.
- **`saveDraftAsLocal`** bypasses the dirty guard so a pristine board can still
  be named and persisted.
- **`createAndSetEmptyProject`** makes a blank `source:'browser'` project with
  an empty id, **not written to storage** until the first save. No name or
  destination is asked up front; that prompt is deferred to the first save (see
  `SaveCoordinatorService` in `ui.md`).
- **`importProjectFromJson`** is the one path that writes a fresh draft to
  storage up front, so a reload restores it, and the one that **throws** on an
  unreadable file (server loads fall back instead). Imported customs are not
  adopted into the library: each resolves through its provenance id or stays an
  embedded, restorable snapshot.
- **Share loads** register `source:'share'` with dirty tracking off, and **both
  kinds fill the main slot** — a component share opens standalone exactly as
  `/component/:uuid` does, so the title bar names it, its tab is the pinned one,
  and the File menu's clone action has a document to read.
- **`renameBrowserProject`** rewrites the blob's top-level `name` **and** the
  summary column, because the codec reads the blob on open, not the column.

### Flows

```
API load:     GET → CircuitFileV1 → circuitFile.decode → Project → register(server, version) → main
API save:     Project → circuitFile.toDocument → PUT { document, version } → adopt the new version
Browser load: IndexedDB record → circuitFile.fromJson → Project → register(browser) → main (/local/:id)
Browser save: Project → circuitFile.toJson → BrowserProjectStore.save (generate id on first save)
File import:  ArrayBuffer → (decodeLgix | utf8) → circuitFile.fromJson → Project → Browser save → main (/local/:id)
File export:  Project → circuitFile.toJson → encodeLgix (gzip + header) → <name>.lgix (download)
```

### Sibling services

**`PromotionService`** moves documents from the browser store to the cloud:
`saveDraftAsServer` flips the **live** project's metadata so circuit and undo
history survive; `promoteComponentToServer` does a server round-trip, then
`promoteMaster` on the registry with the old id kept as an alias, persists the
`oldId→newId` map, deletes the browser record and re-points any open tab; the
`localDependencies*` queries return children before parents to drive the upload
dialog. All uploads are **silent primitives** — `UploadCoordinatorService` owns
the outcome toasts. See
[`dependencies-and-promotion.md`](dependencies-and-promotion.md).

**`ProjectDumpService`** builds debug dumps: the native document plus element
ids and the serialized undo history.

### Session lifecycle & the cloud save guard

`CloudSessionService` (`src/app/user/`) stamps every registered
`source:'server'` document with the user id it was loaded under and answers
`verdict(project): 'ok' | 'logged-out' | 'foreign'`. `saveProject` consults it
for server documents; create/promote/upload require a signed-in session. A
rejection toasts once and throws `AuthRequiredError` / `ForeignDocumentError`,
which outer flows recognize via `isHandledSaveError` and do not re-toast. An
HTTP 401 on a save additionally flips `UserService.sessionExpired()`.

`SessionLifecycleService` reacts to `UserService.user()` transitions: login →
alias preload + `preloadServerMasters`; any logout → `clearServerMasters()`,
which drops server masters from registry and palette except those backing an
open server component editor (their `DefinitionBinding` must stay live); placed
snapshots keep rendering. Its `requestLogout()` drives the Log Out action: dirty
cloud documents prompt Save / Discard / Cancel and any failure aborts the
logout, then the cloud workspace is deliberately reset — server component tabs
force-close, a server main is replaced by a blank draft (exiting a running
simulation first), local documents stay. An **external** logout (expiry, another
tab) touches nothing but the library.

---

## `ProjectMetadataStore`

**File:** `persistence/project-metadata.store.ts`

Holds what a bare `Project` lacks: `{ id, name, type, source, version?,
isPublic, link?, attribution? }`. `id` is the identifier **within the project's
store**: the server uuid for `'server'`/`'share'`, the IndexedDB id for
`'browser'`, or `''` for a browser project not yet written to storage. `version`
is server-only — a browser record is the sole writer of its own blob and a share
is read-only. `attribution` is carried read-only so fork lineage survives
export → import → upload.

- `register(project, metadata, trackDirty = true)` subscribes to
  `project.actionManager.actionChange$` to auto-mark dirty; shares register with
  `trackDirty: false`.
- `dirtyVersion` — a monotonic counter bumped on every `markDirty`, even when
  already dirty.
- `withDirtyGuard(project, fn)` — runs an async save step (which must include
  the serialization) under the mid-save edit guard: snapshot `dirtyVersion` →
  await `fn` → clear the dirty flag only if no edit landed in flight. Both
  gateways run every save through it.
- `updateVersion` adopts the version a cloud read or write answered with;
  `updateId` sets the store id once a fresh draft is first written.

---

## Testing

Pure logic (`detectVersion`, `migrateToCurrent`, `v0ToV1`, the codecs, the
validator, the `.lgix` container) is tested in **`@logigator/core`** with plain
Vitest and no Angular. Editor specs that build `Component`/`Wire` instances call
`setStaticDIInjector(TestBed.inject(Injector))`. Guardrails worth keeping
intact:

- **`v0-to-v1.migration.spec`** (core) pins each `legacyV0Slots` descriptor
  exactly, so a new built-in without one — which would silently drop on decode —
  is caught.
- **`circuit-file.service.spec`** round-trips `toJson → fromJson → toJson`
  (normalized-equal) for multi-element circuits and 1- and 2-deep nested
  customs, covering snapshot embedding and the type-id remap.
- **`circuit-file-validator.spec`** (core) asserts malformed documents raise
  `InvalidFileError` — never a raw `TypeError` — and pins the deliberate
  tolerances (absent sections, absent `source`).

`persistence.service.spec` swaps in the in-memory stores from
`src/testing/fake-browser-stores.ts`, so the orchestration is tested without
touching IndexedDB.
