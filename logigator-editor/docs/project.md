# Project Layer

The project layer is the central owner of all circuit state. `Project` is the root PixiJS scene node (the container the board renders) and the single source of truth for everything on the canvas. `ProjectService` is the Angular-managed wrapper that tracks which projects are currently loaded and which one is active.

## Directory Layout

```
src/app/project/
├── project.ts              # Circuit root — PixiJS Container owning all circuit state
├── project.service.ts      # Angular service — holds and exposes active project signals
├── selection-manager.ts    # Committed selection state (selected flags, sets, observables)
├── selection-inspector.service.ts # Reactive selection summary for UI panels
├── viewport-controller.ts  # Camera: pan/zoom/viewport state (exposed as project.viewport)
├── wire-topology.ts        # Wire-invariant integration + join/split toggling (project.topology)
├── wire-integrator.ts      # The split/merge fixed-point solver WireTopology owns
├── wire-repair.ts          # Board-wide invariant audit + rebuild diff (see wires.md § Board-wide repair)
└── wire-repair.service.ts  # Repair orchestration: on-load offer, Edit-menu command, toasts/logging
```

---

## Core Concepts

### Project as render root

`Project` extends PixiJS `Container`. An instance is created in `AppComponent` and rendered as the root container by `BoardComponent` (`renderer.render({ container: project, target: canvas })` through the shared renderer). Everything rendered on the canvas is a descendant of `Project`.

Canvas navigation (`pan`, `zoomIn`, `zoomOut`, `zoomBy`) is implemented by the `ViewportController`, exposed directly as `project.viewport`; the DOM `PointerController` (see `rendering.md`) calls it on right-drag, wheel, and touch gestures. `Project` itself listens to no pointer events.

### Scene graph layers

The constructor appends two direct children. The background grid is pixel-authored and stays a direct child of `Project`. All circuit content lives inside `_gridSpace`:

```
Project (stage root)
├── Grid                        — infinite background dot grid (pixel-authored)
└── _gridSpace                  — scale = gridSize; coordinates inside are grid units
    ├── QuadTreeContainer<Wire>       — permanent placed wires
    ├── QuadTreeContainer<Component>  — permanent placed components
    ├── ConnectionPointLayer         — derived visual junction markers
    └── FloatingLayer                 — transient in-progress interactions
```

### Coordinate system

All circuit data is stored in **grid units**. The `_gridSpace` container has `scale.set(environment.gridSize)`, so setting a component's `position` to `(5, 3)` in grid units renders at world-pixel `(5 * gridSize, 3 * gridSize)` — no manual conversion is needed. When `Project` is panned or zoomed, only `Project.position` and `Project.scale` change; component and wire positions remain their fixed grid-unit values.

### `_gridSpace` and `gridSpace` getter

`_gridSpace` is the parent of all circuit objects. It is exposed as a public `gridSpace` getter so that `FloatingLayer` can pass it as the reference container to `e.getLocalPosition(this.project.gridSpace)`, converting screen events directly into grid-unit coordinates.

### ActionManager

Every `Project` owns a public `actionManager: ActionManager` field. All circuit mutations (add/remove component or wire) are routed through it so that the operations can be undone and redone. Direct callers never mutate `_components` or `_wires` directly — they always go through `addComponent`, `removeComponent`, `addWire`, or `removeWire`.

### SelectionManager

Every `Project` owns a public `selectionManager: SelectionManager` field. It tracks the currently committed selection — the set of components and wires the user has selected with the rectangle or click selection tools. It is a plain TypeScript class (not an Angular service), constructed directly by `Project`.

