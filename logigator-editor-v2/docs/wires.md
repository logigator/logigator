# Wire System

Wires connect circuit elements on the editor canvas. Each wire is an axis-aligned line segment that occupies a fixed direction (horizontal or vertical) and spans an integer number of grid cells. The wire model is intentionally minimal: there is no graph, no net-list, and no connectivity tracking at this layer — wires are purely positional scene objects.

## Directory Layout

```
src/app/wires/
├── wire.ts                    # Wire class (PixiJS Graphics subclass)
├── wire-direction.enum.ts     # HORIZONTAL / VERTICAL enum
├── wire-snapshot.model.ts     # Geometry-only DTO (start/end/direction/gridBounds)
└── serialized-wire.model.ts   # Persistence DTO

src/app/rendering/graphics/
└── wire.graphics.ts           # Shared GraphicsContext drawn by every Wire

src/app/actions/actions/
├── add-wires.action.ts        # Undo-able add-wire command
└── remove-wires.action.ts     # Undo-able remove-wire command
```

---

## Core Concepts

### Wire extends PixiJS Graphics

`Wire` subclasses the PixiJS `Graphics` class directly. Rather than drawing geometry per-instance, every `Wire` shares a single `GraphicsContext` produced by `WireGraphics` and cached by `GraphicsProviderService`. The context draws a 1×1 unit rectangle (`rect(0, 0, 1, 1)`) — the wire's actual size comes from `scale.x`, and its direction comes from `rotation`.

### Grid vs. Pixel Coordinates

All circuit data is stored in grid units. `Wire` lives inside `Project._gridSpace` (which has `scale = gridSize`), so its PixiJS `position` **is** the grid-unit coordinate — no conversion is needed. The helper `fromGrid(n)` (`n * gridSize`) is still used inside visual contexts that remain pixel-authored (e.g., `Component._visualSpace`), but wire coordinates themselves need no conversion.

**Wire centres lie on half-grid positions.** A wire's `position` has `.x` and `.y` values of the form `n + 0.5` (e.g., `(0.5, 2.5)` means "starting at column 0, row 2"). The `+0.5` is a semantic convention — it aligns the wire's centre-line with component port midpoints — and is added in `deserialize` rather than stored on disk.

### Constant-Width Stroke

Wires must appear the same visual thickness regardless of zoom level. `Wire` extends `Graphics` directly and has no `_visualSpace` wrapper, so it must absorb the `gridSize` factor in `applyScale`. The formula is `scale.y = 1 / (scale * gridSize)`, which cancels out both the zoom scale (from `Project.scale.x`) and the gridSize scale (from `_gridSpace`). `applyScale(scale)` is called by `Project.updateScale` on every zoom change.

---

## `WireDirection` enum

```
src/app/wires/wire-direction.enum.ts
```

```ts
export const enum WireDirection {
    HORIZONTAL, // = 0
    VERTICAL    // = 1
}
```

`HORIZONTAL` maps to `rotation = 0`; `VERTICAL` maps to `rotation = Math.PI / 2`. The direction getter/setter on `Wire` translates between the two representations.

---

## `Wire` class

**File:** `src/app/wires/wire.ts`

### ID

Each `Wire` gets a monotonically increasing integer ID from a module-level counter (`WIRE_ID_COUNTER`). The `id` setter bumps the counter when loading persisted data with higher IDs to prevent collisions.

### Coordinate Properties

| Property | Type | Description |
|---|---|---|
| `position` (inherited) | `Point` | Half-grid position of the wire's start point in grid units (e.g., `(0.5, 2.5)`). This IS the canonical circuit coordinate. |
| `direction` | `WireDirection` | Axis of the wire. Backed by `rotation` (0 or π/2). |
| `length` | `number` | Length in grid units. Backed by `scale.x`. |
| `gridBounds` | `Rectangle` | Axis-aligned bounding box in grid units; used by `QuadTreeContainer` for spatial indexing. The origin is floored to the nearest integer; width/height is `length + 1` on the spanning axis so the box covers the half-grid padding on both ends. |

