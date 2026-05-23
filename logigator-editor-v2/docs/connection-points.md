# Connection Points

Connection points (**CPs**) are small dots rendered at half-grid positions where three or more cardinal directions are filled by wires or component port stubs **and** at least one of those things terminates at the point. They are derived visual sugar — **not** persisted, **not** selectable, **not** in any model graph. They appear and disappear automatically as a consequence of wire/component mutations on `Project`.

## Directory Layout

```
src/app/connection-points/
├── connection-point.ts                 # Per-dot PixiJS Graphics
├── connection-point-layer.ts           # Container holding all CPs
├── connection-point-manager.ts         # Pure logic — decides which points need CPs
└── connection-point-manager.spec.ts    # Unit tests against fake query lambdas

src/app/rendering/graphics/
└── connection-point.graphics.ts        # Shared GraphicsContext (1×1 unit square)
```

---

## Detection Rule

At a candidate half-grid point `P`:

- **Filled directions `D(P)`** — the subset of `{N, E, S, W}` filled by:
  - A wire whose `start === P`: the direction from `P` toward `end` (horizontal → `E`; vertical → `S`).
  - A wire whose `end === P`: the direction back toward `start` (horizontal → `W`; vertical → `N`).
  - A wire whose **interior** contains `P`: both of its axis directions (horizontal → `E + W`; vertical → `N + S`).
  - A component port tip at `P`: the stub direction from the tip back toward the body (depends on rotation — see below).

- **Terminations `T(P)`** — the count of objects that *end* at `P`. Each wire endpoint at `P` is one termination; each component port tip at `P` is one termination. Wire interiors do **not** count.

**A CP exists at `P` iff `|D(P)| ≥ 3` AND `T(P) ≥ 1`.**

The `T ≥ 1` guard makes a pure 2-wire crossing (both interiors passing through, no endpoint) yield no CP — the user must "split" the crossing by clicking it for a CP to form. The `|D| ≥ 3` guard makes a simple L-corner or straight join yield no CP either.

### Worked cases

| Scenario | `D(P)` | `T(P)` | CP? |
|---|---|---|---|
| Single wire endpoint at `P`, nothing else | 1 | 1 | no |
| L-corner: two wires share an endpoint, perpendicular | 2 | 2 | no |
| Pure crossing: H interior + V interior, no endpoints at `P` | 4 | 0 | **no** (`T = 0`) |
| 2-wire T: V endpoint on H interior | 3 | 1 | **yes** |
| 3-wire T (merge-prevented): 2 collinear H endpoints + 1 V endpoint | 3 | 3 | yes |
| 4-wire X with all four endpoints meeting | 4 | 4 | yes |
| Port-only at `P`, no wires | 1 | 1 | no |
| Port + one wire endpoint | 2 | 2 | no |
| Wire interior crossing a component port tip | 3 | 1 | **yes** |
| Two wire endpoints + one component port at `P` | 3 | 3 | yes |

### Component port-stub directions

For an unrotated (`Direction.E`) component each input stub extends `E` (back toward the body) and each output stub extends `W`. After rotation:

| Component direction | Input stub | Output stub |
|---|---|---|
| `Direction.E` | `E` | `W` |
| `Direction.S` | `S` | `N` |
| `Direction.W` | `W` | `E` |
| `Direction.N` | `N` | `S` |

The output stub direction is computed as `(direction + 2) % 4` — the opposite cardinal — via the load-bearing numeric layout of `Direction` (see `utils/direction.ts`).

`Component.portStubs` returns the `{ tip, direction }` pairs in the canonical order (inputs first, then outputs), preserving the invariant `portStubs[i].tip === connectionPoints[i]`.

### Toggleability

The rule is **value-only** — it does not model whether a CP can be toggled by user interaction. Some CPs are physically non-toggleable: the 2-wire T case (V endpoint sitting on H interior) cannot be "unjoined" by splitting the H wire, because the V wire still terminates on the same point. A future click handler will need a local-geometry `canToggle(P)` check; that check is out of scope for the detection rule.

