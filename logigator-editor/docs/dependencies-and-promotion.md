# Custom-Component Dependencies & Promotion

The single reference for how a custom component travels through the editor: how a
document carries the customs it uses, how those references resolve on load, how a
local component is _promoted_ to the cloud, how identities are re-mapped so
references survive, and every degenerate case — nested/recursive dependencies,
orphans, cross-device copies, unresolved snapshots — the system must handle.

This document owns the dependency/promotion story end to end. Adjacent docs cover
the pieces it builds on and only cross-reference here:

- [`custom-components.md`](custom-components.md) — the in-memory master/snapshot
  model, the registry, the rendering class, the editor-tab lifecycle, cycle
  prevention, and per-instance update.
- [`persistence.md`](persistence.md) — the file format, migration chain, browser
  stores, the legacy v0-over-HTTP server transport, and the `PersistenceService` /
  `PromotionService` / `ComponentLibraryService` method surfaces.
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
  is the _snapshot's_ session type id). **This is the load-bearing fact:** an
  instance renders and simulates purely from its snapshot, so a document is
  **self-contained** — it needs no library present to open. A master is required
  only to _edit_ the component or to _update_ an instance to a newer version.
- Every saved document embeds the frozen snapshot of every custom it transitively
  uses in `definitions[]` (native) / `dependencies[]` (server). Losing the master
  never loses the circuit.

