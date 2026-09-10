# Custom Components

A **custom component** (user-defined component / UDC) is a saved circuit given
input/output ports, placeable inside other circuits as a single black-box
element and openable in its own tab to edit.

It follows a **snapshot-with-provenance** model: a placed instance is a **frozen
snapshot** of a library component, copied into the host project at place time
and carrying provenance back to the library entry. Editing the library entry
does not change already-placed instances — bringing one up to date is an
explicit action (see [Per-instance update](#per-instance-update)) — which keeps
placed instances free of cross-document port/size churn and every saved document
self-contained. Encoding lives in [`persistence.md`](persistence.md), promotion
and orphans in [`dependencies-and-promotion.md`](dependencies-and-promotion.md),
the live watch in [`inspection.md`](inspection.md).

## Roles: master vs. snapshot

- A **master** is the editable library entry. Mutable, owns the persistent `id`,
  and is what the user places _from_ and edits. Palette category `USER`.
- A **snapshot** is a frozen copy embedded in a host project at place time,
  carrying `source` provenance (`id` + `version`) back to its master. A placed
  instance always wraps one. Category `HIDDEN` — resolvable by type id, never
  listed in the palette.

## Three id spaces (do not conflate)

1. **Persistent id** (`string`) — a **master's** identity: a server uuid or a
   generated browser store id. A snapshot carries it as `source.id` but does not
   own it (many snapshots share one), so reverse `id → typeId` lookup is
   masters-only.
2. **Type id** (`number`) — the value written as `t` in the wire format.
   Built-ins use the fixed `ComponentType` enum; masters and snapshots get a
   runtime id from `CUSTOM_TYPE_ID_BASE` (1000) upward. One type id denotes
   exactly one immutable shape.
3. **Instance id** (`number`) — `Component._id`, per placed instance.

## Two invariants

- **A — Port count comes from the definition, never the element.** An
  instance's `numInputs`/`numOutputs`/`labels` come from its snapshot
  definition; the element's `i`/`o` are ignored on load. An instance carries no
  options at all — its only other per-instance state is `direction`.
- **B — Snapshots are immutable, so nothing propagates.** Only masters are
  mutated in place; updating an instance replaces it with a new snapshot. The
  registry caches one snapshot per unchanged master, so repeated placements
  share a type id and produce one definition in the save file, and any master
  edit invalidates the cache. Registry and allocator are app-root singletons so
  type ids never collide.

## Files

`CustomComponentDefinition` (and its details/summary-patch shapes) travel in
documents, so they live in `@logigator/core`.

```
components/custom/                        # registry + rendering
├── custom-component-registry.service.ts  # session-global registry (root singleton)
├── custom-component.config.ts            # buildCustomComponentConfig
├── custom-component.ts                   # the black-box rendering class
├── placement-cycle.ts                    # wouldCyclePlacement, the shared guard
├── sub-circuit-watch.ts                  # the live inspection (inspection.md)
└── actions/                              # inspector ComponentActions + renderers

custom-component/                         # editor-side orchestration (NOT rendering)
├── custom-component.service.ts           # create / open / close an editor tab
├── component-library.service.ts          # hydration, aliases, orphan restore
├── outdated-instances.service.ts         # isOutdated + the one board scan
├── definition-binding.ts                 # master summary <- open editor
└── definition-derivation.ts              # deriveSummary: plugs -> ports + labels
```

## `CustomComponentRegistry`

Root-provided singleton, the single owner of definitions. It allocates type ids,
holds a masters-only `id → typeId` index, registers a `ComponentConfig` per
definition into `ComponentProviderService` (so serializer, actions and palette
all work through one `getComponent(t)` path), emits `definitionChange$(typeId)`
on a **master's** summary edit, and tracks the library dependency graph for
[cycle prevention](#cycle-prevention).

- `snapshot(masterTypeId)` returns the master's frozen current state, cached per
  master (Inv. B). `ingestSnapshots(defs)` registers a document's embedded
  snapshots and returns the type remap ([`persistence.md`](persistence.md)).
- `updateDefinition(masterTypeId, patch)` mutates a **master** in place (no-op
  for a snapshot or unknown id) and fires `definitionChange$`. It does not bump
  `version` — that is a save-time stamp.
- `setMasterCircuit` / `setMasterVersion` replace a master's materialised
  circuit (a fresh deep copy, so earlier snapshots stay frozen) and adopt the
  save-returned version. Both invalidate the snapshot cache.
- `wouldCycle(host, placed)` is the one cycle predicate,
  `placed === host || dependentsOf(host).has(placed)`.
- Lookups, dependency accessors, promotion aliases and master removal are
  covered by [`dependencies-and-promotion.md`](dependencies-and-promotion.md).

Configs are never unregistered, so snapshot configs accumulate for the session
and undo history deserializing a custom `t` never dangles. They are tiny, and
`GraphicsProviderService` caches geometry by `[width, height, scale]`.

## `buildCustomComponentConfig`

Builds the one `ComponentConfig` backing a definition — `USER` for a master,
`HIDDEN` for a snapshot. `symbol`/`name`/`description`/`source`/`defaultPorts`
are **getters** reading `def`, so a master's palette tile follows its edits and
a cloud promotion while a frozen snapshot's stay fixed; name and description are
user strings in the literal arm of `LocalizableText`, never resolved against the
translation schema. `create` closes over both `def` and the config object, so a
built instance exposes that exact config (hence
`component.config.type === def.typeId`, which the serializer relies on), and
`inspection` returns a [`SubCircuitWatch`](inspection.md).

The [inspector actions](actions-system.md) each gate their own visibility: edit
circuit, edit details, upload, share and delete are config-scoped and surface on
a palette/ghost selection too, update-to-latest needs a selected instance behind
its master, and update-all any outdated instance in the active project.
`EditComponentAction` degrades to _View inside_, _Restore & edit_ or a _Sign in_
prompt for an **orphan**. `EditDetailsAction`
bumps `version` like a circuit save does, so instances frozen at the older one
are offered "Update to latest" — the details travel in placed snapshots.

## `CustomComponent` (rendering)

One optionless `Component` subclass backs **every** custom type; the config's
`create` factory injects the matching definition. In place of a `ComponentMeta`
the constructor hands the base a `ComponentGeometrySource` closing over `def` —
ports and labels from the definition's counts (Inv. A), and a body of fixed
width `CUSTOM_BODY_GRID_WIDTH`, so the box does not track how wide the symbol
renders.

**Init-order note:** the base constructor draws before the subclass `_def` field
exists, so `symbol` returns `null` on that pass and the constructor calls
`redraw()` once `_def` is set. Nothing reacts afterwards — the snapshot is
frozen, so there is no `definitionChange$` subscription.

## `deriveSummary(project)`

The **only** place that knows the plug → port mapping, used by
`DefinitionBinding` and the snapshot/save path. It scans `project.components`
for `InputComponent`/`OutputComponent`, orders each group by the plug's `index`
option and then instance id (a tiebreak for gappy external data — it never
throws), and returns `{ numInputs, numOutputs, labels }` with inputs first.

## Editing UX

### `CustomComponentService` — create / open / close

A component editor is just a `Project` registered with `type: 'comp'` and an
attached `DefinitionBinding`; `ProjectService` already models multiple open
Projects plus an active one, and the [tab bar](ui.md) switches between them.

- `createComponent(meta)` — mints a master and opens an **empty** editor tab,
  in the cloud or the browser store per the [new-component dialog](ui.md).
- `openComponentForEdit(masterId)` — re-focuses an open editor, or loads the
  master's circuit from its library and opens a tab. A reused master keeps its
  session type id, so palette tile and editor stay one definition.
- `closeComponent(project)` — a clean editor is disposed straight away; a dirty
  one prompts **Save / Discard / Cancel** (dismiss = cancel), and saving a cloud
  component that embeds local ones promotes them first, which the prompt warns
  about ([`dependencies-and-promotion.md`](dependencies-and-promotion.md) §8.1).
  The master definition stays registered — it remains in the palette.

### `DefinitionBinding` — keep a master's summary current

One binding per open component editor. Every plug change — add, remove, label,
reorder — flows through `ActionManager`, so one coalesced `actionChange$`
listener covers them all. Each change re-derives the summary
(`updateDefinition`), materialises the master's circuit (`setMasterCircuit`, so
snapshots capture current contents) and recomputes its direct library
dependencies from its placed snapshots' `source.id`.

### Placing from the palette (snapshot-on-place)

The palette lists **masters**. Committing a placement resolves the master config
to `registry.snapshot(...)`, so the instance is frozen at place time; placing
again after editing the master yields a new snapshot with the new shape.

## Per-instance update

The **only** path by which a placed instance's shape changes. "Behind its
master" has one definition, `OutdatedInstancesService.isOutdated(typeId)`: a
**snapshot** whose frozen `version` is lower than its master's, resolved through
`resolveMaster` and hence through the promotion alias. Built-ins, masters,
orphans and either side missing a version stamp are never outdated. Both update
actions and the palette indicator share it.

`buildInstanceUpdate` re-snapshots the master and builds an
`UpdateInstanceAction`: an `ActionContainer` **replacing** the instance with a
fresh `CustomComponent` of the new snapshot type at the same position and
direction (remove + add), so it is undoable and dirties the project. The add
fires `portsChange$`, so the rebucket and integrator run — in this Project only,
on demand. It returns `null` when the master no longer resolves; the instance
keeps working regardless.

### Board-wide update

`UpdateAllInstancesComponentAction` does the same for **every** outdated
instance of one type in the active project, in one undo entry.
`OutdatedInstancesService` scans the active project **once** per change into a
`masterTypeId → count` map, so button visibility, its count and the palette
tile's marker are map lookups rather than per-consumer scans. Clicking loads the
master's circuit once
(`ensureMasterCircuit` — a cloud master is preloaded summary-only, and
snapshotting an unloaded one would freeze empty content), then
`buildInstancesUpdate` folds every `buildInstanceUpdate` into one
`ActionContainer`; the snapshot cache lands the whole batch on **one** new type
id. A port-count change between versions can leave wires no longer terminating
on a port — now for N instances at once.

## Cycle prevention

A master must not transitively contain itself. Detection runs on the live
library-master graph the registry maintains, with `wouldCycle` as the single
predicate.

- **Palette filter** ([side bar](ui.md)): while editing master C, the
  user-component list excludes C and every master in `dependentsOf(C)`.
- **Placement guard** (defense in depth, [work-mode.md](work-mode.md)):
  `wouldCyclePlacement(project, config)` takes the host master from the editor
  Project's metadata and the placed master from the config, returning false
  outright for built-ins, snapshots and the main project. Both
  `ComponentPlacementSession` (refusing in `onEnd` with a toast) and the
  [automation API](automation.md) call it, covering any path around the palette
  filter. `UpdateInstanceAction` needs none — re-snapshotting an already-placed
  master adds no edge.

## Persistence, dependencies & unresolved snapshots

Saving embeds a frozen snapshot of every custom the document transitively uses,
so a placed instance always resolves whether or not its master still exists; a
deleted or renamed master only disables "Update to latest" and turns the
instance into an **orphan** the user can restore. How documents carry those
dependencies, how a component is **promoted**, how ids are re-mapped and how an
absent snapshot is handled (no tombstone — it is skipped with a counted warning)
is the subject of
**[`dependencies-and-promotion.md`](dependencies-and-promotion.md)**.