---

## Architecture

```
Project (stage root)
├── Grid
└── _gridSpace  (scale = gridSize)
    ├── _wires             (QuadTreeContainer)
    ├── _components        (QuadTreeContainer)
    ├── _connectionPoints.layer   ← ConnectionPointLayer
    └── _floatingLayer
```

The CP layer sits **above** wires and components (dots draw on top of wire fills) and **below** the floating layer (drag previews render on top of stable CPs).

### Why a separate manager class

`ConnectionPointManager` mirrors the pattern used by `WireIntegrator`: a pure logic class owned by `Project`, dependency-injected with query lambdas rather than a `Project` reference. This avoids a circular dependency and keeps the manager unit-testable in isolation against fake query functions.

The manager owns the `ConnectionPointLayer`, the `Map<string, ConnectionPoint>` lookup, and all the per-mutation hooks.

---

## `ConnectionPointGraphics`

**File:** `rendering/graphics/connection-point.graphics.ts`

`GraphicsContext` subclass. Draws a unit `1×1` rectangle filled with the current theme's `wire` colour (no separate theme field). Cached by `GraphicsProviderService`, so theme changes mid-session do not repaint existing CPs — same limitation as `WireGraphics`.

---

## `ConnectionPoint`

**File:** `connection-points/connection-point.ts`

Extends PixiJS `Graphics`. Each instance:

- shares the `ConnectionPointGraphics` context (no per-instance geometry);
- sits at a half-grid `position` and is pivot-centred (`pivot.set(0.5, 0.5)`) so the unit square is drawn around the position;
- compensates zoom + grid scale via `applyScale(scale)`, identical convention to `Wire`:

```
scale.set(SCREEN_SIZE_PX / (scale * gridSize))   // SCREEN_SIZE_PX = 6
```

`ConnectionPoint` does **not** implement `GridElement`, is **not** in any quad tree, and is **not** interactive (`interactiveChildren = false`).

---

## `ConnectionPointLayer`

**File:** `connection-points/connection-point-layer.ts`

Thin `Container<ConnectionPoint>` subclass with `interactiveChildren = false` and `eventMode = 'none'`. Forwards `applyScale(scale)` to every child. Exposed by `ConnectionPointManager.layer`.

---

## `ConnectionPointManager`

**File:** `connection-points/connection-point-manager.ts`

### Construction

```ts
new ConnectionPointManager(
    queryWiresInRange: (rect: Rectangle) => Generator<Wire>,
    queryComponentsInRange: (rect: Rectangle) => Generator<Component>,
    getScale: () => number
)
```

The three lambdas are typically bound to the parent `Project`. `getScale` is needed because newly-created `ConnectionPoint` instances must immediately call `applyScale` to render at the right size if the project is already zoomed.

### Mutation hooks

| Method | Caller | Purpose |
|---|---|---|
| `onWireAdded(snapshot)` | `Project.addWire`, `Project.moveWire` | Recompute every point affected by the new wire |
| `onWireRemoved(snapshot)` | `Project.removeWire`, `Project.moveWire` | Recompute every point affected by the removed wire |
| `onComponentAdded(ports)` | `Project.addComponent`, `Component.portsChange$` listener | Recompute each port tip |
| `onComponentRemoved(ports)` | `Project.removeComponent`, `Component.portsChange$` listener | Recompute each old port tip |

