# Custom Components

A **custom component** (user-defined component / UDC) is a saved circuit that can
be given input/output ports and then placed inside other circuits as a single
black-box element.

It follows a **snapshot-with-provenance** model: a placed instance is a **frozen
snapshot** of a library component, copied into the host project at place time and
carrying provenance back to the library entry. Editing the library entry does
**not** change already-placed instances; bringing one up to date is an explicit,
per-instance action (a later phase). This keeps placed instances side-effect-free
(no cross-document port/size churn) and every saved document self-contained.

This doc covers the **in-memory core** that exists today (registry, definition
model, the single `CustomComponent` rendering class, and summary derivation).
Persistence, editing tabs, and the explicit "update" action land in later phases.
Plug components (`INPUT`/`OUTPUT`) are documented in
[`component-system.md`](component-system.md).

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
└── custom-component.ts                   # the single black-box rendering class

custom-component/
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
  transitive `dependentsOf`) for cycle prevention.

Key methods:

- `createMaster(meta, source)` → masterTypeId (mints/records the persistent id).
- `snapshot(masterTypeId)` → freezes the master's _current_ state into a new
  snapshot definition (with `source` provenance) and returns it; used at place
  time and by the future `UpdateInstanceAction`.
- `registerSnapshot(def)` → the lower-level primitive behind `snapshot` (and, later,
  the embedded-snapshot load path).
- `updateDefinition(masterTypeId, patch)` → mutates a **master** in place (no-op
  for a snapshot or unknown id) and fires `definitionChange$`. Does **not** bump
  `version` — that is a save-time stamp.
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
`TranslationKey` contract (built-ins stay type-safe).

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
returns `{ numInputs, numOutputs, labels }` with inputs first. Used (in later
phases) to keep a master's summary current as its plugs are edited, and at save
time.
