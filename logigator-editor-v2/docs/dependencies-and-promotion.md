# Custom-Component Dependencies & Promotion

The single reference for how a custom component travels through the editor: how a
document carries the customs it uses, how those references resolve on load, how a
local component is *promoted* to the cloud, how identities are re-mapped so
references survive, and every degenerate case — nested/recursive dependencies,
orphans, cross-device copies, unresolved snapshots — the system must handle.

This document owns the dependency/promotion story end to end. Adjacent docs cover
the pieces it builds on and only cross-reference here:

- [`custom-components.md`](custom-components.md) — the in-memory master/snapshot
  model, the registry, the rendering class, the editor-tab lifecycle, cycle
  prevention, and per-instance update.
- [`persistence.md`](persistence.md) — the file format, migration chain, browser
  stores, the legacy v0-over-HTTP server transport, and the `PersistenceService`
  method surface.
- [`ui.md`](ui.md) — the `SaveCoordinatorService` / `UploadCoordinatorService`
  dialogs and the settings-panel affordances.

---

## 1. The model in one picture

```
   LIBRARY (a master lives in exactly one)          A HOST DOCUMENT (project or component)
 ┌───────────────────────┐  ┌──────────────┐        ┌──────────────────────────────────────┐
 │  browser library       │  │ cloud library│        │  body: components + wires              │
 │  (IndexedDB)           │  │ (server)     │        │  definitions[]: a FROZEN SNAPSHOT of   │
 │                        │  │              │        │    every custom the body transitively  │
 │   master  ◄── id ──────┼──┼── master     │        │    places (self-contained)             │
 └────────┬──────────────┘  └──────┬───────┘        └───────────────┬──────────────────────┘
          │ snapshot()             │                                │ each placed custom instance
          ▼ (freeze current state) ▼                                ▼ wraps ONE snapshot
        ┌──────────────────────────────────┐              config.type = snapshot type id
        │ snapshot: frozen circuit + summary│  ◄───────────  (NOT the master's type id)
        │ + source{ id, version, origin }   │
        └──────────────────────────────────┘
```

- A **master** is the editable library entry. It lives in **one** library —
  `browser` (IndexedDB `components` store) or `server` (cloud `/api/component`) —
  and owns a persistent string **id** (browser store id or server uuid).
- A **snapshot** is a frozen copy of a master's circuit + summary, taken at place
  time, carrying `source` provenance (`{ id, version, origin }`) back to the
  master. It is immutable.
