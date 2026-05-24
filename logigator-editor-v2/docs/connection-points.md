# Connection Points

Connection points (**CPs**) are small dots rendered at half-grid positions where **three or more wires or component port tips terminate**. They are derived visual sugar — **not** persisted, **not** selectable, **not** in any model graph. They appear and disappear automatically as a consequence of wire/component mutations on `Project`.

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

**A CP exists at `P` iff at least 3 terminations occur at `P`.**

A *termination* at `P` is either:

- a wire endpoint at `P` — `wire.connectionPoints[0]` or `wire.connectionPoints[1]` equals `P`; or
- a component port tip at `P` — any `Point` in `component.connectionPoints` equals `P`.

Wire interiors do **not** count. Under the split-on-touch invariants enforced by `WireIntegrator` (see [wires.md](./wires.md)), no wire interior can contain another wire's endpoint or a component port tip — those scenarios are normalized into split wires before the rule ever evaluates them.

### Worked cases

| Scenario | Terminations at `P` | CP? |
|---|---|---|
| Single wire endpoint at `P` | 1 | no |
| L-corner: two wires share an endpoint perpendicularly | 2 | no |
| Pure 2-wire crossing (no endpoint at `P`, no port at `P`) | 0 | **no** |
| 2-wire T (post auto-split: 3 wires terminate at `P`) | 3 | **yes** |
| 3-wire T (2 collinear + 1 perpendicular, all endpoints) | 3 | yes |
| 4-wire X (all four endpoints at `P`) | 4 | yes |
| Port-only at `P`, no wires | 1 | no |
| Port + one wire endpoint | 2 | no |
| Port + wire interior crossing it → wire auto-splits → port + 2 wire endpoints | 3 | **yes** |
| Port + two wire endpoints (no auto-split needed) | 3 | yes |

The "2-wire T" case looks like one wire crossing another wire's body, but under the invariants the underlying body is already split into two wires that both end at the touch point. The CP rule sees three terminations.

### Implementation

`_evaluateAt(P)` queries a 2×2 rectangle centred on `P`, counts wire endpoints exactly equal to `P`, then counts component ports exactly equal to `P`, and short-circuits at 3:

```ts
private _evaluateAt(p: Point): boolean {
    const queryRect = new Rectangle(p.x - 1, p.y - 1, 2, 2);
    let terminations = 0;
    for (const wire of this.queryWiresInRange(queryRect)) {
        const [start, end] = wire.connectionPoints;
        if (start.x === p.x && start.y === p.y) terminations++;
        if (end.x === p.x && end.y === p.y) terminations++;
        if (terminations >= 3) return true;
    }
    for (const comp of this.queryComponentsInRange(queryRect)) {
        for (const port of comp.connectionPoints) {
            if (port.x === p.x && port.y === p.y) {
                terminations++;
                if (terminations >= 3) return true;
            }
        }
    }
    return false;
}
```

