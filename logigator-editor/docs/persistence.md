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
  format that mirrors the editor's own model (named options; wires chain-encoded as
  `"x,y:e5s3;…"`; embedded custom-component snapshots). A migration chain
  upgrades older files — including the legacy `logigator-editor` export — to the current
  version on load.

A file is **never a save target** — only an import source and an export sink. Saving
always dispatches to the server (API) or the browser (IndexedDB) depending on `source`;
importing a file converts it into a browser project, and any project can be exported.

`PersistenceService` is the facade for all targets: it owns the project lifecycle
(load → register → set as main → save) and dispatches to two symmetric gateways —
`ServerPersistenceGateway` (temporary, legacy API) and `BrowserPersistenceGateway`
(IndexedDB). Moving documents _between_ the targets is `PromotionService`; debug dumps
are `ProjectDumpService`. `ProjectMetadataStore` holds the per-project bookkeeping
(name, source, dirty state) that a bare `Project` does not.

> When the planned editor-native API lands, it will resemble the native file format — at
> which point it becomes a new file-format version plus one migration, and
> `persistence/server/` is deleted. The versioned format is built for exactly that.

## ⚠️ Three `version` axes — do not conflate

Three unrelated version concepts live in this layer:

1. **File-format version** — `CircuitFileV1.version`, `CURRENT_FILE_VERSION`, a
   migration's `from`/`to`, `detectVersion`. Legacy = `V0`, native current = `V1`
   (`CURRENT_FILE_VERSION = 1`). This is what the migration chain advances.
2. **Custom-component master / snapshot version** — `StoredBrowserComponent.version`,
   `SnapshotDefinition.source.version`, `CustomComponentDefinition.version`. A per-master
   **content revision counter**, bumped each time a library master is saved and copied
   into placed snapshots' provenance. **Unrelated to the file-format version.**
