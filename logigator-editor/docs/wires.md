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

Wires must appear the same visual thickness regardless of zoom level. `Wire` extends `Graphics` directly and has no `_visualSpace` wrapper, so it must absorb the `gridSize` factor in `applyScale`. The base formula is `scale.y = 1 / (scale * gridSize)`, which cancels out both the zoom scale (from `Project.scale.x`) and the gridSize scale (from `_gridSpace`). `applyScale(scale)` is called by `Project.updateScale` on every zoom change.

During simulation a powered wire is `POWERED_WIRE_THICKNESS` (3) screen pixels thick. That state is **pure transform** on the same shared context: `setPowered(true)` multiplies `scale.y` by the thickness and sets `pivot.y = POWERED_WIRE_PIVOT` so the scale-up extends symmetrically around the unpowered pixel. It deliberately does _not_ swap to a thicker `GraphicsContext`: reassigning a `Graphics` context detaches/re-attaches listeners on the shared context (a linear scan over every attached wire and stub — quadratic across a blinking board) and flags the render group for a full instruction rebuild, whereas transform changes are patched into the existing batch in place. The same rule holds for port stubs (`Component.setPortPowered`), negation bubbles (alpha toggle) and LEDs (tint).

---

## `WireDirection` enum

```
src/app/wires/wire-direction.enum.ts
```

```ts
export const enum WireDirection {
  HORIZONTAL, // = 0
  VERTICAL // = 1
}
```

`HORIZONTAL` maps to `rotation = 0`; `VERTICAL` maps to `rotation = Math.PI / 2`. The direction getter/setter on `Wire` translates between the two representations.

---

## `Wire` class

**File:** `src/app/wires/wire.ts`

### ID

Each `Wire` gets a monotonically increasing integer ID from a module-level counter (`WIRE_ID_COUNTER`). The `id` setter bumps the counter when loading persisted data with higher IDs to prevent collisions.

### Coordinate Properties

| Property               | Type            | Description                                                                                                                                                                                                                                      |
| ---------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `position` (inherited) | `Point`         | Half-grid position of the wire's start point in grid units (e.g., `(0.5, 2.5)`). This IS the canonical circuit coordinate.                                                                                                                       |
| `direction`            | `WireDirection` | Axis of the wire. Backed by `rotation` (0 or π/2).                                                                                                                                                                                               |
| `length`               | `number`        | Length in grid units. Backed by `scale.x`.                                                                                                                                                                                                       |
| `gridBounds`           | `Rectangle`     | Axis-aligned bounding box in grid units; used by `QuadTreeContainer` for spatial indexing. The origin is floored to the nearest integer; width/height is `length + 1` on the spanning axis so the box covers the half-grid padding on both ends. |

### `connectionPoints`

Returns a tuple `[start, end]` of `Point` values in **grid-unit coordinates** (half-grid):

- Horizontal wire: `[position, {x: position.x + length, y: position.y}]`
- Vertical wire: `[position, {x: position.x, y: position.y + length}]`

These are the endpoints that should connect to component ports.

### Geometry predicates

| Method             | Use                                                                                          |
| ------------------ | -------------------------------------------------------------------------------------------- |
| `wire.contains(p)` | Returns `true` if `p` lies on the wire's closed axis-aligned segment (endpoint or interior). |

### `Wire.snapshot(wire)`

Returns a geometry-only `WireSnapshot` (see below). Used by every code path that needs to remember a wire's pre-mutation geometry without holding the live `Graphics` instance alive. `Project.removeWire`, `Project.moveWire`, and `SelectionMoveSession.onEnd` all snapshot before mutating.

### `applyScale(scale)`

Sets `scale.y = 1 / (scale * environment.gridSize)` to keep the wire's visual height at one device pixel as the canvas zooms. The formula absorbs two scale factors: the project zoom (`scale`) and the `_gridSpace` scaling (`gridSize`). `Component` handles the latter via its `_visualSpace` counter-scaling, but `Wire` extends `Graphics` directly with no wrapper and must compensate explicitly.

### Serialization

```ts
Wire.serialize(wire); // Wire → SerializedWire  (save/action snapshot)
Wire.deserialize(serial); // SerializedWire → Wire  (load/undo restore)
```