`SelectionManager` is a peer of `ActionManager`: both are public, both are owned by `Project`, and neither holds Angular DI references. See the [SelectionManager](#selectionmanager-1) section below for its full API.

### ConnectionPointManager

Every `Project` owns a private `_connectionPoints: ConnectionPointManager` instance, exposed read-only via the `connectionPoints` getter. It is responsible for the small junction dots drawn at half-grid points where ≥3 cardinal directions are filled and at least one element terminates. The manager owns its own scene layer (added to `_gridSpace` between `_components` and `_floatingLayer`).

CPs are not persisted, not selectable, and have no model presence — they are derived visual sugar driven entirely by `Project`'s mutation methods. See [`connection-points.md`](connection-points.md) for the detection rule, manager API, and drag-move semantics.

---

## `Project`

**File:** `project/project.ts`

### Construction

The constructor sets `boundsArea` and `hitArea` to the full coordinate range (so the container always receives pointer events regardless of viewport position), then builds the two-level scene hierarchy: `_grid` added directly, `_gridSpace` (with `scale.set(environment.gridSize)`) added second, and the three circuit sub-layers (`_wires`, `_components`, `_floatingLayer`) added inside `_gridSpace`.

### Viewport — `project.viewport` (`ViewportController`)

All camera control lives on the exposed `ViewportController`; `Project` keeps no delegates.

| Member                                         | Description                                                                             |
| ---------------------------------------------- | --------------------------------------------------------------------------------------- |
| `resizeViewport(w, h)`                         | Stores the new viewport size and forwards it to `Grid.resizeViewport`                   |
| `pan(delta)`                                   | Translates by `delta` (canvas-local CSS pixels), calls `setPosition`                    |
| `setPosition(p)`                               | Moves the project, calls `Grid.updatePosition`, emits on `viewportChange$`              |
| `viewportChange$` / `viewportState`            | Full camera state (`gridOrigin`, `scale`, `viewportSize`) for overlays like the minimap |
| `gridPosition`                                 | Computed read-only: the current top-left corner in grid units                           |
| `zoomIn/zoomOut(center?)`                      | Steps the scale by `1.2^±1` around `center` (defaults to viewport center)               |
| `zoom100(center?)` / `zoomBy(factor, center?)` | Reset to scale 1 / continuous pinch zoom (clamped, resyncs the step)                    |

Zoom is implemented as discrete steps clamped to `[-12, +5]`, giving a scale range of approximately `1.2^-12 ≈ 0.112` to `1.2^5 ≈ 2.49`. Pivot-correct zoom is achieved by a matrix chain:

```
translate(-center) → unscale(old) → scale(new) → translate(+center) → apply(position)
```

This ensures the point under the mouse stays stationary. After repositioning, `Grid.updateScale` and `FloatingLayer.updateScale` are called, then `applyScale(scale)` goes to each quad tree, which re-tunes the elements of on-screen entries only and leaves the off-screen ones to the cull pass (see `rendering.md` § Culling). Each zoom method ends by requesting one `'single'` render frame through the callback `Project` hands the controller (pans don't — they only happen inside gestures that already hold the ticker on).

### Circuit mutation

| Method                                          | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `addComponent(c)`                               | Inserts into the `_components` quad tree (`insert` re-tunes the component to the live zoom), fires `connectionPoints.onComponentAdded(...)`, subscribes to `c.portsChange$` so future rotation / input-count changes route through the CP manager, emits `'single'` on `_ticker$`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `removeComponent(id)`                           | Snapshots `connectionPoints` **before** removal, calls `selectionManager.evict(component)`, removes from quad tree, fires `connectionPoints.onComponentRemoved(snapshot)`, unsubscribes from `portsChange$`, destroys                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `addWire(w)`                                    | Inserts into the `_wires` quad tree (`insert` re-tunes the wire to the live zoom), fires `connectionPoints.onWireAdded(Wire.snapshot(w))`, emits `'single'` on `_ticker$`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `removeWire(id)`                                | Snapshots geometry via `Wire.snapshot(wire)` **before** removal, calls `selectionManager.evict(wire)`, removes from quad tree, fires `connectionPoints.onWireRemoved(snapshot)`, destroys                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `moveComponent(id, pos)`                        | Snapshots old `connectionPoints`, mutates position, re-inserts (rebuckets), fires `onComponentRemoved(oldPorts)` + `onComponentAdded(newPorts)`. Called by `MoveComponentsAction.do/undo`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `moveWire(id, pos)`                             | Mirror of `moveComponent` using `Wire.snapshot` for the geometry hooks. Called by `MoveWiresAction.do/undo`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `rotateComponent(id, direction, pos)`           | Rotate analog of `moveComponent`: applies a direction (through `Component.applyDirection`, keeping the direction option in sync) plus the pivot-orbited position, rebuckets, fires the CP hooks. The component is unindexed around the direction write so the `portsChange$` handler's automatic (non-undoable) integration stays out — the rotate action's container replays the wire changes itself. Called by `RotateComponentsAction.do/undo`.                                                                                                                                                                                                                                                                                                                                                                                                            |
| `setWireGeometry(id, pos, direction)`           | Moves a wire and sets its axis in one step (a quarter-turn swaps HORIZONTAL/VERTICAL; the length is rotation-invariant). Called by `RotateWiresAction.do/undo`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `queryComponentsInRange(rect, out?)`            | Array of all components intersecting `rect` (delegates to `_components.queryRange`); a snapshot, so the project may be mutated while iterating it                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `queryWiresInRange(rect, out?)`                 | Array of all wires intersecting `rect` (delegates to `_wires.queryRange`); a snapshot, so the project may be mutated while iterating it                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `hasComponentCollision(bounds, excludeIds?)`    | Returns `true` if any component in the quad tree intersects `bounds`, excluding any whose `id` is in `excludeIds`. Uses `queryComponentsInRange` — no extra check needed because `queryRange` already tests the element's grid bounds. `excludeIds` defaults to an empty set; used by future callers (paste, undo-of-move) where the component being tested is already in the tree. Called by `ComponentPlacementSession` and `SelectionMoveSession` on every `pointermove`.                                                                                                                                                                                                                                                                                                                                                                                  |
| `hasWireBodyCollision(wireBounds, excludeIds?)` | Returns `true` if `wireBounds` intersects the **body** (stub-free AABB) of any component. Does a coarse `queryComponentsInRange` first, then a precise `intersects(comp.bodyGridBounds)` check. A wire endpoint touching a port stub tip correctly returns `false` because the stub-free body starts at the integer grid boundary, and the wire AABB ends exactly at that boundary (strict `>` comparison). Called by `WireToolSession` to show red tint and block commit when a preview wire clips through a component body.                                                                                                                                                                                                                                                                                                                                 |
| `topology` (`WireTopology`)                     | Owns the `WireIntegrator` and the wire tool's connection toggling. `topology.integrate(input)` is a pure read — never mutates project state: takes an `IntegrationInput` describing wires/components being added, removed, or moved, and returns `{ toAdd: Wire[], toRemove: Wire[] }`. Callers materialize the result and record `ActionContainer(RemoveWiresAction, AddWiresAction)` alongside their primary action so the whole gesture — including any splits/merges — undoes atomically. Runs from `WireToolSession.onEnd`, `SelectionMoveSession.onEnd`, `ComponentPlacementSession.onEnd`, and the `portsChange$` subscription (for rotation). `topology.toggleConnectionAt(p)` / `connectionToggleKindAt(p)` implement the wire tool's join/split tap and its hover preview. See [Wire Integration Invariants](wires.md#wire-integration-invariants). |
| `getComponentById(id)` / `getWireById(id)`      | O(1) lookups through id → element maps kept in lock-step with quad-tree membership (drag-detached elements are absent from both). Every action `do`/`undo` resolves elements through these.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `connectionPoints`                              | Getter — returns the `ConnectionPointManager`. Used by `SelectionMoveSession` (drag-follow CP capture/discard/restore) and by tests. See [`connection-points.md`](connection-points.md).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `startPasteSession(components, wires)`          | Emits on `pasteRequest$`; the `WorkModeRouter` opens a `PastePlacementSession`. Called by `ClipboardService.paste()` after deserializing fresh `Component`/`Wire` instances from the clipboard snapshot. The session handles placement, collision checking, and commit.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `requestSelectionRotation(steps)`               | Emits on `rotateRequest$`; the `WorkModeRouter` rotates the active session's floating content or the committed selection (see `rendering.md` § rotate flow). Called by the toolbar and mobile selection-bar rotate buttons; the `R`/`Shift+R` shortcuts reach the router directly.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

`QuadTreeContainer.insert` re-tunes what it files because the project may already be at a non-1 zoom level when an element is inserted (e.g., on undo/redo while zoomed in), and because an element moving between entries can come out of one that lagged behind the live zoom while off-screen.

`evict` is called in `removeComponent`/`removeWire` **before** `destroy()`. This prevents `SelectionManager` from holding a stale reference to a destroyed `Container`.

**Mutation ordering for the CP manager:** every removal path snapshots geometry (`Wire.snapshot` / `component.connectionPoints`) **before** mutating the quad tree, then runs the recompute _after_ the tree reflects the post-state. Symmetric for adds. This ordering is critical — the CP manager queries the quad trees to make its decisions.

### Drag operations

These methods are used exclusively by `SelectionMoveSession` during selection drag-move. They operate directly on the quad trees (and the id → element maps) without going through the action system — the caller is responsible for recording undo actions separately.

| Method                                | Description                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `detachForDrag(components, wires)`    | Removes elements from their quad trees (and id maps). Elements keep their position and visual state; the caller reparents them into `FloatingLayer.dragLayer`. **Does not fire CP hooks** — CPs are intentionally frozen during the drag; `SelectionMoveSession` uses `connectionPoints.captureDragCps` to make termination-point CPs follow the drag. |
| `reattachFromDrag(components, wires)` | Re-inserts elements back into their quad trees at their current positions. Skips `destroyed` elements (defensive guard). **Does not fire CP hooks** — the session calls `connectionPoints.recomputeCpsForMovedSelection` once after reattach.                                                                                                          |

`QuadTreeContainer.insert()` already handles the case where an element is already tracked — it removes then re-inserts. `moveComponent`/`moveWire` (listed in the Circuit mutation table above) take advantage of this: they set the position then call `insert()` unconditionally.

### Reactive outputs

| Observable / Signal              | Type                                    | Description                                                                                          |
| -------------------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `viewport.viewportChange$`       | `Observable<ViewportState>`             | Emits the full camera state on every pan, zoom or resize; consumed by the minimap and the status bar |
| `ticker$`                        | `Observable<'single' \| 'on' \| 'off'>` | Ticker control stream consumed by `BoardComponent` to drive the render ticker                        |
| `pasteRequest$`                  | `Observable<{components, wires}>`       | Paste flow hand-off to the `WorkModeRouter`                                                          |
| `rotateRequest$`                 | `Observable<number>`                    | Selection-rotation hand-off to the `WorkModeRouter` (clockwise quarter-turns)                        |
| `userInput$` / `inspectRequest$` | `Observable<Component>`                 | Simulation-mode taps (button/switch activation, inspection requests)                                 |

---

## `ProjectService`

**File:** `project/project.service.ts`

Angular root-provided singleton. Tracks up to three states using Angular `signal`s exposed as read-only `computed` values:

| Signal           | Type              | Description                                                                                                                                                                     |
| ---------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mainProject`    | `Project \| null` | The top-level project (the user's circuit file). Set once on startup via `setMainProject`. Setting it also sets `activeProject`.                                                |
| `openComponents` | `Project[]`       | Sub-projects opened as component editors. Each custom component the user drills into is a separate `Project` pushed here.                                                       |
| `activeProject`  | `Project \| null` | The project currently shown in the canvas. Defaults to `mainProject`; switches when the user opens a sub-component. Reverts to `mainProject` when that sub-component is closed. |

### Methods

| Method                   | Description                                                                                             |
| ------------------------ | ------------------------------------------------------------------------------------------------------- |
| `setMainProject(p)`      | Sets `mainProject` and `activeProject` to `p`                                                           |
| `addOpenComponent(p)`    | Appends `p` to `openComponents`                                                                         |
| `removeOpenComponent(p)` | Removes `p` from `openComponents`; if `p` was `activeProject`, reverts `activeProject` to `mainProject` |

`AppComponent` reads `projectService.activeProject()` to pass the correct `Project` to `BoardComponent` as an input. `BoardComponent` reacts to input changes via an Angular `effect`.

---

## Integration with the rest of the app

| Consuming layer             | How it uses `Project` / `ProjectService`                                                                                                                                                                                                                                                                    |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AppComponent`              | Creates the initial `Project` in its constructor (`new Project()`), calls `projectService.setMainProject`. Reads `activeProject()` to feed `BoardComponent`.                                                                                                                                                |
| `BoardComponent`            | Receives `Project` as an `input()`. Renders it as the root container each frame. Subscribes to `ticker$` and `positionChange$`. Forwards work-mode signals via `effect`.                                                                                                                                    |
| `WorkModeRouter` + sessions | The router dispatches presses to per-mode tools which open sessions (see `rendering.md`); sessions mutate through `add/remove/move*`, `detachForDrag`/`reattachFromDrag`, `topology.integrate`, and record through `project.actionManager`.                                                                 |
| `ClipboardService`          | Reads `project.selectionManager.selectedComponents`/`selectedWires` to serialize, calls `project.removeComponent`/`removeWire` for delete, calls `project.startPasteSession()` for paste, records via `project.actionManager.register()`/`coalesceTop()` after `project.selectionManager.consumeLiveCut()`. |
| `ActionManager`             | Owned by `Project` as `project.actionManager`. All action `do`/`undo` implementations receive the `Project` and call `addComponent`, `removeComponent`, `addWire`, `removeWire`, `moveComponent`, or `moveWire`.                                                                                            |
| `SelectionManager`          | Owned by `Project` as `project.selectionManager`. `FloatingLayer` calls `commit`, `clear`, `containsPoint`, and reads `selectedComponents`/`selectedWires`. `Project.removeComponent`/`removeWire` call `evict` before destroying elements.                                                                 |
| `Grid`                      | Owned by `Project`. Receives `updatePosition`, `resizeViewport`, and `updateScale` calls.                                                                                                                                                                                                                   |

---

## Lifecycle

```
AppComponent constructor
  └── setStaticDIInjector(injector)      // must happen before any Component/Wire is created
  └── new Project()                      // constructs Grid, FloatingLayer, etc.
  └── projectService.setMainProject(p)

BoardComponent ngOnInit
  └── assetsService.init()               // loads fonts
  └── rendererService.acquire()          // leases the shared renderer (WebGPU preferred)

BoardComponent effect (project input changes)
  └── project.viewport.resizeViewport(w, h)
  └── ticker.update()                    // renders the project to the board canvas
  └── subscribe project.ticker$
  └── subscribe project.viewport.viewportChange$

BoardComponent effect (WorkModeService signals change)
  └── router.setMode(workModeService.mode())
  └── router.componentToPlace = workModeService.selectedComponentConfig()
```

---

## `SelectionManager`

**File:** `project/selection-manager.ts`

Plain TypeScript class. Constructed by `Project`; not an Angular service. Owns the committed selection state that persists across pointer interactions until the user explicitly clears it (mode change, click on empty space), plus the live scissor cut's history reference.

### State

| Field                       | Type                | Purpose                                                                                          |
| --------------------------- | ------------------- | ------------------------------------------------------------------------------------------------ |
| `_selectedComponents`       | `Set<Component>`    | Live references to currently selected components                                                 |
| `_selectedWires`            | `Set<Wire>`         | Live references to currently selected wires                                                      |
| `_selectionChange$`         | `Subject<void>`     | Emits whenever the selection changes                                                             |
| `_selectedConnectionPoints` | `ConnectionPoint[]` | CPs currently wearing the selection highlight (re-derived by `retintCps()`)                      |
| `_cutAction`                | `Action \| null`    | The scissor cut this selection registered in the history (live only while it is still `topDone`) |

### Public API

| Member                      | Description                                                                                                                                                                                                                                                                                                                      |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `commit(rect, mode)`        | Dispatch: zero-area rect → single-click hit test; non-zero rect → rectangle selection. Clears the previous selection first.                                                                                                                                                                                                      |
| `clear()`                   | Sets `selected = false` on every selected element (restoring its normal tint), empties both sets, emits `selectionChange$`.                                                                                                                                                                                                      |
| `evict(element)`            | Called from `Project.removeComponent`/`removeWire` before `destroy()`. Drops the ref without touching the selection flag (the element is about to be destroyed). Emits if present.                                                                                                                                               |
| `containsPoint(gridPoint)`  | Returns `true` if any selected element's `gridBounds` contains the point. Used by `FloatingLayer` to decide whether a `pointerdown` in SELECT mode should start a drag-move of the existing selection or open a new rect drag.                                                                                                   |
| `boundingBox()`             | Union AABB of all selected elements' `gridBounds`. Returns `null` when empty. Used for computing the drag offset at drag start.                                                                                                                                                                                                  |
| `isEmpty`                   | `true` when both sets are empty.                                                                                                                                                                                                                                                                                                 |
| `selectionChange$`          | The subject exposed as `Observable<void>`.                                                                                                                                                                                                                                                                                       |
| `selectedComponents`        | `ReadonlySet<Component>` — live references.                                                                                                                                                                                                                                                                                      |
| `selectedWires`             | `ReadonlySet<Wire>` — live references.                                                                                                                                                                                                                                                                                           |
| `select(components, wires)` | Batch-select: clears the current selection, flags the given elements selected, and emits. Used by `PastePlacementSession.onEnd()` to select the freshly pasted elements. Skips destroyed elements silently.                                                                                                                      |
| `hasLiveCut`                | Whether this selection's scissor cut is still committable: it exists and is the newest history entry (`ActionManager.topDone`). Lazily validated — an undo that popped the cut silently ends its live phase.                                                                                                                     |
| `consumeLiveCut()`          | Hands the live cut's history entry over to the move/delete that commits it — the caller coalesces it with its own action (`ActionManager.coalesceTop`) into one undo step. Returns `null` when no cut is live. Called by `SelectionMoveSession.onEnd()` and `ClipboardService._applyDelete()`. See `wires.md` § _Cut lifecycle_. |

### `commit` behavior

**Rectangle drag** (`rect.width > 0 || rect.height > 0`):

1. Calls `clear()` to drop the old selection.
2. Queries `project.queryComponentsInRange(rect)` and flags every result `selected` (each element derives its own theme-keyed highlight tint from the flag) — both modes use the same touching rule for components.
3. **`SELECT` mode**: Queries `project.queryWiresInRange(rect)` and flags every result selected.
4. **`SELECT_EXACT` mode** (scissor select): For each wire returned by `queryWiresInRange(rect)`, calls `cutWire(wire, rect)` (see `wires.md` § _Wire Scissor Cutting_). The result is one of `{kind: 'skip'}` (centerline outside rect — do not select), `{kind: 'keep'}` (no cut needed — select as-is), or `{kind: 'cut', pieces, insideIndex}`. For `cut` results, the manager calls `project.removeWire` on the originals and `project.addWire` on each new piece directly, then **registers** the cut (`ActionContainer(RemoveWiresAction, AddWiresAction)`) as its own history entry and remembers it in `_cutAction`. The inside pieces are flagged selected and added to the selection set by ID. A move or delete that follows consumes the cut and coalesces it with its own action (one Ctrl+Z for cut + move); cancelling the selection retracts the entry (originals restored, no history trace); any unrelated action dissolves the selection first. See `wires.md` § _Cut lifecycle_.
5. Emits `selectionChange$` once at the end.

**Single click** (`rect.width === 0 && rect.height === 0`):

1. Calls `clear()`.
2. Builds a 1×1 grid-unit query rect centered on the click point to work around a PixiJS `Rectangle.intersects()` limitation with zero-area rects.
3. Queries both trees; post-filters with `gridBounds.contains(px, py)` to remove false positives.
4. Tie-breaks when both a component and a wire match: the one with the smaller `gridBounds` area wins (more precisely-aimed target).
5. Tints and adds the winner (if any); emits. Empty result = "click on empty space" = selection cleared.

### Destroyed-element guards

`clear()`, `containsPoint()`, and `boundingBox()` all skip elements where `element.destroyed === true`. This is a defensive guard for the edge case where an element is destroyed via a path other than `Project.removeComponent`/`removeWire` (which always call `evict` first).

---

## Type Hierarchy

```
PixiJS Container
└── Project

SelectionManager  (plain class, owned by Project)
```