3. **`.lgix` container version** — `LGIX_CONTAINER_VERSION`, the byte-framing of the
   exported file (magic + version + flags around the gzipped JSON). Bumped only when the
   framing itself changes; the JSON _inside_ still carries its own file-format version.
   Only the file export/import boundary sees it. See [`.lgix` container](#lgix-container).

## Directory Layout

```
src/app/persistence/
├── persistence.service.ts        # Facade: load/save dispatch, file import/export, main-slot lifecycle
├── promotion.service.ts          # Upload-to-cloud: draft/project/component promotion + local-dependency queries
├── project-metadata.store.ts     # Per-project metadata + dirty tracking (incl. withDirtyGuard)
├── persisted-circuit.types.ts    # Version bases: PersistedComponentV0/V1, PersistedCircuitV0/V1
├── serialized-circuit.ts         # Native body types (SerializedComponentBody/WireBody) + SnapshotDefinition + helpers
├── snapshots.ts                  # Universal snapshot codec (collect/serialize the native body + definitions[])
├── circuit-builder.ts            # buildProject + instantiateBody — the single body→instances path
├── load-warnings.ts              # Shared "customs skipped" toast for the load entry points
├── wire-chain.codec.ts           # Persisted wire encoding: chain string with relative heads
├── position-delta.codec.ts       # Persisted component positions: (type,y,x) sort + deltas
├── persisted-definition.codec.ts # SnapshotDefinition ↔ persisted form (delta components, chain wires)
├── dump/                         # Debug project dumps (circuit + element ids + undo history)
│   └── project-dump.service.ts   # build/export/import — debug menu + bug-report payloads
├── server/                       # ⚠️ TEMPORARY — legacy server (v0-over-HTTP) transport
│   ├── server-persistence.gateway.ts # Server transport + codec + metadata + build, returning Projects
│   └── server-circuit.codec.ts   # v0 ENCODER (Project → ProjectElement[]) + toCircuitFileV0 read adapter
├── browser/                      # Browser-local (IndexedDB) targets
│   ├── browser-persistence.gateway.ts # Browser transport + codec + metadata + build — the server gateway's sibling
│   ├── browser-project.types.ts  # StoredBrowserProject / StoredBrowserComponent records + summaries
│   ├── browser-project.store.ts  # IndexedDB CRUD for saved projects
│   ├── browser-component.store.ts# IndexedDB CRUD for library masters
│   └── component-id-map.store.ts # Durable old→new id map written on component promotion
└── file/                         # Native versioned file format + migrations
    ├── circuit-file.types.ts     # CircuitFileV0/V1 envelopes; CURRENT_FILE_VERSION; CurrentCircuitFile
    ├── circuit-file.errors.ts    # InvalidFileError, UnsupportedVersionError
    ├── circuit-file-migrator.ts  # detectVersion + migrateToCurrent (chain runner + validation)
    ├── circuit-file-validator.ts # Structural validation of a current-version document
    ├── circuit-file.service.ts   # toJson / decode / deserialize / fromJson (the file codec)
    ├── lgix-container.ts         # .lgix export framing: gzip + magic-byte header (encode/decode)
    └── migrations/
        ├── migration.ts          # Migration<TIn,TOut> + MigrationContext
        ├── v0-to-v1.migration.ts # v0 (legacy) → v1 (registry-backed; reads legacyV0Slots)
        └── migrations.ts         # MIGRATIONS — the ordered chain
```

The shared IndexedDB connection wrapper lives in `src/app/storage/indexed-db-store.ts`;
custom-component **library** lifecycle (startup preloads, alias hydration, logout
teardown, snapshot adoption, orphan restore) lives in
`src/app/custom-component/component-library.service.ts` (see
[`dependencies-and-promotion.md`](dependencies-and-promotion.md)).

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
PersistedComponentV1           = SerializedComponentBody   // { type, pos, direction?, options } — pos delta-encoded, direction omitted when East
PersistedWiresV1               = string                    // chain-encoded: "x,y:e5s3;x,y:n2"
PersistedSnapshotDefinitionV1  = SnapshotDefinition with delta components + chain wires
PersistedCircuitV1    = { components: PersistedComponentV1[]; wires: PersistedWiresV1; definitions: PersistedSnapshotDefinitionV1[] }
  └── CircuitFileV1   extends PersistedCircuitV1 → { version: 1, name }   (file + browser store this verbatim)
```

**Why deltas everywhere:** repeated JSON structure is free after gzip; what gzip cannot
remove is the entropy of absolute coordinates. Both persisted encodings therefore sort
elements spatially and store positions relative to the previous element, turning
coordinates into small, repeating deltas (measured on real circuits: ~3–4× smaller
gzipped per section than absolute positions).

**Wire chain encoding** (`wire-chain.codec.ts`) — wires persist as one SVG-path-style
string: each `;`-separated chunk starts at a head point (`x,y:` — itself a delta
against the previous chunk's head, the first relative to the origin), then every
segment is one wire leaving the current point (`e`/`s`/`w`/`n` + length; segments abut
with no separator — the next letter ends the number), whose far endpoint becomes the
next segment's start. The encoder is a greedy walk over an adjacency map keyed `"x,y"`
with every wire indexed under **both** endpoints, starting chunks in (y, x) order of
the canonical start; `w`/`n` mean the walk entered a wire from its far end — the
in-memory model stays canonical (`WireDirection` H/V, positive length, `pos` at the
west/north endpoint) and decoding normalizes back.

**Component position deltas** (`position-delta.codec.ts`) — persisted components are
sorted by (type, y, x) and each `pos` is stored relative to the previous component's
absolute position. Decoding restores absolutes in document order.

Both encoders reorder elements, so the document's element order is the **emission
order**; `toDocument()` returns it (`wireOrder`/`componentOrder`) for consumers that
align per-element data with the document (`ProjectDump.wireIds`/`componentIds`).
Embedded definitions get the same treatment via `persisted-definition.codec.ts` (their
internal order has no consumers, so no order bookkeeping).

`PersistedCircuitV1` is the named **transport payload** (body + `definitions[]`) shared
by the file and browser targets — it makes "the browser store reuses the file format" an
explicit contract. V0's circuit is an intermixed positional element array; that
internal-shape difference from V1 is normal across versions.

### Two encodings, three targets

All targets ultimately produce/consume `Component` and `Wire` instances, but there are
only **two** serialized shapes — the legacy v0 wire format and the native v1 format. The
browser target reuses the native format, so it shares `CircuitFileService` end to end:

|           | Legacy v0 (`ProjectElement`)                                   | Native v1 (`CircuitFileV1`)                                         |
| --------- | -------------------------------------------------------------- | ------------------------------------------------------------------- |
| Used by   | Server API (temporary)                                         | Browser storage **and** save/load-to-file                           |
| Component | `{ t, p, i?, o?, r?, n?[], s? }` — options packed positionally | `{ type, pos, direction?, options }` — options keyed by config name |
| Wire      | `{ t: 0, p, q }` — endpoints                                   | chain string (`"x,y:e5s3;…"`)                                       |
| Customs   | dropped (v0 has none)                                          | embedded as `definitions[]` snapshots                               |
| Decode    | `v0ToV1` migration                                             | `CircuitFileService`                                                |
| Encode    | `server/server-circuit.codec` (temporary)                      | `CircuitFileService` + `snapshots.ts`                               |

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
  dropped with a warning. Custom components **do** round-trip (R14): each server
  `dependencies[]` entry carries an additive embedded `snapshot`, which the migration's
  `decodeDependencies` revives into native `definitions[]` (provenance resolution, the
  `mapping.id`/`localId` rule, and reference-only handling are in
  [`dependencies-and-promotion.md`](dependencies-and-promotion.md)).
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
// rom.config.ts — `s` carries the ROM contents (base64 bit-packed blob)
legacyV0Slots: { s: 'data', n: ['wordSize', 'addressSize'] }
// input.config.ts
legacyV0Slots: { s: 'label', n: ['index'] }
```

- `i` / `o` — option populated from `element.i` / `o` (decode only; encode emits
  these from the component's first-class fields). `r` never needs an entry: it
  always carries the first-class `direction`, decoded into the body's own
  `direction` field and encoded back from it generically. An empty descriptor
  (`legacyV0Slots: {}`) still matters — its presence marks the type as existing
  in the v0 format.
- `n: [...]` — options consuming `element.n[0]`, `n[1]`, … in **declaration order** (the
  one place an `n[]` transposition would corrupt data — pinned by a per-config test).
- `s` — the single option consuming `element.s`.
- Options not listed take their default on decode.

> **Frozen.** `legacyV0Slots` describes the _immutable_ legacy format and names **v1-era
> option keys**. If a live option is later renamed, do **not** edit the descriptor — add a
> `v1→v2` migration instead.

### Legacy-anchor conversion (`persistence/legacy-anchor.ts`)

The old editor anchors a component by its body's **top-left corner**, held fixed across
rotation; editor-v2 anchors by the **rotation pivot** (body drawn from the local origin,
rotated around `position`). The two coincide only for `Direction.E`, so a rotated
component's `p` must be re-anchored when crossing the v0 boundary, or it lands offset.

`legacy-anchor.ts` is the single source of truth for that conversion, shared like
`legacyV0Slots` between the permanent decode and the temporary encode:

- **Decode** (`v0ToV1` migration) — `legacyAnchorToPivot(p, direction, w, h)` shifts the
  legacy top-left to the v2 pivot. `w` comes from the frozen `LEGACY_BODY_WIDTHS` map
  (per-type `bodyGridWidth`, so no render object is instantiated); `h = legacyBodyHeight(i, o)`.
- **Encode** (`server-circuit.codec`) — `pivotToLegacyAnchor` reverses it. For a live
  `Project` component the codec just emits `component.bodyGridBounds` (whose corner already
  **is** the legacy anchor); for built-ins inside a snapshot body (decoded through the same
  migration) it calls `pivotToLegacyAnchor` with the frozen width map.

Customs (`t ≥ CUSTOM_TYPE_ID_BASE`) keep `p` verbatim on both sides — re-anchoring rotated
customs is a deferred follow-up (their `bodyGridWidth` isn't in the frozen map).

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

| Function                      | Behavior                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `detectVersion(data)`         | Integer `version` field → that number; missing/non-integer → `0` (legacy); non-object → `InvalidFileError`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `migrateToCurrent(data, ctx)` | Newer-than-supported → `UnsupportedVersionError`. Otherwise walk `MIGRATIONS`, applying the entry whose `from` matches the current version until `CURRENT_FILE_VERSION`. Each entry advances to the **next** version, never straight to newest. Ends in `validateCurrentCircuitFile` (`circuit-file-validator.ts`) — the single structural pass over the current-version shape (body elements, wires string, definitions incl. their inner bodies), so downstream code indexes into the document without shape checks and everything structurally wrong fails uniformly as `InvalidFileError`. The validator keeps the decode tolerances: absent sections, unchecked `name`, element-wise negation sanitizing, unvalidated option _values_. |

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
- Splits `elements`: `t === WIRE_TYPE_ID (0)` → wire bodies, chain-encoded into the v1
  `wires` string; everything else → a named-option component body via the config's
  `legacyV0Slots` descriptor.
- Drops any element whose type is **unknown or has no `legacyV0Slots`** descriptor (with a
  warning), consistent with the editor's silent-drop behavior.
- Revives both sub-circuit-definition sources into `definitions[]`: the old-editor
  _file_'s inline `components` array (`decodeLegacyComponents`) and the server
  transport's additive embedded snapshots (`decodeDependencies`). Either way the
  migrated document is self-contained and indistinguishable from a native file load.

### `CircuitFileService`

**File:** `persistence/file/circuit-file.service.ts`

The native-format codec. A thin adapter over the universal snapshot codec
(`snapshots.ts`): encoding embeds a frozen snapshot of every custom the project uses and
rewrites the body to file-local type ids; decoding ingests those snapshots into the
registry and remaps back to session ids. It does not touch metadata or the
active-project lifecycle.

| Method                  | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `toJson(project, name)` | Encodes to a **current-version** JSON string: `collectSnapshots` + `serializeProjectBody`, then `remapComponentTypes` to file-local ids. Builds the v1 shape explicitly (not via `Component.serialize`).                                                                                                                                                                                                                                                                                                                                                      |
| `decode(data)`          | Object-level entry: `migrateToCurrent` + `deserialize` → `{ name, components, wires, skippedCustom }`. **Shared by file reads (`fromJson`) and server reads** (`server.toCircuitFileV0(detail)` wraps the API response).                                                                                                                                                                                                                                                                                                                                      |
| `deserialize(file)`     | Current, validated document → `{ components, wires, skippedCustom }`: the shared file→session-body remap (`_toSessionBody`: ingests `definitions[]`, remaps file-local → session ids, never falls a custom id through to its own value) + the shared instance builder (`circuit-builder.instantiateBody`, which also sanitizes negation arrays). Unknown types drop with a warning; a custom with a missing snapshot drops and is **counted** — the codec owns no UI, so the load entry points surface the count via `load-warnings.ts`. Fresh ids allocated. |
| `fromJson(content)`     | Convenience: `JSON.parse` (malformed → `InvalidFileError`) then `decode`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

### Error types

`circuit-file.errors.ts`: `InvalidFileError` (malformed JSON, invalid element, or an
unrecognizable envelope) and `UnsupportedVersionError` (file version newer than this
build supports). Both follow the `AuthRequiredError` convention (set `.name`).

### `.lgix` container

**File:** `persistence/file/lgix-container.ts`

Exported files are **not** raw JSON. `CircuitFileService.toJson` output is wrapped in a
gzip-compressed, magic-byte-framed binary container written to `<name>.lgix`:

```
offset 0   "LGIX"                4 bytes   magic
offset 4   container version     1 byte    (= LGIX_CONTAINER_VERSION)
offset 5   flags                 1 byte    bit0..: compression algorithm (0 = gzip)
offset 6   gzip(utf8(json))      …         the CircuitFileService JSON string
```

- **Compression.** gzip via the platform `CompressionStream`/`DecompressionStream` — no
  dependency, and (unlike `crypto.subtle`) **not** secure-context-gated, so it works on
  plain-http LAN dev hosts too. A circuit's repeated option keys and embedded definitions
  compress heavily.
- **Integrity is corruption-detection only.** The magic + version + flags validate the
  header; gzip's own CRC32 trailer makes `decodeLgix` reject a corrupted or truncated
  payload (the decompression stream errors → `InvalidFileError`). There is **no keyed
  check** — a client-only SPA ships its own verification logic and key, so nothing in the
  format resists a determined forger. This is deliberate: the format is tamper-_evident_,
  not tamper-_proof_.
- **Share re-import defense lives in the UI, not the format.** Because the check can't be
  cryptographically enforced client-side, the effective control is policy:
  `EditorMenuService` hides **Export to File** for read-only `source:'share'` documents,
  and `PersistenceService.exportProjectToFile` throws for them as defense-in-depth. A
  borrowed share therefore never reaches the export path.
- **Import accepts both `.lgix` and plain `.json`.** `importProjectFromFile` reads the
  file as an `ArrayBuffer` and branches on the `LGIX` magic: a match is
  `decodeLgix`-unwrapped, anything else is decoded as UTF-8 JSON — which keeps the
  **permanent** legacy `logigator-editor` `.json` import working. Both paths converge on
  `importProjectFromJson`.

Only the file export/import boundary uses the container. The browser IndexedDB store still
holds the plain `toJson` string, and the server v0 codec is untouched.

---

## Snapshot / custom-component codec

**Files:** `persistence/serialized-circuit.ts`, `persistence/snapshots.ts`

The native document is self-contained: it embeds a frozen snapshot of every custom
component it (transitively) uses, so it can be loaded with no library present.

- **`serialized-circuit.ts`** — the native body types and pure helpers, with **no
  imports** so both the component layer (a definition's `circuit`) and the persistence
  layer can use them without an import cycle:
  - `SerializedComponentBody` `{ type, pos, direction?, options }`, `SerializedWireBody`
    `{ pos, direction, length }`, `SerializedCircuitBody` `{ components, wires }`.
    These are the **in-memory** shapes; on write, `wire-chain.codec.ts` folds the wire
    objects into the persisted chain string and `position-delta.codec.ts` delta-encodes
    the component positions (both unfold on read).
  - `SnapshotDefinition extends SerializedCircuitBody` — a frozen custom: a **file-local**
    `type` id, `source?: { id, version, origin? }` provenance (id + the axis-2 master
    version + the master's library origin), and the display fields (`name`, `symbol`,
    `numInputs`, …).
  - `cloneComponentBody` / `cloneCircuit` (deep copy) and `remapComponentTypes`
    (translate `type` ids through a map; ids absent from the map pass through).
- **`snapshots.ts`** — the universal codec, owning _which_ customs a document embeds and
  the session ↔ file-local type-id remap (but not a byte layout — each target encodes the
  body its own way): `serializeProjectBody` and the `collectSnapshots` /
  `CustomComponentRegistry.ingestSnapshots` round-trip.

The transitive-closure walk, file-local numbering, provenance (`source.id`/`version`/
`origin`) resolution, nesting/recursion, and how every transport carries these snapshots
are documented in
**[`dependencies-and-promotion.md`](dependencies-and-promotion.md)** (the single
reference for the dependency/promotion system).

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

Root-provided singleton; the facade for loading and saving. The four load-as-main entry
points share one `_loadAsMain` skeleton: a race token (`main` for everything filling the
single main slot, `share` for shares) discards stale async loads, a stale result is
disposed, and a failure toasts + falls back to a blank draft. `_saveInFlight`
deduplicates concurrent saves. The per-target work lives in the two gateways
(`ServerPersistenceGateway`, `BrowserPersistenceGateway`); the facade dispatches on
metadata `source`/`type`.

| Method                                                                   | Description                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `loadProject(uuid)` / `loadProjectAsMain(uuid)`                          | GET from API → `circuitFile.decode(server.toCircuitFileV0(detail))` → register `source:'server'` → (As Main) set as main + update URL.                                                                                                                                                                                                                                                                                          |
| `loadLocalProject(id)` / `loadLocalProjectAsMain(id)`                    | Read from `projects` store → `circuitFile.fromJson` → register `source:'browser'` → (As Main) set as main + `/local/:id`. Shares `_mainLoadToken` with the server path (both own the single main slot).                                                                                                                                                                                                                         |
| `loadComponentForEdit(id)`                                               | Read a **library master** from the `components` store → build a Project from its self-contained circuit → reuse or `createMaster` its session type id → register `type:'comp', source:'browser'`. Returns the Project + master type id so the caller can open a tab.                                                                                                                                                            |
| `saveProject(project)`                                                   | No-op unless dirty. Dispatches on metadata: `comp`+`browser` → `browser.saveComponent`; `server` → `server.saveProject`/`saveComponent` (PUT with `oldHash` guard; logs `VersionMismatch`); `browser` → `browser.saveProject` (a fresh draft is promoted to `/local/:id`). Every save path runs under `ProjectMetadataStore.withDirtyGuard`, so an edit landing mid-save keeps the project dirty. `share` is read-only → no-op. |
| `createProject(name, …)`                                                 | POST + initial PUT (`server.serializeProject`), register, set as main, update URL.                                                                                                                                                                                                                                                                                                                                              |
| `saveDraftAsLocal(project, name)`                                        | First save of a never-saved draft to the browser store: applies the chosen `name`, then `browser.saveProject` (generates id, `/local/:id`). Bypasses the `saveProject` dirty-guard so a pristine board can still be named and persisted.                                                                                                                                                                                        |
| `persistImportedProject(project, name)`                                  | Common tail of the import paths (file import here, dump import in `ProjectDumpService`): adopt orphan custom snapshots (`ComponentLibraryService.adoptSnapshots`), register, write a fresh browser draft, set as main, `/local/:id`.                                                                                                                                                                                            |
| `loadShare` / `loadShareAsMain` / `cloneShare`                           | Share read paths (`source:'share'`, dirty tracking disabled); decode via the same server v0 route.                                                                                                                                                                                                                                                                                                                              |
| `createAndSetEmptyProject()`                                             | Blank `source:'browser'` project with empty id (name `'Untitled'`), set as main. **Not written to storage** until the first save. Used both on a project-less page load and by the **New Project** menu action — no name/destination is asked up front; that prompt is deferred to the first save (see `SaveCoordinatorService` in `ui.md`).                                                                                    |
| `exportProjectToJson(project)`                                           | Reads name from metadata, delegates to `circuitFile.toJson`. Source-agnostic. Returns the JSON string — triggering a download is a UI concern.                                                                                                                                                                                                                                                                                  |
| `importProjectFromJson(content)`                                         | `circuitFile.fromJson` → build a Project → **adopt** any master-less embedded customs into the `components` library → register `source:'browser'` (clean) → **persist immediately** (re-encoded current-version) → set as main → `/local/:id`. **Throws** on an unreadable file (no fallback, unlike server loads).                                                                                                             |
| `listBrowserProjects` / `deleteBrowserProject` / `listBrowserComponents` | Browser-store listing/removal for the two stores.                                                                                                                                                                                                                                                                                                                                                                               |
| `renameBrowserProject(id, name)` / `renameProject(uuid, name)`           | Rename a stored project from the Open Project dialog. Browser: rewrites the blob's top-level `name` (the codec reads the blob, not the summary column, on open) **and** the column via `BrowserProjectStore.save`. Server: `PATCH /api/project/:id` with `{ name }`. Both sync the in-memory metadata (title bar) when the renamed project is currently open.                                                                   |

### Flows

```
API load:     GET → ProjectElement[] → server.toCircuitFileV0 → v0ToV1 migration → circuitFile.decode → Project → register(server) → main
API save:     Project → server.serializeProject → ProjectElement[] → PUT (oldHash guard)
Browser load: IndexedDB record → circuitFile.fromJson → Project → register(browser) → main (/local/:id)
Browser save: Project → circuitFile.toJson → BrowserProjectStore.save (generate id on first save)
File import:  ArrayBuffer → (decodeLgix | utf8) → circuitFile.fromJson → Project → adopt customs → Browser save → main (/local/:id)
File export:  Project → circuitFile.toJson → encodeLgix (gzip + header) → <name>.lgix (download)
```

All funnel through the same `Component`/`Wire` instances. The API uses the legacy v0
encoding (decoded through the migration); the browser target and files use the native v1
envelope — which is why a file import is simply "decode, then browser-save the re-encoded
blob."

### Sibling services

The facade's former side-jobs live in dedicated services:

- **`PromotionService`** (`persistence/promotion.service.ts`) — moving documents from
  the browser store to the cloud: `saveDraftAsServer` (first server save of a draft,
  flipping the **live** project's metadata so circuit + undo history survive),
  `promoteProjectToServer` (move an already-saved local project: upload → navigate →
  delete the orphaned browser record), `uploadStoredProjectToServer` (by store id, via a
  throwaway project when it isn't the open one), `promoteComponentToServer` (server
  round-trip → registry `promoteMaster` with the old id kept as an alias → persist the
  `oldId→newId` id-map → delete the browser record → re-point any open editor tab), and
  the `localDependencies*` queries (children-before-parents) that drive the upload
  dialog. All uploads are **silent primitives** — `UploadCoordinatorService` owns the
  outcome toasts. See [`dependencies-and-promotion.md`](dependencies-and-promotion.md).
- **`ComponentLibraryService`** (`custom-component/component-library.service.ts`) —
  library lifecycle: `preloadBrowserMasters` / `preloadServerMasters` /
  `preloadComponentIdAliases` (startup + login), `ensureServerMasterCircuit` (lazy
  hydration), `clearServerMasters` (logout teardown), `adoptSnapshots` (import
  adoption), `restoreOrphanToLibrary` (orphan recovery).
- **`ProjectDumpService`** (`persistence/dump/project-dump.service.ts`) — debug dumps:
  the native document plus element ids and the serialized undo history, driven by the
  debug menu and the bug-report payload builder; its import reuses the facade's
  `persistImportedProject` tail.

### Session lifecycle & the cloud save guard

Cloud persistence follows the signed-in user (`src/app/user/`):

- **`CloudSessionService`** stamps every registered `source:'server'` document
  with the user id it was loaded under and answers
  `verdict(project): 'ok' | 'logged-out' | 'foreign'`. `saveProject` consults it
  for server documents and the create/promote/upload entry points require a
  signed-in session — a rejection toasts the specific reason once and throws
  `AuthRequiredError` / `ForeignDocumentError`, which outer flows recognize via
  `isHandledSaveError` and don't re-toast. An HTTP 401 on a save additionally
  flips `UserService.sessionExpired()` (stale auth cookie cleaned up).
- **`SessionLifecycleService`** (injected by `AppComponent` for its side
  effects, like `InspectionService`) reacts to `UserService.user()` transitions:
  login → `ComponentLibraryService.preloadComponentIdAliases` (memoized) +
  `preloadServerMasters`;
  logout (any kind) → `clearServerMasters()`, which drops server masters from
  the registry/palette except those backing an open server component editor
  (their `DefinitionBinding` must stay live); placed snapshots keep rendering.
  Its `requestLogout()` drives the Log Out menu action: dirty cloud documents
  prompt Save / Discard / Cancel (save runs `promoteLocalDepsAndSave`; any
  failure aborts the logout), then the session ends and the cloud workspace is
  deliberately reset — server component tabs force-close, a server main is
  replaced by a blank draft (exiting a running simulation first), local
  documents stay. An **external** logout (expiry / another tab) touches nothing
  but the library.

### Dependencies, promotion & orphan recovery

How a document carries the custom components it uses, how a local component is
**promoted** to the cloud, how ids are re-mapped so references survive, and how a
lost master is recovered — the whole story, including the `dependencies[].id`
mapping rule, `snapshot.localId`, the promotion alias, and orphan restore — lives
in **[`dependencies-and-promotion.md`](dependencies-and-promotion.md)**. The
`PromotionService` methods (`promote*`, `uploadStoredProjectToServer`,
`saveDraftAsServer`, `localDependencies*`) and
`ComponentLibraryService.restoreOrphanToLibrary` are the primitives that document
sequences.

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

| Method                                         | Description                                                                                                                                                                                                                                    |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `register(project, metadata, trackDirty=true)` | Stores metadata; when `trackDirty`, subscribes to `project.actionManager.actionChange$` to auto-mark dirty. Shares register with `trackDirty:false`.                                                                                           |
| `getMetadata` / `getHandleById` / `remove`     | Lookup and teardown.                                                                                                                                                                                                                           |
| `markDirty` / `clearDirty` / `isDirty`         | Dirty flag (Angular signal).                                                                                                                                                                                                                   |
| `dirtyVersion`                                 | Monotonic counter used by the save paths to detect edits that land during a save.                                                                                                                                                              |
| `withDirtyGuard(project, fn)`                  | Runs an async save step (which must include the serialization) under the mid-save edit guard: snapshot `dirtyVersion` → await `fn` → clear the dirty flag only when no edit landed in flight. Every save path (both gateways) runs through it. |
| `updateHash`                                   | Updates the optimistic-concurrency hash after a successful server save.                                                                                                                                                                        |
| `updateId`                                     | Sets the store id after a project is first written (e.g. a fresh browser draft promoted into IndexedDB on save).                                                                                                                               |

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
- **`circuit-file-validator.spec`** — malformed-document fixtures (broken component
  entries, non-string wires, definitions with broken inner bodies) assert
  `InvalidFileError` — never a raw `TypeError` — plus the deliberate tolerances
  (absent sections, absent `source`).

`browser-project.store.spec` runs against the **real** IndexedDB (Karma uses a real
browser), clearing records between tests rather than deleting the DB (which would block on
open connections). `persistence.service.spec` swaps in the in-memory stores from
`src/testing/fake-browser-stores.ts` (`useValue`) so the orchestration — import persists,
save dispatches by source, browser load reads back — is tested deterministically without
touching IndexedDB.