**The one-directional rule.** A **cloud** document may contain only **cloud**
components; a local document may use cloud components, but a browser-local custom
may not live inside a cloud document — it is promoted to the cloud first (enforced at
save, [§8](#8-one-directional-rule-no-local-in-cloud)). "Cloud-in-local" is allowed;
"local-in-cloud" is not.

> Full model, id spaces, invariants, and cycle prevention live in
> [`custom-components.md`](custom-components.md). The essentials repeated here are
> only what the dependency/promotion flows depend on.

---

## 2. Identity: ids, versions, origin, and the registry indexes

Three **id spaces** — never conflate them:

| Space                  | Type                                    | Who owns it                                                                                                                                                                                          |
| ---------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Persistent id**      | `string` (uuid)                         | a **master** (browser store id or server uuid). A snapshot carries it as `source.id` provenance but does not own it — many snapshots share one master id. Reverse `id → typeId` is **masters-only**. |
| **Session type id**    | `number` ≥ `CUSTOM_TYPE_ID_BASE` (1000) | every master **and** every snapshot, allocated by the registry, unique per session. Written as `t` in the wire format.                                                                               |
| **File-local type id** | `number` ≥ 1000                         | a document-local id used only inside one serialized document; remapped to a session id on load.                                                                                                      |

Two more axes on a definition:

- **`version`** (monotonic) — a master's current version; a snapshot's frozen
  version (the master state it copied). Comparing them is how "a newer version
  exists" (the _Update to latest_ affordance) is detected. **Frozen version is
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

**Files:** `persistence/snapshots.ts`, `serialized-circuit.ts` (core). One
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
    dependency's upload references the dependency's _current_ (cloud) id (§6).
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
- Under the [one-directional rule](#8-one-directional-rule-no-local-in-cloud) a cloud
  save has **no** local dependencies (they are promoted first), so in practice every
  entry gets a real id. The `''` path is a defensive fallback: a local custom that
  somehow reaches a cloud serialize (a bypass) is embedded with `id:''` and no
  re-link hint, so it loads as a recoverable **orphan** — never the "Component for
  mapping not found" crash (that only happens if a _browser id_ is sent, which
  `serverDependencyId` never does).

**The snapshot blob round-trips whole.** `serializeStoredCircuit` stores each
mapping's `snapshot` verbatim in the circuit file, and `buildDependencyResponse`
echoes it back on read — so **any field inside `snapshot` survives a round-trip with
no backend storage changes**. The backend `DependencySnapshot` DTO must still
_declare_ every field it accepts, because validation runs `forbidNonWhitelisted:
true` — an undeclared field is rejected, not ignored (see
[§11](#11-backend-contract--deployment)).

**`synthesizeMissingSnapshots`.** For an old-editor document whose dependency rows
carry no embedded snapshot, the backend backfills one from the live master — but
only for **leaf** masters (whose own circuit places no further custom), because a
hierarchical master's nested file-local ids would collide with the host document's.
Non-leaf reference-only deps stay unresolved and are dropped on load (§10).

### 4.3 Decode: resolving provenance

The `v0ToV1` migration's `decodeDependencies` revives each embedded `snapshot` into
a native `SnapshotDefinition`. Provenance:

```
id     = mapping.id || dependency.id      // the owned cloud component
origin = 'server'                          // a server dependency is always cloud
```

- A present mapping id ⇒ a cloud dependency ⇒ **cloud origin** (`'server'`).
- No id (`''`) ⇒ `source = undefined` — no provenance survives, so the instance
  loads as an embedded **orphan** (recoverable via restore). This covers a legacy
  reference-only dep and the bypass case above.

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
       definitions[]: source { id, version,      (a browser dependency in a local doc,
       origin } — id is the current id           allowed — origin 'browser'; a lost id is
       ─────────────────────────────────────     kept for same-device re-link / orphan recovery)
       ── SERVER (v0) ───────────────────────    ── SERVER (v0) — should not occur ────────────
       mapping.id = id  (owned server)           mapping.id = ''   (defensive: embedded, no dep
       → backend creates a dependency ROW        row; loads as an orphan). A local dep is
                                                 promoted BEFORE a cloud save (see §7/§8).
```

The **snapshot circuit is always embedded**, in every branch. The only variable is
_whether a dependency link/id is recorded_ and _which library it points at_. A local
dependency in a **cloud** document is not a normal state — it is promoted to the
cloud first ([§8](#8-one-directional-rule-no-local-in-cloud)).

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
_pre-promotion_ browser id, every **other** device — which has no such alias — would
strand the reference. Writing the _current_ id keeps it resolvable everywhere the
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
(`ui/upload/`), with `PromotionService` primitives underneath
(`persistence/promotion.service.ts`).

### 7.1 The five entry shapes (`UploadTarget`)

| Kind              | Trigger                                                      | Target primitive              |
| ----------------- | ------------------------------------------------------------ | ----------------------------- |
| `component`       | a placed local master's _Upload to cloud_ action             | `promoteComponentToServer`    |
| `project`         | the open local project (title bar / File menu)               | `promoteProjectToServer`      |
| `stored-project`  | a browser project by id (Open dialog list)                   | `uploadStoredProjectToServer` |
| `draft-to-server` | first save of a never-saved draft to the server              | `saveDraftAsServer`           |
| `save-server`     | re-saving an already-cloud project that gained local customs | `saveProject`                 |

`SaveCoordinatorService` routes the server-save shapes here: a first server save
(`draft-to-server`) and a re-save of a **server project or component editor** that
embeds local customs (`save-server`) both need the promotion treatment, because a
cloud document may only contain cloud components. It only routes `save-server` when
the document actually embeds local customs; otherwise it saves directly. The
tab-close flow ([§8.1](#81-the-tab-close-flow)) is a fourth trigger.

### 7.2 The sequence

```
 requestUpload(target)
   │
   ├─ 1. ANALYZE   localDependencies* → local customs embedded, CHILDREN-BEFORE-PARENTS
   │
   ├─ 2. PROMPT    upload dialog: visibility + an INFORMATIONAL list of the local
   │               components that will be published (promotion is mandatory — no
   │               opt-out). Skipped when visibility is preset AND no local deps
   │               (draft-to-server / save-server common case). Cancel ⇒ abort.
   │
   ├─ 3. PROMOTE EVERY RESOLVABLE DEPENDENCY, in child→parent order:
   │       for each dep:  promoteComponentToServer(dep)
   │         → registry.promoteMaster records oldId→newId alias
   │         → because serialize resolves ids through the alias, the NEXT upload
   │           (and the target) references the already-promoted child by its cloud id
   │       first failure ⇒ STOP (nothing after it uploaded; retry re-analyzes)
   │
   └─ 4. UPLOAD TARGET   promote/save the project or component itself
```

**Promotion is mandatory (one-directional rule, §8).** The dialog lists the local
components that will be published but offers no per-component opt-out — a cloud
document cannot keep a local dependency. A dependency that no longer resolves to a
library master (an already-embedded orphan) cannot be published; it stays an
embedded copy and the dialog warns about it.

**Children-before-parents ordering is a true topological (post-order DFS) sort**,
not a reversed collect order — a reversed pre-order mis-orders a _diamond_ (a shared
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
_recognizably the same component_.

---

## 8. One-directional rule: no local-in-cloud

**A cloud document may contain only cloud components.** A _local_ project may still
use _cloud_ components (cloud-in-local is fine — the natural "use a published thing
in private work" direction), but the reverse — a browser-local custom embedded in a
server project or component — is disallowed. Putting a local component into cloud
work publishes it (promotion, §7); there is no "keep it local inside the cloud
document" option.

This is enforced **at save**, not at placement: you edit freely, and any cloud save
of a document that embeds local customs promotes them first (mandatory). It gives a
one-sentence mental model ("cloud projects contain cloud components") and removes the
old confusing "half-editable embedded copy" state. Consequences:

- **No `localId`.** The earlier mechanism that let a local component live inside a
  cloud document (re-linkable only on the author's device) is gone — removed from the
  frontend (codec/decode/model) and from the backend `DependencySnapshot` DTO. Under
  `forbidNonWhitelisted`, dropping the DTO field means the editor that stops sending
  it must deploy **before** the backend removes it (see the deployment note).
- **A bypass degrades to an orphan, not a crash.** If a local dependency ever reaches
  a cloud serialize without promotion, it is embedded with `mapping.id:''` and no
  provenance → a restorable orphan on reload (§9). No data loss, no 400.
- **Files still hold cloud deps.** Because cloud-in-local is allowed, exporting a
  cloud project to a native file (which carries cloud dependency ids) and importing
  it round-trips fine.

### 8.1 The tab-close flow

Closing a component-editor tab funnels through `CustomComponentService.closeComponent`:

```
 close tab
   │ dirty?
   ├─ no  → dispose
   └─ yes → CloseTabDialogComponent (Save / Discard / Cancel; dismiss = Cancel)
              │
              ├─ Save    → uploadCoordinator.promoteLocalDepsAndSave(project)
              │             (a cloud comp with local deps promotes them first — NO
              │              second dialog; the close dialog already carried the
              │              promotion warning) → dispose on success, else keep open
              ├─ Discard → dispose without saving
              └─ Cancel  → keep the tab open (the safe default for a stray dismissal)
```

`promoteLocalDepsAndSave` is the no-dialog core: for a server document it promotes
every resolvable local dependency (children-first, at the document's own visibility),
then saves; for a browser document it just saves. The close dialog folds the
promotion warning inline so the user is never hit with two modals.

---

## 9. Orphans & restore

An **orphan** is a placed custom whose master resolves in **no** library
(`resolveMaster` is `undefined`). It is **not broken** — its circuit is embedded, so
it renders and simulates fine; only _editing_ was a dead-end. The settings panel
marks it with the `embedded` source-indicator state.

How orphans arise:

| Scenario                                                                                                                   | Origin recorded                    |
| -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| You deleted the cloud component your project depends on                                                                    | `server`                           |
| You opened someone else's shared cloud project referencing _their_ cloud component                                         | `server`                           |
| You are **signed out**, so no cloud masters are loaded — every cloud dep looks lost                                        | `server`                           |
| A local project's local dependency isn't in this browser's library (e.g. a hand-carried native file — import never adopts) | `browser`                          |
| A local dependency reached a cloud save via a bypass (no promotion) — degraded, `id:''`                                    | `undefined` → treated as `browser` |
| A file/document authored before `origin` existed                                                                           | `undefined` → treated as `browser` |

### Restore (`restoreOrphanToLibrary`)

Rebuilds a **browser** master from the frozen snapshot's circuit at its frozen
version, so the component is editable again. Restore is **always browser** (no login
needed).

- **Re-linking** reuses the snapshot's own `source.id` as the new master's id, so
  every placed instance resolves to the restore with no further change. An anonymous
  snapshot (no id) mints a fresh id and `relinkSnapshotProvenance` re-points the
  snapshot.
- **Reusing the id is server-safe** — server ids are always server-minted (the
  client never dictates one), and a browser id never travels to the server as an
  identity. So no server collision is possible.

### View inside (`viewSnapshot`) — the borrowed-document case

Restore only makes sense for a document the viewer owns. In a **share** the
embedded customs are somebody else's: no sign-in resolves them, and depositing a
stranger's component in the viewer's library is the wrong price for a look
inside. So a share offers **View inside** instead — `CustomComponentService.viewSnapshot`
instantiates the frozen circuit into a tab registered as a `source:'share'`
document, which inherits every read-only suppression already keyed off that flag
(save refused, no File-menu save entry, dirty tracking off, no wire-repair
offer). It writes nothing: no store record, no master, no provenance re-link —
the placed instance stays an orphan. Nested customs inside the tab are embedded
the same way and the tab is itself a share, so drilling further recurses. The way
to _keep_ a share's components is to clone the share, which copies the whole
document server-side.

### Host source + the origin bit decide which degraded mode is offered

The edit action (`EditComponentAction`) chooses its mode from `resolveMaster` +
the host document's source + origin + login state:

```
   custom instance selected
        │
        ▼
   resolveMaster(type)?  ──yes──►  mode = EDIT        (open the master)
        │ no (orphan)
        ▼
   host document is a share?
        │ yes ──►  mode = VIEW     (View inside → viewSnapshot → read-only tab;
        │                            the master is the publisher's, and nothing
        │                            is written to this viewer's library)
        │ no
        ▼
   origin === 'server' AND signed out?
        │ yes ──►  mode = SIGN-IN  (disabled; "sign in" — the cloud master is
        │                            probably just unloaded; restoring locally
        │                            would DUPLICATE an owned cloud master)
        │ no  ──►  mode = RESTORE  (Restore & edit → restoreOrphanToLibrary → open)
```

### Genuinely unresolvable: an absent snapshot

Distinct from an orphan (which _has_ its circuit): a body `t` whose **snapshot is
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
what _else_ happens.

| #   | Scenario                                               | Mapping id (server) / `source.id` (native)                                         | Dep row (server)     | On reload / other device                                      |
| --- | ------------------------------------------------------ | ---------------------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------- |
| 1   | **Local dep in a local document**                      | native `source.id` = browser id                                                    | n/a                  | re-links to browser master; editable                          |
| 2   | **Local dep in a cloud document**                      | **not allowed** — promoted to the cloud at save (§8), becoming a cloud dep (row 5) | —                    | after save it is a cloud dependency everywhere                |
| 3   | **Local dep reaches a cloud save unpromoted** (bypass) | `id:''`, no provenance                                                             | no                   | loads as a restorable **orphan** (no crash)                   |
| 4   | **Cloud dep in a local document**                      | native `source.id` = cloud id, origin `server`                                     | n/a                  | re-links to cloud master if loaded; else orphan               |
| 5   | **Cloud dep in a cloud document**                      | server id                                                                          | yes                  | re-links to cloud master everywhere                           |
| 6   | **Local dep inside a local dep** (nesting)             | each custom = its own definition; parent circuit references child's file-local id  | per §4.2 recursively | full closure embedded; each re-links per its own origin       |
| 7   | **Cloud dep inside a local dep**                       | inner definition's `source.id` = cloud id                                          | per §4.2             | inner re-links to cloud master if present                     |
| 8   | **Recursive dependency (A→…→A)**                       | —                                                                                  | —                    | **prevented at author time** (`wouldCycle`); never serialized |
| 9   | **Diamond (A→B, A→C, B→D, C→D)**                       | D emitted once; promote order D→B,C→A                                              | —                    | shared D promotes/links once; topological order               |
| 10  | **Orphan — deleted/foreign cloud master**              | `source.id` = lost cloud id, origin `server`                                       | none                 | renders; edit ⇒ restore (signed in) or sign-in (signed out)   |
| 11  | **Orphan — local master missing on this device**       | `source.id` = browser id, origin `browser`                                         | n/a                  | renders; edit ⇒ restore                                       |
| 12  | **Absent snapshot (reference-only)**                   | —                                                                                  | (row may exist)      | element **dropped** with a counted warning                    |

Cross-cutting guarantees:

- **A cloud document only ever contains cloud components** (§8) — a local dependency
  is promoted before a cloud save, or (bypass) degrades to a restorable orphan.
- **No dependency is ever silently lost** — every custom in the closure is embedded,
  so the worst case is "embedded copy / orphan," never a broken circuit. The one
  hard-loss case (#12) is user-visible via a toast.
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
- `DependencySnapshot` — the frozen embedded circuit + summary. Stored verbatim in
  the circuit blob (`serializeStoredCircuit`) and echoed on read
  (`buildDependencyResponse`), so fields inside it round-trip without storage
  changes. `synthesizeMissingSnapshots` backfills leaf masters for old documents.
- **`forbidNonWhitelisted: true`** (global validation): any field the DTO does not
  declare is **rejected with 400**, not stripped.

> ⚠️ **Deployment order (both directions).** Because unknown fields are rejected:
> _adding_ a wire field means the backend DTO must deploy **first / together with**
> the editor; _removing_ one (as `localId` was) means the editor that stops sending
> it must deploy **before** the backend drops the field, or an in-flight save from an
> old editor 400s. An old document that still carries `localId` inside a stored
> snapshot blob is unaffected — the blob is echoed verbatim on read and the field is
> simply ignored, never re-validated against the DTO.

---

## 12. Invariants & non-obvious gotchas

- **Instances wrap snapshots, not masters.** Rendering/simulation never need a
  library; the master is only for edit/update. A "lost" component still works.
- **Frozen version is never rewritten.** Only `source.id`/`origin` are re-resolved
  at serialize time; the version stays as captured so "update available" stays
  correct.
- **A cloud document may only contain cloud components** (§8). Local deps are
  promoted at save; enforced across _every_ cloud-save path (project save, first
  server save, component-editor save, tab-close save), since a bypass now degrades
  to an orphan instead of the old graceful `localId` re-link.
- **Empty mapping id for local/foreign deps.** A browser (or non-owned) id in
  `mapping.id` = the "Component for mapping not found" 400. Send `''`. `serverDependencyId`
  never sends a browser id, so a bypass orphans rather than crashes.
- **Topological (post-order) dependency order**, not reversed pre-order — diamonds
  break under a naive reverse.
- **Serialize resolves ids through the alias** (`currentIdForId`) — device-local
  alias tables must not leak captured ids into shared documents.
- **`origin` is the _current_ master origin**, resolved live at collect time — a
  promoted master serializes as `server` even from an old snapshot.
- **Reusing an id on restore is server-safe** — server ids are server-minted; a
  browser id never travels to the server as an identity.
- **Reappear-collision edge** — an undeleted cloud master vs a local restore/reuse
  of its id: `masterTypeIdForId` gives direct precedence over the alias, but the
  startup preload order decides which registers under the shared id. Rare
  (undelete), documented, self-recoverable (delete the local copy).
- **Import never adopts.** Opening a file registers nothing into the library: each
  embedded custom re-links through its provenance id to a **local** or **cloud**
  master when one exists and otherwise stays an **embedded** (orphan) snapshot,
  recoverable via restore.
- **Toasts: coordinator owns, primitives are silent** (except `saveProject`, which
  self-toasts, so `save-server` suppresses the coordinator toast).
- **The `SerializedComponent`/`SerializedWire` undo/redo snapshot is a _third_,
  separate in-memory shape** — not a persistence format, unrelated to
  `SnapshotDefinition`.