`serialize` floors `wire.position.x / y` to integer coordinates (the position is stored at the grid-line origin, not the half-grid centre). `deserialize` sets `wire.position` to `[pos[0] + 0.5, pos[1] + 0.5]` — the `+0.5` is a semantic half-grid offset added at load time, not a unit conversion artifact.

---

## `SerializedWire` interface

**File:** `src/app/wires/serialized-wire.model.ts`

```ts
interface SerializedWire {
  id: number; // Wire ID (for undo/redo lookup)
  pos: [number, number]; // Integer grid position [x, y] of the start point
  direction: WireDirection;
  length: number; // Grid-unit length
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

A `GraphicsContext` subclass that draws a single **white** 1×1 rectangle. The wire's actual color lives entirely in the per-instance tint (`white × tint = the tint exactly`): `Wire.refreshTint()` sets it to the theme's `wire` color, or `wireSelectColor` while `wire.selected` is set. This makes the context theme-independent (`themeIndependent = true`, one `GraphicsProviderService` cache entry across themes) — a theme change retints instances instead of swapping contexts. All `Wire` instances (and every component port stub, which gets the same base tint at draw time) share this one context. Powered thickness is expressed by the owning `Graphics`' cross-axis scale (see _Constant-Width Stroke_ above), never by a second, thicker context. The module also exports `POWERED_WIRE_THICKNESS` and `POWERED_WIRE_PIVOT`, the transform constants that scale-up uses.

---

## Project Integration

`Project` owns a `QuadTreeContainer<Wire>` (`_wires`) inside `_gridSpace`:

```
Project (stage root)
├── Grid
└── _gridSpace  (scale = gridSize)
    ├── _wires  ← QuadTreeContainer<Wire>
    ├── _components
    ├── _connectionPoints.layer
    └── FloatingLayer