### `connectionPoints`

Returns a tuple `[start, end]` of `Point` values in **grid-unit coordinates** (half-grid):

- Horizontal wire: `[position, {x: position.x + length, y: position.y}]`
- Vertical wire: `[position, {x: position.x, y: position.y + length}]`

These are the endpoints that should connect to component ports.

### Geometry predicates

| Method | Use |
|---|---|
| `wire.contains(p)` | Returns `true` if `p` lies on the wire's closed axis-aligned segment (endpoint or interior). |
| `Wire.segmentContains(start, end, dir, p)` | Same predicate against a snapshot or raw segment description. Used when no live `Wire` is available (e.g., comparing against `WireSnapshot`). |

These collapse the previously-duplicated point-on-segment helpers used by `WireIntegrator` and `ConnectionPointManager` into one shared implementation.

### `Wire.snapshot(wire)`

Returns a geometry-only `WireSnapshot` (see below). Used by every code path that needs to remember a wire's pre-mutation geometry without holding the live `Graphics` instance alive. `Project.removeWire`, `Project.moveWire`, and `SelectionMoveSession.onEnd` all snapshot before mutating.

### `applyScale(scale)`

Sets `scale.y = 1 / (scale * environment.gridSize)` to keep the wire's visual height at one device pixel as the canvas zooms. The formula absorbs two scale factors: the project zoom (`scale`) and the `_gridSpace` scaling (`gridSize`). `Component` handles the latter via its `_visualSpace` counter-scaling, but `Wire` extends `Graphics` directly with no wrapper and must compensate explicitly.

### Serialization

```ts
Wire.serialize(wire)       // Wire → SerializedWire  (save/action snapshot)
Wire.deserialize(serial)   // SerializedWire → Wire  (load/undo restore)
```

`serialize` floors `wire.position.x / y` to integer coordinates (the position is stored at the grid-line origin, not the half-grid centre). `deserialize` sets `wire.position` to `[pos[0] + 0.5, pos[1] + 0.5]` — the `+0.5` is a semantic half-grid offset added at load time, not a unit conversion artifact.

---

## `SerializedWire` interface

**File:** `src/app/wires/serialized-wire.model.ts`

```ts
interface SerializedWire {
    id: number;               // Wire ID (for undo/redo lookup)
    pos: [number, number];    // Integer grid position [x, y] of the start point
    direction: WireDirection;
    length: number;           // Grid-unit length
}
```

This is the canonical persistence format used by both the undo/redo action system and project serialization.

---

## `WireSnapshot` interface

**File:** `src/app/wires/wire-snapshot.model.ts`

```ts
interface WireSnapshot {
    start: Point;
    end: Point;
    direction: WireDirection;
    gridBounds: Rectangle;
}
```

Geometry-only DTO independent of the live `Wire` instance. Distinct from `SerializedWire`:

- `SerializedWire` is the **persistence** format — integer positions, designed for disk and undo replay.
- `WireSnapshot` is a **runtime** comparison form — half-grid endpoints + bounds, used by mutation hooks that need to refer to a wire's geometry after the wire instance has been removed or moved.

Build one with `Wire.snapshot(wire)`.

---

## `WireGraphics`

**File:** `src/app/rendering/graphics/wire.graphics.ts`

A `GraphicsContext` subclass that draws a single 1×1 white rectangle filled with the `wire` colour from `ThemingService`. All `Wire` instances share this context — it is cached by `GraphicsProviderService` the first time `WireGraphics` is requested, so theme changes that happen after construction are not reflected automatically.

---

## Project Integration

`Project` owns a `QuadTreeContainer<Wire>` (`_wires`) inside `_gridSpace`:

```
Project (InteractionContainer)
├── Grid
└── _gridSpace  (scale = gridSize)
    ├── _wires  ← QuadTreeContainer<Wire>
    ├── _components
    ├── _connectionPoints.layer
    └── FloatingLayer
```