- A **placed instance** wraps a **snapshot**, never a master (`component.config.type`
  is the *snapshot's* session type id). **This is the load-bearing fact:** an
  instance renders and simulates purely from its snapshot, so a document is
  **self-contained** — it needs no library present to open. A master is required
  only to *edit* the component or to *update* an instance to a newer version.
- Every saved document embeds the frozen snapshot of every custom it transitively
  uses in `definitions[]` (native) / `dependencies[]` (server). Losing the master
  never loses the circuit.

> Full model, id spaces, invariants, and cycle prevention live in
> [`custom-components.md`](custom-components.md). The essentials repeated here are
> only what the dependency/promotion flows depend on.

---

## 2. Identity: ids, versions, origin, and the registry indexes

Three **id spaces** — never conflate them:

| Space | Type | Who owns it |
| --- | --- | --- |
| **Persistent id** | `string` (uuid) | a **master** (browser store id or server uuid). A snapshot carries it as `source.id` provenance but does not own it — many snapshots share one master id. Reverse `id → typeId` is **masters-only**. |
| **Session type id** | `number` ≥ `CUSTOM_TYPE_ID_BASE` (1000) | every master **and** every snapshot, allocated by the registry, unique per session. Written as `t` in the wire format. |
| **File-local type id** | `number` ≥ 1000 | a document-local id used only inside one serialized document; remapped to a session id on load. |

Two more axes on a definition:

- **`version`** (monotonic) — a master's current version; a snapshot's frozen
  version (the master state it copied). Comparing them is how "a newer version
  exists" (the *Update to latest* affordance) is detected. **Frozen version is
  never rewritten** by any transport.
- **`source` (origin)** — which library the master lives in: `'server'` |
  `'browser'`. On a snapshot definition this records the master's origin (see
  [§9](#9-orphans--restore)).

The **`CustomComponentRegistry`** ([`custom-components.md`](custom-components.md))
holds the session-global state the whole dependency system pivots on:

- `_idToMasterTypeId` — masters-only `id → typeId`.
- `_idAliases` — `oldId → newId` remap (promotion + restore); see [§6](#6-uuid-mapping--the-alias-table).
- `_dependencies` — `masterTypeId → its direct child master type ids`, for cycle
  detection.
- `_masterToSnapshotTypeId` — placement cache (one snapshot type per unchanged
  master), invalidated by any master mutation.
- `revision` signal — bumped on identity-changing mutations (promotion, restore,
  alias) so reactive readers (settings-panel chip, actions) re-resolve.

Key resolvers:

- `masterTypeIdForId(id)` — direct lookup, then **through the alias map**. Direct
  wins over alias.
- `resolveMaster(typeId)` — a master returns itself; a snapshot follows its
  `source.id` (through the alias) to its master. `undefined` ⇒ **orphan**.
- `currentIdForId(id)` — walks the alias chain to the current id (see §6).

---

## 3. The universal snapshot codec

**Files:** `persistence/snapshots.ts`, `persistence/serialized-circuit.ts`. One
codec feeds **every** transport (file, browser, server); each transport only
chooses a byte layout for the body.

### 3.1 Collect (save)

`collectSnapshots(project, registry)` walks every custom the project **transitively**
places — the snapshots in its body, then recursively the customs inside those
snapshots' circuits — and returns `{ definitions, sessionToLocal }`:

- **Transitive closure.** Depth-first from each placed component's type, following
  `def.circuit.components`. A nested custom that is never placed at top level is
  still embedded (it lives inside its parent's circuit).
- **File-local numbering.** Definitions are numbered from `CUSTOM_TYPE_ID_BASE` in
  first-encounter (depth-first, body order) order — deterministic and
  session-order-independent, so the same circuit always serializes byte-identically.
- **Reference rewrite.** Every nested custom reference inside a definition's body is
  rewritten from session id → file-local id, and `sessionToLocal` maps the document
  body the same way.
- **Provenance.** `source = { id: currentIdForId(def.id), version, origin }`:
  - `id` resolved **through the promotion alias** so a document saved after a
    dependency's upload references the dependency's *current* (cloud) id (§6).
  - `version` is the frozen version, kept verbatim.
  - `origin` is the master's **current** library (`resolveMaster(...).master.source`),
    falling back to the snapshot's own frozen kind when the master is already gone.
    So a promoted master round-trips as `'server'`.

### 3.2 Ingest (load)

`CustomComponentRegistry.ingestSnapshots(defs)` registers a document's embedded
snapshots and returns the `fileLocal → session` remap the caller applies to the
document body. **Two passes** so nested references resolve: pass 1 allocates a
session id per definition; pass 2 registers each, rewriting the type ids inside its
own circuit from file-local → session. The stored circuit therefore holds post-remap
**session** ids, so re-saving or re-opening resolves correctly.

- The ingested snapshot's `source` (kind) = `def.source?.origin ?? 'browser'` (the
  master's library origin; older documents that omit `origin` default to browser).
- It pre-populates the placement cache when an ingested snapshot's `source` matches a
  currently-loaded master at the same version, so palette placements after opening a
  project reuse the ingested type id instead of minting a duplicate on save.

### 3.3 Nesting & recursion

- **Nesting is unbounded.** A→B→C→… all embed self-contained: A's snapshot circuit
  references B's file-local id, B's references C's, etc. `collectSnapshots` emits one
  definition per distinct custom in the closure.
- **Recursion (cycles) is prevented at author time, not serialize time.** A master
  may not transitively contain itself. The registry maintains the live master
  dependency graph; `wouldCycle(host, placed)` gates both the palette filter and the
  placement session (see [`custom-components.md`](custom-components.md) → Cycle
  prevention). So `collectSnapshots`' DFS is always over a DAG and terminates; the
  `sessionToLocal` visited-set also guards against re-emitting a shared dependency
  (diamonds).

---

## 4. How a document carries its dependencies (per transport)

There are two serialization encodings across three targets.

### 4.1 Native file & browser store (v1, permanent)

`persistence/file/` — the native versioned format. A document is
`{ version, name, components, wires, definitions[] }`, where `definitions[]` is the
`SnapshotDefinition[]` from `collectSnapshots`, each carrying
`source: { id, version, origin }`. Browser-store records (`projects` and
`components`) store this exact JSON as their `content`. This is the crux of the
design: a file import is just "decode, then browser-save the re-encoded blob," and
the migration chain upgrades stored circuits on load for free.

### 4.2 Server API (legacy v0-over-HTTP, **temporary**)

`persistence/server/` — **deleted when the native-model API ships.** The server
transports the positional `ProjectElement[]` (file-format v0) plus a
`dependencies[]` array. Decode is permanent (folds into the `v0ToV1` migration);
encode (`server-circuit.codec.ts`) is throwaway.

Each `dependencies[]` entry is a `DependencyMapping`:

```
{ id: string,          // mapping to an OWNED server component, or '' (see below)
  model: number,       // the file-local type id — matches the body `t` and snapshot
  snapshot: {          // the additive frozen copy (R14)
    version, name, symbol, description, numInputs, numOutputs, labels,
    localId?,          // the browser-library id, when this is a local custom
    elements           // positional body of the snapshot's circuit
  } }
```

**The mapping-id rule (`serverDependencyId`).** `id` is only set when the
dependency resolves to a **registered server master the user owns**; everything
else — a local (browser) custom, an unregistered/foreign id — is sent as `''`.

- The backend validates a non-empty `id` with `getOwnedComponentOrThrow` and creates
  a **dependency row** (used for the server-side dependency graph: share cloning,
  etc.). An empty `id` creates **no row** — the dependency rides solely on its
  embedded `snapshot`.
- **Gotcha:** sending a *browser* id here was the "Component for mapping not found"
  bug. A browser id is not an owned server component, so it must be `''`. This is
  also why an unpromoted/unselected local dependency does not break a save.

**The snapshot blob round-trips whole.** `serializeStoredCircuit` stores each
mapping's `snapshot` verbatim in the circuit file, and `buildDependencyResponse`
echoes it back on read — so **any field inside `snapshot` survives a round-trip with
no backend storage changes** (this is why `localId` was cheap to add). The backend
`DependencySnapshot` DTO must still *declare* every field, because validation runs
`forbidNonWhitelisted: true` — an undeclared field is rejected, not ignored (see
[§11](#11-backend-contract--deployment)).

**`synthesizeMissingSnapshots`.** For an old-editor document whose dependency rows
carry no embedded snapshot, the backend backfills one from the live master — but
only for **leaf** masters (whose own circuit places no further custom), because a
hierarchical master's nested file-local ids would collide with the host document's.
Non-leaf reference-only deps stay unresolved and are dropped on load (§10).

### 4.3 Decode: resolving provenance

The `v0ToV1` migration's `decodeDependencies` revives each embedded `snapshot` into
a native `SnapshotDefinition`. Provenance resolves in priority order:

```
id     = mapping.id  ||  dependency.id  ||  snapshot.localId
origin = (mapping.id || dependency.id) ? 'server' : 'browser'
```

- `mapping.id` / `dependency.id` — an owned cloud component ⇒ **cloud origin**.
- `snapshot.localId` — a local custom that was never uploaded ⇒ **browser origin**.
- none ⇒ `source = undefined` (an anonymous local, or a legacy reference-only dep).

A reference-only dependency (no embedded `snapshot`) is skipped here; its body
elements then surface as unresolved customs and are dropped with a warning (§10).

---

## 5. The write/serialize decision, per dependency

For every custom in a document's closure, at save time:

```
                       ┌─────────────────────────────────────────────┐
                       │ dependency D (a placed custom's snapshot)     │
                       └───────────────────────┬─────────────────────┘
                                               │  id = currentIdForId(D.source.id)
                                               ▼
                          resolveMaster(D) → registered SERVER master?
                              │ yes                         │ no (browser / unresolvable)
                              ▼                             ▼
       ── NATIVE FILE / BROWSER ──────────    definitions[]: source { id, version, origin }
       definitions[]: source { id, version,      (origin 'browser'; id may be a lost id — kept
       origin } — id is the current id           for same-device re-link and orphan recovery)
       ─────────────────────────────────────
       ── SERVER (v0) ───────────────────────    ── SERVER (v0) ───────────────────────────────
       mapping.id  = id  (owned server)          mapping.id       = ''      (no dep row)
       snapshot.localId = (absent)               snapshot.localId = id      (browser re-link hint)
       → backend creates a dependency ROW        → backend stores snapshot only
```

The **snapshot circuit is always embedded**, in every branch. The only variable is
*whether a dependency link/id is recorded* and *which library it points at*.

---

## 6. UUID mapping — the alias table

A component's persistent id can change (promotion) or be re-established (restore).
The registry's **alias map** (`_idAliases: oldId → newId`) makes references survive
without rewriting every placed snapshot.

- `promoteMaster(typeId, newId, version)` (on upload) removes the old `id → typeId`
  entry, records `oldId → newId`, flips the master to `source:'server'` with the new
  id, and bumps `revision`.
- `masterTypeIdForId(id)` resolves **direct first, then through the alias** — so a
  snapshot that captured the pre-promotion id still finds the (now-cloud) master.
  Direct beats alias, so a real master reappearing under `oldId` wins over a stale
  alias.
- `currentIdForId(id)` walks the alias chain to the current id. **Serialization uses
  it** (§3.1) so a document written after a dependency's promotion references the new
  cloud id — not the captured browser id.

**Why the rewrite matters (device-local safety, not cosmetics).** The alias table
lives only in this browser. If a document that lands on the server kept a captured
*pre-promotion* browser id, every **other** device — which has no such alias — would
strand the reference. Writing the *current* id keeps it resolvable everywhere the
master actually exists.

**Persistence & startup.** The `oldId → newId` map is persisted in the
`componentIdMapStore` (IndexedDB) and hydrated at startup by
`preloadComponentIdAliases`, before `preloadBrowserMasters` / `preloadServerMasters`
register the libraries. `isPromotedId(oldId)` lets the browser preload skip a stale
local record left behind by a partially-failed promotion (so a promoted component is
not duplicated as both a local and a cloud master).

---

## 7. Promotion (browser → cloud)

Promotion **moves** a component or project from the browser to the cloud. It is one
pipeline for every entry shape, orchestrated by `UploadCoordinatorService`
(`ui/upload/`), with `PersistenceService` primitives underneath.

### 7.1 The five entry shapes (`UploadTarget`)

| Kind | Trigger | Target primitive |
| --- | --- | --- |
| `component` | a placed local master's *Upload to cloud* action | `promoteComponentToServer` |
| `project` | the open local project (title bar / File menu) | `promoteProjectToServer` |
| `stored-project` | a browser project by id (Open dialog list) | `uploadStoredProjectToServer` |
| `draft-to-server` | first save of a never-saved draft to the server | `saveDraftAsServer` |
| `save-server` | re-saving an already-cloud project that gained local customs | `saveProject` |

`SaveCoordinatorService` routes the two save shapes here: a first server save
(`draft-to-server`) and a re-save of a cloud project that embeds local customs
(`save-server`) both need the promotion treatment, because the backend rejects a
local dependency id. It only routes `save-server` when the project actually embeds
local customs; otherwise it saves directly.

### 7.2 The sequence

```
 requestUpload(target)
   │
   ├─ 1. ANALYZE   localDependencies* → local customs embedded, CHILDREN-BEFORE-PARENTS
   │
   ├─ 2. PROMPT    upload dialog: visibility + which resolvable deps to promote
   │               (all preselected). Skipped when visibility is preset AND no local
   │               deps (draft-to-server / save-server common case). Cancel ⇒ abort.
   │
   ├─ 3. UPLOAD DEPENDENCIES FIRST, in child→parent order:
   │       for each selected dep:  promoteComponentToServer(dep)
   │         → registry.promoteMaster records oldId→newId alias
   │         → because serialize resolves ids through the alias, the NEXT upload
   │           (and the target) references the already-promoted child by its cloud id
   │       first failure ⇒ STOP (nothing after it uploaded; retry re-analyzes)
   │
   └─ 4. UPLOAD TARGET   promote/save the project or component itself
```

**Children-before-parents ordering is a true topological (post-order DFS) sort**,
not a reversed collect order — a reversed pre-order mis-orders a *diamond* (a shared
grandchild landing after one of its parents). `_depsFromFileDefinitions` (record
sources) and `localDependenciesOfProject` (live registry) both post-order.

**`promoteComponentToServer` (the primitive).** Upload the circuit → server
create+save → `registry.promoteMaster` (flip source, new id, alias) → persist the
`oldId→newId` map → delete the browser record → re-point any open editor tab. It is
**silent** (no toast) — the coordinator owns the outcome toast, so the two layers
never double-toast. (`saveProject` is the exception: it self-toasts, so the
coordinator suppresses its toast for `save-server`.)

**Linking semantics.** The server model has no first-class linking; every entry
stays self-contained (a parent still embeds its own copy of a child). Promotion's
only "link" is keeping the id current via the alias, so the embedded copy is
*recognizably the same component*. A dependency the user does **not** select stays
local and rides along as an embedded copy — the dialog warns that such copies can no
longer be updated as components elsewhere.

---

## 8. Keeping the local-library link inside a cloud document (`localId`)

The **local-dependency-in-a-cloud-document** case. When a local custom is embedded
in a *server* project/component and is **not** promoted, its `mapping.id` must be
`''` (§4.2) — which would erase all trace of *which* local component it was. To
preserve editability on the author's own device, its browser-library id is carried
in `snapshot.localId`:

- Additive, optional field on the backend `DependencySnapshot` DTO; stored verbatim,
  echoed on read, **never resolved or ownership-checked** server-side.
- On decode, provenance resolves to `mapping.id || dependency.id || snapshot.localId`
  (§4.3), so on the **author's own device** the embedded custom re-links to the
  still-present local master and stays editable/updatable.
- On **any other device**, the id is unknown → it remains a plain embedded copy (an
  orphan for that device — §9).
- Promoting the component later switches it back to a real `mapping.id` and drops
  `localId`.

---

## 9. Orphans & restore

An **orphan** is a placed custom whose master resolves in **no** library
(`resolveMaster` is `undefined`). It is **not broken** — its circuit is embedded, so
it renders and simulates fine; only *editing* was a dead-end. The settings panel
marks it with the `embedded` source-indicator state.

How orphans arise:

| Scenario | Origin recorded |
| --- | --- |
| You deleted the cloud component your project depends on | `server` |
| You opened someone else's shared cloud project referencing *their* cloud component | `server` |
| A cloud project embedding *your* local custom (`localId`) opened on a **different** device | `browser` |
| You are **signed out**, so no cloud masters are loaded — every cloud dep looks lost | `server` |
| A file/document authored before `origin` existed | `undefined` → treated as `browser` |

### Restore (`restoreOrphanToLibrary`)

Rebuilds a **browser** master from the frozen snapshot's circuit at its frozen
version, so the component is editable again. Restore is **always browser** (no login
needed).

- **Re-linking** reuses the snapshot's own `source.id` as the new master's id, so
  every placed instance resolves to the restore with no further change. An anonymous
  snapshot (no id) mints a fresh id and `relinkSnapshotProvenance` re-points the
  snapshot.
- **Reusing the id is server-safe** — server ids are always server-minted (the
  client never dictates one), and a browser id only ever travels as an opaque
  `localId`. So no server collision is possible.

### The origin bit decides whether to *offer* restore

The edit action (`EditComponentAction`) chooses its mode from `resolveMaster` +
origin + login state:

```
   custom instance selected
        │
        ▼
   resolveMaster(type)?  ──yes──►  mode = EDIT        (open the master)
        │ no (orphan)
        ▼
   origin === 'server' AND signed out?
        │ yes ──►  mode = SIGN-IN  (disabled; "sign in" — the cloud master is
        │                            probably just unloaded; restoring locally
        │                            would DUPLICATE an owned cloud master)
        │ no  ──►  mode = RESTORE  (Restore & edit → restoreOrphanToLibrary → open)
```

### Genuinely unresolvable: an absent snapshot

Distinct from an orphan (which *has* its circuit): a body `t` whose **snapshot is
absent** — an old reference-only server document, or one an old client re-saved and
stripped of the additive `snapshot`. There is **no tombstone**: the element is
**skipped with a warning** (`CircuitFileService.deserialize`, the single load
chokepoint), counted, and surfaced as one aggregated toast. A custom-range `t`
resolves **only** through the snapshot remap, never falling through to its own value
(which could alias an unrelated session type).

---

## 10. The scenario matrix — everything that must be supported

Every combination of {what is being saved} × {where its dependencies live}. In all
rows the dependency's **circuit is embedded** (self-contained); the columns record
what *else* happens.

| # | Scenario | Mapping id (server) / `source.id` (native) | Dep row (server) | On reload / other device |
| --- | --- | --- | --- | --- |
| 1 | **Local dep in a local document** | native `source.id` = browser id | n/a | re-links to browser master; editable |
| 2 | **Local dep in a cloud document, promoted** | server id (its own new cloud id) | yes | re-links to cloud master everywhere |
| 3 | **Local dep in a cloud document, NOT promoted** | `id:''`, `snapshot.localId` = browser id | no | author's device re-links; other devices = embedded copy (orphan) |
| 4 | **Cloud dep in a local document** | native `source.id` = cloud id | n/a | re-links to cloud master if loaded; else orphan (origin `server`) |
| 5 | **Cloud dep in a cloud document** | server id | yes | re-links to cloud master everywhere |
| 6 | **Local dep inside a local dep** (nesting) | each custom = its own definition; parent circuit references child's file-local id | per §4.2 rules recursively | full closure embedded; each re-links per its own origin |
| 7 | **Cloud dep inside a local dep** | inner definition's `source.id` = cloud id | per §4.2 | inner re-links to cloud master if present |
| 8 | **Recursive dependency (A→…→A)** | — | — | **prevented at author time** (`wouldCycle`); never serialized |
| 9 | **Diamond (A→B, A→C, B→D, C→D)** | D emitted once; upload order D→B,C→A | — | shared D re-links once; topological upload order |
| 10 | **Orphan — deleted/foreign cloud master** | `source.id` = lost cloud id, origin `server` | none | renders; edit ⇒ restore (signed in) or sign-in (signed out) |
| 11 | **Orphan — local master on another device** | `source.id` = browser id (from `localId`), origin `browser` | none | renders; edit ⇒ restore |
| 12 | **Absent snapshot (reference-only)** | — | (row may exist) | element **dropped** with a counted warning |

Cross-cutting guarantees:

- **No dependency is ever silently lost** — every custom in the closure is embedded,
  so the worst case for a mis-classified/unpromoted dependency is "embedded copy,"
  never a broken circuit. The one hard-loss case (#12) is user-visible via a toast.
- **Promotion is a move, not a copy** — the browser record is deleted and the id is
  aliased, so a promoted component is not duplicated across libraries.
- **Restore is a copy into the browser library** — it does not touch the (gone)
  original; if the original cloud master ever reappears, the local restore may
  shadow it (deletable to un-shadow). This edge is accepted, not specially handled.

---

## 11. Backend contract & deployment

`logigator-backend` (`project.controller` / `component.controller`, DTOs in
`models/request/api/`):

- `ProjectMapping { id, model, snapshot }` — `id` is `''` **or** an owned server
  component uuid; a non-empty id is validated by `getOwnedComponentOrThrow` and
  creates a `ComponentDependency` / `ProjectDependency` row. `''` ⇒ no row.
- `DependencySnapshot` — the frozen embedded circuit + summary + optional `localId`.
  Stored verbatim in the circuit blob (`serializeStoredCircuit`) and echoed on read
  (`buildDependencyResponse`), so fields inside it round-trip without storage
  changes. `synthesizeMissingSnapshots` backfills leaf masters for old documents.
- **`forbidNonWhitelisted: true`** (global validation): any field the DTO does not
  declare is **rejected with 400**, not stripped.

> ⚠️ **Deployment order.** Because unknown fields are rejected, an editor that sends
> a new `DependencySnapshot`/`ProjectMapping` field (e.g. `localId`) will 400 unless
> the backend DTO change deploys **first, or together with** the editor. Every
> additive wire field here carries this coupling.

---

## 12. Invariants & non-obvious gotchas

- **Instances wrap snapshots, not masters.** Rendering/simulation never need a
  library; the master is only for edit/update. A "lost" component still works.
- **Frozen version is never rewritten.** Only `source.id`/`origin` are re-resolved
  at serialize time; the version stays as captured so "update available" stays
  correct.
- **Empty mapping id for local/foreign deps.** A browser (or non-owned) id in
  `mapping.id` = the "Component for mapping not found" 400. Send `''`.
- **`||` not `??` in decode provenance.** An unpromoted local dep sends an *empty
  string* mapping id, which must fall through to `localId`.
- **Topological (post-order) dependency order**, not reversed pre-order — diamonds
  break under a naive reverse.
- **Serialize resolves ids through the alias** (`currentIdForId`) — device-local
  alias tables must not leak captured ids into shared documents.
- **`origin` is the *current* master origin**, resolved live at collect time — a
  promoted master serializes as `server` even from an old snapshot.
- **Reusing an id on restore is server-safe** — server ids are server-minted; a
  browser id only travels as opaque `localId`.
- **Reappear-collision edge** — an undeleted cloud master vs a local restore/reuse
  of its id: `masterTypeIdForId` gives direct precedence over the alias, but the
  startup preload order decides which registers under the shared id. Rare
  (undelete), documented, self-recoverable (delete the local copy).
- **Import auto-adopts** (`_adoptSnapshots`) — opening a file registers its
  master-less customs into the browser library, so files rarely produce orphans.
- **Toasts: coordinator owns, primitives are silent** (except `saveProject`, which
  self-toasts, so `save-server` suppresses the coordinator toast).
- **The `SerializedComponent`/`SerializedWire` undo/redo snapshot is a *third*,
  separate in-memory shape** — not a persistence format, unrelated to
  `SnapshotDefinition`.