No direction set, no interior counting, no port-stub direction lookups. The previous "non-toggleable CP" special case (where a wire endpoint sat on another wire's interior) is gone — that state is no longer reachable.

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

Each hook funnels through `recomputeAt(P)`, which decides whether `P` needs a CP and creates/destroys the visual accordingly. Recomputes are idempotent — calling `recomputeAt(P)` twice produces exactly one CP (or none).

Under the new invariants, the only points that can change a CP state for a given wire mutation are the wire's two endpoints — `affectedPointsForWire` and `affectedPointsForSnapshot` simply return `[start, end]`.

### Full recompute and direct API

| Method | Purpose |
|---|---|
| `recomputeAll(allWires, allComponents)` | Clear all CPs and rebuild from scratch. Used by loaders that bulk-insert elements directly into the quad trees, bypassing `addWire`/`addComponent`. |
| `recomputeAt(p)` | Re-evaluate a single point. |
| `recomputeCpsForMovedSelection(oldComponentPorts, oldWireSnapshots, newComponents, newWires)` | Recompute over both old and new affected points after a selection drag commit. Called from `SelectionMoveSession.onEnd` — see [Selection drag-move](#selection-drag-move) below. |
| `affectedPointsForWire(wire)` / `affectedPointsForSnapshot(snap)` | Returns `[start, end]` — under the invariants, only the wire's own endpoints can change CP state. |

### Drag-follow helpers

These methods let a `SelectionMoveSession` make CPs *visually follow* dragged elements without recomputing the rule mid-drag:

| Method | Purpose |
|---|---|
| `getCpAt(p)` / `hasCpAt(p)` | Lookup by exact-position key |
| `detachCp(cp)` | Remove from layer + map, without destroying |
| `reattachCp(cp)` | Insert back into layer + map (key derived from `cp.position`) |
| `captureDragCps(comps, wires, dragLayer)` | Find every CP sitting at a termination point of a dragged element, detach it, parent it into `dragLayer`, and return the captured list |
| `discardDragCps(captured)` | Destroy captured CPs (used on drag commit; recompute follows) |
| `restoreDragCps(captured)` | Reattach captured CPs to the main layer (used on drag cancel or no-move commit) |

CPs at non-termination points are intentionally **not** captured.

### Numerical safety

Wire endpoints and port tips are exact half-integers (`n + 0.5`). Map keys use `${p.x},${p.y}` directly — no rounding, no epsilon.

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
| `moveWire(id, pos)` | Old snapshot before mutation; re-insert; both hooks fire |
| `addComponent(c)` | `onComponentAdded(c.connectionPoints)`; subscribes to `c.portsChange$` |
| `removeComponent(id)` | Snapshot ports, remove from tree, `onComponentRemoved(ports)`, unsubscribe |
| `moveComponent(id, pos)` | Mirror of `moveWire` — old ports captured before mutation |
| `detachForDrag` / `reattachFromDrag` | Do **not** recompute CPs (drag-follow helpers handle visuals) |

**Mutation ordering invariant:** for every removal path the snapshot is captured **before** mutating the quad tree, so the recompute (which runs after) sees a tree that reflects the post-state. Symmetric for adds — the new element is in the tree by the time the hook runs.

### Component rotation / input-count changes

`Component` fires `portsChange$: Subject<{ oldPorts, newPorts }>` whenever its `direction`, `numInputs`, or `numOutputs` setter runs (guarded by `_initialized`). `Project.addComponent` subscribes; the handler:

1. Calls `computeIntegration({ movedComponentPorts: [{ oldPorts, newPorts }] })` to compute any wire splits (a new port landing on a wire interior) or merges (an old port no longer blocks).
2. Applies the resulting `{ toAdd, toRemove }` directly to the project tree.
3. Recomputes CPs for old and new port positions.

This path **bypasses `ActionManager`** — rotation has no undo support today, and the implied splits/merges aren't undoable either. Full undo coverage is tracked as future work (see [Future work](#future-work)).

### Selection drag-move

During `SelectionMoveSession`:

1. **Drag start** — after `project.detachForDrag(...)`, the session calls `project.connectionPoints.captureDragCps(components, wires, dragLayer)`. Captured CPs are reparented into the drag layer so they visually follow.
2. **Mid-drag** — no CP recompute.
3. **Commit (`hasMove`)** — session captures old wire snapshots and old component ports before applying the delta. After `reattachFromDrag`:
   - The integrator runs over `movedWires` + `movedComponentPorts` and produces a `{ toAdd, toRemove }` diff.
   - `discardDragCps(captured)` destroys the followed CPs.
   - `recomputeCpsForMovedSelection(...)` runs over old + new affected points.
4. **Commit (no move)** — `restoreDragCps(captured)` returns the CPs to the main layer.
5. **Cancel** — same as no-move.

### Undo / redo

Action `do`/`undo` implementations go through `Project.addWire` / `removeWire` / `moveWire` (and component analogues). All of these fire the CP hooks, so undo/redo work without any action-layer changes. The integrator is **not** re-run on undo/redo — the captured snapshots are the source of truth.

---

## Click-to-Toggle

Users can click on a wire crossing to place or remove a CP junction:

- **Pure 2-wire X crossing (no endpoints at the click point)**: `WorkMode.WIRE_CONNECTION` handles a pointer-down + up. `FloatingLayer` snaps the click position to the nearest half-grid point via `roundToHalfGrid`, then delegates to `WireConnectionSession`. On `onEnd`, it calls `Project.toggleConnectionAt(p)`. Because `hasCpAt(p)` is false, `_splitAt(p)` runs: both wires are split into two pieces each, the four new halves are run through `computeIntegration`, and an `ActionContainer(RemoveWiresAction, AddWiresAction)` is pushed to `ActionManager`. The CP rule then sees 4 terminations at `p` → CP appears.

- **4-endpoint X junction (CP present at click point)**: `hasCpAt(p)` is true → `_joinAt(p)` runs. It finds the two H wire endpoints and the two V wire endpoints at `p`, builds a merged wire for each pair, runs integration, and checks if any output wire has an endpoint at `p` (which would indicate the integrator re-split because a third terminator blocked the merge). If not blocked, the action is pushed and the CP disappears.

- **T-junction (3 endpoints, CP present)**: `_joinAt` is called, but one direction has only 1 wire, so only the collinear pair is attempted. The integrator detects that the third wire's endpoint sits on the merged wire's interior (I1 violation) and re-splits it. The blocked check fires → no action is pushed → click is a silent no-op. The CP remains.

### Entry points

| Layer | Detail |
|---|---|
| `WorkMode.WIRE_CONNECTION` | Enum value `'connWire'`, already in `work-mode.enum.ts` |
| `FloatingLayer.onPointerDown` | `case WorkMode.WIRE_CONNECTION` → `roundToHalfGrid` + `WireConnectionSession` |
| `WireConnectionSession` | Minimal `DragSession`; `onEnd` calls `project.toggleConnectionAt(startPos)` |
| `Project.toggleConnectionAt(p)` | Dispatches to `_joinAt` or `_splitAt` based on `hasCpAt(p)` |
| `Project._splitAt(p)` | Splits both crossing wires at `p`, pushes action via `actionManager.push` |
| `Project._joinAt(p)` | Merges collinear pairs at `p`; no-ops silently if integrator re-splits |

### Undo / redo

Both `_splitAt` and `_joinAt` use `ActionManager.push`, so undo/redo work automatically through the normal action system.

---

## Future work

### Full undo for component rotation / port-count changes

The current `portsChange$` subscription in `Project.addComponent` applies integration mutations directly without action wrapping. Wrapping the property change + integration result into an `ActionContainer(ChangeComponentDirectionAction, RemoveWiresAction, AddWiresAction)` would give full undo coverage. The hand-off requires re-routing the UI side-panel option-change path through `ActionManager`.

### Bulk loaders

Any code that bulk-inserts elements directly into `_components` / `_wires` quad trees without going through `addComponent` / `addWire` (e.g., a paste or load fast-path that bypasses the action system) **must** post-process its input so I1/I2/I3 already hold (no wire interior contains another wire's endpoint or port tip, no two collinear wires share an endpoint without a third terminator), then call `connectionPoints.recomputeAll(allWires, allComponents)` to seed the CP set. Alternatively, run the loaded set through `computeIntegration` to normalize.

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
