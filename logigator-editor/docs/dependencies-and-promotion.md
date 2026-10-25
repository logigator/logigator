# Custom-Component Dependencies & Promotion

How a document carries the customs it uses, how those references resolve on
load, how a local component is _promoted_ to the cloud, how identities are
re-mapped so references survive, and the degenerate cases.

Adjacent docs: [`custom-components.md`](custom-components.md) (master/snapshot
model, registry, editor tabs, cycle prevention),
[`persistence.md`](persistence.md) (format, migration chain, stores,
transports), [`ui.md`](ui.md) (the save/upload dialogs).

---

## 1. The model

A **master** is the editable library entry. It lives in exactly **one** library
— `browser` (IndexedDB `components` store) or `server` (cloud API) — and owns a
persistent string **id**. A **snapshot** is a frozen, immutable copy of a
master's circuit + summary taken at place time, carrying `source` provenance (`{
id, version, origin }`).

A **placed instance wraps a snapshot, never a master** (`component.config.type`
is the _snapshot's_ session type id). This is the load-bearing fact: an instance
renders and simulates purely from its snapshot, so a document is
**self-contained** and needs no library to open — a master is needed only to
_edit_ the component or _update_ an instance. Every saved document embeds the
snapshot of every custom it **transitively** uses in `definitions[]`, so losing
the master never loses the circuit.

**The one-directional rule:** a cloud document may contain only cloud
components. Cloud-in-local is fine; local-in-cloud is not — a local custom is
promoted first, enforced at save
([§8](#8-one-directional-rule-no-local-in-cloud)).

---

## 2. Identity: ids, versions, origin, registry indexes

Three **id spaces** — never conflate them:

| Space              | Type                                    | Who owns it                                                                                                              |
| ------------------ | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Persistent id      | `string` uuid                           | a **master**. A snapshot carries it as `source.id` provenance but does not own it, so the reverse index is masters-only. |
| Session type id    | `number` ≥ 1000 (`CUSTOM_TYPE_ID_BASE`) | every master **and** every snapshot, registry-allocated, unique per session. Written as `t`.                             |
| File-local type id | `number` ≥ 1000                         | valid only inside one serialized document; remapped to a session id on load.                                             |

**`version`** (monotonic) is a master's current version, or on a snapshot the
master state it froze — comparing them is how "a newer version exists" (the
_Update to latest_ affordance) is detected, and **a frozen version is never
rewritten** by any transport. **`origin`** is the library the master lives in.

`CustomComponentRegistry` owns the session-global state: `_idToMasterTypeId`
(masters-only `id → typeId`), `_idAliases` (§6), `_dependencies` (master →
direct child masters, for cycle detection), `_masterToSnapshotTypeId` (placement
cache, invalidated by any master mutation), and a `revision` signal bumped on
identity-changing mutations so reactive readers re-resolve.
`resolveMaster(typeId)` returns a master as itself and follows a snapshot's
`source.id` to its master; `undefined` ⇒ **orphan**.

---

## 3. The universal snapshot codec

`persistence/snapshots.ts` plus core's `serialized-circuit.ts`. One codec feeds
**every** transport; each transport only chooses a byte layout for the body.

### 3.1 Collect (save)

`collectSnapshots(project, registry)` walks the transitive closure of placed
customs — the snapshots in the body, then recursively the customs inside those
snapshots' circuits — and returns `{ definitions, sessionToLocal }`, rewriting
nested references session → file-local. Numbering is first-encounter
(depth-first, body) order from `CUSTOM_TYPE_ID_BASE`, so it is
session-order-independent and the same circuit always serializes
byte-identically.

Provenance is `{ id: currentIdForId(def.id), version, origin }`. The `version`
is kept verbatim but defaults to 1: an id with no version emits no provenance at
all and re-orphans on reload. `origin` is read live from `resolveMaster`, so a
promoted master round-trips as `'server'`, falling back to the snapshot's frozen
kind when the master is gone.

### 3.2 Ingest (load)

`ingestSnapshots(defs)` registers the embedded snapshots and returns the
`fileLocal → session` remap the caller applies to the body. **Two passes** so
nested references resolve: pass 1 allocates a session id per definition, pass 2
registers each while rewriting the type ids inside its own circuit. The stored
circuit therefore holds post-remap **session** ids, so re-saving or re-opening
resolves correctly. Origin defaults to `'browser'` for older documents that omit
it. Ingest also pre-populates the placement cache when a snapshot matches a
loaded master at the same version, so palette placements after opening a project
reuse the ingested type id instead of minting a duplicate on save.

### 3.3 Nesting & recursion

Nesting is unbounded and self-contained: A→B→C each get one definition, A's
circuit referencing B's file-local id and so on. **Cycles are prevented at
author time, not serialize time** — `wouldCycle(host, placed)` gates the palette
filter and the placement session, so the DFS is always over a DAG; its visited
set also keeps a shared dependency (a diamond) from being emitted twice.

---

## 4. How a document carries its dependencies

One serialization across all targets — the native versioned document (`{
version, name, components, wires, definitions[] }`). Browser-store records hold
that exact JSON as their `content` and the cloud API transports it unchanged, so
a file import is just "decode, then browser-save the re-encoded blob" and there
is no second dependency encoding anywhere. What differs between transports is
only what the receiver _derives_ (§11).

### 4.1 Legacy decode

A native document needs no provenance reconstruction; `fromPersistedDefinition`
reads `source` back verbatim. The `v0ToV1` migration's `decodeDependencies`
handles the two legacy shapes — an old-editor file's `components[]` sub-circuit
definitions, and the `dependencies[]` rows the Phase 6 database migration
attaches to a legacy blob (a legacy row's customs are relations, not part of the
blob). There a present mapping id means a cloud dependency (`origin: 'server'`);
no id means `source = undefined`, so the instance loads as an embedded
**orphan**. A reference-only dependency (no embedded `snapshot`) is skipped, and
its body elements surface as unresolved customs dropped with a warning
([§9](#9-orphans--restore)).

---

## 5. The write decision, per dependency

**The snapshot circuit is always embedded, in every branch.** The only variables
are whether a provenance id is recorded and which library it names.

---

## 6. UUID mapping — the alias table

A component's persistent id changes on promotion. The registry's **alias map**
(`_idAliases: oldId → newId`) makes references survive without rewriting every
placed snapshot. `promoteMaster(typeId, newId, version)` drops the old `id →
typeId` entry, records the alias, flips the master to `source: 'server'` with
the new id, and bumps `revision`.

**Resolution always runs through the alias chain first** —
`masterTypeIdForId(id)` is `_idToMasterTypeId.get(currentIdForId(id))` — so a
snapshot holding a pre-promotion id finds the now-cloud master, and a promoted
old id can never resolve to a second master registered under it.

**Serialization writes `currentIdForId`** (§3.1), which is device-local safety
rather than cosmetics: the alias table lives only in this browser, so a document
landing on the server with a captured _pre-promotion_ id would strand the
reference on every other device.

**Startup ordering.** The map is persisted in `componentIdMapStore` and hydrated
by `preloadComponentIdAliases` **before** `preloadBrowserMasters` /
`preloadServerMasters` register the libraries. `isPromotedId(oldId)` lets the
browser preload skip a stale local record left by a partially-failed promotion,
so a promoted component is not duplicated as both a local and a cloud master.

---

## 7. Promotion (browser → cloud)

Promotion **moves** a component or project from the browser to the cloud — one
pipeline for every entry shape, orchestrated by `UploadCoordinatorService`
(`ui/upload/`) over `PromotionService` primitives.

### 7.1 The five entry shapes (`UploadTarget`)

| Kind              | Trigger                                             | Target primitive              |
| ----------------- | --------------------------------------------------- | ----------------------------- |
| `component`       | a local master's _Upload to cloud_ action           | `promoteComponentToServer`    |
| `project`         | the open local project (title bar / File menu)      | `promoteProjectToServer`      |
| `stored-project`  | a browser project by id (Open dialog list)          | `uploadStoredProjectToServer` |
| `draft-to-server` | first save of a never-saved draft to the server     | `saveDraftAsServer`           |
| `save-server`     | re-saving a cloud project that gained local customs | `saveProject`                 |

`SaveCoordinatorService` routes `save-server` here only when the document
actually embeds local customs; otherwise it saves directly. Tab close
([§8.1](#81-the-tab-close-flow)) is a fourth trigger.

### 7.2 The sequence

Analyze the transitively embedded local customs → prompt → promote every
**resolvable** dependency child-before-parent → upload the target itself.

- The **prompt** collects visibility and lists the local components that will be
  published; promotion is mandatory, so there is no per-component opt-out. It is
  skipped when visibility is already preset **and** nothing resolvable is left
  to publish, so an orphan-only document skips too.
- Each promotion records an `oldId → newId` alias, and because serialization
  resolves through aliases, every later upload references the already-promoted
  child by its cloud id. The **first failure stops the sequence**; nothing after
  it uploaded, so a retry re-analyzes cleanly with promoted entries dropping
  out.
- **Child-before-parent is a true topological (post-order DFS) sort**, not a
  reversed collect order — reversing a pre-order mis-orders a _diamond_, landing
  a shared grandchild after one of its parents. `_depsFromFileDefinitions`
  (stored records) and `localDependenciesOfProject` (live registry) both
  post-order.

`promoteComponentToServer` uploads the circuit, then `promoteMaster` → persist
the alias → delete the browser record → re-point any open editor tab. The server
round-trip runs first because it is the only fail-able, irreversible step: until
it returns nothing local has changed and a retry is clean. The local writes
after it are best-effort — the upload already committed, so surfacing their
failure would be a lie, and `isPromotedId` self-heals the leftover on reload.

**Linking semantics.** The server model has no first-class linking; every entry
stays self-contained, a parent embedding its own copy of a child. Promotion's
only "link" is keeping the id current via the alias, so the embedded copy is
_recognizably the same component_.

---

## 8. One-directional rule: no local-in-cloud

**A cloud document may contain only cloud components.** A local project may use
cloud components — the natural "use a published thing in private work" direction
— but a browser-local custom may not live inside a server project or component;
putting one into cloud work publishes it (§7).

Enforcement is **at save, not at placement**: you edit freely, and any cloud
save of a document embedding local customs promotes them first. A bypass
degrades to an orphan rather than crashing — an unpromoted local dependency
still travels as a definition, but its browser origin yields no server edge, so
it reloads as a restorable orphan (§9). Because cloud-in-local is allowed,
exporting a cloud project to a native file and re-importing it round-trips.

### 8.1 The tab-close flow

Closing a dirty component-editor tab (`CustomComponentService.closeComponent`)
prompts Save / Discard / Cancel via `CloseTabDialogComponent`; a dismissal is
Cancel (the safe default), and Save keeps the tab open if the save fails. Save
runs `uploadCoordinator.promoteLocalDepsAndSave(project)` — the no-dialog core,
which promotes a server document's resolvable local dependencies at the
document's own visibility and then saves. The close dialog folds the promotion
warning inline so the user never meets two modals.

---

## 9. Orphans & restore

An **orphan** is a placed custom whose master resolves in **no** library. It is
**not broken** — its circuit is embedded, so it renders and simulates fine; only
_editing_ dead-ends, and the settings panel marks it `embedded`. Orphans arise
from a deleted cloud master, someone else's shared project referencing _their_
cloud component, being **signed out** (no cloud masters loaded, so every cloud
dep looks lost), a local dep absent from this browser's library (a hand-carried
file — import never adopts), or an unpromoted local dep that reached a cloud
save. The first three record `origin: 'server'`; the rest `'browser'`, as does
any document predating `origin`.

**Restore** (`restoreOrphanToLibrary`) rebuilds a **browser** master from the
frozen snapshot's circuit at its frozen version — always browser, no login
needed. **Id reuse is origin-gated:** the new master reuses the snapshot's own
`source.id` only when that id is **browser**-origin, in which case every placed
instance re-links with no further work. An anonymous snapshot (no id) or a
**cloud**-origin one mints a fresh id and `relinkSnapshotProvenance` re-points
the snapshot at it — reusing a cloud uuid in the browser store would collide
with the real cloud entry once it reloads. The relink stamps a `version` too,
since serialization needs both id and version to emit resolvable provenance and
a no-provenance orphan has neither.

**View inside** (`viewSnapshot`) is the borrowed-document alternative. In a
**share** the embedded customs are somebody else's: no sign-in resolves them,
and depositing a stranger's component in the viewer's library is the wrong price
for a look inside. So the frozen circuit opens in a tab registered as a `source:
'share'` document, inheriting every read-only suppression keyed off that flag.
It writes nothing — no store record, no master, no relink — so the instance
stays an orphan, and nested customs recurse the same way. Keeping a share's
components means cloning the share.

`EditComponentAction` picks the mode from `resolveMaster`, the host document's
source, the snapshot's origin, and login state: a resolvable master is **Edit**;
an orphan in a share is **View inside**; an orphan whose origin is `'server'`
while signed out is a disabled **Sign in to edit** (the master is probably just
unloaded, and restoring would duplicate an owned cloud master); anything else is
**Restore & edit**.

### Genuinely unresolvable: an absent snapshot

Distinct from an orphan (which _has_ its circuit): a body `t` whose **snapshot
is absent** — an old reference-only server document, or one an old client
re-saved and stripped of the additive `snapshot`. There is **no tombstone**: the
element is **skipped with a warning** at the single load chokepoint
(`CircuitFileService.deserialize`), counted, and surfaced as one aggregated
toast. A custom-range `t` resolves **only** through the snapshot remap, never
falling through to its own value (which could alias an unrelated session type).

---

## 10. The scenario matrix

Every combination of {what is saved} × {where its dependencies live}. In all
rows the dependency's **circuit is embedded**; the columns record what _else_
happens.

| #   | Scenario                                     | `source.id` / origin                                         | Server dep row  | On reload / other device                            |
| --- | -------------------------------------------- | ------------------------------------------------------------ | --------------- | --------------------------------------------------- |
| 1   | Local dep in a local document                | browser id, `browser`                                        | n/a             | re-links to browser master; editable                |
| 2   | Local dep reaching a cloud save unpromoted   | browser id, `browser`                                        | no              | restorable **orphan** (no crash)                    |
| 3   | Cloud dep in a local document                | cloud id, `server`                                           | n/a             | re-links to the cloud master if loaded; else orphan |
| 4   | Cloud dep in a cloud document                | cloud id, `server`                                           | yes             | re-links everywhere                                 |
| 5   | Nesting (dep inside a dep)                   | one definition each; parent references child's file-local id | recursively     | full closure embedded; each re-links per its origin |
| 6   | Diamond (A→B, A→C, B→D, C→D)                 | D emitted once                                               | one edge        | promote order D → B,C → A                           |
| 7   | Orphan — deleted or foreign cloud master     | lost cloud id, `server`                                      | none            | renders; edit ⇒ restore (signed in) or sign-in      |
| 8   | Orphan — local master missing on this device | browser id, `browser`                                        | n/a             | renders; edit ⇒ restore                             |
| 9   | Absent snapshot (reference-only)             | —                                                            | (row may exist) | element **dropped** with a counted warning          |

Two combinations have no row: a local dep in a cloud document is promoted at
save (§8) and becomes row 4, and a recursive dependency (A→…→A) is prevented at
author time by `wouldCycle` and never serialized.

---

## 11. Server contract & deployment

`logigator-api` (`documents/`) takes a document and **derives everything else
from it**:

- **A write carries `{ document, version }` and nothing about dependencies.**
  `parseCircuitDocument` reads `definitions[].source`, keeps the `origin:
'server'` entries and writes one dependency edge per distinct master — the
  graph share-cloning walks. With no client-asserted list there is no field to
  get wrong. A snapshot with **no `source` is not an error** but a legitimate
  self-contained copy, and an **edge whose master no longer exists is dropped,
  not fatal**: the cascade makes "snapshot, no edge" the steady state after a
  delete, and failing the save would let somebody else's deletion break a
  circuit that does not need them.
- **A document embedding two snapshots of one master is refused** in strict mode
  (lenient keeps the first): its instances would render from two frozen copies
  of one component, and an edge table keyed by (dependent, dependency) has one
  row to give it either way.
- **A read answers `dependencies[]` describing each master as it stands now** —
  that `version` against the embedded snapshot's is the whole "an update is
  available" signal, since the document already embeds everything needed to
  render. A deleted master is absent and its embedded snapshot keeps working.
- **Unknown fields are tolerated.** Response schemas in `@logigator/contract`
  are `.loose()`, and an unknown document field fails the format validator
  rather than a DTO whitelist.

> **Deployment order.** A format bump couples the two sides: the API normalizes
> every write to the newest version it knows and rejects a document claiming a
> newer one with `unsupported_format_version`. The server deploys first, and a
> bulk re-normalization job follows.

---

## 12. Invariants & gotchas

- **Import never adopts.** Opening a file registers nothing into the library:
  each embedded custom re-links through its provenance id when a master exists,
  and otherwise stays an embedded orphan.
- **Toasts: the coordinator owns them, primitives are silent** (except
  `saveProject`, which self-toasts, so `save-server` suppresses the
  coordinator's).
- **`SerializedComponent`/`SerializedWire` are a _third_, separate in-memory
  shape** for undo/redo — not a persistence format, unrelated to
  `SnapshotDefinition`.