```

`Project.addWire(wire)` calls `wire.applyScale(this.scale.x)` before inserting it into the quad tree, ensuring the wire renders at the correct thickness for the current zoom level. `Project.removeWire(wireId)` finds the wire by ID in `_wires.items`, snapshots its geometry, then removes it from the quad tree. The snapshot is forwarded to `ConnectionPointManager.onWireRemoved` so the CP layer can recompute around the removed segment (see [`connection-points.md`](connection-points.md)).

---

## Wire Drawing Interaction (WireToolSession)

When `WorkMode.WIRE_TOOL` is active, the `WorkModeRouter` runs the drag through a `WireToolSession`:

1. **`pointerdown`** — the `WorkModeRouter` snaps the input's grid position to the half-grid with `roundToHalfGrid` and starts a `WireToolSession` at this snapped point.

2. **`pointermove` → `handleMouseMoveWhilePlacingWire`** — on first non-zero mouse movement, the dominant axis is determined:
   - Movement on X first → `WireDirection.HORIZONTAL` locked.
   - Movement on Y first → `WireDirection.VERTICAL` locked.

   Two `Wire` children are added to `_wireSelection` — one horizontal and one vertical — creating an L-shaped preview routed from the drag origin to the cursor. Positions and lengths are updated every frame:
   - The horizontal wire's `position.x` tracks the leftmost extent (`Math.min(0, mouseX)`).
   - The vertical wire's `position.y` tracks the topmost extent (`Math.min(0, mouseY)`).
   - The elbow of the L is placed at the cursor's axis-locked coordinate.

3. **`pointerup` → `onEnd`** — wires with `length > 0` are collected and run through `project.topology.integrate`; the surviving live instances go into the project directly and an `ActionContainer(RemoveWires?, AddWires)` is registered against that state. Zero-length wires are silently discarded.

4. **Mode change or abort** — `abortSelection` destroys the preview wires without committing.

---

## Undo / Redo

Wire mutations go through the `ActionManager` on `Project.actionManager`.

### `AddWiresAction`

Accepts one or more `Wire` instances at construction time. Immediately serializes them to `SerializedWire[]` so the action is self-contained and immune to further mutations on the live objects.

| Method          | Effect                                                  |
| --------------- | ------------------------------------------------------- |
| `do(project)`   | Deserializes each wire and calls `project.addWire(...)` |
| `undo(project)` | Calls `project.removeWire(wire.id)` for each stored ID  |

### `RemoveWiresAction`

Mirror of `AddWiresAction` with `do` and `undo` swapped.

### `ActionContainer`

When a single user gesture places both components and wires (e.g., a component placement also lays connecting wires), the session's `onEnd` wraps multiple actions in an `ActionContainer` so the whole operation undoes atomically.

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

## Wire Integration Invariants

After every gesture commit (drawing, moving, placing, removing), the project tree satisfies three invariants:

- **I1** — No wire's interior contains another wire's endpoint.
- **I2** — No wire's interior contains a component port tip.
- **I3** — No two collinear wires share an endpoint unless a third _terminating_ thing (perpendicular wire endpoint or component port tip) also terminates at that point.

I1 + I2 are **split-forcing** invariants — when a mutation would land an endpoint/port inside another wire's interior, the interior wire is auto-split at that point. I3 is the **merge-forcing** invariant — when nothing else terminates at a shared endpoint, two collinear wires merge into one.

**Scissor cut exception (live cut).** An uncommitted scissor cut deliberately violates I3 _while it is live_ (the newest history entry, awaiting a move/delete to commit it). The integrator never runs against that state; the next gesture either coalesces the cut into its own action or the selection-clear retracts it — and any unrelated action dissolves it first. The CP rule renders the violation invisible (only 2 terminations at the cut point → no CP), so users don't notice the temporary state.

### `project.topology.integrate(input)`

The integrator entry point. Pure query — does not mutate project state. Returns `{ toAdd: Wire[], toRemove: Wire[] }`.

```ts
interface IntegrationInput {
  addedWires?: readonly Wire[]; // Not yet in tree
  removedWires?: readonly Wire[]; // Currently in tree
  movedWires?: readonly { wire: Wire; oldSnapshot: WireSnapshot }[];
  addedComponentPorts?: readonly Point[];
  removedComponentPorts?: readonly Point[];
  movedComponentPorts?: readonly {
    oldPorts: readonly Point[];
    newPorts: readonly Point[];
  }[];
  vacatedPoints?: readonly Point[]; // Terminations already gone from the tree
}
```

`vacatedPoints` seeds candidate points for elements a caller already removed
from the tree — the eraser deletes live during its sweep, so by integration
time the erased instances no longer exist. The merge pass heals a collinear
pair whose third terminator vanished; the split pass's termination guard keeps
a vacated point with no current terminator from splitting anything.

- `toAdd` — fresh `Wire` instances the caller should add to the tree (splits, merges, or `addedWires` that survived integration).
- `toRemove` — live wires currently in the tree the caller should remove (absorbed by merges, or split sources).

Callers wrap the result in `ActionContainer(RemoveWiresAction, AddWiresAction)` alongside their primary action so the whole gesture — including any splits/merges — undoes atomically. The integrator itself never runs inside `Action.do/undo`; undo/redo replays from captured snapshots.

### Where integration runs

| Mutation site                                   | Inputs passed                                                                                                                                    |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `WireToolSession.onEnd`                         | `addedWires`                                                                                                                                     |
| `SelectionMoveSession.onEnd`                    | `movedWires`, `movedComponentPorts`                                                                                                              |
| `ComponentPlacementSession.onEnd`               | `addedComponentPorts`                                                                                                                            |
| `PastePlacementSession.onEnd`                   | `addedWires`, `addedComponentPorts` — the selection adopts span-sharing successors (merge results, split pieces of pasted wires)                 |
| `ClipboardService._applyDelete` (Delete, Cut)   | `removedWires`, `removedComponentPorts`                                                                                                          |
| `EraseSession.onEnd`                            | `vacatedPoints` — the sweep removes live, so the erased terminations are seeded after the fact                                                   |
| Automation `applyEdit` ops                      | the per-op analogue of the above (`addWire`/`addComponent`/`move*`/`rotateComponent`/`remove`)                                                   |
| `Component.portsChange$` (rotation, port-count) | `movedComponentPorts` — applied directly without action wrapping (no undo yet; see [`connection-points.md`](connection-points.md) § Future work) |

The integrator runs **once per gesture** at the session/command boundary. Low-level mutators (`Project.addWire`, `removeWire`, `moveWire`, and component analogues) do not invoke it.

### Algorithm

The integrator computes a **fixed-point** over a working set of wires:

1. Seed candidate points from input (endpoints of added/removed/moved wires, port positions).
2. **Consolidate pass**: for each added/moved wire, absorb any collinear-overlapping existing wires into one merged wire (this handles the case where the caller's wire was drawn on top of an existing one). An absorbed wire's endpoint that lands _inside_ the merged span while a perpendicular wire still ends there marks a junction the user connected; the point is remembered so the merge pass leaves it alone (see _Junction preservation_ below).
3. **Loop until fixed point**:
   - **Split pass**: for each candidate `P` where another wire endpoint or component port terminates, split any wire whose interior contains `P` into two halves at `P`.
   - **Merge pass**: for each candidate `P` where exactly 2 collinear wires end and no third terminator is present, merge them into a single wire spanning the union.
4. Diff the working set against the original tree wires to produce `{ toAdd, toRemove }`.

The loop is bounded at 8 iterations (in practice converges in 1–2); exceeding the cap throws to fail loudly on algorithmic bugs.

### Junction preservation

A junction has no state of its own — it exists only as the split state of the wires meeting at it. That evidence is what the consolidate pass destroys: drawing or moving a wire along one arm of a junction absorbs that arm into a span whose _interior_ now contains the junction point, so the perpendicular pair meeting there loses its third terminator, I3 fires, and the pair fuses into a plain crossing — the junction disappears without the user asking for it.

The consolidate pass therefore records every absorbed endpoint that (a) ends up inside the merged span and (b) has a perpendicular wire endpoint at it. The merge pass skips those points, so the wires that still terminate there stay split, and the split pass re-cuts the merged span at the junction. A collinear neighbour ending at the same point is not a marker — it overlaps the merged span and gets absorbed too. Component ports need no marker either: `hasPort` reports them independently of the wires, so a port keeps blocking the merge and forcing the split on its own.

This is narrower than the merge-first ordering it carves out of: a point only becomes protected when consolidation removed a termination that was there. Moving both halves of a previously split wire across another wire still merges the halves and leaves a crossing, because nothing perpendicular ends at the seam.

### Board-wide repair (`project/wire-repair.ts` + `WireRepairService`)

Documents saved before integration covered every mutation path (pasting and the removal gestures shipped without it) can carry violations: stacked collinear wires, endpoints buried in interiors, unmerged pairs. Two functions handle them:

- `auditWireInvariants(project)` — pure scan; classifies every violation (`overlap`, `endpoint-in-interior`, `port-in-interior`, `unmerged-pair`) with a loggable detail string.
- `computeWireRepair(project)` — rebuilds the board's wires in an offline working set, re-adding each wire through the integrator one at a time (the integrator only ever sees valid state plus one wire — its designed use case), then multiset-diffs the result against the live wires by exact geometry. Wires whose spans survive unchanged keep their live instances — ids, selection and history references intact; only the changed remainder lands in the returned plan. A repair never changes which grid cells are wired, only how they group into `Wire` instances. Zero-length wires are dropped as cruft.

Both work off a `WireRowColumnIndex` (`project/wire-line-index.ts`, shared with `WireIntegrator`) rather than the project's quad tree. A wire is axis-aligned and its `gridBounds` spans exactly one grid row (horizontal) or column (vertical), so the index buckets horizontals by row and verticals by column — one bucket per grid line. The quad tree files by full containment instead, which parks long and boundary-straddling wires high in the tree where every descending query rescans them; tolerable for the point-sized queries of an interactive gesture, but the audit touches every wire and every port, where that rescan dominates.

The audit never issues a rect query, because neither invariant needs one:

- **Collinear pairs** (`overlap`, `unmerged-pair`) can only involve wires on the same grid line, so each line is sorted by axis position and swept — a wire meets only those starting before it ends, and the scan breaks at the first one that does not.
- **Buried endpoints and ports** (`endpoint-in-interior`, `port-in-interior`) are point containment: an interior point lies exactly on its wire's centre line, so only the row and the column through that point can hold a container. Each is a binary search into that line's sorted wires, walking back only as far as the line's longest wire can reach.

Both are bounded by what shares a grid line with the wire rather than by how long the wires are, which is what keeps a full-width bus from dragging in every wire it crosses. Lines are sorted lazily, so `computeWireRepair` — which mutates the index constantly and only calls `query` — never pays for the ordering. Indexed wires must not move; neither caller repositions them.

`WireRepairService` orchestrates and reports (toast summary, per-violation console log). Both entry points are user-initiated — a load never repairs by itself:

- **Manually** (`repairManually`) — the Edit-menu "Repair Wires" command. Clears the selection first (retracting a live scissor cut, whose seam is a deliberate transient I3 violation the repair must not fuse), registers the fix as a single undoable history entry, and always toasts — including "no wire issues found". A post-repair audit logs an error if anything survived, failing loudly on repair bugs.
- **On load** (`offerRepairOnLoad`) — audits a freshly loaded document and, when it is broken, raises a warning toast whose action runs `repairManually`. Detection is a pure read: a clean board leaves no trace, and a broken one is not touched until the user accepts, so the fix stays undoable like the menu command. The toast never auto-dismisses (`life: 0`), so the handler re-checks `project.destroyed` — the offer can outlive the document that raised it. Read-only shares are skipped: a share can be neither saved nor exported, so an accepted repair would have nowhere to go. Hooked at `PersistenceService._loadAsMain` (server/browser projects, components-as-main, shares), `PersistenceService.persistImportedProject` (file and dump import) and `CustomComponentService._openEditor` (component tabs).

### Body collision during wire drawing

`Project.hasWireBodyCollision(wireBounds)` checks whether a wire's AABB intersects any component's body (excluding stub padding). `WireToolSession` calls this on every `pointermove` and tints colliding preview segments red. `canEnd()` returns `false` while any collision is active, blocking the commit.

A wire endpoint touching a port stub tip is not a collision — the strict `Rectangle.intersects` semantics and body-only bounds ensure this case is handled correctly without special-casing.

Components flagged with `ignoresWireCollision = true` are skipped entirely by the wire-vs-body check (currently only `TextComponent`). Wires may therefore pass through a text annotation body without triggering a red collision indicator or blocking `canEnd()`.

---

## Wire Scissor Cutting

When the user drags a `SELECT_EXACT` rubber-band rectangle, every wire that extends past the rectangle is split at the rectangle boundary. The inside piece is added to the selection; the outside pieces are left in place, unselected. See [`work-mode.md`](work-mode.md) § _SELECT vs SELECT_EXACT_ for the user-facing semantics and [`project.md`](project.md) § _`commit` behavior_ for the orchestration. The geometry helper itself lives in `wires/wire-cut.ts`.

### `cutWire(wire: Wire, rect: Rectangle): WireCutResult`

Pure function — no DI, no `Project` access. Returns one of three variants:

| Variant                                | Meaning                                                                                                                                                                                                                        |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `{ kind: 'skip' }`                     | The wire's centerline lies outside the rectangle (the half-cell padding of `gridBounds` is what produced the AABB intersect). Caller must not select it.                                                                       |
| `{ kind: 'keep' }`                     | The wire stays whole — either `rect.containsRect(wire.gridBounds)` succeeds, or the rectangle's edges happen to align with the wire's half-grid endpoints so the cut collapses to the original. Caller selects the wire as-is. |
| `{ kind: 'cut', pieces, insideIndex }` | The wire splits into 2–3 pieces in axis order. `pieces[insideIndex]` is the piece overlapping the rectangle; the others are the outside remnants.                                                                              |

### Cut formula

For a horizontal wire (vertical is the same mirrored onto the Y axis):

```
leftCut  = max(wStart, floor(rect.x - 0.5) + 0.5)
rightCut = min(wEnd,   ceil(rect.right - 0.5) + 0.5)
```

Cuts land on the first half-grid position **at or outside** the rectangle on each side — wire endpoints live on the half-grid lattice (`n + 0.5`), so that is the finest granularity a cut can have, and the marquee is free-form (never snapped), so its edges are arbitrary floats. A rectangle drawn strictly inside one grid unit therefore cuts exactly that unit; one whose edges are already half-grid aligned cuts exactly on them. The outside pieces' positions are not used to decide what's selected — `SelectionManager` holds the new `Wire` instances directly in a local array and picks the inside one by ID — so nothing depends on where the outside pieces' `gridBounds` land relative to the rectangle.

### Worked example

Wire at `(3.5, 4.5)` length 5 → endpoints `3.5 → 8.5`. Rectangle `(5, 4, 2, 1)` → `rect.x = 5`, `rect.right = 7`.

```
leftCut  = max(3.5, floor(4.5) + 0.5) = 4.5
rightCut = min(8.5, ceil(6.5) + 0.5)  = 7.5

