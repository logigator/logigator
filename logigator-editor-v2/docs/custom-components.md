# Custom Components

A **custom component** (user-defined component / UDC) is a saved circuit that can
be given input/output ports and then placed inside other circuits as a single
black-box element, and opened in its own tab to edit.

It follows a **snapshot-with-provenance** model: a placed instance is a **frozen
snapshot** of a library component, copied into the host project at place time and
carrying provenance back to the library entry. Editing the library entry does
**not** change already-placed instances; bringing one up to date is an explicit,
per-instance action (see [Per-instance update](#per-instance-update)). This keeps
placed instances side-effect-free (no cross-document port/size churn) and every
saved document self-contained.

This doc covers the **in-memory core** (registry, definition model, the single
`CustomComponent` rendering class, summary derivation) and the **editor-side
orchestration** (create / open / close a component editor tab, keep a master's
summary current, update an instance). A placed custom and the customs it nests are
embedded as **frozen snapshots** in every saved document via the universal codec —
see [`persistence.md`](persistence.md) for the file/browser/server encoding, the
`collectSnapshots` / `ingestSnapshots` round-trip, and how an unresolved snapshot
is handled. Plug components (`INPUT`/`OUTPUT`) and the `ComponentConfig.create`
factory are documented in [`component-system.md`](component-system.md); the tab
bar, ports panel, and selection-driven settings in [`ui.md`](ui.md); the
custom-component actions in [`actions-system.md`](actions-system.md).

## Roles: master vs. snapshot

Every definition is one of two **kinds**:

- a **master** — the editable library/catalog entry. Mutable; it owns the
  persistent `id` and is what the user places _from_ and edits. Surfaced in the
  palette (category `USER`).
- a **snapshot** — a **frozen** copy embedded in a host project at place time,
  carrying `source` provenance (`id` + `version`) back to its master. A placed
  instance always wraps a snapshot. Category `HIDDEN` (resolvable by type id, but
  never listed in the palette — you place from masters, not snapshots).

## Three id spaces (do not conflate)

1. **Persistent id** (`string`) — the identity of a **library master**: a server
   uuid or a generated browser store id. A snapshot carries it as `source.id`
   provenance but does not _own_ it (many snapshots share one master id). So
   reverse `id → typeId` lookup is **masters-only**; snapshots are addressed by
   type id only.
2. **Type id** (`number`) — the value written as `t` in the wire format. Built-ins
   use the fixed `ComponentType` enum; each master **and each snapshot** gets a
   runtime-allocated id from `CUSTOM_TYPE_ID_BASE` (1000) upward. `typeId →
definition` is a clean function: one type id denotes exactly one immutable
   shape.
3. **Instance id** (`number`) — `Component._id`, per placed instance.

## Two invariants

- **A — Port count comes from the definition, never the element.** A custom
  instance's `numInputs`/`numOutputs`/`labels` come from its (snapshot) definition;
  the element's `i`/`o` are ignored on load. The only per-instance option is
  `direction`.
- **B — One session-global allocator; frozen snapshots don't share.** A type id
  denotes one immutable shape (a master being edited, or a frozen snapshot).
  Snapshots are never mutated, so there is no cross-Project propagation; two
  Projects that placed the same master hold independent snapshots with independent
  type ids. The registry/allocator are app-root singletons only so type ids never
  collide.

## Files

```
components/custom/
├── custom-component-definition.model.ts  # CustomComponentDefinition (master|snapshot) + summary patch
├── custom-component-registry.service.ts  # session-global registry (root singleton)
├── custom-component.config.ts            # buildCustomComponentConfig + CustomComponentOptions
├── custom-component.ts                   # the single black-box rendering class
└── actions/                              # inspector ComponentActions on a selected instance
    ├── edit-component.component-action.ts     # "Edit component" — open the master in a tab
    └── update-instance.component-action.ts    # "Update to latest" — re-snapshot a stale instance

custom-component/                         # editor-side orchestration (NOT rendering)
├── custom-component.service.ts           # create / open / close a component editor tab
├── definition-binding.ts                 # keeps a master's summary current while its editor is open
└── definition-derivation.ts              # deriveSummary(project): plugs -> { numInputs, numOutputs, labels }
```

## `CustomComponentRegistry`

Root-provided singleton; the single owner of custom-component definitions.

- Allocates stable type ids from `CUSTOM_TYPE_ID_BASE` upward — one per master and
  per snapshot.
- Holds a **masters-only** `id → typeId` index.
- For every definition (master _or_ snapshot) builds a `ComponentConfig` (via
  `buildCustomComponentConfig`) and registers it into `ComponentProviderService`,
  so every existing resolver (serializer, actions, palette) keeps working through
  the same `getComponent(t)` path.
- Emits `definitionChange$(typeId)` when a **master's** summary is edited (palette/
  editor refresh). Frozen snapshots never emit.
- Tracks the library dependency graph (`setDependencies` / `dependenciesOf` /
  transitive `dependentsOf`) for [cycle prevention](#cycle-prevention).

Key methods:

- `createMaster(meta, source)` → masterTypeId (mints/records the persistent id).
- `snapshot(masterTypeId)` → freezes the master's _current_ state into a new
  snapshot definition (with `source` provenance) and registers it; used at place
  time and by `UpdateInstanceAction`.
- `registerSnapshot(def)` → the lower-level primitive behind `snapshot`.
- `ingestSnapshots(defs)` → registers a document's embedded snapshots and returns
  the `fileLocalType → sessionType` remap (the universal load path — see
  [`persistence.md`](persistence.md)).
- `updateDefinition(masterTypeId, patch)` → mutates a **master** in place (no-op
  for a snapshot or unknown id) and fires `definitionChange$`. Does **not** bump
  `version` — that is a save-time stamp.
- `setMasterCircuit(masterTypeId, circuit)` / `setMasterVersion(masterTypeId,
version)` → replace a master's materialised circuit (a fresh deep copy, so
  earlier snapshots stay frozen) and adopt the save-returned version.
- `wouldCycle(hostMasterTypeId, placedMasterTypeId)` → the single cycle predicate
  (`placed === host || dependentsOf(host).has(placed)`), shared by the palette
  filter and the placement guard.
- `getDefinition(typeId)`, `masterTypeIdForId(id)`, `idForTypeId(typeId)`,
  `dependenciesOf` / `dependentsOf`, `definitionChange$(typeId)`.

> **Mutability rule.** The "one mutable object, mutated in place" rule applies
> **only to masters** (their `create()` closure + editor view hold the one object).
> Snapshots are immutable — created frozen and never edited; bringing a placed
> instance up to date replaces it with a _new_ snapshot, it does not mutate the old
> one. Configs are never unregistered — snapshot configs accumulate for the session
> so undo history that deserializes a custom `t` never dangles (they're tiny, and
> `GraphicsProviderService` caches the geometry by `[width, height, scale]`).

## `buildCustomComponentConfig`

Builds the one `ComponentConfig` backing a definition. Master configs are `USER`
(palette); snapshot configs are `HIDDEN`. `symbol`/`name`/`description` are getters
reading `def` — live for a master (palette follows edits), fixed for a frozen
snapshot. `create` closes over both `def` and the config object, so a built instance
exposes that exact config (hence `component.config.type === def.typeId`, which the
serializer relies on). A custom name/description is a user string cast to the
`TranslationKey` contract (built-ins stay type-safe). A master config also carries
the [inspector actions](actions-system.md) (`EditComponentAction`,
`UpdateInstanceComponentAction`) surfaced when an instance is selected.

## `CustomComponent` (rendering)

A single `Component<{ direction }>` subclass backs **every** custom type — the
`create` factory injects the matching definition. A placed instance always wraps a
**frozen snapshot**, so it renders from fixed values and does **not** subscribe to
`definitionChange$` (there is no propagation to react to).

- Constructor: `super(def.numInputs, def.numOutputs, direction, options)` (Inv. A),
  subscribes to `direction` changes, then redraws once.
- `draw()`: a chamfered `ComponentGraphics` box (fixed `bodyGridWidth = 3`) plus the
  centered `symbol` `Text`, registered as a rotation-counter container so it stays
  upright.
- `inputLabels` / `outputLabels`: `def.labels.slice(0, numInputs)` /
  `def.labels.slice(numInputs)`. Everything else (`connectionPoints`, `gridBounds`,
  port stubs, rotation, scale) is inherited from `Component`.

**Init-order note:** `draw()`, `inputLabels`, and `outputLabels` run once from the
base constructor _before_ the subclass `_def` field exists, so each guards for an
undefined `_def` (box-only / empty labels); the constructor then calls `redraw()`
once `_def` is set to paint the symbol and labels.

## `deriveSummary(project)`

The **only** place that knows the plug → port mapping. Scans `project.components`
for `InputComponent`/`OutputComponent` instances, orders each group by the plug's
`index` option (then instance id as a defensive tiebreak — never throws), and
returns `{ numInputs, numOutputs, labels }` with inputs first. Used by
`DefinitionBinding` to keep a master's summary current as its plugs are edited, and
by the snapshot/save path.

## Editing UX

### `CustomComponentService` — open / create / close

Editor-side orchestration, distinct from the rendering/registry layer. A component
editor is just a `Project` registered with `type: 'comp'` and an attached
`DefinitionBinding`; `ProjectService` already models multiple open Projects + an
active one, and the [tab bar](ui.md) switches between them.

- `createComponent(meta)` — mints a master and opens an **empty** editor tab. The
  user picks the store in the [new-component dialog](ui.md): a `'server'` master is
  created via the API (POST), a `'browser'` master is minted locally
  (`registry.createMaster`).
- `openComponentForEdit(masterId)` — re-focuses an already-open editor, or loads
  the master's circuit (the universal embedded-snapshot path) from its library —
  server (GET) or the browser `components` store — and opens a tab. A reused master
  shares its session type id, so the palette tile and editor stay one definition.
- `closeComponent(project)` — saves a dirty editor to its store before disposing
  it; a clean editor is disposed straight away. The master definition itself stays
  registered (it remains in the palette).
- `buildInstanceUpdate(instance)` — see [Per-instance update](#per-instance-update).

### `DefinitionBinding` — keep a master's summary current

One binding per open component editor. It subscribes to the editor Project's
`actionManager.actionChange$` (coalesced) — because **every** plug change flows
through `ActionManager` (`AddComponents`/`RemoveComponents` for add/remove,
`ChangeOptionAction` for labels, `ReorderPlugsAction` for order), a single listener
covers them all. On each change it recomputes `deriveSummary(project)`, calls
`registry.updateDefinition` (which refreshes the palette tile + editor view only),
and recomputes the master's direct library dependencies (`setDependencies`) from
its placed snapshots' `source.id` provenance. **Placed snapshots in other Projects
are untouched** — there is no propagation.

### Placing from the palette (snapshot-on-place)

The palette lists **masters**. When a placement is committed, the placement session
resolves the master config to a **fresh snapshot** of the master's current state
(`registry.snapshot`), so the placed instance is frozen at place time; placing the
same master again after editing it yields a new snapshot with the new shape.
Repeated placements within one Project share that Project's snapshot type.

## Per-instance update

The **only** path by which a placed instance's shape changes. A selected custom
instance whose `source.version` is behind its master's current `version` shows an
"Update to latest" inspector action (`UpdateInstanceComponentAction`). It calls
`CustomComponentService.buildInstanceUpdate`, which re-snapshots the master and
builds an `UpdateInstanceAction` — an `ActionContainer` that **replaces** the
instance with a fresh `CustomComponent` of the new snapshot type at the same
position/direction (remove + add), so it is undoable and dirties the project. The
add fires `portsChange$`, so the rebucket + integrator run — but in **this Project
only**, on demand. Returns `null` (no update offered) if the instance's master can
no longer be resolved; the instance keeps working regardless.

## Cycle prevention

A master must not (transitively) contain itself. Cycle detection runs on the live
library-master graph maintained by the registry (`DefinitionBinding` recomputes a
master's direct deps from its placed snapshots' provenance); `wouldCycle` is the
single predicate.

- **Palette filter** ([side bar](ui.md)): while editing master C, the user-component
  list excludes C and every master in `dependentsOf(C)` — placing any of those would
  close a cycle.
- **Placement guard** (defense in depth, [work-mode.md](work-mode.md)):
  `ComponentPlacementSession` decides up front whether committing would cycle
  (host master from the editor Project's metadata, placed master from
  `componentToPlace`) and refuses in `onEnd` with a toast if so — covering any path
  that bypasses the palette filter (stale `componentToPlace`, future paste).
  `UpdateInstanceAction` needs no guard (re-snapshotting an already-placed master
  adds no edge).

## Persistence & unresolved snapshots

Saving embeds a frozen snapshot of every custom the document transitively uses;
loading ingests them and renders from the embedded circuit with zero extra
fetches — see [`persistence.md`](persistence.md). Because a placed instance carries
its own circuit, it always resolves regardless of whether its library master still
exists; a deleted/renamed master only disables "Update to latest".

The one genuinely unresolvable case is a body `t` whose snapshot is **absent** — an
old reference-only server document, or one an old client re-saved and stripped of
the additive `snapshot` field. There is **no tombstone**: the element is **skipped
with a warning** (`CircuitFileService.deserialize`, the single load chokepoint),
counted, and surfaced as one aggregated toast so the loss is user-visible. A
custom-range `t` resolves **only** through the snapshot remap (never falling through
to its own value, which could alias an unrelated session type, since file-local and
session custom ids both count up from `CUSTOM_TYPE_ID_BASE`).