Each hook funnels through `recomputeAt(P)`, which decides whether `P` needs a CP based on the [detection rule](#detection-rule) and creates/destroys the visual accordingly. Recomputes are idempotent — calling `recomputeAt(P)` twice produces exactly one CP (or none).

`onWireAdded` and `onWireRemoved` share the same body internally — the manager doesn't need to know which side of the transition it is; both ask "given the tree's current state, what should the affected points look like?".

### Full recompute and direct API

| Method | Purpose |
|---|---|
| `recomputeAll(allWires, allComponents)` | Clear all CPs and rebuild from scratch. Used by loaders that bulk-insert elements directly into the quad trees, bypassing `addWire`/`addComponent`. |
| `recomputeAt(p)` | Re-evaluate a single point. The detection rule lives entirely inside `_evaluateAt`, called from here. |
| `recomputeCpsForMovedSelection(oldComponentPorts, oldWireSnapshots, newComponents, newWires)` | Recompute over both old and new affected points after a selection drag commit. Called from `SelectionMoveSession.onEnd` — see [Selection drag-move](#selection-drag-move) below. |
| `affectedPointsForWire(wire)` / `affectedPointsForSnapshot(snap)` | Returns the set of points whose CP status could change as a result of this wire being added or removed. Used internally and by `recomputeCpsForMovedSelection`. |

### Drag-follow helpers

These three methods exist so a `SelectionMoveSession` can make CPs *visually follow* dragged elements without recomputing the rule mid-drag:

| Method | Purpose |
|---|---|
| `getCpAt(p)` / `hasCpAt(p)` | Lookup by exact-position key |
| `detachCp(cp)` | Remove from layer + map, without destroying |
| `reattachCp(cp)` | Insert back into layer + map (key derived from `cp.position`) |
| `captureDragCps(comps, wires, dragLayer)` | Find every CP sitting at a termination point of a dragged element, detach it, parent it into `dragLayer`, and return the captured list |
| `discardDragCps(captured)` | Destroy captured CPs (used on drag commit; recompute follows) |
| `restoreDragCps(captured)` | Reattach captured CPs to the main layer (used on drag cancel or no-move commit) |

CPs at non-termination points (e.g., a CP that depends on a dragged wire's *interior* pass-through) are intentionally **not** captured — those CPs would be visually wrong if dragged.

### Internals

- **Affected point set for a wire** — endpoints of the wire plus any other wire-endpoint or component-port-tip lying on the wire's segment. Computed via a quad-tree range query on `wire.gridBounds` plus `Wire.segmentContains` filtering. The source wire shows up in its own query results but the dedup `PointSet` (keyed on `"x,y"`) makes that harmless.
- **Single-point evaluation** — `_evaluateAt(p)` queries a `2×2` rect centred on `p` (smallest wire/component bound is `1×1`, so any incident element falls inside). Classifies each result as start / end / interior / port stub and accumulates the direction set and termination count.
- **Numerical safety** — wire endpoints and port tips are exact half-integers (`n + 0.5`). Map keys use `${p.x},${p.y}` directly — no rounding, no epsilon.

---

## `Project` integration

```
Project
├── _connectionPoints = new ConnectionPointManager(
│       (rect) => this.queryWiresInRange(rect),
│       (rect) => this.queryComponentsInRange(rect),
│       () => this.scale.x
│   )
└── _portsChangeSubs: Map<componentId, Subscription>
```

| Project method | CP-related effect |
|---|---|
| `addWire(w)` | `onWireAdded(Wire.snapshot(w))` after insert |
| `removeWire(id)` | Snapshot **before** removing from quad tree, then `onWireRemoved(snapshot)` |
| `moveWire(id, pos)` | Old snapshot before mutation; re-insert; both hooks fire (order doesn't matter — idempotent) |
| `addComponent(c)` | `onComponentAdded(c.connectionPoints)`; subscribes to `c.portsChange$` |
| `removeComponent(id)` | Snapshot ports, remove from tree, `onComponentRemoved(ports)`, unsubscribe from `portsChange$` |
| `moveComponent(id, pos)` | Mirror of `moveWire` — old ports captured before mutation |
| `detachForDrag` / `reattachFromDrag` | Do **not** recompute CPs (the drag-follow helpers handle CP visuals during drag) |
| `connectionPoints` getter | Exposes the `ConnectionPointManager` for tests and for sessions |

**Mutation ordering invariant:** for every removal path the snapshot is captured **before** mutating the quad tree, so the recompute (which runs after) sees a tree that reflects the post-state. Symmetric for adds — the new element is in the tree by the time the hook runs.

### Component rotation / input-count changes

`Component` fires `portsChange$: Subject<{ oldPorts, newPorts }>` whenever its `direction`, `numInputs`, or `numOutputs` setter runs (guarded by `_initialized` so constructor calls don't fire). `Project.addComponent` subscribes; the handler calls `onComponentRemoved(oldPorts)` followed by `onComponentAdded(newPorts)`. Subscriptions are tracked in a `Map<componentId, Subscription>` and torn down in `removeComponent`.

This path covers rotation triggered by the `DirectionComponentOption` from the side panel, which bypasses the action system.

### Selection drag-move

During `SelectionMoveSession`:

1. **Drag start** — after `project.detachForDrag(...)`, the session calls `project.connectionPoints.captureDragCps(components, wires, dragLayer)`. Captured CPs are reparented into the drag layer so they visually follow.
2. **Mid-drag** — no CP recompute. The CP layer is frozen; drag-layer CPs ride along with the drag-layer's offset.
3. **Commit (`hasMove`)** — session captures old wire snapshots (`this._wires.map(w => Wire.snapshot(w))`) and old component ports before applying the delta. After `reattachFromDrag`:
   - `discardDragCps(captured)` destroys the followed CPs (they're stale — recompute will recreate the correct ones).
   - `recomputeCpsForMovedSelection(...)` runs over old + new affected points, dropping stale CPs at the old positions and creating new ones at the new positions.
4. **Commit (no move)** — `restoreDragCps(captured)` returns the CPs to the main layer; their position is unchanged so they snap back visually as the drag-layer offset resets to zero.
5. **Cancel** — same as no-move: `restoreDragCps(captured)`.

### Undo / redo

Action `do`/`undo` implementations go through the public `Project.addWire` / `removeWire` / `moveWire` (and component analogues). All of these fire the CP hooks, so undo/redo work without any action-layer changes.

The **initial** `MoveWires/MoveComponents` action push from `SelectionMoveSession.onEnd` is the special case — at push time, the elements are already at their new positions, so the action `do()` is an effective no-op for CP purposes. `recomputeCpsForMovedSelection` shoulders the initial-commit recompute. Subsequent undo/redo replays of the same action observe an actual transition and the per-mutation hooks suffice.

---

## Future work

### Click-to-toggle

Treat a click on a CP-eligible point as a *wire mutation*: clicking a 2-wire X splits both wires at `P`, producing 4 wires that all end at `P` → CP forms automatically. Clicking a 4-wire X joins each opposing pair back into 2 wires → CP disappears automatically. The future action (`SplitWiresAction` / `JoinWiresAction` or similar) goes through `addWire` / `removeWire` and fires the existing CP hooks. The manager needs no new API.

A `canToggle(P)` predicate based on local geometry will be needed to filter out non-toggleable CPs (e.g., the 2-wire T case where splitting the through-wire wouldn't change electrical connectivity).

### Bulk loaders

Any code that bulk-inserts elements directly into `_components` / `_wires` quad trees without going through `addComponent` / `addWire` (e.g., a paste or load fast-path that bypasses the action system) **must** call `connectionPoints.recomputeAll(allWires, allComponents)` afterwards to seed the CP set. The action-routed paths already keep CPs in sync without this.

---

## Type Hierarchy

```
PixiJS Container
└── ConnectionPointLayer    (Container<ConnectionPoint>)

PixiJS Graphics
└── ConnectionPoint

GraphicsContext
└── ConnectionPointGraphics  (shared instance via GraphicsProviderService)
```