`Project.addWire(wire)` calls `wire.applyScale(this.scale.x)` before inserting it into the quad tree, ensuring the wire renders at the correct thickness for the current zoom level. `Project.removeWire(wireId)` finds the wire by ID in `_wires.items`, snapshots its geometry, then removes it from the quad tree. The snapshot is forwarded to `ConnectionPointManager.onWireRemoved` so the CP layer can recompute around the removed segment (see [`connection-points.md`](connection-points.md)).

---

## Wire Drawing Interaction (FloatingLayer)

When `WorkMode.WIRE_DRAWING` is active, `FloatingLayer` handles the user drag gesture:

1. **`pointerdown`** — converts the event to grid-unit coordinates via `e.getLocalPosition(this.project.gridSpace)`, snaps to the half-grid with `roundToHalfGrid`, and sets `FloatingLayer.position` to this snapped point.

2. **`pointermove` → `handleMouseMoveWhilePlacingWire`** — on first non-zero mouse movement, the dominant axis is determined:
   - Movement on X first → `WireDirection.HORIZONTAL` locked.
   - Movement on Y first → `WireDirection.VERTICAL` locked.
   
   Two `Wire` children are added to `_wireSelection` — one horizontal and one vertical — creating an L-shaped preview routed from the drag origin to the cursor. Positions and lengths are updated every frame:
   - The horizontal wire's `position.x` tracks the leftmost extent (`Math.min(0, mouseX)`).
   - The vertical wire's `position.y` tracks the topmost extent (`Math.min(0, mouseY)`).
   - The elbow of the L is placed at the cursor's axis-locked coordinate.

3. **`pointerup` → `commitSelection`** — wires with `length > 0` are collected, their positions are converted from local → world grid-unit coordinates (adding `FloatingLayer.position`), and an `AddWiresAction` is pushed to the `ActionManager`. Zero-length wires are silently discarded.

4. **Mode change or abort** — `abortSelection` destroys the preview wires without committing.

---

## Undo / Redo

Wire mutations go through the `ActionManager` on `Project.actionManager`.

### `AddWiresAction`

Accepts one or more `Wire` instances at construction time. Immediately serializes them to `SerializedWire[]` so the action is self-contained and immune to further mutations on the live objects.

| Method | Effect |
|---|---|
| `do(project)` | Deserializes each wire and calls `project.addWire(...)` |
| `undo(project)` | Calls `project.removeWire(wire.id)` for each stored ID |

### `RemoveWiresAction`

Mirror of `AddWiresAction` with `do` and `undo` swapped.

### `ActionContainer`

When a single user gesture places both components and wires (e.g., a component placement also lays connecting wires), the `FloatingLayer.commitSelection` wraps multiple actions in an `ActionContainer` so the whole operation undoes atomically.

---

## Type Hierarchy

```
PixiJS Graphics
└── Wire

GraphicsContext
└── WireGraphics  (shared instance, cached by GraphicsProviderService)

Action (abstract)
├── AddWiresAction
└── RemoveWiresAction
```

---

## Wire Merging

When a new wire is placed (or a moved wire is committed), `Project.computeWireIntegration` computes the minimal set of changes needed to maintain the invariant that no two collinear wires overlap or are unnecessarily adjacent.

### Rules

- **Overlap**: two collinear wires whose segments share interior points always merge into one wire spanning the union of their extents.
- **Adjacency**: two collinear wires that touch at exactly one endpoint merge — **unless** a third wire (any direction) has that shared point on its segment, which would create a T/X junction. Junction nodes are deferred to a future stage.
- **Perpendicular / different axis**: wires cross or sit on different tracks freely; no merge.

### `Project.computeWireIntegration(newWires: Wire[])`

Pure query — does not mutate project state. Returns `{ toAdd: Wire[], toRemove: Wire[] }`.

- `toAdd` contains either the original new wires (no merge) or fresh `Wire` objects for the merged spans.
- `toRemove` contains the live project wires that are absorbed by the merge.

Callers wrap the result in `ActionContainer(RemoveWiresAction, AddWiresAction)` so the entire placement — including any merges — undoes atomically. The merge algorithm itself never runs inside `Action.do/undo`; undo/redo always replays from serialized snapshots.