pieces:
  [0] outside-left  position=(3.5, 4.5) length=1   (3.5 → 4.5)
  [1] inside        position=(4.5, 4.5) length=3   (4.5 → 7.5)   ← insideIndex = 1
  [2] outside-right position=(7.5, 4.5) length=1   (7.5 → 8.5)
```

### No wire integration on scissor

`Project.addWire` does NOT invoke `WireIntegrator`, so the cut pieces — which share endpoints at the cut points — stay as separate wires. This is intentional: the whole point of scissoring is to detach the inside from the outside. The CP rule needs ≥3 terminations to draw a dot, so 2 collinear cut-piece endpoints meeting at the cut boundary produce no visible marker. The scissor cut is the one documented exception to invariant I3 — see [Wire Integration Invariants](#wire-integration-invariants) above.

### Cut lifecycle

A scissor cut is a **real history entry from the start** — but it stays _live_ (committable/retractable) only while it is the newest entry. `SelectionManager._scissorAndSelectWires` mutates the project directly via `Project.addWire` / `Project.removeWire` (so the inside piece is a real, selectable `Wire`), registers `ActionContainer(RemoveWiresAction, AddWiresAction)` via `ActionManager.register`, and keeps the reference in `_cutAction`.

Three outcomes:

- **Move (`SelectionMoveSession.onEnd` with `hasMove === true`)** — the move session calls `selectionManager.consumeLiveCut()` and coalesces the cut's history entry with its own action container (`ActionManager.coalesceTop`), so cut + move are recorded as a single `ActionContainer` and revert with one `Ctrl+Z`. The cut's `RemoveWiresAction` captured the originals at their pre-cut positions; its `AddWiresAction` captured the new pieces at their **post-cut** positions, so the move action inside the same container correctly transitions them from post-cut to post-move on redo. `ClipboardService._applyDelete` commits a live cut the same way.
- **Cancel (`SelectionManager.clear()`, mode change, click on empty space)** — the manager retracts the entry (`ActionManager.retract`): the cut's `undo()` removes the new pieces and re-adds the originals, and the history shows no trace.
- **Ctrl+Z while the cut is live** — a plain history undo of the newest entry; the cut stays redoable.
- **An unrelated action while the cut is live** — the selection clears (retracting the cut) before the new action is recorded, so an uncommitted split can never be orphaned behind newer history. `SelectionManager` installs this rule through the generic `ActionManager.onBeforeRecord` hook.
- **No-move drag (`SelectionMoveSession.onEnd` with `hasMove === false`)** — the session returns early without consuming, leaving the cut live. The next clear retracts it.

This guarantees the wire invariant — collinear wires that touch at one endpoint with no third wire at the junction must merge — is never observably violated. The split state only persists when a move has already separated the pieces.

---

## Known Gaps / TODOs

- Visual connection-point markers (see [`connection-points.md`](connection-points.md)) are purely visual sugar — no electrical connectivity graph is built from them.
- No connectivity graph is maintained. Net-list extraction (required by the simulation layer) must be derived externally from the positional data available via `_wires.items`.
- Component rotation / port-count changes run the integrator but bypass `ActionManager`, so the implied wire splits/merges aren't undoable. Rotation itself was never undoable; full undo coverage is tracked as future work.