### Body collision during wire drawing

`Project.hasWireBodyCollision(wireBounds)` checks whether a wire's AABB intersects any component's body (excluding stub padding). `WireDrawingSession` calls this on every `pointermove` and tints colliding preview segments red. `canEnd()` returns `false` while any collision is active, blocking the commit.

A wire endpoint touching a port stub tip is not a collision — the strict `Rectangle.intersects` semantics and body-only bounds ensure this case is handled correctly without special-casing.

---

## Wire Scissor Cutting

When the user drags a `SELECT_EXACT` rubber-band rectangle, every wire that extends past the rectangle is split at the rectangle boundary. The inside piece is added to the selection; the outside pieces are left in place, unselected. See [`work-mode.md`](work-mode.md) § *SELECT vs SELECT_EXACT* for the user-facing semantics and [`project.md`](project.md) § *`commit` behavior* for the orchestration. The geometry helper itself lives in `wires/wire-cut.ts`.

### `cutWire(wire: Wire, rect: Rectangle): WireCutResult`

Pure function — no DI, no `Project` access. Returns one of three variants:

| Variant | Meaning |
|---|---|
| `{ kind: 'skip' }` | The wire's centerline lies outside the rectangle (the half-cell padding of `gridBounds` is what produced the AABB intersect). Caller must not select it. |
| `{ kind: 'keep' }` | The wire stays whole — either `rect.containsRect(wire.gridBounds)` succeeds, or the rectangle's edges happen to align with the wire's half-grid endpoints so the cut collapses to the original. Caller selects the wire as-is. |
| `{ kind: 'cut', pieces, insideIndex }` | The wire splits into 2–3 pieces in axis order. `pieces[insideIndex]` is the piece overlapping the rectangle; the others are the outside remnants. |

### Cut formula

For a horizontal wire (vertical is the same mirrored onto the Y axis):

```
leftCut  = max(wStart, floor(rect.x) - 0.5)
rightCut = min(wEnd,   ceil(rect.right) + 0.5)
```

Cuts land on the first half-grid position **outside** the rectangle on each side. This guarantees the outside pieces' `gridBounds.right` (or `.bottom`) lands at an integer ≤ `rect.x` (or ≥ `rect.right` for the bottom), strictly excluding the outside pieces from any future `Rectangle.intersects(rect)` test on integer-aligned rects. For non-integer (user-drawn) rectangles the outside pieces can still half-cell-overlap the rect — `SelectionManager` does not rely on a post-cut re-query but tracks the inside piece's ID directly to decide what to add to the selection.

### Worked example

Wire at `(3.5, 4.5)` length 5 → endpoints `3.5 → 8.5`. Rectangle `(5, 4, 2, 1)` → `rect.x = 5`, `rect.right = 7`.

```
leftCut  = max(3.5, floor(5) - 0.5)  = 4.5
rightCut = min(8.5, ceil(7) + 0.5)   = 7.5

pieces:
  [0] outside-left  position=(3.5, 4.5) length=1   (3.5 → 4.5)
  [1] inside        position=(4.5, 4.5) length=3   (4.5 → 7.5)   ← insideIndex = 1
  [2] outside-right position=(7.5, 4.5) length=1   (7.5 → 8.5)
```

### No wire integration on scissor

`Project.addWire` does NOT invoke `WireIntegrator`, so the cut pieces — which share endpoints at the cut points — stay as separate wires. This is intentional: the whole point of scissoring is to detach the inside from the outside. The `ConnectionPointManager`'s ≥3-direction rule naturally suppresses visible junction dots at the interior cut endpoints, so the cut leaves no visual trace beyond the new selection.

---

## Known Gaps / TODOs

- Visual junction markers exist (see [`connection-points.md`](connection-points.md)) but they are purely visual sugar — no electrical connectivity graph is built from them.
- No connectivity graph is maintained. Net-list extraction (required by the simulation layer) must be derived externally from the positional data available via `_wires.items`.